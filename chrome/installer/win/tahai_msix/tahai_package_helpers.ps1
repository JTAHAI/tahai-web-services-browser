# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0

Set-StrictMode -Version Latest

function Invoke-TahaiReleaseResourceValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonExecutable,
        [Parameter(Mandatory = $true)]
        [string]$ValidatorScript,
        [Parameter(Mandatory = $true)]
        [string]$BuildDirectory
    )

    if (-not (Test-Path -LiteralPath $PythonExecutable -PathType Leaf)) {
        throw "Pinned validation interpreter is unavailable: $PythonExecutable"
    }
    if (-not (Test-Path -LiteralPath $ValidatorScript -PathType Leaf)) {
        throw "Release resource validator is unavailable: $ValidatorScript"
    }
    if (-not (Test-Path -LiteralPath $BuildDirectory -PathType Container)) {
        throw "Release build directory is unavailable: $BuildDirectory"
    }

    # Never discover ambient `python.exe`: the caller supplies the interpreter
    # that was pinned for the source/provenance validation of this same run.
    & $PythonExecutable $ValidatorScript --build-dir $BuildDirectory
    $validatorExit = $LASTEXITCODE
    if ($validatorExit -ne 0) {
        throw "TAHAI release resource/third-party notice verification failed with exit code $validatorExit."
    }
}
