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
    if ($iterations.Count -ne 1 -or $RequiredTests.Count -eq 0) {
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
            if ($attempts.Count -ne 1) { throw "$Suite must run $name exactly once without retries." }
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
    if ($file.PSIsContainer -or $file.Length -le 0 -or $file.Length -gt 64MB -or
        ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
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
        $written -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $Record.sha256) {
        throw "Evidence is stale or its SHA-256 changed: $path"
    }
    return $path
}

function Assert-TahaiSmokeEvidence {
    param([string]$Path, [string]$ChromeSha256, [string]$ChromeDllSha256,
          [long]$NotBeforeUnixMs)
    Set-StrictMode -Version Latest
    $root = Split-Path -Parent $Path
    $record = @{ file = (Get-Item -LiteralPath $Path).Name;
                 sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    $null = Assert-TahaiEvidenceFile $root $record $NotBeforeUnixMs
    $smoke = Read-TahaiEvidenceJson $Path
    if (-not (Test-TahaiJsonInteger $smoke.schemaVersion) -or $smoke.schemaVersion -ne 1 -or
        $smoke.isolatedProfile -isnot [bool] -or -not $smoke.isolatedProfile -or
        $smoke.cleanExit -isnot [bool] -or -not $smoke.cleanExit -or
        -not (Test-TahaiJsonInteger $smoke.exitCode) -or $smoke.exitCode -ne 0 -or
        $ChromeSha256 -notmatch '^[a-fA-F0-9]{64}$' -or
        $ChromeDllSha256 -notmatch '^[a-fA-F0-9]{64}$' -or
        $smoke.chromeSha256 -ne $ChromeSha256 -or
        $smoke.chromeDllSha256 -ne $ChromeDllSha256) {
        throw 'An isolated, clean-exit smoke report bound to these browser binaries is required.'
    }
    $names = @{}
    foreach ($check in @($smoke.checks)) {
        if ([string]::IsNullOrWhiteSpace($check.name) -or
            $names.ContainsKey($check.name) -or $check.status -cne 'passed') {
            throw 'Smoke checks must be uniquely named and passing.'
        }
        $names[$check.name] = $true
        $null = Assert-TahaiEvidenceFile $root $check.evidence $NotBeforeUnixMs
    }
    foreach ($surface in @('rail-icons', 'rail-expanded', 'rail-hidden',
                           'native-menu-recovery', 'dual-view', 'local-oi', 'named-workspaces', 'guard-custom-rules', 'guard-native-panel', 'skin-package-manager')) {
        if (@($smoke.checks.name) -cnotcontains $surface) {
            throw "Smoke evidence is missing: $surface"
        }
    }
    $null = Assert-TahaiEvidenceFile $root $record $NotBeforeUnixMs
    return $smoke
}

function Copy-TahaiSmokeEvidence {
    param([string]$Path, [string]$DestinationDirectory, [string]$ChromeSha256,
          [string]$ChromeDllSha256, [long]$NotBeforeUnixMs)
    Set-StrictMode -Version Latest
    $root = Split-Path -Parent $Path
    $reportRecord = @{ file = (Get-Item -LiteralPath $Path).Name;
                       sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    $smoke = Assert-TahaiSmokeEvidence $Path $ChromeSha256 $ChromeDllSha256 $NotBeforeUnixMs
    $records = @($smoke.checks | ForEach-Object { $_.evidence })
    $destinations = @{ 'smoke.json' = $true }
    foreach ($record in $records) {
        if ($destinations.ContainsKey($record.file) -or
            (Test-Path -LiteralPath (Join-Path $DestinationDirectory $record.file))) {
            throw 'Smoke evidence has a duplicate or colliding destination.'
        }
        $destinations[$record.file] = $true
    }
    $copiedSmoke = Join-Path $DestinationDirectory 'smoke.json'
    if (Test-Path -LiteralPath $copiedSmoke) { throw 'Smoke output already exists.' }
    foreach ($record in $records) {
        $sourcePath = Assert-TahaiEvidenceFile $root $record $NotBeforeUnixMs
        Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $DestinationDirectory $record.file) -ErrorAction Stop
        $null = Assert-TahaiEvidenceFile $DestinationDirectory $record $NotBeforeUnixMs
    }
    $null = Assert-TahaiEvidenceFile $root $reportRecord $NotBeforeUnixMs
    # Preserve original bytes, attestations and timestamps. Never reserialize
    # or replace a check's recorded hash with whatever bytes happen to exist.
    Copy-Item -LiteralPath $Path -Destination $copiedSmoke -ErrorAction Stop
    $copiedRecord = @{ file = 'smoke.json'; sha256 = $reportRecord.sha256 }
    $null = Assert-TahaiEvidenceFile $DestinationDirectory $copiedRecord $NotBeforeUnixMs
    $null = Assert-TahaiSmokeEvidence $copiedSmoke $ChromeSha256 $ChromeDllSha256 $NotBeforeUnixMs
    return $copiedSmoke
}

function Assert-TahaiReleaseEvidence {
    param([string]$EvidencePath, [string]$BuildDir)

    Set-StrictMode -Version Latest
    $evidence = Read-TahaiEvidenceJson $EvidencePath
    if (-not (Test-TahaiJsonInteger $evidence.schemaVersion) -or $evidence.schemaVersion -ne 3 -or
        -not (Test-TahaiJsonInteger $evidence.buildExitCode) -or $evidence.buildExitCode -ne 0) {
        throw 'A successful build with version-3 release evidence including full source preflight and Windows service tests is required.'
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
        'tahai_mission_service_tests.exe', 'browser_tests.exe',
        'elevation_service.exe', 'elevated_tracing_service.exe',
        'elevation_service_unittests.exe', 'elevated_tracing_service_unittests.exe')
    if (@($evidence.artifacts).Count -ne $requiredArtifacts.Count) {
        throw 'Release evidence must bind all eight required native binaries.'
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
    . (Join-Path $PSScriptRoot '..\..\..\..\tools\tahai\source_preflight.ps1')
    $preflightPath = Assert-TahaiEvidenceFile $root $evidence.sourcePreflight 0
    $preflight = Assert-TahaiSourcePreflight $preflightPath $source $started
    $testResultPath = Assert-TahaiEvidenceFile $root $evidence.testResults $finished
    $testResults = Read-TahaiEvidenceJson $testResultPath
    if (-not (Test-TahaiJsonInteger $testResults.nativeExitCode) -or $testResults.nativeExitCode -ne 0 -or
        -not (Test-TahaiJsonInteger $testResults.browserExitCode) -or $testResults.browserExitCode -ne 0 -or
        -not (Test-TahaiJsonInteger $testResults.elevationExitCode) -or $testResults.elevationExitCode -ne 0 -or
        -not (Test-TahaiJsonInteger $testResults.tracingExitCode) -or $testResults.tracingExitCode -ne 0 -or
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
    $serviceCounts = @{}
    foreach ($gate in @(
        @{name='elevation'; scope='ServiceMainTest.*'; required='ServiceMainTest.TahaiConfiguredInterfaceMatchesTypeLibrary'},
        @{name='tracing'; scope='SystemTracingSessionTest.*'; required='SystemTracingSessionTest.TahaiConfiguredInterfaceMatchesTypeLibrary'})) {
        $record = $evidence.($gate.name + 'Tests')
        if (-not (Test-TahaiJsonInteger $record.exitCode) -or $record.exitCode -ne 0) {
            throw ('Windows service test process failed: ' + $gate.name)
        }
        $path = Assert-TahaiEvidenceFile $root $record $finished
        $serviceCounts[$gate.name] = Assert-TahaiTestSummary (Read-TahaiEvidenceJson $path) @($gate.required) ($gate.name + ' service tests') @($gate.scope)
    }
    $nativeCount = Assert-TahaiTestSummary (Read-TahaiEvidenceJson $nativePath) @(
        'TahaiWorkflowJournalTest.IntentSurvivesReopenAndCannotReplay',
        'TahaiModeServiceTest.ExternalPreferencesAndPolicyRemainAuthoritative',
        'TahaiModeServiceTest.ConfigurationWritesPreserveUnknownAndOtherModes',
        'TahaiModeServiceTest.MalformedPreferencesAreReadOnly',
        'TahaiModeServiceTest.UnknownActiveModeIsNotRewrittenOnLoad',
        'TahaiModeServiceTest.DensityMigrationProducesCanonicalSnapshots',
        'TahaiModeServiceTest.ReentrantNotificationsAreDeferred',
        'TahaiModeServiceTest.ObserverCanDestroyServiceDuringPreferenceWrite',
        'TahaiModeServiceTest.ShutdownRejectsAllMutationsAndDropsQueuedNotifications',
        'TahaiModeServiceTest.ModifierChangesNotifyOnceAndNoopsDoNotPersist',
        'TahaiModeServiceTest.PrivateEditsCannotAcknowledgeSupersededSettings',
        'TahaiModeServiceTest.PrivateObserverCanDestroyServiceDuringEdit',
        'TahaiNamedWorkspaceStoreTest.ManagedStoreCannotCreateShadowUserEdits',
        'TahaiNamedWorkspaceStoreTest.WrongTypedStoreCannotBeReplacedBySave',
        'MissionServiceTest.DiscardedOldestLedgerRecordCannotVerifyRemainingHistory',
        'MissionServiceTest.EmptyOrMalformedHistoryCannotClearIntegrityWarning',
        'MissionServiceTest.RestoredMissionIdentifiersRemainUnambiguous',
        'MissionServiceTest.MissionTextRemainsValidUtf8AcrossDuplicationAndRestore',
        'MissionServiceTest.LocalOiSearchRetainsOnlyTypedEntityDetailTargets',
        'TahaiWorkflowNativeTest.ArchiveRestoreNeverImplicitlyResumesNativeWork',
        'TahaiWorkflowNativeTest.LegacyArchivedRunningSnapshotRequiresExplicitResume',
        'TahaiLocalOiStoreTest.FutureSchemaIsPreservedAndCannotBeOverwritten',
        'TahaiLocalOiStoreTest.WrongTypedPreferenceIsPreservedWithoutDefaultReset',
        'TahaiLocalOiStoreTest.StaleBatchCannotReplaceNewerMutation',
        'TahaiLocalOiStoreTest.OtherStoreOwnerCannotOverwriteNewerGeneration',
        'TahaiLocalOiStoreTest.ManagedStorageCannotAcquireHiddenUserWrites',
        'TahaiLocalOiStoreTest.ReloadRejectsDanglingRelationshipTargets',
        'TahaiCapabilityBrokerTest.CrashedDocumentCannotGrantOrUseCapability',
        'TahaiCapabilityBrokerTest.WrongTypedStorageCannotBeRepairedByGrant',
        'TahaiCapabilityBrokerTest.InheritedOriginIsNotAnHttpsDocument',
        'TahaiSkinStudioDraftTest.CanonicalGrowthCannotReplaceLastReloadableDraft',
        'TahaiSkinStudioDraftTest.NewDraftTargetsRunningEngineOnly',
        'TahaiSkinStudioDraftTest.ExistingCompatibilityIsNeverSilentlyWidened',
        'MissionServiceTest.QueuedActivationPreservesAuthoredManualRecovery',
        'MissionServiceTest.InvalidQueuedRecoveryCannotReplacePriorLaunch',
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
        'MissionServiceTest.CapsuleKeyWrongTypedStorageIsNeverReplaced',
        'MissionServiceTest.CapsuleKeyLateStorageCorruptionIsPreserved',
        'MissionServiceTest.CapsuleKeyIdentityMismatchReportsCorruptionNotSuccess',
        'MissionServiceTest.CapsuleKeyCallbackSurvivesOwnerDeletionDuringPersistence',
        'MissionServiceTest.MissionExternalStorageReplacementIsNotOverwritten',
        'MissionServiceTest.CapsuleImportCommitsAtomicallyBeforeOwnerDeletion',
        'MissionServiceTest.MissionWrongTypedStorageRejectsMutationsWithoutDataLoss',
        'MissionServiceTest.EnvironmentGuardRejectsDamagedStorageAndInvalidEnums',
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
        'TahaiWorkflowNativeTest.NativeDeadlineMutationSurvivesOwnerDeletion',
        'TahaiWorkflowNativeTest.NativeDeadlineShutdownSurvivesOwnerDeletion',
        'TahaiWorkflowNativeTest.NativeDeadlineEncryptorCallbackSurvivesOwnerDeletion',
        'TahaiWorkflowNativeTest.NativeDeadlineRechecksMutationPolicyAfterNotification',
        'TahaiWorkflowNativeTest.NativeDeadlinePinsBorrowedMutationArguments',
        'TahaiWorkflowNativeTest.QueuedWorkflowCannotReplayOrResumeAfterOwnerDeletion',
        'TahaiWorkflowNativeTest.QueuedWorkflowPreservesManagedAndUnknownStorage',
        'TahaiWorkflowNativeTest.QueuedWorkflowNotificationCannotReplaceConsumedLaunch',
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
        'TahaiLocalOiBrowserTest.FindingTransitionsUpdateSearchProjectionAtomically',
        'MultiContentsViewBrowserTest.TahaiNamedWorkspaceStopsAfterObserverRemovesNextGroup',
        'MultiContentsViewBrowserTest.TahaiNamedWorkspaceStopsAfterObserverReordersTabs',
        'TahaiLocalOiBrowserTest.UnavailableStoreCannotSearchBriefExportOrMutate',
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
        'TahaiOperationalModeBrowserTest.TahaiManagerActivationPreservesAuthoredRecovery',
        'TahaiOperationalModeBrowserTest.TahaiManagerActivationStopsOnSynchronousClose',
        'TahaiSkinManagerBrowserTest.TahaiWindowAppearanceApplySurvivesManagerClose',
        'TahaiSkinManagerBrowserTest.TahaiWindowAppearanceResetSurvivesManagerClose',
        'TahaiSkinManagerBrowserTest.TahaiWindowAppearanceApplyStopsAfterRetarget',
        'TahaiSkinManagerBrowserTest.TahaiWindowAppearanceResetStopsAfterRetarget',
        'TahaiSkinProfileBrowserTest.TahaiAppearanceApplyStopsAfterServiceShutdown',
        'TahaiSkinProfileBrowserTest.TahaiAppearanceResetStopsAfterServiceShutdown',
        'TahaiSkinProfileBrowserTest.TahaiAppearancePreservesWrongTypedPreference',
        'TahaiSkinProfileBrowserTest.TahaiPreviewRestartCannotContinueAfterThemeCancellation',
        'TahaiSkinManagerBrowserTest.TahaiPresentationRestoreRejectsObserverReplacement',
        'TahaiOperationalModeBrowserTest.TahaiManagerCustomActivationStopsOnSynchronousClose',
        'TahaiOperationalModeBrowserTest.TahaiManagerActivationStopsOnSynchronousRetarget',
        'TahaiOperationalModeBrowserTest.TahaiManagerActivationStopsOnSynchronousRevocation',
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
    $chrome = @($evidence.artifacts | Where-Object { $_.name -ceq 'chrome.exe' })[0]
    $chromeDll = @($evidence.artifacts | Where-Object { $_.name -ceq 'chrome.dll' })[0]
    $null = Assert-TahaiSmokeEvidence $smokePath $chrome.sha256 $chromeDll.sha256 $finished
    return [pscustomobject]@{
        NativeTestAttempts = $nativeCount
        BrowserTestAttempts = $browserCount
        ElevationTestAttempts = $serviceCounts.elevation
        TracingTestAttempts = $serviceCounts.tracing
        BuildLog = $buildLog
        EvidenceSha256 = (Get-FileHash -LiteralPath $EvidencePath -Algorithm SHA256).Hash
        SourceProvenance = $sourcePath
        SourceIdentitySha256 = $source.identitySha256
        SourceHead = $source.identity.head
        SourceTree = $source.identity.tree
        SourcePreflight = $preflightPath
        SourcePreflightSuites = $preflight.suites
    }
}
