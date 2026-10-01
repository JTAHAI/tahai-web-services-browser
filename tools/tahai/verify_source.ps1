# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Source preflight only: never starts GN, Ninja, browser release tests or MSIX.
[CmdletBinding()]
param(
    [string]$PythonExecutable = 'C:\Python314\python.exe',
    [string]$NodeExecutable = 'C:\Program Files\nodejs\node.exe',
    [string]$PowerShellExecutable = 'C:\Program Files\PowerShell\7\pwsh.exe',
    [switch]$RenderCss
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
foreach ($executable in @($PythonExecutable, $NodeExecutable, $PowerShellExecutable)) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Missing source-check interpreter: $executable" }
}
$taskEvidence = Join-Path $taskRoot ('out\source-review-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $taskEvidence -ErrorAction Stop | Out-Null
$taskResults = [Collections.Generic.List[object]]::new()
function Invoke-SourceCheck([string]$Name, [string]$Executable, [string[]]$Arguments) {
    $log = Join-Path $taskEvidence ($Name + '.log')
    & $PythonExecutable (Join-Path $PSScriptRoot 'run_logged.py') --log $log -- $Executable @Arguments
    $code = $LASTEXITCODE
    $taskResults.Add([ordered]@{name=$Name; exit_code=$code; log=[IO.Path]::GetFileName($log)})
    if ($code -ne 0) { throw "Source check failed: $Name (exit $code). Evidence: $taskEvidence" }
}
Push-Location $taskRoot
$taskExit = 1
try {
    Invoke-SourceCheck 'royal-resources' $PowerShellExecutable @('-NoProfile', '-File', 'tools/tahai/royal_brand_assets.ps1')
    foreach ($name in @('workflow_designer', 'workflow_editor_events', 'workflow_input_events',
                       'studio_editor', 'studio_palette_events', 'studio_history', 'studio_transfer', 'offline_creator', 'native_mode_placement',
                       'surface_designer', 'surface_designer_events', 'capability_review_events',
                       'local_oi_controls')) {
        Invoke-SourceCheck $name $NodeExecutable @("tools/tahai/${name}_test.js")
    }
    foreach ($name in @('source_provenance', 'audit_guard_dependencies', 'check_windows_build_prerequisites')) {
        Invoke-SourceCheck $name $PythonExecutable @("tools/tahai/${name}_test.py")
    }
    Invoke-SourceCheck 'release-runner-rejections' $PythonExecutable @('tools/tahai/verify_upgrade_test.py', '--powershell', $PowerShellExecutable)
    Invoke-SourceCheck 'guard-source-inventory' $PythonExecutable @('tools/tahai/audit_guard_dependencies.py', '--source-inventory', 'docs/tahai-guard-import-inventory.json')
    Invoke-SourceCheck 'packaged-resource-unit' $PythonExecutable @('chrome/installer/win/tahai_msix/verify_release_resources_test.py')
    Invoke-SourceCheck 'creator-release' $PythonExecutable @('docs/tahai-skins/test_build_skin.py', '--release-gate', '-v')
    Invoke-SourceCheck 'creator-kit' $PythonExecutable @('docs/tahai-skins/build_creator_kit.py', '--check', '--chromium-version-file', 'chrome/VERSION')
    Invoke-SourceCheck 'guard-lists' $PythonExecutable @('third_party/tahai_guard_lists/build_rules.py', '--check')
    foreach ($name in @('package_unsigned_msix', 'release_evidence')) {
        Invoke-SourceCheck $name $PowerShellExecutable @('-NoProfile', '-File', "chrome/installer/win/tahai_msix/${name}_test.ps1")
    }
    if ($RenderCss) {
        Invoke-SourceCheck 'source-render-and-command-palette' $PythonExecutable @('tools/tahai/royal_brand_render_test.py')
    }
    if ($taskResults.Count -ne (25 + [int]$RenderCss.IsPresent)) { throw 'Incomplete or zero source-check selection' }
    $taskExit = 0
} finally {
    [ordered]@{
        scope='source-preflight-only; native/runtime/package acceptance remains pending'
        source=$taskRoot
        head=(& git -C $taskRoot rev-parse HEAD)
        exit_code=$taskExit
        suites=$taskResults.Count
        results=$taskResults
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskEvidence 'summary.json') -Encoding utf8
    Pop-Location
    Write-Output "Source preflight evidence: $taskEvidence"
}
