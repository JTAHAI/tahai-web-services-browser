$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_ICON_CACHE_RESET=START"

# Kill only TAHAI Browser processes first.
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

# Clear Start Menu shortcuts created by older preview installers. They will be recreated by the new installer.
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
        Write-Host "Removing old shortcut $($_.FullName)"
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
      }
  }
}

Write-Host "TAHAI_BROWSER_ICON_CACHE_RESET=OK"
Write-Host "Now uninstall old preview builds, install the new 1.6.4 build, launch from Start, then pin the running app again."
