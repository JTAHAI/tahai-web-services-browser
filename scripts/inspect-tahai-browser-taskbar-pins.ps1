$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_TASKBAR_PIN_INSPECT=START"

$taskbarPins = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"

if (-not (Test-Path $taskbarPins)) {
  Write-Warning "Taskbar pin folder not found: $taskbarPins"
  exit 0
}

$shell = New-Object -ComObject WScript.Shell

$pins = Get-ChildItem $taskbarPins -Filter "*.lnk" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -like "*TAHAI*" -or $_.Name -like "*Browser*" -or $_.Name -like "*Electron*"
  }

if (-not $pins) {
  Write-Host "No TAHAI/Browser/Electron taskbar pins found."
  Write-Host "TAHAI_BROWSER_TASKBAR_PIN_INSPECT=OK"
  exit 0
}

foreach ($pin in $pins) {
  $lnk = $shell.CreateShortcut($pin.FullName)
  [pscustomobject]@{
    Shortcut = $pin.FullName
    TargetPath = $lnk.TargetPath
    IconLocation = $lnk.IconLocation
    WorkingDirectory = $lnk.WorkingDirectory
    Arguments = $lnk.Arguments
  } | Format-List
}

Write-Host "TAHAI_BROWSER_TASKBAR_PIN_INSPECT=OK"
