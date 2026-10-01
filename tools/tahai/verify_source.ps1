# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Source preflight only: never starts GN, Ninja, browser release tests or MSIX.
[CmdletBinding()]
param(
    [string]$PythonExecutable = 'C:\Python314\python.exe',
    [string]$NodeExecutable = 'C:\Program Files\nodejs\node.exe',
    [string]$PowerShellExecutable = 'C:\Program Files\PowerShell\7\pwsh.exe',
    [string]$EvidenceDirectory = '',
    [switch]$RenderCss
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'source_preflight.ps1')
. (Join-Path $taskRoot 'chrome/installer/win/tahai_msix/release_evidence.ps1')
foreach ($executable in @($PythonExecutable, $NodeExecutable, $PowerShellExecutable)) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Missing source-check interpreter: $executable" }
}
$taskEvidence = if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
    Join-Path $taskRoot ('out\source-review-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
} else { [IO.Path]::GetFullPath($EvidenceDirectory) }
$taskOutputPrefix = [IO.Path]::GetFullPath((Join-Path $taskRoot 'out')).TrimEnd('\') + '\'
if (-not $taskEvidence.StartsWith($taskOutputPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Source evidence must be a new directory beneath this checkout/out.'
}
New-Item -ItemType Directory -Path $taskEvidence -ErrorAction Stop | Out-Null
$taskStarted = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$taskResults = [Collections.Generic.List[object]]::new()
$taskTools = [Collections.Generic.List[object]]::new()
$taskScripts = @()
$taskIdentity = $null
$taskUnchanged = $false
$taskExecutables = @{python=$PythonExecutable; node=$NodeExecutable; powershell=$PowerShellExecutable}
function Invoke-SourceCheck($Suite) {
    $log = Join-Path $taskEvidence ('source-' + $Suite.name + '.log')
    $arguments = @($Suite.arguments | ForEach-Object { if ($_ -ceq '{powershell}') { $PowerShellExecutable } else { $_ } })
    & $PythonExecutable (Join-Path $PSScriptRoot 'run_logged.py') --log $log -- $taskExecutables[$Suite.tool] @arguments
    $code = $LASTEXITCODE
    $checks = 0
    $status = 'failed'
    try {
        if ($code -eq 0) {
            $checks = Get-TahaiSourceCheckCount $Suite.name (Get-Content -LiteralPath $log -Raw)
            if ($checks -le 0) { throw "Zero source-check selection: $($Suite.name)" }
            $status = 'passed'
        }
    } finally {
        $taskResults.Add([ordered]@{name=$Suite.name; exit_code=$code; status=$status; checks=$checks;
            log=@{file=[IO.Path]::GetFileName($log); sha256=(Get-FileHash -LiteralPath $log -Algorithm SHA256).Hash}})
    }
    if ($status -cne 'passed') { throw "Source check failed: $($Suite.name) (exit $code). Evidence: $taskEvidence" }
}
function Add-SourceTool([string]$Name, [string]$Executable, [string[]]$Arguments) {
    $version = (& $Executable @Arguments | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($version)) { throw "Cannot record source tool version: $Name" }
    $taskTools.Add([ordered]@{name=$Name; path=$Executable; version=$version})
}
Push-Location $taskRoot
$taskExit = 1
try {
    & $PythonExecutable (Join-Path $PSScriptRoot 'source_provenance.py') --source $taskRoot --source-only --output (Join-Path $taskEvidence 'source-start.json')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot capture source preflight identity.' }
    $taskIdentity = Read-TahaiEvidenceJson (Join-Path $taskEvidence 'source-start.json')
    $taskScripts = @(Get-TahaiSourceScriptRecords $taskRoot)
    Add-SourceTool 'python' $PythonExecutable @('--version')
    Add-SourceTool 'node' $NodeExecutable @('--version')
    Add-SourceTool 'powershell' $PowerShellExecutable @('-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()')
    Add-SourceTool 'git' (@(Get-Command git -CommandType Application)[0].Source) @('--version')
    foreach ($package in @('cryptography', 'playwright')) {
        Add-SourceTool $package $PythonExecutable @('-c', "import importlib.metadata; print(importlib.metadata.version('$package'))")
    }
    $plan = @(Get-TahaiSourcePlan $RenderCss.IsPresent)
    foreach ($suite in $plan) { Invoke-SourceCheck $suite }
    if ($taskResults.Count -ne $plan.Count -or $plan.Count -le 0) { throw 'Incomplete source-check selection' }
    $taskExit = 0
} finally {
    try {
      if ($null -ne $taskIdentity) {
        & $PythonExecutable (Join-Path $PSScriptRoot 'source_provenance.py') --source $taskRoot --source-only --compare (Join-Path $taskEvidence 'source-start.json')
        $taskUnchanged = $LASTEXITCODE -eq 0
      }
      if (-not $taskUnchanged) { $taskExit = 1 }
      [ordered]@{
        schemaVersion=2
        scope='source-preflight-only; native/runtime/package acceptance remains pending'
        source=$taskRoot
        source_identity=$taskIdentity
        source_unchanged=$taskUnchanged
        render_css=$RenderCss.IsPresent
        started_unix_ms=$taskStarted
        finished_unix_ms=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        tools=$taskTools
        scripts=$taskScripts
        exit_code=$taskExit
        suites=$taskResults.Count
        results=$taskResults
      } | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $taskEvidence 'source-preflight-summary.json') -Encoding utf8
    } finally {
      Pop-Location
      Write-Output "Source preflight evidence: $taskEvidence"
    }
}
if ($taskExit -ne 0) { throw 'Source changed during preflight; evidence is not eligible for release.' }
if ($RenderCss) { $null = Assert-TahaiSourcePreflight (Join-Path $taskEvidence 'source-preflight-summary.json') }
