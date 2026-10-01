# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
# Synthetic contract fixtures only; never native or source acceptance evidence.
function New-TahaiSourcePreflightFixture([string]$Root, $Identity, [long]$Started, [long]$Finished) {
    $sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
    $results = foreach ($suite in (Get-TahaiSourcePlan)) {
        $text = switch ($suite.name) {
            'guard-source-inventory' { '{"source_inventory_verified":true,"packages":1}'; break }
            'guard-lists' { '[{"synthetic":true}]'; break }
            'creator-kit' { 'Checked synthetic.zip: 1 bytes'; break }
            'source-render-and-command-palette' { '{"checks":1,"failed":[],"scope":"SYNTHETIC fixture"}'; break }
            default { "1 synthetic checks passed. NOT actual suite acceptance: $($suite.name)" }
        }
        $name = 'source-' + $suite.name + '.log'
        $path = Join-Path $Root $name
        [IO.File]::WriteAllText($path, $text)
        [ordered]@{name=$suite.name; exit_code=0; status='passed'; checks=1;
            log=@{file=$name; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}}
    }
    return [ordered]@{schemaVersion=2; scope='SYNTHETIC fixture only'; source_identity=$Identity;
        source_unchanged=$true; render_css=$true; started_unix_ms=$Started; finished_unix_ms=$Finished;
        tools=@(@('python', 'node', 'powershell', 'git', 'cryptography', 'playwright') | ForEach-Object { @{name=$_; version='SYNTHETIC'; path='SYNTHETIC'} });
        scripts=@(Get-TahaiSourceScriptRecords $sourceRoot); exit_code=0; suites=@($results).Count; results=@($results)}
}
