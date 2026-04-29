$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")
Set-Location $AppRoot

$Package = Get-Content .\package.json -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ReleaseDir = Join-Path $AppRoot "release"
$Exe = Join-Path $ReleaseDir "TAHAI-Web-Services-Browser-$Version-x64.exe"
$Msi = Join-Path $ReleaseDir "TAHAI-Web-Services-Browser-$Version-x64.msi"

if (-not (Test-Path $Exe)) { throw "Installer EXE not found: $Exe" }

Set-Location $ReleaseDir

Get-ChildItem "TAHAI-Web-Services-Browser-$Version-x64.exe","TAHAI-Web-Services-Browser-$Version-x64.msi" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Get-FileHash $_.FullName -Algorithm SHA256 |
      ForEach-Object { "$($_.Hash)  $([IO.Path]::GetFileName($_.Path))" }
  } | Set-Content .\SHA256SUMS.txt

@"
TAHAI Web Services Browser v$Version Preview
Windows x64
Unsigned friend-feedback build

Install:
Run TAHAI-Web-Services-Browser-$Version-x64.exe

Notes:
- Windows may show SmartScreen because this preview build is not code-signed yet.
- Use the EXE installer for normal testing.
- MSI is included for admin/enterprise installer testing.

Feedback requested:
- Guide opens.
- DevOps menu opens and has no overlapping text.
- IT Tools menu opens and has no overlapping text.
- Ops Panel opens and is readable.
- About opens browser.tahai.net online and local fallback offline.
- Start/Desktop/taskbar icons look correct after pinning the running app.
"@ | Set-Content .\README-FIRST.txt

$ZipName = "TAHAI-Web-Services-Browser-$Version-Preview-Friend-Feedback.zip"
$Inputs = @(".\TAHAI-Web-Services-Browser-$Version-x64.exe", ".\SHA256SUMS.txt", ".\README-FIRST.txt")
if (Test-Path $Msi) { $Inputs += ".\TAHAI-Web-Services-Browser-$Version-x64.msi" }
Compress-Archive -Path $Inputs -DestinationPath ".\$ZipName" -Force
Get-Item ".\$ZipName" | Select-Object FullName, Length, LastWriteTime
