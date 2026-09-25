param([string]$BuildDirectory = 'out\tahai_ga_release_x64')

# Source-focused checks, not a final browser build or GA/package acceptance.
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$build = Join-Path $source $BuildDirectory
$evidence = Join-Path $build ('workflow-checks-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$null = New-Item -ItemType Directory -Path $evidence
$python = 'D:\dev\depot_tools\bootstrap-2@3_11_8_chromium_35_bin\python3\bin\python3.exe'
$creator = 'C:\Users\justi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$node = 'C:\Program Files\nodejs\node.exe'
$env:vs2026_install = 'C:\PROGRA~2\MICROS~2\18\BUILDT~1'
$env:GYP_MSVS_OVERRIDE_PATH = $env:vs2026_install
$env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
$env:PATH = (Split-Path -Parent $python) + ';D:\dev\depot_tools;' + $env:PATH.Replace('"', '')
$logged = Join-Path $PSScriptRoot 'run_logged.py'
$record = Join-Path $evidence 'source-provenance.json'
$result = [ordered]@{ startedUtc = [DateTime]::UtcNow.ToString('o'); finishedUtc = $null;
  checks = [ordered]@{}; buildExitCode = $null; sourceComparisonExitCode = $null;
  journalTestsExecuted = $false; browserTestsExecuted = $false; msixProduced = $false; failure = $null }
function Invoke-Check([string]$Name, [string[]]$Command) {
  & $python $logged --log (Join-Path $evidence ($Name + '.log')) -- @Command
  $result.checks[$Name] = $LASTEXITCODE
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit $LASTEXITCODE" }
}
Push-Location $source
try {
  $busy = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(ninja|clang-cl|lld-link|gn|siso)\.exe$' }
  if ($busy) { throw 'A compiler/build process is active; no competing batch started.' }
  Invoke-Check 'workflow-model' @($node, 'tools/tahai/workflow_designer_test.js')
  Invoke-Check 'workflow-events' @($node, 'tools/tahai/workflow_editor_events_test.js')
  Invoke-Check 'workflow-input-events' @($node, 'tools/tahai/workflow_input_events_test.js')
  Invoke-Check 'native-mode-placements' @($node, 'tools/tahai/native_mode_placement_test.js')
  Invoke-Check 'geometry' @($node, 'tools/tahai/surface_designer_test.js')
  Invoke-Check 'creator-tests' @($creator, 'docs/tahai-skins/test_build_skin.py', '--release-gate', '-v')
  Invoke-Check 'creator-kit-check' @($python, 'docs/tahai-skins/build_creator_kit.py', '--check')
  Invoke-Check 'guard-list-check' @($python, 'third_party/tahai_guard_lists/build_rules.py', '--check')
  Invoke-Check 'release-evidence-guard' @('C:\Program Files\PowerShell\7\pwsh.exe', '-NoProfile', '-File', 'chrome/installer/win/tahai_msix/release_evidence_test.ps1')
  Invoke-Check 'source-capture' @($python, 'tools/tahai/source_provenance.py', '--source', $source, '--build', $build, '--output', $record)
  $targets = @(
    'tahai_workflow_journal_tests',
    'obj/chrome/common/tahai_skins/manifest/tahai_operational_skin_manifest.obj',
    'obj/chrome/browser/ui/ui/tahai_custom_mode_registry.obj',
    'obj/chrome/browser/ui/ui/tahai_mode_service.obj',
    'obj/chrome/browser/ui/ui/tahai_mode_command_model.obj',
    'obj/chrome/browser/ui/ui/tahai_window_mode_controller.obj',
    'obj/chrome/browser/ui/ui/tahai_finder.obj',
    'obj/chrome/browser/ui/ui/tahai_workspace_rail_view.obj',
    'obj/chrome/browser/ui/ui/browser_view.obj',
    'obj/chrome/browser/ui/ui/browser_view_tabbed_layout_impl.obj',
    'obj/chrome/browser/ui/toolbar/impl/app_menu_model.obj',
    'obj/chrome/browser/ui/views/toolbar/impl/toolbar_view.obj',
    'obj/chrome/browser/ui/ui/tahai_operational_workflow_queue.obj',
    'obj/chrome/browser/ui/ui/tahai_skin_manager.obj',
    'obj/chrome/browser/tahai_skins/profile_service/skin_profile_service.obj',
    'obj/chrome/browser/tahai_skins/signature/tahai_skin_signature.obj',
    'obj/chrome/browser/prefs/impl/browser_prefs.obj',
    'obj/chrome/browser/ui/webui/configs/tahai_mission_service.obj',
    'obj/chrome/browser/ui/webui/configs/tahai_workflow_journal.obj',
    'obj/chrome/browser/ui/webui/configs/tahai_workflow_native_handler.obj',
    'obj/chrome/browser/ui/webui/configs/tahai_sync_key_service.obj',
    'obj/chrome/browser/ui/webui/configs/tahai_ui.obj',
    'obj/chrome/browser/ui/webui/tahai_mission_service_tests/tahai_mission_service_unittest.obj',
    'obj/chrome/browser/ui/webui/tahai_mission_service_tests/tahai_operational_skin_manifest_unittest.obj',
    'obj/chrome/browser/ui/webui/tahai_mission_service_tests/tahai_custom_mode_registry_unittest.obj',
    'obj/chrome/browser/ui/webui/tahai_mission_service_tests/tahai_workflow_native_unittest.obj',
    'obj/chrome/browser/ui/webui/tahai_mission_service_tests/tahai_workflow_journal_unittest.obj',
    'obj/chrome/browser/tahai_skins/browser_tests/skin_decoder_browsertest.obj',
    'obj/chrome/test/browser_tests/tahai_finder_browsertest.obj',
    'obj/chrome/test/browser_tests/multi_contents_view_browsertest.obj'
  )
  $result.targets = $targets
  & $python $logged --log (Join-Path $evidence 'build.log') -- (Join-Path $source 'third_party\ninja\ninja.exe') -C $BuildDirectory -j 3 @targets
  $result.buildExitCode = $LASTEXITCODE
  if ($LASTEXITCODE -ne 0) { throw "Native workflow batch failed with exit $LASTEXITCODE" }
  $test = Join-Path $build 'tahai_workflow_journal_tests.exe'
  Invoke-Check 'journal-discovery' @($test, '--gtest_list_tests')
  Invoke-Check 'journal-tests' @($test, '--gtest_filter=TahaiWorkflowJournalTest.*', '--test-launcher-jobs=1', '--test-launcher-retry-limit=0', '--test-launcher-bot-mode', ('--test-launcher-summary-output=' + (Join-Path $evidence 'journal-tests.json')))
  . (Join-Path $source 'chrome\installer\win\tahai_msix\release_evidence.ps1')
  $required = @('IntentSurvivesReopenAndCannotReplay', 'RejectedAttemptCannotBeRetried', 'KeysAreBoundedAndSeparateRunsRevisionsAndSteps', 'CorruptFileIsPreservedWithoutDispatch', 'FutureVersionIsPreservedAndNotExecuted', 'QuotaCannotDiscardOldAttemptToAllowReplay') | ForEach-Object { 'TahaiWorkflowJournalTest.' + $_ }
  $null = Assert-TahaiTestSummary (Read-TahaiEvidenceJson (Join-Path $evidence 'journal-tests.json')) $required 'native workflow journal' @('TahaiWorkflowJournalTest.*')
  $result.journalTestsExecuted = $true
} catch {
  $result.failure = $_.ToString()
  $_ | Out-String | Set-Content -LiteralPath (Join-Path $evidence 'runner-error.log') -Encoding utf8
} finally {
  if (Test-Path -LiteralPath $record) {
    & $python $logged --log (Join-Path $evidence 'source-comparison.log') -- $python tools/tahai/source_provenance.py --source $source --build $build --compare $record
    $result.sourceComparisonExitCode = $LASTEXITCODE
  }
  $result.finishedUtc = [DateTime]::UtcNow.ToString('o')
  $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'result.json') -Encoding utf8
  Pop-Location
  Write-Output $evidence
}
if ($result.failure -or $result.sourceComparisonExitCode -ne 0) { exit 1 }
exit 0
