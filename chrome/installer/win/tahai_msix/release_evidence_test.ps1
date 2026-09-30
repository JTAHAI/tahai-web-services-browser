# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Small synthetic tests of the packaging guard only. Does not run Chromium.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release_evidence.ps1')
$script:cases = 0

function Expect-Rejected {
    param([scriptblock]$Action, [string]$Name)
    $rejected = $false
    try { $null = & $Action } catch { $rejected = $true }
    if (-not $rejected) { throw "Regression not rejected: $Name" }
    $script:cases++
}

function New-TestSummary {
    param([string[]]$Names)
    $iteration = [ordered]@{}
    foreach ($name in $Names) {
        $iteration[$name] = @([ordered]@{ status = 'SUCCESS' })
    }
    return [ordered]@{ all_tests = $Names; per_iteration_data = @($iteration) } |
        ConvertTo-Json -Depth 8 | ConvertFrom-Json
}

$summary = New-TestSummary @('Fixture.Required')
if ((Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture') -ne 1) {
    throw 'Positive test summary rejected.'
}
$script:cases++
Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Absent') 'fixture' } 'missing test'
Expect-Rejected { Assert-TahaiTestSummary (New-TestSummary @()) @('Fixture.Required') 'fixture' } 'zero tests'
foreach ($status in @('FAILURE', 'SKIPPED', 'CRASH', 'TIMEOUT', 'NOTRUN')) {
    $summary = New-TestSummary @('Fixture.Required')
    $summary.per_iteration_data[0].'Fixture.Required'[0].status = $status
    Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture' } $status
}
$summary = New-TestSummary @('Fixture.Required')
$summary.per_iteration_data[0].'Fixture.Required' = @(
    [pscustomobject]@{status='FAILURE'}, [pscustomobject]@{status='SUCCESS'})
Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture' } 'failed retry'
$summary = New-TestSummary @('Fixture.Required')
$summary.per_iteration_data[0].'Fixture.Required' = @()
Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture' } 'empty attempt'
$summary = New-TestSummary @('Fixture.Required')
$summary.all_tests += 'Fixture.Unrun'
Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture' @('Fixture.*') } 'filtered-out discovered test'
Expect-Rejected { Assert-TahaiTestSummary $summary @('Fixture.Required') 'fixture' @('Typo.*') } 'zero-discovery scope'

# Chromium records PRE_ setup tests in all_tests and runs them before the main
# test, but does not repeat the PRE_ name in per_iteration_data. Match that real
# launcher shape while still rejecting a missing main result.
$preSummary = New-TestSummary @('Fixture.PRE_State', 'Fixture.State')
$preSummary.per_iteration_data[0].PSObject.Properties.Remove('Fixture.PRE_State')
if ((Assert-TahaiTestSummary $preSummary @('Fixture.PRE_State', 'Fixture.State') 'fixture') -ne 1) {
    throw 'Chromium PRE_ launcher summary shape rejected.'
}
$script:cases++
$preSummary.per_iteration_data[0].PSObject.Properties.Remove('Fixture.State')
Expect-Rejected { Assert-TahaiTestSummary $preSummary @('Fixture.PRE_State', 'Fixture.State') 'fixture' } 'PRE_ test without main result'

$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixtureRoot = Join-Path $tempRoot ('tahai-release-evidence-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
    $buildDir = Join-Path $fixtureRoot 'build'
    New-Item -ItemType Directory -Path $buildDir | Out-Null
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $started = $now - 30000
    $finished = $now - 10000
    $artifacts = @()
    foreach ($name in @('chrome.exe', 'chrome.dll', 'tahai_mission_service_tests.exe', 'browser_tests.exe',
                        'elevation_service.exe', 'elevated_tracing_service.exe',
                        'elevation_service_unittests.exe', 'elevated_tracing_service_unittests.exe')) {
        $filePath = Join-Path $buildDir $name
        # Plain text fixtures deliberately cannot be mistaken for PE binaries.
        [IO.File]::WriteAllText($filePath, "SYNTHETIC packaging-guard fixture: $name")
        [IO.File]::SetLastWriteTimeUtc($filePath, [DateTimeOffset]::FromUnixTimeMilliseconds($started + 1000).UtcDateTime)
        $artifacts += [ordered]@{ name = $name; bytes = (Get-Item -LiteralPath $filePath).Length;
            sha256 = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash }
    }
    function Write-FixtureEvidence {
        param([string]$Name, $Data)
        $path = Join-Path $fixtureRoot $Name
        $Data | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
        return [ordered]@{ file = $Name; sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
    }
    $native = New-TestSummary @(
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
        'MissionServiceTest.TahaiNamedWorkspacePrivateAndManagedPolicyBoundaries',
        'TahaiLocalOiStoreTest.SyntheticFixture')
    $browser = New-TestSummary @(
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
        'TahaiGuardProxyBrowserTest.TahaiLostTerminalCannotAcceptLateDecision')
    $browser.per_iteration_data[0].PSObject.Properties.Remove(
        'SessionRestoreTest.PRE_TahaiNamedWorkspaceSurvivesProcessRestart')
    $nativeRecord = Write-FixtureEvidence 'native.json' $native
    $nativeRecord.exitCode = 0
    $browserRecord = Write-FixtureEvidence 'browser.json' $browser
    $browserRecord.exitCode = 0
    $elevation = New-TestSummary @('ServiceMainTest.TahaiConfiguredInterfaceMatchesTypeLibrary', 'ServiceMainTest.ExitSignalTest')
    $tracing = New-TestSummary @('SystemTracingSessionTest.TahaiConfiguredInterfaceMatchesTypeLibrary', 'SystemTracingSessionTest.NoAggregation')
    $elevationRecord = Write-FixtureEvidence 'elevation.json' $elevation
    $elevationRecord.exitCode = 0
    $tracingRecord = Write-FixtureEvidence 'tracing.json' $tracing
    $tracingRecord.exitCode = 0
    $logPath = Join-Path $fixtureRoot 'build.log'
    [IO.File]::WriteAllText($logPath, 'SYNTHETIC build-log fixture, not a browser build.')
    $checks = @()
    foreach ($name in @('rail-icons', 'rail-expanded', 'rail-hidden', 'native-menu-recovery', 'dual-view', 'local-oi', 'named-workspaces', 'guard-custom-rules', 'guard-native-panel', 'skin-package-manager')) {
        $checks += [ordered]@{name=$name; status='passed';
            evidence=(Write-FixtureEvidence "$name.json" @{synthetic=$true})}
    }
    $smoke = [ordered]@{schemaVersion=1; isolatedProfile=$true; cleanExit=$true; exitCode=0;
        chromeSha256=$artifacts[0].sha256; chromeDllSha256=$artifacts[1].sha256; checks=$checks}
    [IO.File]::WriteAllText((Join-Path $buildDir 'args.gn'), 'SYNTHETIC args fixture')
    $source = [ordered]@{
        schemaVersion=1; identitySha256=('a' * 64)
        identity=@{head=('b' * 40); buildArgsSha256=(Get-FileHash -LiteralPath (Join-Path $buildDir 'args.gn') -Algorithm SHA256).Hash}
        sourceSnapshot=(Write-FixtureEvidence 'source.zip' @{synthetic=$true})
    }
    $testResults = @{nativeExitCode=0; browserExitCode=0; elevationExitCode=0; tracingExitCode=0; isolatedTestSession='SYNTHETIC fixture only'}
    $evidence = [ordered]@{schemaVersion=2; buildExitCode=0;
        buildStartedUnixMs=$started; buildFinishedUnixMs=$finished; artifacts=$artifacts;
        buildLog=@{file='build.log';sha256=(Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash};
        nativeTests=$nativeRecord; browserTests=$browserRecord;
        elevationTests=$elevationRecord; tracingTests=$tracingRecord;
        sourceProvenance=(Write-FixtureEvidence 'source-provenance.json' $source);
        testResults=(Write-FixtureEvidence 'test-results.json' $testResults);
        smoke=(Write-FixtureEvidence 'smoke.json' $smoke)}
    $evidencePath = Join-Path $fixtureRoot 'release.json'
    $null = Write-FixtureEvidence 'release.json' $evidence
    $result = Assert-TahaiReleaseEvidence $evidencePath $buildDir
    if ($result.NativeTestAttempts -ne 147 -or $result.BrowserTestAttempts -ne 180 -or
        $result.ElevationTestAttempts -ne 2 -or $result.TracingTestAttempts -ne 2) {
        throw 'Positive fixture counts were incorrect.'
    }
    $script:cases++

    $evidence.schemaVersion = 1
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'old evidence lacks required service gates'
    $evidence.schemaVersion = 2
    $evidence.Remove('tracingTests')
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'missing tracing test report'
    $evidence.tracingTests = $tracingRecord
    $testResults.elevationExitCode = $null
    $evidence.testResults = Write-FixtureEvidence 'test-results.json' $testResults
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'missing actual service test exit'
    $testResults.elevationExitCode = 0
    $evidence.testResults = Write-FixtureEvidence 'test-results.json' $testResults
    $tracing.per_iteration_data[0].PSObject.Properties.Remove('SystemTracingSessionTest.TahaiConfiguredInterfaceMatchesTypeLibrary')
    $evidence.tracingTests = Write-FixtureEvidence 'tracing.json' $tracing
    $evidence.tracingTests.exitCode = 0
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'missing changed tracing interface regression'
    $tracing = New-TestSummary $tracing.all_tests
    $tracing.all_tests += 'SystemTracingSessionTest.FilteredOut'
    $evidence.tracingTests = Write-FixtureEvidence 'tracing.json' $tracing
    $evidence.tracingTests.exitCode = 0
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'filtered-out discovered service test'
    $tracing.all_tests = @($tracing.all_tests | Where-Object { $_ -ne 'SystemTracingSessionTest.FilteredOut' })
    $evidence.tracingTests = Write-FixtureEvidence 'tracing.json' $tracing
    $evidence.tracingTests.exitCode = 0
    $evidence.elevationTests.exitCode = 1
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'service process failed'
    $evidence.elevationTests.exitCode = 0
    [IO.File]::SetLastWriteTimeUtc((Join-Path $buildDir 'elevated_tracing_service.exe'), [DateTimeOffset]::FromUnixTimeMilliseconds($started - 1000).UtcDateTime)
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'stale tracing service binary'
    [IO.File]::SetLastWriteTimeUtc((Join-Path $buildDir 'elevated_tracing_service.exe'), [DateTimeOffset]::FromUnixTimeMilliseconds($started + 1000).UtcDateTime)
    $null = Assert-TahaiReleaseEvidence $evidencePath $buildDir
    $script:cases++

    $native.per_iteration_data[0].PSObject.Properties.Remove('TahaiWorkflowJournalTest.AbruptWriterExitRollsBackWithoutReplay')
    $evidence.nativeTests = Write-FixtureEvidence 'native.json' $native
    $evidence.nativeTests.exitCode = 0
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'missing actual crash-recovery journal test'
    $native = New-TestSummary $native.all_tests
    $evidence.nativeTests = Write-FixtureEvidence 'native.json' $native
    $evidence.nativeTests.exitCode = 0

    $source.identity.buildArgsSha256 = 'c' * 64
    $evidence.sourceProvenance = Write-FixtureEvidence 'source-provenance.json' $source
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'source configuration mismatch'
    $source.identity.buildArgsSha256 = (Get-FileHash -LiteralPath (Join-Path $buildDir 'args.gn') -Algorithm SHA256).Hash
    $evidence.sourceProvenance = Write-FixtureEvidence 'source-provenance.json' $source
    $testResults.browserExitCode = $null
    $evidence.testResults = Write-FixtureEvidence 'test-results.json' $testResults
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'missing actual browser exit'
    $testResults.browserExitCode = 0
    $evidence.testResults = Write-FixtureEvidence 'test-results.json' $testResults
    $null = Write-FixtureEvidence 'release.json' $evidence
    [IO.File]::AppendAllText((Join-Path $fixtureRoot 'source.zip'), 'changed')
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'changed source snapshot'
    $source.sourceSnapshot = Write-FixtureEvidence 'source.zip' @{synthetic=$true}
    $evidence.sourceProvenance = Write-FixtureEvidence 'source-provenance.json' $source

    $evidence.buildExitCode = 1
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'failed build'
    $evidence.buildExitCode = 0
    $evidence.nativeTests.file = '../native.json'
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'path traversal'
    $evidence.nativeTests.file = 'native.json'
    $null = Write-FixtureEvidence 'release.json' $evidence
    [IO.File]::SetLastWriteTimeUtc((Join-Path $buildDir 'browser_tests.exe'), [DateTimeOffset]::FromUnixTimeMilliseconds($started - 1000).UtcDateTime)
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'stale binary'
    [IO.File]::SetLastWriteTimeUtc((Join-Path $buildDir 'browser_tests.exe'), [DateTimeOffset]::FromUnixTimeMilliseconds($started + 1000).UtcDateTime)
    [IO.File]::AppendAllText((Join-Path $fixtureRoot 'native.json'), ' ')
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'changed test report'
    $evidence.nativeTests = Write-FixtureEvidence 'native.json' $native
    $evidence.nativeTests.exitCode = 0
    $smoke.cleanExit = 'true'
    $evidence.smoke = Write-FixtureEvidence 'smoke.json' $smoke
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'string instead of boolean'
    $smoke.cleanExit = $true
    $evidence.smoke = Write-FixtureEvidence 'smoke.json' $smoke
    $evidence.browserTests.exitCode = 1
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'browser process failed'
    $evidence.browserTests.exitCode = 0
    $evidence.artifacts[3].name = 'chrome.dll'
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'duplicate binary evidence'
    $evidence.artifacts[3].name = 'browser_tests.exe'
    $null = Write-FixtureEvidence 'release.json' $evidence
    [IO.File]::WriteAllText($logPath, 'FAILED: synthetic negative test')
    $evidence.buildLog.sha256 = (Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash
    $null = Write-FixtureEvidence 'release.json' $evidence
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'failure in build log'
    [IO.File]::WriteAllText($logPath, 'SYNTHETIC positive fixture')
    $evidence.buildLog.sha256 = (Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash
    $null = Write-FixtureEvidence 'release.json' $evidence
    [IO.File]::WriteAllText((Join-Path $buildDir 'chrome.dll'), 'Changed synthetic binary')
    [IO.File]::SetLastWriteTimeUtc((Join-Path $buildDir 'chrome.dll'), [DateTimeOffset]::FromUnixTimeMilliseconds($started + 1000).UtcDateTime)
    Expect-Rejected { Assert-TahaiReleaseEvidence $evidencePath $buildDir } 'binary changed after tests'
} finally {
    # Only delete this test's newly-created unique fixture, never a supplied path.
    $resolvedFixture = (Resolve-Path -LiteralPath $fixtureRoot).Path
    if ([IO.Path]::GetDirectoryName($resolvedFixture) -ne $tempRoot.TrimEnd('\') -or
        [IO.Path]::GetFileName($resolvedFixture) -notmatch '^tahai-release-evidence-test-[a-f0-9]{32}$') {
        throw 'Refusing to clean an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
Write-Output "TAHAI packaging evidence guard: $script:cases synthetic checks passed. No Chromium tests executed."
