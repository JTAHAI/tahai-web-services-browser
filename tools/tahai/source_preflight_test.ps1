# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'source_preflight.ps1')
. (Join-Path $PSScriptRoot 'source_preflight_test_fixture.ps1')
. (Join-Path $PSScriptRoot '../../chrome/installer/win/tahai_msix/release_evidence.ps1')
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('tahai-preflight-test-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $fixtureRoot
$script:cases = 0
function Reject-Preflight([scriptblock]$Change, [string]$Name) {
    $changed = $baseline | ConvertFrom-Json
    & $Change $changed
    $changed | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $summaryPath -Encoding utf8
    $rejected = $false
    try { $null = Assert-TahaiSourcePreflight $summaryPath $native $buildStarted } catch { $rejected = $true }
    if (-not $rejected) { throw "Contract did not reject: $Name" }
    $script:cases++
}
try {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $buildStarted = $now - 5000
    $identity = @{schemaVersion=1; identitySha256=('a' * 64);
        identity=@{head=('b' * 40); tree=('c' * 40); diffSha256=('d' * 64); indexDiffSha256=('e' * 64); overrides=@()}}
    $native = @{identity=$identity.identity; sourceIdentitySha256=$identity.identitySha256}
    $summary = New-TahaiSourcePreflightFixture $fixtureRoot $identity ($now - 10000) ($now - 6000)
    $summaryPath = Join-Path $fixtureRoot 'source-preflight-summary.json'
    $baseline = $summary | ConvertTo-Json -Depth 14
    $baseline | Set-Content -LiteralPath $summaryPath -Encoding utf8
    $null = Assert-TahaiSourcePreflight $summaryPath $native $buildStarted
    $script:cases++
    Reject-Preflight { param($s) $s.schemaVersion = 1 } 'legacy summary'
    Reject-Preflight { param($s) $s.exit_code = 1 } 'failed runner'
    Reject-Preflight { param($s) $s.source_unchanged = $false } 'source mutation'
    Reject-Preflight { param($s) $s.render_css = $false } 'omitted render suite'
    Reject-Preflight { param($s) $s.suites = 0 } 'zero selection'
    Reject-Preflight { param($s) $s.results = $s.results[1..($s.results.Count - 1)] } 'missing suite'
    Reject-Preflight { param($s) $s.results[1].name = $s.results[0].name } 'duplicate suite'
    Reject-Preflight { param($s) $s.results[0].exit_code = '0' } 'coerced exit'
    Reject-Preflight { param($s) $s.results[0].status = 'skipped' } 'skipped suite'
    Reject-Preflight { param($s) $s.results[0].checks = 0 } 'zero checks'
    Reject-Preflight { param($s) $s.results[0].checks = 2 } 'count mismatch'
    Reject-Preflight { param($s) $s.results[0].log.file = '../escape.log' } 'log traversal'
    Reject-Preflight { param($s) $s.results[0].log.sha256 = 'a' * 64 } 'tampered log'
    Reject-Preflight { param($s) $s.source_identity.identity.head = 'f' * 40 } 'wrong commit'
    Reject-Preflight { param($s) $s.source_identity.identity.tree = 'f' * 40 } 'wrong tree'
    Reject-Preflight { param($s) $s.source_identity.identitySha256 = 'f' * 64 } 'wrong source snapshot'
    Reject-Preflight { param($s) $s.source_identity.identity.overrides = @(@{path='x'; deleted=$true}) } 'different dirty overrides'
    Reject-Preflight { param($s) $s.tools[0].version = '' } 'missing tool version'
    Reject-Preflight { param($s) $s.tools[1].name = 'python' } 'duplicate tool'
    Reject-Preflight { param($s) $s.scripts[0].sha256 = 'f' * 64 } 'changed script hash'
    Reject-Preflight { param($s) $s.scripts = @() } 'omitted script inventory'
    Reject-Preflight { param($s) $s.finished_unix_ms = $buildStarted + 1 } 'preflight after build'
    foreach ($text in @('Ran 0 tests in 0.0s', '0 synthetic checks passed', 'PASS', '')) {
        $rejected = $false
        try { $count = Get-TahaiSourceCheckCount 'fixture' $text; $rejected = $count -le 0 } catch { $rejected = $true }
        if (-not $rejected) { throw 'Empty launcher selection accepted.' }
        $script:cases++
    }
    foreach ($sample in @(
        @{text='PASS 17 offline creator export checks (no native runtime claim)'; count=17},
        @{text='Verified 33 Royal derivatives against the approved master; no build created.'; count=33},
        @{text='30 shipped Work Modes acknowledgment checks passed; DOM doubles only.'; count=30},
        @{text='TAHAI packaging evidence guard: 41 synthetic checks passed.'; count=41},
        @{text="Ran 4 tests in 1.0s`nOK"; count=4})) {
        if ((Get-TahaiSourceCheckCount 'fixture' $sample.text) -ne $sample.count) { throw 'Source count parser regression.' }
        $script:cases++
    }
} finally {
    $resolved = (Resolve-Path -LiteralPath $fixtureRoot).Path
    if ([IO.Path]::GetDirectoryName($resolved) -ne [IO.Path]::GetTempPath().TrimEnd('\') -or
        [IO.Path]::GetFileName($resolved) -notmatch '^tahai-preflight-test-[a-f0-9]{32}$') { throw 'Unsafe fixture cleanup target.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Output "TAHAI source preflight contract: $script:cases synthetic checks passed; no native acceptance claimed."
