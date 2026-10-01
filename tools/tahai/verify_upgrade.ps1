param(
  [string]$BuildDirectory = 'out\tahai_rc_154_x64',
  [string]$DepotTools = 'D:\dev\depot_tools',
  # The recovered release toolchain is deliberately pinned.  Do not replace
  # either path with a discovery of the newest VS or bootstrap directory.
  [string]$VisualStudioPath = 'C:\PROGRA~2\MICROS~2\18\BUILDT~1',
  [string]$BootstrapPython = 'D:\dev\depot_tools\bootstrap-2@3_11_8_chromium_35_bin\python3\bin\python3.exe',
  # Optional creator-test interpreter with cryptography/Ed25519 installed.
  # This never changes Chromium's recovered Python or build environment.
  [string]$CreatorPython = '',
  # Full preflight needs cryptography/Playwright in CreatorPython and these
  # separate source tools; never change Chromium's bootstrap environment.
  [string]$SourceNode = 'C:\Program Files\nodejs\node.exe',
  [string]$SourcePowerShell = 'C:\Program Files\PowerShell\7\pwsh.exe',
  # Chromium's template/plugin-heavy units can exceed several GiB each.
  [ValidateRange(1, 6)][int]$Jobs = 1,
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
$nativeBuild = [IO.Path]::GetFullPath((Join-Path $nativeSource $BuildDirectory))
$allowedBuildPrefix = [IO.Path]::GetFullPath((Join-Path $nativeSource 'out')).TrimEnd('\') + '\'
if (-not $nativeBuild.StartsWith($allowedBuildPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'BuildDirectory must name a dedicated output directory beneath this source checkout/out.'
}
if (-not (Test-Path -LiteralPath (Join-Path $nativeBuild 'args.gn') -PathType Leaf)) {
  throw 'Prepare and review args.gn in the dedicated build directory first; refusing an implicit default/debug build.'
}
$runnerStartedUtc = [Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().ToString('o')
$buildLockDirectory = Join-Path $nativeBuild '.tahai-release-build.lock'
$buildLockOwner = Join-Path $buildLockDirectory 'owner.json'
$buildLockHeld = $false
$runDirectory = $null
$statusFile = $null
$stage = 'setup'
function Write-UpgradeStatus([string]$state, [int]$code = 0) {
  if ([string]::IsNullOrWhiteSpace($statusFile)) {
    return
  }
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

# Only the runner that created this directory may remove it.  A stale or
# malformed lock remains evidence for an operator instead of being deleted by
# a later invocation.  This prevents a rebooted/abandoned runner from being
# mistaken for a live compiler and prevents two builds from sharing outputs.
function Acquire-TahaiBuildLock {
  if (Test-Path -LiteralPath $buildLockDirectory) {
    $owner = $null
    try {
      $lockItem = Get-Item -LiteralPath $buildLockDirectory -ErrorAction Stop
      $ownerItem = Get-Item -LiteralPath $buildLockOwner -ErrorAction Stop
      if (-not $lockItem.PSIsContainer -or $ownerItem.PSIsContainer -or
          ($ownerItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'lock metadata is not a regular owner record'
      }
      $owner = Get-Content -LiteralPath $buildLockOwner -Raw -ErrorAction Stop |
        ConvertFrom-Json -DateKind String -ErrorAction Stop
      $ownerProcess = Get-Process -Id ([int]$owner.processId) -ErrorAction Stop
      $ownerStartedUtc = $ownerProcess.StartTime.ToUniversalTime().ToString('o')
      if ($owner.schemaVersion -eq 1 -and
          $owner.source -ceq $nativeSource -and
          $owner.build -ceq $nativeBuild -and
          $owner.processStartedUtc -ceq $ownerStartedUtc) {
        throw ("Build directory is owned by live runner PID {0} since {1}; no competing run started." -f
          $owner.processId, $owner.processStartedUtc)
      }
      throw 'lock owner identity does not match a live release runner'
    } catch {
      throw ("Refusing to reuse existing build lock '{0}': {1}" -f
        $buildLockDirectory, $_.Exception.Message)
    }
  }
  try {
    New-Item -ItemType Directory -Path $buildLockDirectory -ErrorAction Stop | Out-Null
    [ordered]@{
      schemaVersion = 1
      processId = $PID
      processStartedUtc = $runnerStartedUtc
      source = $nativeSource
      build = $nativeBuild
      commandLine = [Environment]::CommandLine
      acquiredUtc = [DateTime]::UtcNow.ToString('o')
    } | ConvertTo-Json | Set-Content -LiteralPath $buildLockOwner -Encoding utf8 -NoNewline
    $script:buildLockHeld = $true
  } catch {
    throw ("Could not acquire exclusive build lock '{0}': {1}" -f
      $buildLockDirectory, $_.Exception.Message)
  }
}

function Release-TahaiBuildLock {
  if (-not $script:buildLockHeld) {
    return
  }
  try {
    $owner = Get-Content -LiteralPath $buildLockOwner -Raw -ErrorAction Stop |
      ConvertFrom-Json -DateKind String -ErrorAction Stop
    if ($owner.schemaVersion -ne 1 -or $owner.processId -ne $PID -or
        $owner.processStartedUtc -cne $runnerStartedUtc -or
        $owner.source -cne $nativeSource -or $owner.build -cne $nativeBuild) {
      throw 'owner record changed while this runner held the lock'
    }
    Remove-Item -LiteralPath $buildLockDirectory -Recurse -Force -ErrorAction Stop
    $script:buildLockHeld = $false
  } catch {
    Write-Warning ("Release runner left its build lock for inspection: {0}" -f $_.Exception.Message)
  }
}

Push-Location $nativeSource
try {
  Acquire-TahaiBuildLock
  $runDirectory = Join-Path $nativeBuild ('upgrade-checks-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $runDirectory -ErrorAction Stop | Out-Null
  $statusFile = Join-Path $runDirectory 'status.json'
  Write-UpgradeStatus 'running'
  if (-not $BuildOnly -and [string]::IsNullOrWhiteSpace($IsolatedTestSession)) {
    throw 'Interactive gates require a designated isolated Windows session. Use BuildOnly on the everyday desktop.'
  }
  # Chromium's local VS setup invokes vcvarsall through cmd.exe.  Preserve the
  # recovered short path instead of letting a new VS install silently change
  # the generator and linker environment mid-release.
  if (-not (Test-Path -LiteralPath $VisualStudioPath -PathType Container)) {
    throw "Recovered Visual Studio path is unavailable: $VisualStudioPath"
  }
  $visualStudioPath = $VisualStudioPath.TrimEnd('\')
  $env:vs2026_install = $visualStudioPath
  $env:GYP_MSVS_OVERRIDE_PATH = $visualStudioPath
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
  # Keep GN's Python selection stable between generations.  Alternating system
  # Python and depot_tools Python invalidates thousands of action commands.
  if (-not (Test-Path -LiteralPath $DepotTools -PathType Container) -or
      -not (Test-Path -LiteralPath $BootstrapPython -PathType Leaf)) {
    throw 'Recovered depot_tools or its pinned bootstrap Python is unavailable.'
  }
  $depotToolsRoot = [IO.Path]::GetFullPath($DepotTools).TrimEnd('\')
  $python = [IO.Path]::GetFullPath($BootstrapPython)
  if (-not $python.StartsWith($depotToolsRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Pinned bootstrap Python must remain under the selected depot_tools root.'
  }
  $pythonDirectory = Split-Path -Parent $python
  $creatorTestExecutable = if ([string]::IsNullOrWhiteSpace($CreatorPython)) { $python } else { $CreatorPython }
  if (-not (Test-Path -LiteralPath $creatorTestExecutable -PathType Leaf)) {
    throw 'CreatorPython must identify an existing Python executable with Ed25519 support.'
  }
  $logged = Join-Path $nativeSource 'tools\tahai\run_logged.py'
  $env:PATH = $pythonDirectory + ';' + $depotToolsRoot + ';' + $env:PATH.Replace('"', '')

  $stage = 'source-pinned build prerequisites'
  Write-UpgradeStatus 'running'
  & $python $logged --log (Join-Path $runDirectory 'build-prerequisites.json') -- $python tools/tahai/check_windows_build_prerequisites.py --source $nativeSource --visual-studio $visualStudioPath --depot-tools $depotToolsRoot --bootstrap-python $python
  if ($LASTEXITCODE -ne 0) { throw 'Build prerequisites failed; no GN generation or compilation started. See build-prerequisites.json.' }
  $sourceRecord = Join-Path $runDirectory 'source-provenance.json'
  & $python (Join-Path $nativeSource 'tools\tahai\source_provenance.py') --source $nativeSource --build $nativeBuild --output $sourceRecord
  if ($LASTEXITCODE -ne 0) { throw 'Could not capture the release source state.' }
  $stage = 'full source preflight before GN or compilation'
  Write-UpgradeStatus 'running'
  $preflightDirectory = Join-Path $runDirectory 'source-preflight'
  & $python $logged --log (Join-Path $runDirectory 'source-preflight.log') -- $SourcePowerShell -NoProfile -File tools/tahai/verify_source.ps1 -PythonExecutable $creatorTestExecutable -NodeExecutable $SourceNode -PowerShellExecutable $SourcePowerShell -EvidenceDirectory $preflightDirectory -RenderCss
  if ($LASTEXITCODE -ne 0) { throw 'Full source preflight failed; no GN generation or compilation started.' }
  . (Join-Path $nativeSource 'chrome\installer\win\tahai_msix\release_evidence.ps1')
  . (Join-Path $PSScriptRoot 'source_preflight.ps1')
  $null = Assert-TahaiSourcePreflight (Join-Path $preflightDirectory 'source-preflight-summary.json') (Read-TahaiEvidenceJson $sourceRecord)
  & $python (Join-Path $PSScriptRoot 'source_provenance.py') --source $nativeSource --build $nativeBuild --compare $sourceRecord
  if ($LASTEXITCODE -ne 0) { throw 'Release source changed during source preflight.' }

  if (-not $SkipGenerate) {
    $stage = 'generate native build'
    Write-UpgradeStatus 'running'
    & $python $logged --log (Join-Path $runDirectory 'gn.log') -- (Join-Path $nativeSource 'buildtools\win\gn.exe') gen $BuildDirectory
    if ($LASTEXITCODE -ne 0) { Write-UpgradeStatus 'failed' $LASTEXITCODE; exit $LASTEXITCODE }
  }

  $stage = 'build chrome and native tests'
  Write-UpgradeStatus 'running'
  & $python (Join-Path $PSScriptRoot 'source_provenance.py') --source $nativeSource --build $nativeBuild --compare $sourceRecord
  if ($LASTEXITCODE -ne 0) { throw 'Release source or arguments changed during GN generation.' }
  # Each release report must bind the browser, Windows services and their tests
  # produced during this actual
  # successful build interval. Preserve old binaries before asking Ninja to
  # relink them; never change timestamps or relabel a previous build as fresh.
  $previousArtifacts = Join-Path $runDirectory 'previous-artifacts'
  New-Item -ItemType Directory -Path $previousArtifacts | Out-Null
  $buildPrefix = [IO.Path]::GetFullPath($nativeBuild).TrimEnd('\') + '\'
  foreach ($name in @('chrome.exe', 'chrome.dll', 'browser_tests.exe',
                      'tahai_mission_service_tests.exe', 'elevation_service.exe',
                      'elevated_tracing_service.exe', 'elevation_service_unittests.exe',
                      'elevated_tracing_service_unittests.exe')) {
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
    & $python $logged --log $attemptLog -- (Join-Path $nativeSource 'third_party\ninja\ninja.exe') -C $BuildDirectory -j $Jobs chrome browser_tests tahai_mission_service_tests elevation_service elevated_tracing_service elevation_service_unittests elevated_tracing_service_unittests
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
  $testResults = [ordered]@{isolatedTestSession=$IsolatedTestSession; nativeExitCode=$null; browserExitCode=$null; elevationExitCode=$null; tracingExitCode=$null}
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

  # These scopes exercise the real service class factories and changed COM
  # interfaces with process-local mock callers. System-wide service installation
  # and cross-integrity tests are separate isolated-VM acceptance work.
  foreach ($gate in @(
      @{name='elevation'; binary='elevation_service_unittests.exe'; scope='ServiceMainTest.*'; required='ServiceMainTest.TahaiConfiguredInterfaceMatchesTypeLibrary'},
      @{name='tracing'; binary='elevated_tracing_service_unittests.exe'; scope='SystemTracingSessionTest.*'; required='SystemTracingSessionTest.TahaiConfiguredInterfaceMatchesTypeLibrary'})) {
    $stage = $gate.name + ' COM interface regression tests'
    Write-UpgradeStatus 'running'
    $summary = Join-Path $runDirectory ($gate.name + '-tests.json')
    & $python $logged --log (Join-Path $runDirectory ($gate.name + '-tests.log')) -- (Join-Path $nativeBuild $gate.binary) ('--gtest_filter=' + $gate.scope) '--test-launcher-jobs=1' '--test-launcher-retry-limit=0' ('--test-launcher-summary-output=' + $summary)
    $code = $LASTEXITCODE
    $testResults[$gate.name + 'ExitCode'] = $code
    $testResults | ConvertTo-Json | Set-Content -LiteralPath $testResultPath -Encoding utf8
    if ($code -ne 0) { Write-UpgradeStatus 'failed' $code; exit $code }
    $null = Assert-TahaiTestSummary (Read-TahaiEvidenceJson $summary) @($gate.required) $stage @($gate.scope)
  }
  $stage = 'complete'
  Write-UpgradeStatus 'passed'
} catch {
  $runnerFailure = $_
  # Lock acquisition can fail before there is a run directory. Preserve that
  # original diagnostic; a null path or failed evidence write must not hide it.
  try {
    if (-not [string]::IsNullOrWhiteSpace($runDirectory) -and
        (Test-Path -LiteralPath $runDirectory -PathType Container)) {
      $runnerFailure | Out-String | Set-Content -LiteralPath (Join-Path $runDirectory 'runner-error.log')
    }
    Write-UpgradeStatus 'failed' 1
  } catch {
    Write-Warning ("Could not save release-runner failure evidence: {0}" -f $_.Exception.Message)
  }
  throw $runnerFailure
} finally {
  Release-TahaiBuildLock
  Pop-Location
}
