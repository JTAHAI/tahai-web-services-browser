param(
  [string]$BuildDirectory = 'out\tahai_release_x64',
  [string]$DepotTools = 'D:\dev\depot_tools',
  # Optional creator-test interpreter with cryptography/Ed25519 installed.
  # This never changes Chromium's recovered Python or build environment.
  [string]$CreatorPython = '',
  # Chromium's template/plugin-heavy units can exceed several GiB each.
  [ValidateRange(1, 6)][int]$Jobs = 3,
  # Preserve every failed native attempt for diagnosis, then bind release
  # evidence only to the final clean Ninja attempt. This handles transient
  # Windows compiler process failures without hiding a source failure.
  [ValidateRange(1, 5)][int]$MaxBuildAttempts = 1,
  # Incremental repairs can reuse the existing supported graph. Ninja still
  # regenerates when a declared build input actually changes.
  [switch]$SkipGenerate,
  # Compiling does not implicitly authorize UI tests on the operator desktop.
  # A build-only run must never be reported as a passed release gate.
  [switch]$BuildOnly,
  # An operator names the dedicated Windows session/runner, not a hidden
  # console window on their everyday desktop. This is an explicit prerequisite.
  [string]$IsolatedTestSession
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
  if (-not $BuildOnly -and [string]::IsNullOrWhiteSpace($IsolatedTestSession)) {
    throw 'Interactive gates require a designated isolated Windows session. Use BuildOnly on the everyday desktop.'
  }
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  $installation = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
  if (-not $installation.installationPath) { throw 'Visual Studio C++ build tools were not found.' }
  # Chromium's local VS setup invokes vcvarsall through cmd.exe. A VS 18
  # BuildTools install below Program Files (x86) can otherwise hit cmd's
  # parentheses parsing path in that invocation. Resolve the real installed
  # directory to its Win32 short form once and use the same path for every GN
  # and Ninja recipe in this release run.
  $fileSystem = New-Object -ComObject Scripting.FileSystemObject
  $visualStudioPath = [string]$fileSystem.GetFolder([string]$installation.installationPath).ShortPath
  if (-not $visualStudioPath) { throw 'Could not resolve a stable Visual Studio path.' }
  if ($installation.installationVersion -like '18.*') {
    $env:vs2026_install = $visualStudioPath
  } else {
    $env:vs2022_install = $visualStudioPath
  }
  $env:GYP_MSVS_OVERRIDE_PATH = $visualStudioPath
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
  # Keep GN's Python selection stable between generations. Alternating system
  # Python and depot_tools Python invalidates thousands of action commands.
  $bootstrapPython = Get-ChildItem -LiteralPath $DepotTools -Directory -Filter 'bootstrap-*_bin' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $bootstrapPython) { throw 'Run depot_tools bootstrap before building.' }
  $pythonDirectory = Join-Path $bootstrapPython.FullName 'python3\bin'
  $python = Join-Path $pythonDirectory 'python3.exe'
  $creatorTestExecutable = if ([string]::IsNullOrWhiteSpace($CreatorPython)) { $python } else { $CreatorPython }
  if (-not (Test-Path -LiteralPath $creatorTestExecutable -PathType Leaf)) {
    throw 'CreatorPython must identify an existing Python executable with Ed25519 support.'
  }
  $logged = Join-Path $nativeSource 'tools\tahai\run_logged.py'
  $env:PATH = $pythonDirectory + ';' + $DepotTools + ';' + $env:PATH.Replace('"', '')

  $stage = 'creator and bundled-list checks'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'creator-tests.log') -- $creatorTestExecutable docs/tahai-skins/test_build_skin.py --release-gate -v
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  & $python $logged --log (Join-Path $runDirectory 'guard-list-check.log') -- $python third_party/tahai_guard_lists/build_rules.py --check
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  & $python $logged --log (Join-Path $runDirectory 'creator-kit-check.log') -- $python docs/tahai-skins/build_creator_kit.py --check
  if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }

  if (-not $SkipGenerate) {
    $stage = 'generate native build'
    Write-UpgradeStatus 'running'
    & $python $logged --log (Join-Path $runDirectory 'gn.log') -- (Join-Path $nativeSource 'buildtools\win\gn.exe') gen $BuildDirectory
    if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  }

  $stage = 'build chrome and native tests'
  Write-UpgradeStatus 'running'
  $sourceRecord = Join-Path $runDirectory 'source-provenance.json'
  & $python (Join-Path $nativeSource 'tools\tahai\source_provenance.py') --source $nativeSource --build $nativeBuild --output $sourceRecord
  if ($LASTEXITCODE -ne 0) { throw 'Could not capture the release source state.' }
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
    # A compiler diagnostic will repeat unchanged. Preserve the failure and
    # let the source be repaired before resuming, even if retries were asked
    # for to cover a transient process-start failure.
    if (Select-String -LiteralPath $attemptLog -Pattern '(^|\s)(fatal )?error:' -Quiet) {
      break
    }
  }
  [ordered]@{buildStartedUnixMs=$buildStarted; buildFinishedUnixMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); buildExitCode=$buildExit} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'build-result.json') -Encoding utf8
  if ($buildExit -ne 0) { Write-UpgradeStatus 'failed' $buildExit; exit $buildExit }
  & $python (Join-Path $nativeSource 'tools\tahai\source_provenance.py') --source $nativeSource --build $nativeBuild --compare $sourceRecord
  if ($LASTEXITCODE -ne 0) { throw 'Release source state changed while compiling.' }

  if ($BuildOnly) {
    $stage = 'build complete; runtime tests pending'
    Write-UpgradeStatus 'built'
    exit 0
  }

  $stage = 'all native TAHAI tests'
  Write-UpgradeStatus 'running'
  $testResults = [ordered]@{isolatedTestSession=$IsolatedTestSession; nativeExitCode=$null; browserExitCode=$null}
  $testResultPath = Join-Path $runDirectory 'test-results.json'
  & $python $logged --log (Join-Path $runDirectory 'native-tests.log') -- (Join-Path $nativeBuild 'tahai_mission_service_tests.exe') '--test-launcher-jobs=1' '--test-launcher-retry-limit=0' ('--test-launcher-summary-output=' + (Join-Path $runDirectory 'native-tests.json'))
  $testResults.nativeExitCode = $LASTEXITCODE
  $testResults | ConvertTo-Json | Set-Content -LiteralPath $testResultPath -Encoding utf8
  if ($testResults.nativeExitCode -ne 0) { Write-UpgradeStatus 'failed' $testResults.nativeExitCode; exit $testResults.nativeExitCode }
  . (Join-Path $nativeSource 'chrome\installer\win\tahai_msix\release_evidence.ps1')
  $null = Assert-TahaiTestSummary (Read-TahaiEvidenceJson (Join-Path $runDirectory 'native-tests.json')) @('MissionServiceTest.WorkspaceRailStatesAreFiniteAndPersistPerMode') 'native tests' @('*')

  $stage = 'native browser behavior tests'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'browser-tests.log') -- (Join-Path $nativeBuild 'browser_tests.exe') '--gtest_filter=*Tahai*' '--test-launcher-jobs=1' '--test-launcher-retry-limit=0' '--test-launcher-bot-mode' ('--test-launcher-summary-output=' + (Join-Path $runDirectory 'browser-tests.json'))
  $testResults.browserExitCode = $LASTEXITCODE
  $testResults | ConvertTo-Json | Set-Content -LiteralPath $testResultPath -Encoding utf8
  if ($testResults.browserExitCode -ne 0) { Write-UpgradeStatus 'failed' $testResults.browserExitCode; exit $testResults.browserExitCode }
  $null = Assert-TahaiTestSummary (Read-TahaiEvidenceJson (Join-Path $runDirectory 'browser-tests.json')) @('TahaiWebUIBrowserTest.TahaiMissionControlLoadsThroughPublicRoute') 'browser tests' @('*Tahai*')
  $stage = 'complete'
  Write-UpgradeStatus 'passed'
} catch {
  $_ | Out-String | Set-Content -LiteralPath (Join-Path $runDirectory 'runner-error.log')
  Write-UpgradeStatus 'failed' 1
  throw
} finally {
  Pop-Location
}
