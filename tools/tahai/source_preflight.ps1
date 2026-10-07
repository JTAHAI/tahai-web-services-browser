# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Shared source-only selection and fail-closed evidence contract. No build/UI.
function Get-TahaiSourcePlan([bool]$RenderCss = $true) {
    $plan = @([pscustomobject]@{name='royal-resources'; tool='powershell'; arguments=@('-NoProfile', '-File', 'tools/tahai/royal_brand_assets.ps1')})
    foreach ($name in @('workflow_designer', 'workflow_editor_events', 'workflow_input_events',
        'studio_editor', 'studio_palette_events', 'studio_history', 'studio_transfer',
        'offline_creator', 'native_mode_placement', 'surface_designer', 'surface_designer_events',
        'capability_review_events', 'local_oi_controls', 'work_modes_events', 'local_oi_navigation')) {
        $plan += [pscustomobject]@{name=$name; tool='node'; arguments=@("tools/tahai/${name}_test.js")}
    }
    foreach ($name in @('source_provenance', 'audit_guard_dependencies', 'check_windows_build_prerequisites', 'midl_dynamic_paths', 'guard_rust_policy', 'rust_stdlib_paths', 'rust_bindgen_paths')) {
        $plan += [pscustomobject]@{name=$name; tool='python'; arguments=@("tools/tahai/${name}_test.py")}
    }
    $plan += @(
        [pscustomobject]@{name='release-runner-rejections'; tool='python'; arguments=@('tools/tahai/verify_upgrade_test.py', '--powershell', '{powershell}')},
        [pscustomobject]@{name='guard-source-inventory'; tool='python'; arguments=@('tools/tahai/audit_guard_dependencies.py', '--source-inventory', 'docs/tahai-guard-import-inventory.json')},
        [pscustomobject]@{name='packaged-resource-unit'; tool='python'; arguments=@('chrome/installer/win/tahai_msix/verify_release_resources_test.py')},
        [pscustomobject]@{name='creator-release'; tool='python'; arguments=@('docs/tahai-skins/test_build_skin.py', '--release-gate', '-v')},
        [pscustomobject]@{name='creator-kit'; tool='python'; arguments=@('docs/tahai-skins/build_creator_kit.py', '--check', '--chromium-version-file', 'chrome/VERSION')},
        [pscustomobject]@{name='guard-lists'; tool='python'; arguments=@('third_party/tahai_guard_lists/build_rules.py', '--check')})
    foreach ($name in @('package_unsigned_msix', 'release_evidence')) {
        $plan += [pscustomobject]@{name=$name; tool='powershell'; arguments=@('-NoProfile', '-File', "chrome/installer/win/tahai_msix/${name}_test.ps1")}
    }
    $plan += [pscustomobject]@{name='source-preflight-contract'; tool='powershell'; arguments=@('-NoProfile', '-File', 'tools/tahai/source_preflight_test.ps1')}
    if ($RenderCss) {
        $plan += [pscustomobject]@{name='source-render-and-command-palette'; tool='python'; arguments=@('tools/tahai/royal_brand_render_test.py')}
    }
    return $plan
}

function Get-TahaiSourceScriptRecords([string]$SourceRoot) {
    $paths = @('tools/tahai/verify_source.ps1', 'tools/tahai/source_preflight.ps1',
        'tools/tahai/run_logged.py', 'tools/tahai/source_provenance.py', 'build/toolchain/win/midl.py',
        'build/rust/std/find_std_rlibs.py', 'build/rust/gni_impl/run_bindgen.py',
        'tools/tahai/source_preflight_test_fixture.ps1',
        'tools/tahai/verify_upgrade.ps1', 'tools/tahai/assemble_release_evidence.ps1',
        'chrome/installer/win/tahai_msix/release_evidence.ps1',
        'chrome/installer/win/tahai_msix/package_unsigned_msix.ps1',
        'tools/tahai/source-check-requirements.txt',
        '.github/workflows/source-checks.yml', '.github/workflows/native-release.yml')
    foreach ($suite in (Get-TahaiSourcePlan)) {
        $paths += @($suite.arguments | Where-Object { $_ -match '\.(ps1|py|js)$' })
    }
    foreach ($path in ($paths | Sort-Object -Unique)) {
        $item = Get-Item -LiteralPath (Join-Path $SourceRoot $path) -ErrorAction Stop
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Source-check script is not a regular file: $path"
        }
        [pscustomobject]@{path=$path; sha256=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
    }
}

function Get-TahaiSourceCheckCount([string]$Name, [string]$Text) {
    # Test launchers must report a nonzero actual selection, not just exit zero.
    if ($Text -match '(?m)^Ran (\d+) tests? in ') { return [int]$Matches[1] }
    if ($Text -match '(?m)^PASS (\d+) [^\r\n]* checks\b') { return [int]$Matches[1] }
    if ($Text -match '(?m)^(?:TAHAI packaging evidence guard: |TAHAI source preflight contract: |PASS |Verified )?(\d+) [^\r\n]*(?:checks|derivatives)[^\r\n]*(?:passed|against|checks)') { return [int]$Matches[1] }
    switch ($Name) {
        'guard-source-inventory' {
            $data = $Text | ConvertFrom-Json
            if ($data.source_inventory_verified -eq $true) { return [int]$data.packages }
        }
        'guard-lists' { return @($Text | ConvertFrom-Json).Count }
        'creator-kit' { return @([regex]::Matches($Text, '(?m)^Checked [^\r\n]+: \d+ bytes')).Count }
        'package_unsigned_msix' {
            if ($Text -match 'clean-process interpreter selection and failure propagation passed\.') { return 1 }
        }
        'source-render-and-command-palette' {
            $data = $Text | ConvertFrom-Json
            if (@($data.failed).Count -eq 0) { return [int]$data.checks }
        }
    }
    throw "Source suite did not report a nonzero selection: $Name"
}

function Assert-TahaiSourcePreflight {
    param([string]$SummaryPath, $NativeSource = $null, [long]$BuildStartedUnixMs = 0)
    Set-StrictMode -Version Latest
    $root = Split-Path -Parent (Resolve-Path -LiteralPath $SummaryPath).Path
    $summary = Read-TahaiEvidenceJson $SummaryPath
    $plan = @(Get-TahaiSourcePlan)
    if (-not (Test-TahaiJsonInteger $summary.schemaVersion) -or $summary.schemaVersion -ne 2 -or
        -not (Test-TahaiJsonInteger $summary.exit_code) -or $summary.exit_code -ne 0 -or
        $summary.render_css -isnot [bool] -or -not $summary.render_css -or
        $summary.source_unchanged -isnot [bool] -or -not $summary.source_unchanged -or
        -not (Test-TahaiJsonInteger $summary.suites) -or $summary.suites -ne $plan.Count -or
        @($summary.results).Count -ne $plan.Count) {
        throw 'A complete successful source preflight including isolated CSS rendering is required.'
    }
    if (-not (Test-TahaiJsonInteger $summary.started_unix_ms) -or
        -not (Test-TahaiJsonInteger $summary.finished_unix_ms) -or
        $summary.started_unix_ms -le 0 -or $summary.finished_unix_ms -le $summary.started_unix_ms -or
        $summary.finished_unix_ms -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
        ($BuildStartedUnixMs -gt 0 -and $summary.finished_unix_ms -gt $BuildStartedUnixMs)) {
        throw 'Source preflight must finish before compilation and have valid timestamps.'
    }
    $identity = $summary.source_identity
    if ($identity.schemaVersion -ne 1 -or $identity.identity.head -cnotmatch '^[a-f0-9]{40}$' -or
        $identity.identity.tree -cnotmatch '^[a-f0-9]{40}$' -or
        $identity.identitySha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid source preflight identity.' }
    if ($null -ne $NativeSource -and (
        $identity.identitySha256 -cne $NativeSource.sourceIdentitySha256 -or
        $identity.identity.head -cne $NativeSource.identity.head -or
        $identity.identity.tree -cne $NativeSource.identity.tree -or
        $identity.identity.diffSha256 -cne $NativeSource.identity.diffSha256 -or
        $identity.identity.indexDiffSha256 -cne $NativeSource.identity.indexDiffSha256 -or
        (ConvertTo-Json -InputObject @($identity.identity.overrides) -Depth 8 -Compress) -cne
        (ConvertTo-Json -InputObject @($NativeSource.identity.overrides) -Depth 8 -Compress))) {
        throw 'Source preflight and native provenance describe different source snapshots.'
    }
    foreach ($tool in @('python', 'node', 'powershell', 'git', 'cryptography', 'playwright')) {
        $records = @($summary.tools | Where-Object { $_.name -ceq $tool })
        if ($records.Count -ne 1 -or [string]::IsNullOrWhiteSpace($records[0].version) -or
            [string]::IsNullOrWhiteSpace($records[0].path)) { throw "Missing source tool version: $tool" }
    }
    if (@($summary.tools).Count -ne 6) { throw 'Unexpected source tool records.' }
    $sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
    $expectedScripts = @(Get-TahaiSourceScriptRecords $sourceRoot)
    if (@($summary.scripts).Count -ne $expectedScripts.Count) { throw 'Incomplete source-check script hashes.' }
    foreach ($script in $expectedScripts) {
        $records = @($summary.scripts | Where-Object { $_.path -ceq $script.path })
        if ($records.Count -ne 1 -or $records[0].sha256 -cne $script.sha256) {
            throw "Source-check script changed since preflight: $($script.path)"
        }
    }
    foreach ($suite in $plan) {
        $results = @($summary.results | Where-Object { $_.name -ceq $suite.name })
        if ($results.Count -ne 1) { throw "Missing or duplicate source suite: $($suite.name)" }
        $result = $results[0]
        if (-not (Test-TahaiJsonInteger $result.exit_code) -or $result.exit_code -ne 0 -or
            $result.status -cne 'passed' -or -not (Test-TahaiJsonInteger $result.checks) -or $result.checks -le 0 -or
            $result.log.file -cne ('source-' + $suite.name + '.log')) {
            throw "Failed, empty or malformed source suite: $($suite.name)"
        }
        $log = Assert-TahaiEvidenceFile $root $result.log $summary.started_unix_ms
        $count = Get-TahaiSourceCheckCount $suite.name (Get-Content -LiteralPath $log -Raw)
        if ($count -ne $result.checks) { throw "Source selection differs from its log: $($suite.name)" }
    }
    return $summary
}
