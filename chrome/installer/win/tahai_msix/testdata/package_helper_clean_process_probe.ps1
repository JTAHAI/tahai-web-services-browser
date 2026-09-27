param(
    [Parameter(Mandatory = $true)][string]$Helpers,
    [Parameter(Mandatory = $true)][string]$Interpreter,
    [Parameter(Mandatory = $true)][string]$SourceValidator,
    [Parameter(Mandatory = $true)][string]$ResourceValidator,
    [Parameter(Mandatory = $true)][string]$BuildDirectory,
    [Parameter(Mandatory = $true)][string]$InterpreterLog,
    [string]$FailScript = ''
)

$ErrorActionPreference = 'Stop'
# This process is intentionally new and proves that no inherited ambient
# `$python` value is needed by the production helper.
Remove-Variable -Name python -Force -ErrorAction SilentlyContinue
. $Helpers
$env:TAHAI_PACKAGE_TEST_INTERPRETER_LOG = $InterpreterLog
$env:TAHAI_PACKAGE_TEST_FAIL_SCRIPT = $FailScript
Invoke-TahaiReleaseResourceValidation -PythonExecutable $Interpreter `
    -ValidatorScript $SourceValidator -BuildDirectory $BuildDirectory
if ([string]::IsNullOrEmpty($FailScript)) {
    Invoke-TahaiReleaseResourceValidation -PythonExecutable $Interpreter `
        -ValidatorScript $ResourceValidator -BuildDirectory $BuildDirectory
    exit 0
}
try {
    Invoke-TahaiReleaseResourceValidation -PythonExecutable $Interpreter `
        -ValidatorScript $ResourceValidator -BuildDirectory $BuildDirectory
    throw 'A failing resource helper was accepted.'
} catch {
    if ($_.Exception.Message -notmatch 'exit code 37') {
        throw
    }
}
