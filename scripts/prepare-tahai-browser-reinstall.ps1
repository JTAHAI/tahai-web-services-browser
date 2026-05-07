$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_PREPARE_REINSTALL=START"

$targets = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq "TAHAI Web Services Browser.exe") -or
    ($_.ExecutablePath -like "*\TAHAI Web Services Browser.exe") -or
    ($_.CommandLine -like "*TAHAI Web Services Browser*")
  }

foreach ($target in $targets) {
  try {
    Write-Host "Stopping TAHAI Browser pid=$($target.ProcessId)"
    Stop-Process -Id ([int]$target.ProcessId) -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not stop pid=$($target.ProcessId): $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 1

$shortcutRoots = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop"
)

foreach ($root in $shortcutRoots) {
  if (Test-Path $root) {
    Get-ChildItem $root -Recurse -Filter "*TAHAI*Browser*.lnk" -ErrorAction SilentlyContinue |
      ForEach-Object {
        Write-Host "Removing pre-install stale shortcut $($_.FullName)"
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
      }
  }
}

Write-Host "TAHAI_BROWSER_PREPARE_REINSTALL=OK"
Write-Host "Install the new EXE now. Do not run this cleanup script again after installing."
