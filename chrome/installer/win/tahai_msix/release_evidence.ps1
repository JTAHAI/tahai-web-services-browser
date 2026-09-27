# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# These functions verify recorded local release evidence. They do not build,
# launch, install, certify, or submit the browser.

function Test-TahaiJsonInteger {
    param($Value)
    # Windows PowerShell and newer PowerShell choose different integer widths
    # for JSON numbers. Neither strings, booleans nor floating point are valid.
    return $Value -is [int] -or $Value -is [long]
}

function Assert-TahaiTestSummary {
    param($Summary, [string[]]$RequiredTests, [string]$Suite,
          [string[]]$RequiredPatterns = @())

    Set-StrictMode -Version Latest
    $iterations = @($Summary.per_iteration_data)
    if ($iterations.Count -eq 0 -or $RequiredTests.Count -eq 0) {
        throw "$Suite has no test iterations or required test selection."
    }
    foreach ($pattern in $RequiredPatterns) {
        $discovered = @($Summary.all_tests | Where-Object { $_ -clike $pattern })
        if ($discovered.Count -eq 0) {
            throw "$Suite discovered no tests for required scope: $pattern"
        }
        $RequiredTests += $discovered
    }
    $count = 0
    foreach ($iteration in $iterations) {
        if ($null -eq $iteration) { throw "$Suite has an empty iteration." }
        $names = @($iteration.PSObject.Properties.Name)
        if ($names.Count -eq 0) { throw "$Suite ran zero tests." }
        foreach ($name in $names) {
            $attempts = @($iteration.PSObject.Properties[$name].Value)
            if ($attempts.Count -eq 0) { throw "$Suite did not run $name." }
            foreach ($attempt in $attempts) {
                if ($null -eq $attempt -or $attempt.status -cne 'SUCCESS') {
                    throw "$Suite contains a non-passing attempt: $name. Retries do not erase failures."
                }
                $count++
            }
        }
        foreach ($required in $RequiredTests) {
            if ($names -ccontains $required) { continue }

            # Chromium's launcher executes PRE_ setup tests as part of the
            # corresponding main test, but omits those setup names from
            # per_iteration_data even though they remain in all_tests and the
            # console run. A passing main result therefore proves its PRE_
            # chain completed. Keep requiring both discovery and the main
            # result so a filtered-out setup or main test still fails closed.
            $isPreTest = $required -cmatch '^(?<suite>[^.]+)\.PRE_(?<test>.+)$'
            $mainTest = if ($isPreTest) {
                $Matches.suite + '.' + $Matches.test
            } else { '' }
            if (-not $isPreTest -or
                @($Summary.all_tests) -cnotcontains $required -or
                $names -cnotcontains $mainTest) {
                throw "$Suite is missing required regression: $required"
            }
        }
    }
    return $count
}

function Read-TahaiEvidenceJson {
    param([string]$Path)
    $file = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($file.PSIsContainer -or $file.Length -le 0 -or $file.Length -gt 64MB) {
        throw "Evidence must be a nonempty JSON file of at most 64 MiB: $Path"
    }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Assert-TahaiEvidenceFile {
    param([string]$Root, $Record, [long]$NotBeforeUnixMs)
    # Reports must be siblings of the evidence manifest. Never resolve supplied
    # absolute paths, alternate data streams, or traversal outside the run.
    if ($Record.file -cnotmatch '^[A-Za-z0-9][A-Za-z0-9_.-]*$' -or
        $Record.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'Invalid evidence filename or SHA-256.'
    }
    $path = Join-Path $Root $Record.file
    $file = Get-Item -LiteralPath $path -ErrorAction Stop
    if ($file.PSIsContainer -or
        ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $file.Length -le 0) {
        throw "Evidence is not a regular nonempty file: $path"
    }
    $written = ([DateTimeOffset]$file.LastWriteTimeUtc).ToUnixTimeMilliseconds()
    if ($written -lt $NotBeforeUnixMs -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Record.sha256) {
        throw "Evidence is stale or its SHA-256 changed: $path"
    }
    return $path
}

function Assert-TahaiReleaseEvidence {
    param([string]$EvidencePath, [string]$BuildDir)

    Set-StrictMode -Version Latest
    $evidence = Read-TahaiEvidenceJson $EvidencePath
    if (-not (Test-TahaiJsonInteger $evidence.schemaVersion) -or $evidence.schemaVersion -ne 1 -or
        -not (Test-TahaiJsonInteger $evidence.buildExitCode) -or $evidence.buildExitCode -ne 0) {
        throw 'A successful build with version-1 release evidence is required.'
    }
    $started = [long]$evidence.buildStartedUnixMs
    $finished = [long]$evidence.buildFinishedUnixMs
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if (-not (Test-TahaiJsonInteger $evidence.buildStartedUnixMs) -or
        -not (Test-TahaiJsonInteger $evidence.buildFinishedUnixMs) -or
        $started -le 0 -or $finished -le $started -or $finished -gt $now) {
        throw 'Invalid build evidence timestamps.'
    }
    $requiredArtifacts = @('chrome.exe', 'chrome.dll',
        'tahai_mission_service_tests.exe', 'browser_tests.exe')
    if (@($evidence.artifacts).Count -ne $requiredArtifacts.Count) {
        throw 'Release evidence must bind all four required native binaries.'
    }
    foreach ($name in $requiredArtifacts) {
        $records = @($evidence.artifacts | Where-Object { $_.name -ceq $name })
        if ($records.Count -ne 1 -or $records[0].sha256 -notmatch '^[a-fA-F0-9]{64}$') {
            throw "Missing or duplicate binary evidence: $name"
        }
        $file = Get-Item -LiteralPath (Join-Path $BuildDir $name) -ErrorAction Stop
        $written = ([DateTimeOffset]$file.LastWriteTimeUtc).ToUnixTimeMilliseconds()
        if ($file.PSIsContainer -or $file.Length -le 0 -or
            ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            -not (Test-TahaiJsonInteger $records[0].bytes) -or
            $file.Length -ne $records[0].bytes -or
            $written -lt $started -or $written -gt $finished -or
            (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $records[0].sha256) {
            throw "Native binary is stale or changed since validation: $name"
        }
    }
    $root = Split-Path -Parent (Resolve-Path -LiteralPath $EvidencePath).Path
    # Source is captured before compilation, so it is not subject to the
    # post-build timestamp gate used for runtime results. Its content is hashed
    # and packaging separately compares it with the complete current tree.
    $sourcePath = Assert-TahaiEvidenceFile $root $evidence.sourceProvenance 0
    $source = Read-TahaiEvidenceJson $sourcePath
    if ($source.schemaVersion -ne 1 -or
        $source.identity.head -cnotmatch '^[a-f0-9]{40}$' -or
        $source.identitySha256 -cnotmatch '^[a-f0-9]{64}$' -or
        $source.identity.buildArgsSha256 -ne (Get-FileHash -LiteralPath (Join-Path $BuildDir 'args.gn') -Algorithm SHA256).Hash) {
        throw 'Source identity or build configuration does not match the candidate.'
    }
    $null = Assert-TahaiEvidenceFile $root $source.sourceSnapshot 0
    $testResultPath = Assert-TahaiEvidenceFile $root $evidence.testResults $finished
    $testResults = Read-TahaiEvidenceJson $testResultPath
    if (-not (Test-TahaiJsonInteger $testResults.nativeExitCode) -or $testResults.nativeExitCode -ne 0 -or
        -not (Test-TahaiJsonInteger $testResults.browserExitCode) -or $testResults.browserExitCode -ne 0 -or
        [string]::IsNullOrWhiteSpace($testResults.isolatedTestSession)) {
        throw 'Actual successful isolated test process results are required.'
    }
    $buildLog = Assert-TahaiEvidenceFile $root $evidence.buildLog $started
    if (Select-String -LiteralPath $buildLog -Pattern '^FAILED:|^ninja: (build stopped:|error:)' -Quiet) {
        throw 'The recorded native build log contains a failure.'
    }
    if (-not (Test-TahaiJsonInteger $evidence.nativeTests.exitCode) -or $evidence.nativeTests.exitCode -ne 0 -or
        -not (Test-TahaiJsonInteger $evidence.browserTests.exitCode) -or $evidence.browserTests.exitCode -ne 0) {
        throw 'Both focused test processes must exit successfully.'
    }
    $nativePath = Assert-TahaiEvidenceFile $root $evidence.nativeTests $finished
    $browserPath = Assert-TahaiEvidenceFile $root $evidence.browserTests $finished
    $nativeCount = Assert-TahaiTestSummary (Read-TahaiEvidenceJson $nativePath) @(
        'TahaiWorkflowJournalTest.IntentSurvivesReopenAndCannotReplay',
        'TahaiSkinStudioDraftTest.CanonicalGrowthCannotReplaceLastReloadableDraft',
        'TahaiCapabilityBrokerTest.ExactOriginRevisionAndOperationAreRequired',
        'TahaiCapabilityBrokerTest.SameOriginNavigationExpiresCapturedDocument',
        'TahaiCapabilityBrokerTest.RejectsPrivateForeignAndManagedProfiles',
        'TahaiCapabilityBrokerTest.PreservesMalformedStateAndDeniesGrants',
        'TahaiCapabilityBrokerTest.RevokingProviderRemovesEveryRevision',
        'TahaiCapabilityBrokerTest.DisabledSkinsStillAllowReviewAndRevocation',
        'TahaiSkinStudioDraftTest.OversizedStoredDraftFallbackNeverOverwritesOriginalBytes',
        'TahaiSkinStudioDraftTest.JsonDiagnosticsNeverEchoRejectedSource',
        'TahaiSkinStudioDraftTest.ManifestDiagnosticsIdentifyBoundedSections',
        'TahaiWorkflowJournalTest.RejectedAttemptCannotBeRetried',
        'TahaiWorkflowJournalTest.KeysAreBoundedAndSeparateRunsRevisionsAndSteps',
        'TahaiWorkflowJournalTest.CorruptFileIsPreservedWithoutDispatch',
        'TahaiWorkflowJournalTest.FutureVersionIsPreservedAndNotExecuted',
        'TahaiWorkflowJournalTest.QuotaCannotDiscardOldAttemptToAllowReplay',
        'TahaiWorkflowJournalTest.UnexpectedSchemaCannotAcknowledgeUnpersistedIntent',
        'TahaiWorkflowJournalTest.BlockedRollbackJournalCannotAuthorizeOrEraseAttempts',
        'TahaiWorkflowJournalTest.ExclusiveWriterCannotAuthorizeOrEraseAttempts',
        'TahaiWorkflowJournalTest.AbruptWriterExitRollsBackWithoutReplay',
        'TahaiOperationalSkinManifestTest.NamedOutputsAreBoundedBindingsWithoutValuesOrPrivacyOverrides',
        'TahaiOperationalSkinManifestTest.CompensationChecklistsAreBoundedManualAndRoundTrip',
        'TahaiOperationalSkinManifestTest.TypedVariablesAndAssignmentsRejectPrivacyDowngradesAndMalformedBindings',
        'TahaiOperationalSkinManifestTest.NumericExpressionsAreClosedBoundedAndRejectProtectedReferences',
        'TahaiOperationalSkinManifestTest.NumericConditionsAreClosedTypedAndExcludeProtectedInputs',
        'TahaiOperationalSkinManifestTest.NumericComparisonsCoverEveryBoundaryWithoutCoercion',
        'MissionServiceTest.NumericBranchesRequireAnswersAndPreserveSkippedHistoryAcrossRestart',
        'MissionServiceTest.NumericBranchesRejectPrivateMixedAndMalformedPersistedDefinitions',
        'MissionServiceTest.SkippedBranchesLockWhenLaterAssignmentsWaitsOrNativeAttemptsStart',
        'TahaiWorkflowNativeTest.NumericBranchDefinitionAndAnswerAreRecheckedBeforeNativeDispatch',
        'TahaiOperationalSkinManifestTest.VariableConditionsUseExplicitNamespacesAndNeverAdmitRunDecisions',
        'MissionServiceTest.VariableBranchesFreezeBeforeMutationAndRecoverWithoutReevaluatingHistory',
        'MissionServiceTest.VariableBranchesRejectMalformedDecisionsAndPrivateOrLegacyBindings',
        'MissionServiceTest.VariableBranchSuccessRequiresRecordedTrailingDecisions',
        'MissionServiceTest.VariableBranchesRecordDecisionsBeforeWaitsAndNativeAttempts',
        'MissionServiceTest.TypedVariableDecisionsPrecedeSelfAssignmentAndCannotBeReopenedIntoAnotherBranch',
        'TahaiWorkflowNativeTest.VariableBranchNamespaceAndRecordedDecisionAreCheckedBeforeDispatch',
        'TahaiOperationalSkinManifestTest.CompoundPredicatesAreClosedBoundedAndValidateEveryReference',
        'TahaiOperationalSkinManifestTest.CompoundEvaluationNeverShortCircuitsUnknownValuesIntoAuthority',
        'MissionServiceTest.CompoundBranchesRequireAllSourcesAndRetainRecordedHistoryAcrossRestart',
        'MissionServiceTest.CompoundPredicatesFailClosedOnMixedPrivateMalformedAndUnrecordedState',
        'TahaiWorkflowNativeTest.CompoundPredicateDefinitionsAndPendingDecisionsArePinnedBeforeDispatch',
        'TahaiOperationalSkinManifestTest.BoundedRepeatsExpandDistinctStepsWithoutChangingAuthoredDefinitions',
        'TahaiOperationalSkinManifestTest.BoundedRepeatsRejectOverlapCollisionsCoercionAndExpansionOverflow',
        'MissionServiceTest.BoundedRepeatsCarryVariablesAndRecoverIndependentIterationDecisions',
        'MissionWaitTest.BoundedRepeatsRejectInvalidHandoffsAndKeepWaitBudgetsSeparate',
        'TahaiWorkflowNativeTest.BoundedRepeatActionsPinEveryIterationAndCannotReuseCompletedAttempts',
        'TahaiOperationalSkinManifestTest.ProtectedVariableBindingsAreMonotonicAndExcludeConditionsCalculationsAndRunData',
        'MissionServiceTest.ProtectedVariablesEncryptRebindAndRecoverWithoutPlaintextOrReplay',
        'MissionServiceTest.ProtectedVariableFailuresPreserveCiphertextTokensAndProgress',
        'MissionServiceTest.ProtectedVariableContextTamperingAndPlaintextPreferencesFailClosed',
        'MissionServiceTest.ProtectedVariablesPreserveAllTypedValuesAndRejectManagedWrites',
        'MissionServiceTest.ProtectedVariableRepeatIterationsSeparateInputNamespaceAndNeverReplay',
        'TahaiWorkflowNativeTest.ProtectedVariablePrivacyIsPinnedBeforeNativeDispatch',
        'TahaiOperationalSkinManifestTest.TextExpressionsAreClosedBoundedTypedAndExcludeProtectedSources',
        'TahaiOperationalSkinManifestTest.BooleanAssignmentsAreBoundedTypedAndExcludeProtectedSources',
        'MissionServiceTest.BooleanAssignmentsFailClosedPersistFalseAndNeverReplay',
        'MissionServiceTest.TerminalRecoveryReviewPersistsWithoutResumingOrChangingRunProgress',
        'MissionServiceTest.AuthoredCompensationIsManualTerminalOnlyAndPersists',
        'MissionServiceTest.CancelledRecoveryWaitsForNativeOutcomeAndNeverReplaysIt',
        'MissionWaitTest.RecoveryReviewRequiresFreshStateAfterDeadlineSettlement',
        'TahaiWorkflowNativeTest.BooleanAssignmentsRemainExactlyRevisionPinnedBeforeNativeDispatch',
        'TahaiOperationalSkinManifestTest.TextExpressionEvaluationUsesLiteralBoundedUnicodeAndFixedErrors',
        'MissionServiceTest.TextExpressionsPersistExactDefinitionsAndNeverReplayOrExportValues',
        'MissionServiceTest.TextExpressionFailuresPreservePriorValueProgressAndMalformedPreferences',
        'TahaiWorkflowNativeTest.TextExpressionsRemainExactlyRevisionPinnedBeforeNativeDispatch',
        'MissionServiceTest.ManagedAndShutdownMissionsRejectChecklistAndRunStateChanges',
        'MissionServiceTest.ManagedAndShutdownMissionsRejectMetadataCreationAndOrdinaryInputWrites',
        'MissionServiceTest.CapsuleKeyLeasesRecheckAfterProviderAndPreserveManagedStorage',
        'MissionServiceTest.CapsuleKeyQueueIsBoundedAndRevokedRequestsNeverGenerateKeys',
        'TahaiOperationalSkinManifestTest.ActionStatusBindingsAreTypedPrecedingAndIterationScoped',
        'MissionServiceTest.ActionStatusBindingsPersistWithoutReplayAndRejectForgedSources',
        'MissionServiceTest.ActionStatusBindingsRespectEachIterationAndTargetConstraints',
        'TahaiWorkflowNativeTest.ActionStatusBindingsAreExactlyPinnedBeforeAnyDispatch',
        'TahaiOperationalSkinManifestTest.NumericEvaluatorEnforcesEveryIntermediateAndDecimalResultBudget',
        'MissionServiceTest.CalculationsRequireExplicitOrderAndPersistWithoutReplayOrExportValues',
        'MissionServiceTest.CalculationFailuresPreserveValuesTokensAndPreferencesAndMalformedRestoreIsInert',
        'TahaiWorkflowNativeTest.CalculationDefinitionsMustMatchExactlyBeforeNativeDispatch',
        'MissionServiceTest.VariablesAssignExplicitlyPersistWithoutReplayAndStayOutOfExports',
        'MissionServiceTest.VariableAssignmentsEnforceLimitsConditionsLifecycleAndExplicitClear',
        'MissionServiceTest.MalformedVariablesAndProtectedAssignmentsFailClosedOnCreateQueueAndRestore',
        'TahaiWorkflowNativeTest.VariableDefinitionsAndAssignmentsMustMatchBeforeNativeDispatch',
        'TahaiOperationalSkinManifestTest.TimedWaitsAreBoundedDefinitionsWithoutClockStateOrActions',
        'MissionWaitTest.WaitRequiresOrderedExplicitStartAndElapsedExplicitCompletion',
        'MissionWaitTest.PauseInputLossAndShutdownFreezeRemainingTimeWithoutAutoResume',
        'MissionWaitTest.AbruptRestartUsesSavedProgressOnlyAndNeverReplaysWait',
        'MissionWaitTest.WaitRejectsManagedPrivateLegacyAndTerminalActions',
        'MissionWaitTest.MalformedWaitDefinitionsAndSavedClocksFailClosed',
        'TahaiWorkflowNativeTest.WaitDefinitionAndCompletionMustMatchBeforeNativeDispatch',
        'TahaiOperationalSkinManifestTest.WaitDeadlinesRequireBoundedLaterWholeSeconds',
        'MissionWaitTest.DeadlineExpiresWithoutRendererAndPersistsFailureWithoutReplay',
        'MissionWaitTest.CompletionDisarmsDeadlineAndPauseFreezesBothBudgets',
        'MissionWaitTest.DeadlinesScheduleAcrossRunsAndStopOnInputLossArchiveOrCancel',
        'MissionWaitTest.DeadlineRecoveryRetainsSavedBudgetWithoutOfflineExpiryOrAutoResume',
        'MissionWaitTest.ExpiredDeadlineCannotBeBypassedBeforeTimerDelivery',
        'MissionWaitTest.MalformedDeadlineSnapshotsAndManagedTimerWritesFailClosed',
        'TahaiWorkflowNativeTest.WaitDeadlineCannotBeChangedOrRemovedBeforeNativeDispatch',
        'TahaiWorkflowNativeTest.RejectedAndUnknownOutcomesFailRunWithoutReplayOrOutputs',
        'TahaiWorkflowNativeTest.LateFailurePreservesCancellationAndClosesPausedOrArchivedRun',
        'TahaiWorkflowNativeTest.SavedNativeFailuresCloseWithoutRewritingPreferencesOrFalseSuccess',
        'TahaiWorkflowNativeTest.ManagedPolicyDuringNativeCompletionCannotRewriteUserStorage',
        'TahaiWorkflowNativeTest.NativeDeadlineExpiresWithoutRendererAndSurvivesRestart',
        'TahaiWorkflowNativeTest.NativeDeadlineCannotBeBypassedBeforeTimerDeliveryOrWithInvalidClock',
        'TahaiWorkflowNativeTest.NativeCompletionDisarmsDeadlineAndLateResultsCannotOverwriteOutcome',
        'TahaiWorkflowNativeTest.NativeDeadlineContinuesAcrossPauseCancelArchiveAndOtherRuns',
        'TahaiWorkflowNativeTest.NativeDeadlineCannotBlessLateManagedResultOrResumeAfterShutdown',
        'TahaiWorkflowNativeTest.SharedDeadlineTimerKeepsNativeAndAuthoredWaitBudgetsIndependent',
        'TahaiWorkflowNativeTest.PersistedNativeClocksAndMalformedDeadlineErrorsAreInert',
        'MissionServiceTest.NamedOutputsResolveOnlyAfterSuccessAndRetainTheirOwnRun',
        'MissionServiceTest.NamedProtectedOutputsNeverReturnPlaintextOrCiphertext',
        'MissionServiceTest.InvalidOutputBindingsFailClosedOnCreateQueueAndRestore',
        'TahaiWorkflowNativeTest.NamedOutputBindingsMustMatchTheTrustedRevision',
        'TahaiOperationalSkinManifestTest.InputValidationRulesAreClosedTypedAndBounded',
        'TahaiOperationalSkinManifestTest.InputValidationMatchesUtf8BytesAndInclusiveNumbers',
        'MissionServiceTest.InputValidationSurvivesQueueRestartAndRejectsWithoutMutation',
        'MissionServiceTest.InvalidStoredValidationNeverSilentlyDropsRequiredGate',
        'MissionServiceTest.ProtectedValidationRejectsBeforeEncryptionAndBindsCiphertext',
        'TahaiWorkflowNativeTest.ValidationRulesCannotBeChangedRemovedOrBypassedAtDispatch',
        'MissionServiceTest.WorkspaceRailStatesAreFiniteAndPersistPerMode',
        'MissionServiceTest.SkinPathsRejectWindowsDeviceAndTrailingDotAliases',
        'MissionServiceTest.SkinPackageExactRatioAndPurposeCannotBypassLimits',
        'TahaiSkinStoreTest.AtomicUpdateRetainsOneRevisionAcrossRestart',
        'TahaiSkinStoreTest.OperationalPackagesUseTheExistingBoundedStoreAndRollback',
        'TahaiSkinStoreTest.UnexpectedSchemaCannotDiscardRollbackOrAcknowledgeUpdate',
        'TahaiSkinStoreTest.DiskFullUpdatePreservesCurrentAndRollbackAfterReopen',
        'TahaiSkinStoreTest.DiskFullRemovalPreservesCurrentAndRollbackAfterReopen',
        'TahaiSkinStoreTest.RemovalRequiresReviewedRevisionAndStaysProfileLocal',
        'TahaiSkinStoreTest.InvalidInputCannotReplaceExistingData',
        'TahaiSkinStoreTest.QuotasRejectWithoutEvictingPackagesOrRollback',
        'TahaiSkinStoreTest.UnknownVersionAndCorruptionAreNeverRazed',
        'MissionServiceTest.WorkspaceRailMigratesLegacyBooleanAndRejectsBadState',
        'MissionServiceTest.WorkspaceRailPreferencesDoNotCrossProfiles',
        'MissionServiceTest.LocalOiManagedPolicyOverridesProfileSetting',
        'MissionServiceTest.LocalOiDisabledBlocksDirectWritesAndFindingActions',
        'MissionServiceTest.LocalOiReportPolicyAlsoBlocksDirectLedgerWrites',
        'MissionServiceTest.NetworkInspectorRequiresConnectionTimePublicAddressCheck',
        'MissionServiceTest.NetworkInspectionGuidanceReportsConnectionTimeBlock',
        'MissionServiceTest.ModeConfigurationNoopDoesNotPersistOrNotify',
        'MissionServiceTest.TahaiGridRatiosAreFiniteAndBounded',
        'MissionServiceTest.TahaiGridSessionTrailerRoundTripsAndReadsLegacy',
        'MissionServiceTest.TahaiGridSessionTrailerRejectsCorruptionAtomically',
        'MissionServiceTest.TahaiNamedWorkspaceCodecPreservesLayoutsAndGroups',
        'MissionServiceTest.TahaiNamedWorkspaceRejectsUnsafeUrlsAndPartitions',
        'MissionServiceTest.TahaiNamedWorkspaceOperationsReadLatestProfileState',
        'MissionServiceTest.TahaiNamedWorkspaceLimitsAndCorruptionPreserveData',
        'MissionServiceTest.TahaiNamedWorkspacePrivateAndManagedPolicyBoundaries'
    ) 'TAHAI native tests' @('*')
    $browserCount = Assert-TahaiTestSummary (Read-TahaiEvidenceJson $browserPath) @(
        'TahaiPolicyPrefsTest.TahaiAllEnterprisePoliciesMapToManagedPreferences',
        'TahaiWebUIBrowserTest.TahaiRailHasOnlyIconsLabelsOrHidden',
        'TahaiWebUIBrowserTest.TahaiCollapsedRailActivatesAndRestoresPreferences',
        'TahaiLocalOiBrowserTest.TrustedLocalOiWebUiRendersRealLocalSurfaces',
        'TahaiLocalOiBrowserTest.OffTheRecordSurfaceDoesNotReadRegularLocalOiData',
        'TahaiLocalOiBrowserTest.LocalOiStorePersistsOnlyProfileLocalTypedRecord',
        'TahaiLocalOiBrowserTest.InspectionLoaderBlocksLocalConnectionEndpoint',
        'TahaiWebUIBrowserTest.TahaiModeChangesOnlyRelayoutAffectedWindows',
        'MultiContentsViewBrowserTest.TahaiGridGeometryNeverOverlapsAtTinySizes',
        'MultiContentsViewBrowserTest.TahaiQuadReorderAndExitPreserveActiveContents',
        'MultiContentsViewBrowserTest.TahaiGridDividersResizeResetAndKeepTabs',
        'MultiContentsViewBrowserTest.TahaiGridResizeCannotCrossTabSetsOrFocusMode',
        'MultiContentsViewBrowserTest.TahaiGridCaptureLossAndOrientationKeepRatios',
        'SessionRestoreTest.TahaiGridRatiosSurviveBrowserRestart',
        'MultiContentsViewBrowserTest.TahaiLayoutFailureRetainsOriginalSplit',
        'MultiContentsViewBrowserTest.TahaiLayoutFailurePreservesChangedCreatedPane',
        'MultiContentsViewBrowserTest.TahaiLayoutRejectsExistingAndForeignCreationResults',
        'MultiContentsViewBrowserTest.TahaiLayoutShrinkKeepsExistingSiblingPanes',
        'MultiContentsViewBrowserTest.TahaiNamedWorkspaceRestoresIntoIndependentWindow',
        'MultiContentsViewBrowserTest.TahaiNamedWorkspaceDoesNotCrossPrivateProfiles',
        'MultiContentsViewBrowserTest.TahaiNamedWorkspaceNativeManagerSavesFromButton',
        'SessionRestoreTest.PRE_TahaiNamedWorkspaceSurvivesProcessRestart',
        'SessionRestoreTest.TahaiNamedWorkspaceSurvivesProcessRestart',
        'TahaiGuardRequestBrowserTest.TahaiDocumentPauseCannotLeakToSameOriginTabOrWorker',
        'TahaiGuardRequestBrowserTest.TahaiDocumentPauseCoversOwnedOrdinarySubframes',
        'TahaiGuardRequestBrowserTest.TahaiDocumentPauseExpiresOnReloadNavigationAndBack',
        'TahaiGuardRequestBrowserTest.TahaiPrivateDocumentPauseCannotPersistOrCrossProfile',
        'TahaiGuardRequestBrowserTest.TahaiQueuedPauseIsAbortedAfterResumeOrSettingsChange',
        'TahaiGuardRequestBrowserTest.TahaiManagedPolicyRevokesPageRecovery',
        'TahaiGuardRequestBrowserTest.TahaiNativeGuardControllerRejectsStaleDualPaneActions',
        'TahaiGuardRequestBrowserTest.TahaiNativeGuardSiteExceptionPreservesExactOriginScope',
        'TahaiGuardRequestBrowserTest.TahaiNativeGuardMenuAllModesAndButtonRecovery',
        'TahaiGuardRequestBrowserTest.TahaiRendererLossRevokesDocumentPauseAndPanel',
        'TahaiGuardRequestBrowserTest.TahaiNativeGuardPrivateAndManagedButtonsStayLocked',
        'TahaiGuardEngineBrowserTest.TahaiNetworkRulesAndExceptions',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxDecodesPngAndWebpWithoutExtraction',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxRejectsLiteralPathAliases',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxRejectsLinksEncryptionAndUnicodeAliases',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxRejectsDuplicateAndUnexpectedMembers',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxChecksExactRatioSizeCrcAndHash',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxBoundsActualDeflateExtraction',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxRejectsUntrustedManifestAuthority',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxRejectsInvalidAnimatedAndOversizedImages',
        'TahaiSkinDecoderBrowserTest.TahaiSkinSandboxBoundsAggregateDecodedPixels',
        'TahaiSkinDecoderBrowserTest.TahaiSkinOwnerRejectsIncompatiblePackages',
        'TahaiSkinDecoderBrowserTest.TahaiSkinOwnerRejectsMalformedUtilityResponses',
        'TahaiSkinDecoderBrowserTest.TahaiSkinOwnerCopiesPixelsAndIsSingleUse',
        'TahaiSkinDecoderBrowserTest.TahaiSkinOwnerCancellationAndDisconnectCannotPublish',
        'TahaiSkinDecoderBrowserTest.TahaiSkinOwnerTimeoutAndInputBoundsFailClosed',
        'TahaiSkinProfileBrowserTest.TahaiSkinInstallUpdateRollbackAndRestart',
        'TahaiSkinProfileBrowserTest.TahaiLocalPublisherStartupCannotSurviveRevokedGeneration',
        'TahaiSkinManagerBrowserTest.PRE_TahaiLocalPublisherRevocationSurvivesProcessRestart',
        'TahaiSkinManagerBrowserTest.TahaiLocalPublisherRevocationSurvivesProcessRestart',
        'TahaiSkinProfileBrowserTest.TahaiLocalPublisherEnrollmentIsExplicitPersistentAndRevocable',
        'TahaiSkinProfileBrowserTest.TahaiLocalPublisherPolicyOverridesAndStaleReviewNeverFallsBack',
        'TahaiSkinProfileBrowserTest.TahaiLocalPublisherBoundsAndCorruptionFailClosed',
        'TahaiSkinManagerBrowserTest.PRE_TahaiLocalPublisherTrustSurvivesProcessRestart',
        'TahaiSkinManagerBrowserTest.TahaiLocalPublisherTrustSurvivesProcessRestart',
        'TahaiSkinManagerBrowserTest.TahaiNativeLocalPublisherRequiresConfirmationAndSupportsRevocation',
        'TahaiSkinRevisionDiffTest.ExactValuesOrderingTypesAndAbsentAreVisible',
        'TahaiSkinRevisionDiffTest.AddedAndRemovedTreesDoNotHideProtectedFlags',
        'TahaiSkinRevisionDiffTest.LimitsFailWithoutPartialReview',
        'TahaiSkinProfileBrowserTest.TahaiRevisionReviewRequiresExactAcknowledgementAndRollback',
        'TahaiSkinProfileBrowserTest.TahaiRevisionReviewRejectsSupersededCandidateAndForgedCachedManifest',
        'TahaiOperationalModeBrowserTest.TahaiRevisionReviewReportsCapabilitiesDefinitionsAndPolicyRevocation',
        'TahaiOperationalModeBrowserTest.TahaiRevisionReviewExposesKeyRotationAndHistoricalRevocation',
        'TahaiSkinManagerBrowserTest.TahaiNativeRevisionReviewRequiresCheckboxAndConfirmation',
        'TahaiOperationalModeBrowserTest.TahaiPublisherReviewBindsKeyFingerprintAndRevokesWithPolicy',
        'TahaiOperationalModeBrowserTest.TahaiNativeTrustReviewShowsCapabilitiesAndClearsOnRevocation',
        'TahaiWebUIBrowserTest.TahaiMissionProtectedInputIsMaskedStoredEncryptedAndExplicitlyCleared',
        'TahaiWebUIBrowserTest.TahaiMissionInputLimitsAreExplainedAndEnforcedByNativeService',
        'TahaiWebUIBrowserTest.TahaiMissionNamedOutputsRequireSuccessStayLocalAndMaskProtectedValues',
        'TahaiWebUIBrowserTest.TahaiSkinStudioNamedOutputsPersistWithoutSimulatedValues',
        'TahaiWebUIBrowserTest.TahaiSkinStudioSavesOnlyValidatedDraftSource',
        'TahaiWebUIBrowserTest.TahaiSkinStudioPrivateSurfaceNeverReadsRegularDraft',
        'TahaiWebUIBrowserTest.TahaiSkinStudioWorkflowOutlineTracksInspectorWithoutMutatingDraft',
        'TahaiWebUIBrowserTest.TahaiSkinStudioLocalStartersPersistWithoutAuthorityOrBindingChanges',
        'TahaiWebUIBrowserTest.TahaiSkinStudioUndoRespectsTextFieldsAndRestoresSource',
        'TahaiWebUIBrowserTest.TahaiSkinStudioDiagnosticsStayBoundToSubmittedSource',
        'TahaiWebUIBrowserTest.TahaiCapabilityReviewRevokesWhileDisabledAndHidesPrivateState',
        'TahaiWebUIBrowserTest.TahaiCapabilityReviewRejectsUnreviewedAndGesturelessRevocation',
        'TahaiWebUIBrowserTest.TahaiSkinStudioVariablesAssignmentsAndResultsPersistWithoutSimulationData',
        'TahaiWebUIBrowserTest.TahaiSkinStudioCalculationsPersistOnlyDefinitionsAndSimulateLocally',
        'TahaiWebUIBrowserTest.TahaiSkinStudioNumericConditionsPersistAndSimulateWithoutActions',
        'TahaiWebUIBrowserTest.TahaiMissionNumericConditionsCannotRewriteASkippedBranchAfterProgress',
        'TahaiWebUIBrowserTest.TahaiSkinStudioBasicCalculationsPreserveAdvancedTreesAndPrivacy',
        'TahaiWebUIBrowserTest.TahaiSkinStudioVariableLimitsRejectInvalidReadonlyAndStaleEdits',
        'TahaiWebUIBrowserTest.TahaiSkinStudioVariableBranchesPersistDefinitionsAndRecordDisposableDecisions',
        'TahaiWebUIBrowserTest.TahaiMissionVariableBranchesBlockUnassignedWorkAndKeepRecordedHistory',
        'TahaiWebUIBrowserTest.TahaiSkinStudioCompoundConditionsPersistAndBlockUnknownOrBranches',
        'TahaiWebUIBrowserTest.TahaiMissionCompoundChoicesStayRequiredAndRecordedAfterCheckpointReopen',
        'TahaiWebUIBrowserTest.TahaiSkinStudioRepeatRangesPersistAndSimulateDistinctIterations',
        'TahaiWebUIBrowserTest.TahaiMissionRepeatAssignmentsStayExplicitAndRetainIndependentProgress',
        'TahaiWebUIBrowserTest.TahaiSkinStudioProtectedVariablesPersistWithoutSimulationValues',
        'TahaiWebUIBrowserTest.TahaiMissionProtectedVariableCopiesRemainMaskedAcrossReloadAndSuccess',
        'TahaiWebUIBrowserTest.TahaiMissionProtectedVariablesBootstrapStorageWithoutProtectedInputs',
        'TahaiWebUIBrowserTest.TahaiSkinStudioTextExpressionsAuthorSimulateAndRestoreOnlyDefinitions',
        'TahaiWebUIBrowserTest.TahaiMissionTextExpressionsShowFixedErrorsAndRequireExplicitAssignment',
        'TahaiWebUIBrowserTest.TahaiBooleanAssignmentsAuthorSaveAndRunWithoutAutomaticEffects',
        'TahaiWebUIBrowserTest.TahaiSkinStudioSimulationTraceIsBoundedPrivateAndInert',
        'TahaiWebUIBrowserTest.TahaiSkinStudioNestedConditionsEditSaveAndRejectStaleControls',
        'MultiContentsViewBrowserTest.TahaiSurfaceStudioRejectsStaleEditsAndTrialRequests',
        'TahaiWebUIBrowserTest.TahaiFailedMissionRecoveryReviewRequiresFreshGestureAndNeverResumes',
        'TahaiWebUIBrowserTest.TahaiMissionChecklistsRequireCurrentDocumentGestureAndFreshToken',
        'TahaiWebUIBrowserTest.TahaiMissionStateControlsRejectStaleAndAutomaticTransitions',
        'TahaiWebUIBrowserTest.TahaiMissionMetadataControlsRejectStaleViewsAndDuplicateSubmissions',
        'TahaiWebUIBrowserTest.TahaiMissionCreationAndMetadataRequireDocumentGestureAndOneSubmission',
        'TahaiWebUIBrowserTest.TahaiEvidenceReviewIsCardScopedSingleUseAndRevisionBound',
        'TahaiWebUIBrowserTest.TahaiEvidenceReviewRequiresMissionGestureAndCannotSurviveNavigation',
        'TahaiWebUIBrowserTest.TahaiCapsuleMessagesRequireMissionGestureAndVerifiedSingleUseImport',
        'TahaiWebUIBrowserTest.TahaiWorkflowInputsRejectUnactivatedStaleAndRepeatedEdits',
        'TahaiWebUIBrowserTest.TahaiSkinStudioActionStatusBindingsAuthorSimulateAndRestoreDefinitions',
        'TahaiOperationalModeBrowserTest.TahaiActionStatusBindingFollowsRealDispatchAndExplicitCheckpoint',
        'TahaiWebUIBrowserTest.TahaiMissionCalculationsShowFailuresAndRequireFreshExplicitAssignment',
        'TahaiWebUIBrowserTest.TahaiMissionVariableAssignmentRequiresExplicitOrderedValidActionAndSurvivesReload',
        'TahaiWebUIBrowserTest.TahaiSkinStudioTimedWaitDefinitionPersistsWithoutSimulationClock',
        'TahaiWebUIBrowserTest.TahaiMissionWaitRequiresCurrentExplicitStartAndCompletionWithoutNextAction',
        'TahaiWebUIBrowserTest.TahaiSkinStudioWaitDeadlinePersistsAndSimulatesTerminalFailure',
        'TahaiWebUIBrowserTest.TahaiMissionWaitDeadlineFailsWithoutPageActionAndDisplaysRecordedError',
        'TahaiWebUIBrowserTest.TahaiMissionNativeFailureShowsTerminalOutcomeAndNoResume',
        'TahaiWebUIBrowserTest.TahaiSkinStudioNativeFailureSimulationIsDisposable',
        'TahaiOperationalModeBrowserTest.TahaiWorkflowNativeActionDispatchesOnceAndRevokesAtUse',
        'TahaiOperationalModeBrowserTest.TahaiWorkflowNativeDeadlineStopsDelayedJournalDispatch',
        'TahaiSkinProfileBrowserTest.TahaiSkinProfileIsolationAndPrivateDenial',
        'TahaiSkinProfileBrowserTest.TahaiSkinManagedPolicyRevokesReviewAndRetainsPackages',
        'TahaiSkinProfileBrowserTest.TahaiSkinCancelledAndSupersededReviewsCannotCommit',
        'TahaiSkinProfileBrowserTest.TahaiSkinInvalidImportsCannotReplaceInstalledRevision',
        'TahaiSkinManagerBrowserTest.TahaiSkinManagerAllModesAndOneWindowPerProfile',
        'TahaiSkinManagerBrowserTest.TahaiSkinNativeChooserReviewAndConfirmedInstall',
        'TahaiSkinManagerBrowserTest.TahaiSkinChooserRevocationAndCloseDoNotInstall',
        'TahaiGuardEngineBrowserTest.TahaiChromiumPrivateSuffixClassification',
        'TahaiGuardEngineBrowserTest.TahaiDeclarativeFilteringRejectsActiveContentOptions',
        'TahaiGuardEngineBrowserTest.TahaiCosmeticsHonorExceptionsAndGenericHide',
        'TahaiGuardEngineBrowserTest.TahaiUnsafeCosmeticReplyAndDeadlineFailClosedAtBoundary',
        'TahaiGuardRequestBrowserTest.TahaiCosmeticsFollowDynamicDomPauseExceptionsAndOff',
        'TahaiGuardRequestBrowserTest.TahaiCosmeticsDoNotLeakAcrossNavigationOrPrivateProfiles',
        'TahaiGuardRequestBrowserTest.TahaiCosmeticsFollowSameDocumentUrlExceptions',
        'TahaiSkinManagerBrowserTest.TahaiSkinLivePreviewAndExportPreserveCommittedState',
        'TahaiSkinManagerBrowserTest.TahaiBuiltInPalettesApplyAndRespectPolicy',
        'TahaiSkinManagerBrowserTest.PRE_TahaiBuiltInPaletteSurvivesRestart',
        'TahaiSkinManagerBrowserTest.TahaiBuiltInPaletteSurvivesRestart',
        'TahaiGuardEngineBrowserTest.TahaiRequestBoundsAndCanonicalOrigins',
        'TahaiGuardEngineBrowserTest.TahaiGenerationsAreIndependentAndImmutable',
        'TahaiGuardEngineBrowserTest.TahaiInputLimitsRejectWholeGeneration',
        'TahaiGuardEngineBrowserTest.TahaiQueueIsBoundedAndTimeoutIsNotAllow',
        'TahaiGuardEngineBrowserTest.TahaiDisconnectAndStopCompletePendingRequests',
        'TahaiGuardEngineBrowserTest.TahaiInvalidCompileReplyCannotEnableEngine',
        'TahaiGuardEngineBrowserTest.TahaiCancellationBeforeCompileReply',
        'TahaiGuardEngineBrowserTest.TahaiOpaqueSourceStillChecksGeneralNetworkRules',
        'TahaiGuardRequestBrowserTest.TahaiFetchBlocksBeforeNetworkAndOffRestores',
        'TahaiGuardRequestBrowserTest.TahaiRedirectAndMainNavigationBlockBeforeNetwork',
        'TahaiGuardRequestBrowserTest.TahaiExactOriginRecoveryDoesNotFollowAnotherPane',
        'TahaiGuardRequestBrowserTest.TahaiFailedReplacementKeepsLiveAndPersistedRules',
        'TahaiGuardRequestBrowserTest.TahaiPrivateProfileNeverBorrowsRegularGuard',
        'TahaiGuardRequestBrowserTest.TahaiDedicatedSharedAndServiceWorkerFetchesAreFiltered',
        'TahaiGuardRequestBrowserTest.TahaiScriptRequestsUseResourceTypeRules',
        'TahaiGuardRequestBrowserTest.TahaiManagedMissingRulesFailClosedAndLockChanges',
        'TahaiGuardRequestBrowserTest.TahaiManagedInvalidReplacementCannotReuseOldAllow',
        'TahaiGuardRequestBrowserTest.TahaiCountersRequireOptInAndClearOnOptOut',
        'TahaiGuardRequestBrowserTest.TahaiSandboxedFrameCannotEscapeGeneralRules',
        'TahaiGuardRequestBrowserTest.TahaiCustomRuleEditorInstallsThroughVisibleControl',
        'TahaiGuardRequestBrowserTest.TahaiKeepaliveRemainsFilteredAfterDocumentNavigation',
        'TahaiGuardRequestBrowserTest.TahaiTwoRegularProfilesKeepDistinctGenerations',
        'TahaiGuardRequestBrowserTest.TahaiPrivateEngineRefreshAndTeardownAreIsolated',
        'TahaiGuardRequestBrowserTest.TahaiPrivateManagedMissingEngineFailsClosed',
        'TahaiGuardRequestBrowserTest.TahaiPrivateEditorCannotMutateInheritedRules',
        'TahaiGuardProfileBrowserTest.TahaiFailedCandidateKeepsCurrentOwnerGeneration',
        'TahaiGuardProfileBrowserTest.TahaiReplacedGenerationCannotDeliverOldAllow',
        'TahaiGuardProfileBrowserTest.TahaiQueuedBypassCannotCrossMandatoryRevision',
        'TahaiGuardProfileBrowserTest.TahaiShutdownCancelsCandidateWithoutLatePublication',
        'TahaiGuardProfileBrowserTest.TahaiOwnerSanitizesCredentialsAndOpaqueSource',
        'TahaiGuardProfileBrowserTest.TahaiManagedOwnerOverloadDoesNotAllow',
        'TahaiGuardProfileBrowserTest.TahaiIdleCrashRecoveryHasFiniteBackoff',
        'TahaiGuardProfileBrowserTest.TahaiOffCancelsPendingCrashRecovery',
        'TahaiGuardProfileBrowserTest.TahaiShutdownCannotReturnReusableServiceOrManagedAllow',
        'TahaiGuardProxyBrowserTest.TahaiRendererCannotForgeFactoryAttribution',
        'TahaiGuardProxyBrowserTest.TahaiPendingRequestRetainsExactTerminalAfterFactoryClose',
        'TahaiGuardProxyBrowserTest.TahaiCancelledPreflightCannotForwardLateAllow',
        'TahaiGuardProxyBrowserTest.TahaiRedirectOverrideIsCheckedBeforeForwarding',
        'TahaiGuardProxyBrowserTest.TahaiCloneLimitDoesNotCreateUnboundedReceivers',
        'TahaiGuardProxyBrowserTest.TahaiLostTerminalCannotAcceptLateDecision'
    ) 'TAHAI browser tests' @('*Tahai*')
    $smokePath = Assert-TahaiEvidenceFile $root $evidence.smoke $finished
    $smoke = Read-TahaiEvidenceJson $smokePath
    $chrome = @($evidence.artifacts | Where-Object { $_.name -ceq 'chrome.exe' })[0]
    $chromeDll = @($evidence.artifacts | Where-Object { $_.name -ceq 'chrome.dll' })[0]
    if (-not (Test-TahaiJsonInteger $smoke.schemaVersion) -or $smoke.schemaVersion -ne 1 -or
        $smoke.isolatedProfile -isnot [bool] -or -not $smoke.isolatedProfile -or
        $smoke.cleanExit -isnot [bool] -or -not $smoke.cleanExit -or
        -not (Test-TahaiJsonInteger $smoke.exitCode) -or $smoke.exitCode -ne 0 -or
        $smoke.chromeSha256 -ne $chrome.sha256 -or
        $smoke.chromeDllSha256 -ne $chromeDll.sha256) {
        throw 'An isolated, clean-exit smoke report bound to these browser binaries is required.'
    }
    foreach ($surface in @('rail-icons', 'rail-expanded', 'rail-hidden',
                           'native-menu-recovery', 'dual-view', 'local-oi', 'named-workspaces', 'guard-custom-rules', 'guard-native-panel', 'skin-package-manager')) {
        $checks = @($smoke.checks | Where-Object { $_.name -ceq $surface })
        if ($checks.Count -ne 1 -or $checks[0].status -cne 'passed') {
            throw "Smoke evidence is missing or failed: $surface"
        }
        $null = Assert-TahaiEvidenceFile $root $checks[0].evidence $finished
    }
    return [pscustomobject]@{
        NativeTestAttempts = $nativeCount
        BrowserTestAttempts = $browserCount
        BuildLog = $buildLog
        EvidenceSha256 = (Get-FileHash -LiteralPath $EvidencePath -Algorithm SHA256).Hash
        SourceProvenance = $sourcePath
        SourceIdentitySha256 = $source.identitySha256
        SourceHead = $source.identity.head
    }
}
