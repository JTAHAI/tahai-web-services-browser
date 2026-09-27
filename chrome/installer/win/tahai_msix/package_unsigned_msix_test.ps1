# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0

# Exercise the production helper in fresh PowerShell processes without an
# inherited $python variable. The fixture is not release evidence and never
# invokes the packager, MakeAppx, or any Chromium binary.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSCommandPath
$helpers = Join-Path $root 'tahai_package_helpers.ps1'
$interpreter = Join-Path $root 'testdata\recording_interpreter.cmd'
$sourceValidator = Join-Path $root 'testdata\source_validator_fixture.py'
$resourceValidator = Join-Path $root 'testdata\resource_validator_fixture.py'
$probe = Join-Path $root 'testdata\package_helper_clean_process_probe.ps1'
$poison = Join-Path $root 'testdata\poison_python.cmd'
$pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
foreach ($path in @($helpers, $interpreter, $sourceValidator, $resourceValidator,
                    $probe, $poison, $pwsh)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Test fixture is unavailable: $path"
    }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('tahai-msix-helper-' + [guid]::NewGuid())
$originalPath = $env:PATH
$null = New-Item -ItemType Directory -Path $temp -ErrorAction Stop
try {
    $log = Join-Path $temp 'interpreter.log'
    $poisonLog = Join-Path $temp 'ambient-python.log'
    $env:PATH = (Join-Path $root 'testdata') + ';' + $originalPath
    $env:TAHAI_PACKAGE_TEST_POISON_LOG = $poisonLog
    & $pwsh -NoProfile -File $probe -Helpers $helpers -Interpreter $interpreter `
        -SourceValidator $sourceValidator -ResourceValidator $resourceValidator `
        -BuildDirectory $temp -InterpreterLog $log
    if ($LASTEXITCODE -ne 0) {
        throw "Clean-process pinned-interpreter test failed with exit $LASTEXITCODE"
    }
    $records = @(Get-Content -LiteralPath $log)
    $expected = @(
        "$interpreter|$sourceValidator --build-dir $temp",
        "$interpreter|$resourceValidator --build-dir $temp"
    )
    if (@($records).Count -ne 2 -or $records[0] -cne $expected[0] -or
        $records[1] -cne $expected[1] -or (Test-Path -LiteralPath $poisonLog)) {
        throw 'Pinned interpreter selection was not exclusive and exact.'
    }
    Remove-Item -LiteralPath $log -Force -ErrorAction Stop
    & $pwsh -NoProfile -File $probe -Helpers $helpers -Interpreter $interpreter `
        -SourceValidator $sourceValidator -ResourceValidator $resourceValidator `
        -BuildDirectory $temp -InterpreterLog $log -FailScript $resourceValidator
    if ($LASTEXITCODE -ne 0) {
        throw "Clean-process helper failure-propagation test failed with exit $LASTEXITCODE"
    }
    $failureRecords = @(Get-Content -LiteralPath $log)
    if (@($failureRecords).Count -ne 2 -or $failureRecords[0] -cne $expected[0] -or
        $failureRecords[1] -cne $expected[1] -or (Test-Path -LiteralPath $poisonLog)) {
        throw 'Pinned helper did not propagate the controlled resource failure safely.'
    }
    $packageSource = Get-Content -LiteralPath (Join-Path $root 'package_unsigned_msix.ps1') -Raw
    if ($packageSource -notmatch [regex]::Escape('Invoke-TahaiReleaseResourceValidation -PythonExecutable $ProvenancePython') -or
        $packageSource -match '(?m)^\s*&\s*\$python\s+') {
        throw 'The package pipeline is not bound to the pinned resource-validation helper.'
    }
    Write-Output 'TAHAI package helper: clean-process interpreter selection and failure propagation passed.'
} finally {
    $env:PATH = $originalPath
    if (Test-Path -LiteralPath $temp) {
        Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction Stop
    }
}
