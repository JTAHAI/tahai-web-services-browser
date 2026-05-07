<#
PASS 61 — Windows-to-WSL Linux Installer Wrapper
Runs Linux packaging inside Ubuntu 24.04 while forcing the repo-side bash script
through the Linux-native mirror guard. This wrapper intentionally does not run
npm, node, or electron-builder from Windows.
#>
[CmdletBinding()]
param(
  [string]$Distro = "Ubuntu-24.04",
  [string]$RepoPath = "C:\dev\browser\app",
  [ValidateSet("AppImage", "deb", "rpm")]
  [string[]]$Targets = @("AppImage", "deb", "rpm"),
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error "TAHAI_WSL_LINUX_BUILD_WRAPPER_ERROR=$Message"
  exit 1
}

function Convert-ToWslPath([string]$Path) {
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
  $drive = $resolved.Path.Substring(0, 1).ToLowerInvariant()
  $tail = $resolved.Path.Substring(2).Replace('\\', '/')
  return "/mnt/$drive$tail"
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  Fail "wsl.exe was not found. Install WSL and Ubuntu 24.04 before building Linux installers."
}

if (-not (Test-Path -LiteralPath $RepoPath -PathType Container)) {
  Fail "RepoPath does not exist: $RepoPath"
}

$wslPath = Convert-ToWslPath $RepoPath
$targetText = ($Targets -join ' ')

if (-not $SkipPreflight) {
  Write-Host "TAHAI_WSL_LINUX_BUILD_PREFLIGHT=distro=$Distro repo=$RepoPath targets=$targetText"
  & wsl.exe -d $Distro --cd ~ -- bash -lc "set -euo pipefail; export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; command -v node; command -v npm; node -v; npm -v; test -d '$wslPath'; test -f '$wslPath/scripts/build-linux-installers.sh'"
  if ($LASTEXITCODE -ne 0) { Fail "WSL preflight failed for $Distro and $RepoPath" }
}

Write-Host "TAHAI_WSL_LINUX_BUILD_START=distro=$Distro repo=$RepoPath targets=$targetText"
& wsl.exe -d $Distro --cd $wslPath -- bash scripts/build-linux-installers.sh @Targets
if ($LASTEXITCODE -ne 0) { Fail "Linux installer build failed inside $Distro" }

$linuxRelease = Join-Path $RepoPath "release\linux"
if (-not (Test-Path -LiteralPath $linuxRelease -PathType Container)) {
  Fail "Expected Linux release folder was not created: $linuxRelease"
}

$expected = @(
  "TAHAI-Web-Services-Browser-1.8.30-x64.AppImage",
  "TAHAI-Web-Services-Browser-1.8.30-x64.deb",
  "TAHAI-Web-Services-Browser-1.8.30-x64.rpm",
  "TAHAI-Linux-installers-manifest.txt"
)

foreach ($name in $expected) {
  $file = Join-Path $linuxRelease $name
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    Fail "Missing expected Linux artifact: $file"
  }
  $size = (Get-Item -LiteralPath $file).Length
  if ($name -ne "TAHAI-Linux-installers-manifest.txt" -and $size -lt 10485760) {
    Fail "Linux artifact is suspiciously small: $file ($size bytes)"
  }
  Write-Host "TAHAI_WSL_LINUX_BUILD_ARTIFACT=$file $size bytes"
}

Write-Host "TAHAI_WSL_LINUX_BUILD=OK"
