[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RunDirectory,
  [Parameter(Mandatory = $true)]
  [string]$BuildDirectory,
  [Parameter(Mandatory = $true)]
  [string]$SmokePath,
  [Parameter(Mandatory = $true)]
  [string]$EvidenceDirectory
)

# Assemble, but never invent, the evidence consumed by the Store packager. The
# builder and smoke runner must already have produced their real reports.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-RequiredFile([string]$Path) {
  $item = Get-Item -LiteralPath $Path -ErrorAction Stop
  if ($item.PSIsContainer -or $item.Length -le 0 -or
      ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "Expected a nonempty regular evidence file: $Path"
  }
  return $item
}

function Get-Record([string]$Path) {
  $item = Get-RequiredFile $Path
  return [ordered]@{
    file = $item.Name
    sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
  }
}

function Copy-EvidenceFile([string]$Path) {
  $item = Get-RequiredFile $Path
  $destination = Join-Path $EvidenceDirectory $item.Name
  if (Test-Path -LiteralPath $destination) {
    throw "Evidence output would overwrite an existing file: $destination"
  }
  Copy-Item -LiteralPath $item.FullName -Destination $destination -ErrorAction Stop
  return $destination
}

$RunDirectory = (Resolve-Path -LiteralPath $RunDirectory).Path
$BuildDirectory = (Resolve-Path -LiteralPath $BuildDirectory).Path
$SmokePath = (Resolve-Path -LiteralPath $SmokePath).Path
if (Test-Path -LiteralPath $EvidenceDirectory) {
  throw "Evidence output directory must be new: $EvidenceDirectory"
}
New-Item -ItemType Directory -Path $EvidenceDirectory -ErrorAction Stop | Out-Null

$buildResult = Get-Content -LiteralPath (Join-Path $RunDirectory 'build-result.json') -Raw |
  ConvertFrom-Json
if ($buildResult.buildExitCode -ne 0 -or
    $buildResult.buildStartedUnixMs -le 0 -or
    $buildResult.buildFinishedUnixMs -le $buildResult.buildStartedUnixMs) {
  throw 'The selected native build did not complete successfully.'
}

$copiedBuildLog = Copy-EvidenceFile (Join-Path $RunDirectory 'build.log')
$copiedNative = Copy-EvidenceFile (Join-Path $RunDirectory 'native-tests.json')
$copiedBrowser = Copy-EvidenceFile (Join-Path $RunDirectory 'browser-tests.json')

$smoke = Get-Content -LiteralPath $SmokePath -Raw | ConvertFrom-Json
if ($smoke.schemaVersion -ne 1 -or $null -eq $smoke.checks) {
  throw 'The smoke report has an invalid schema.'
}
$smokeRoot = Split-Path -Parent $SmokePath
foreach ($check in @($smoke.checks)) {
  if ([string]::IsNullOrWhiteSpace($check.name) -or
      [string]::IsNullOrWhiteSpace($check.evidence.file) -or
      $check.evidence.file -notmatch '^[A-Za-z0-9][A-Za-z0-9_.-]*$') {
    throw 'The smoke report contains an invalid check evidence reference.'
  }
  $sourceEvidence = Join-Path $smokeRoot $check.evidence.file
  $copiedCheck = Copy-EvidenceFile $sourceEvidence
  $check.evidence.file = (Get-Item -LiteralPath $copiedCheck).Name
  $check.evidence.sha256 = (Get-FileHash -LiteralPath $copiedCheck -Algorithm SHA256).Hash
}
$copiedSmoke = Join-Path $EvidenceDirectory 'smoke.json'
if (Test-Path -LiteralPath $copiedSmoke) {
  throw "Evidence output would overwrite an existing file: $copiedSmoke"
}
$smoke | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $copiedSmoke -Encoding utf8

$artifacts = foreach ($name in @('chrome.exe', 'chrome.dll',
                                 'tahai_mission_service_tests.exe',
                                 'browser_tests.exe')) {
  $file = Get-RequiredFile (Join-Path $BuildDirectory $name)
  [ordered]@{
    name = $name
    bytes = [int64]$file.Length
    sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  }
}

$release = [ordered]@{
  schemaVersion = 1
  buildExitCode = [int]$buildResult.buildExitCode
  buildStartedUnixMs = [int64]$buildResult.buildStartedUnixMs
  buildFinishedUnixMs = [int64]$buildResult.buildFinishedUnixMs
  artifacts = @($artifacts)
  buildLog = Get-Record $copiedBuildLog
  nativeTests = [ordered]@{
    file = (Get-Item -LiteralPath $copiedNative).Name
    sha256 = (Get-FileHash -LiteralPath $copiedNative -Algorithm SHA256).Hash
    exitCode = 0
  }
  browserTests = [ordered]@{
    file = (Get-Item -LiteralPath $copiedBrowser).Name
    sha256 = (Get-FileHash -LiteralPath $copiedBrowser -Algorithm SHA256).Hash
    exitCode = 0
  }
  smoke = Get-Record $copiedSmoke
}
$releasePath = Join-Path $EvidenceDirectory 'release.json'
$release | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $releasePath -Encoding utf8
Get-Item -LiteralPath $releasePath | Select-Object FullName, Length, LastWriteTimeUtc
