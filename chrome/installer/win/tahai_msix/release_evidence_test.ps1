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
    foreach ($name in @('chrome.exe', 'chrome.dll', 'tahai_mission_service_tests.exe', 'browser_tests.exe')) {
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
        'MissionServiceTest.WorkspaceRailStatesAreFiniteAndPersistPerMode',
        'MissionServiceTest.SkinPathsRejectWindowsDeviceAndTrailingDotAliases',
        'MissionServiceTest.SkinPackageExactRatioAndPurposeCannotBypassLimits',
        'TahaiSkinStoreTest.AtomicUpdateRetainsOneRevisionAcrossRestart',
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
    $logPath = Join-Path $fixtureRoot 'build.log'
    [IO.File]::WriteAllText($logPath, 'SYNTHETIC build-log fixture, not a browser build.')
    $checks = @()
    foreach ($name in @('rail-icons', 'rail-expanded', 'rail-hidden', 'native-menu-recovery', 'dual-view', 'local-oi', 'named-workspaces', 'guard-custom-rules', 'guard-native-panel', 'skin-package-manager')) {
        $checks += [ordered]@{name=$name; status='passed';
            evidence=(Write-FixtureEvidence "$name.json" @{synthetic=$true})}
    }
    $smoke = [ordered]@{schemaVersion=1; isolatedProfile=$true; cleanExit=$true; exitCode=0;
        chromeSha256=$artifacts[0].sha256; chromeDllSha256=$artifacts[1].sha256; checks=$checks}
    $evidence = [ordered]@{schemaVersion=1; buildExitCode=0;
        buildStartedUnixMs=$started; buildFinishedUnixMs=$finished; artifacts=$artifacts;
        buildLog=@{file='build.log';sha256=(Get-FileHash -LiteralPath $logPath -Algorithm SHA256).Hash};
        nativeTests=$nativeRecord; browserTests=$browserRecord;
        smoke=(Write-FixtureEvidence 'smoke.json' $smoke)}
    $evidencePath = Join-Path $fixtureRoot 'release.json'
    $null = Write-FixtureEvidence 'release.json' $evidence
    $result = Assert-TahaiReleaseEvidence $evidencePath $buildDir
    if ($result.NativeTestAttempts -ne 25 -or $result.BrowserTestAttempts -ne 107) {
        throw 'Positive fixture counts were incorrect.'
    }
    $script:cases++

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
