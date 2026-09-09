param(
  [string]$BuildDirectory = 'out\tahai_release_x64',
  [string]$DepotTools = 'D:\dev\depot_tools',
  # Chromium's template/plugin-heavy units can exceed several GiB each.
  [ValidateRange(1, 6)][int]$Jobs = 3,
  # Preserve every failed native attempt for diagnosis, then bind release
  # evidence only to the final clean Ninja attempt. This handles transient
  # Windows compiler process failures without hiding a source failure.
  [ValidateRange(1, 5)][int]$MaxBuildAttempts = 4
)

$ErrorActionPreference = 'Stop'
$nativeSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$nativeBuild = Join-Path $nativeSource $BuildDirectory
$runDirectory = Join-Path $nativeBuild ('upgrade-checks-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $runDirectory | Out-Null
$statusFile = Join-Path $runDirectory 'status.json'
$runnerStartedUtc = [Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o')
$stage = 'setup'
function Write-UpgradeStatus([string]$state, [int]$code = 0) {
  [ordered]@{
    state = $state
    stage = $stage
    exit_code = $code
    process_id = $PID
    process_started_utc = $runnerStartedUtc
    updated_utc = [DateTime]::UtcNow.ToString('o')
    source = $nativeSource
    build = $nativeBuild
    logs = $runDirectory
  } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding utf8
}

Push-Location $nativeSource
try {
  Write-UpgradeStatus 'running'
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  $installation = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
  if (-not $installation.installationPath) { throw 'Visual Studio C++ build tools were not found.' }
  if ($installation.installationVersion -like '18.*') {
    $env:vs2026_install = [string]$installation.installationPath
  } else {
    $env:vs2022_install = [string]$installation.installationPath
  }
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
  # Keep GN's Python selection stable between generations. Alternating system
  # Python and depot_tools Python invalidates thousands of action commands.
  $bootstrapPython = Get-ChildItem -LiteralPath $DepotTools -Directory -Filter 'bootstrap-*_bin' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $bootstrapPython) { throw 'Run depot_tools bootstrap before building.' }
  $pythonDirectory = Join-Path $bootstrapPython.FullName 'python3\bin'
  $python = Join-Path $pythonDirectory 'python3.exe'
  $logged = Join-Path $nativeSource 'tools\tahai\run_logged.py'
  $env:PATH = $pythonDirectory + ';' + $DepotTools + ';' + $env:PATH.Replace('"', '')

  $stage = 'creator and bundled-list checks'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'creator-tests.log') -- $python -m unittest discover -s docs/tahai-skins -v
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  & $python $logged --log (Join-Path $runDirectory 'guard-list-check.log') -- $python third_party/tahai_guard_lists/build_rules.py --check
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  & $python $logged --log (Join-Path $runDirectory 'creator-kit-check.log') -- $python docs/tahai-skins/build_creator_kit.py --check
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }

  $stage = 'generate native build'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'gn.log') -- (Join-Path $nativeSource 'buildtools\win\gn.exe') gen $BuildDirectory
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }

  $stage = 'build chrome and native tests'
  Write-UpgradeStatus 'running'
  # Each release report must bind four outputs produced during this actual
  # successful build interval. Preserve old binaries before asking Ninja to
  # relink them; never change timestamps or relabel a previous build as fresh.
  $previousArtifacts = Join-Path $runDirectory 'previous-artifacts'
  New-Item -ItemType Directory -Path $previousArtifacts | Out-Null
  $buildPrefix = [IO.Path]::GetFullPath($nativeBuild).TrimEnd('\') + '\'
  foreach ($name in @('chrome.exe', 'chrome.dll', 'browser_tests.exe',
                      'tahai_mission_service_tests.exe')) {
    $artifactPath = [IO.Path]::GetFullPath((Join-Path $nativeBuild $name))
    $archivePath = [IO.Path]::GetFullPath((Join-Path $previousArtifacts $name))
    if (-not $artifactPath.StartsWith($buildPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not $archivePath.StartsWith($buildPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Refusing to archive a binary outside the selected build directory.'
    }
    if (Test-Path -LiteralPath $artifactPath) {
      $artifact = Get-Item -LiteralPath $artifactPath
      if ($artifact.PSIsContainer -or ($artifact.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw ('Expected a regular build output: ' + $artifactPath)
      }
      Move-Item -LiteralPath $artifactPath -Destination $archivePath
    }
  }
  $buildStarted = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $buildExit = 1
  for ($attempt = 1; $attempt -le $MaxBuildAttempts; $attempt++) {
    $attemptLog = Join-Path $runDirectory ("build-attempt-{0}.log" -f $attempt)
    & $python $logged --log $attemptLog -- (Join-Path $nativeSource 'third_party\ninja\ninja.exe') -C $BuildDirectory -j $Jobs chrome browser_tests tahai_mission_service_tests
    $buildExit = $LASTEXITCODE
    if ($buildExit -eq 0) {
      # The evidence verifier rejects failed lines. It receives this clean,
      # successful final attempt while the failed attempts stay beside it for
      # transparent diagnosis.
      Copy-Item -LiteralPath $attemptLog -Destination (Join-Path $runDirectory 'build.log') -ErrorAction Stop
      break
    }
  }
  [ordered]@{buildStartedUnixMs=$buildStarted; buildFinishedUnixMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); buildExitCode=$buildExit} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'build-result.json') -Encoding utf8
  if ($buildExit -ne 0) { Write-UpgradeStatus 'failed' $buildExit; exit $buildExit }

  $stage = 'all native TAHAI tests'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'native-tests.log') -- (Join-Path $nativeBuild 'tahai_mission_service_tests.exe') '--test-launcher-jobs=1' '--test-launcher-retry-limit=0' ('--test-launcher-summary-output=' + (Join-Path $runDirectory 'native-tests.json'))
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }

  $stage = 'native browser behavior tests'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'browser-tests.log') -- (Join-Path $nativeBuild 'browser_tests.exe') '--gtest_filter=*Tahai*' '--test-launcher-jobs=1' '--test-launcher-retry-limit=0' '--test-launcher-bot-mode' ('--test-launcher-summary-output=' + (Join-Path $runDirectory 'browser-tests.json'))
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  $stage = 'complete'
  Write-UpgradeStatus 'passed'
} catch {
  $_ | Out-String | Set-Content -LiteralPath (Join-Path $runDirectory 'runner-error.log')
  Write-UpgradeStatus 'failed' 1
  throw
} finally {
  Pop-Location
}
