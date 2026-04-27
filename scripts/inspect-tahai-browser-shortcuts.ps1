$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_SHORTCUT_INSPECT=START"

$shortcutRoots = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop"
)

$shortcuts = foreach ($root in $shortcutRoots) {
  if (Test-Path $root) {
    Get-ChildItem $root -Recurse -Filter "*TAHAI*Browser*.lnk" -ErrorAction SilentlyContinue
  }
}

if (-not $shortcuts) {
  Write-Warning "No TAHAI Browser shortcuts found."
  exit 1
}

$shell = New-Object -ComObject WScript.Shell

foreach ($shortcut in $shortcuts) {
  $lnk = $shell.CreateShortcut($shortcut.FullName)
  [pscustomobject]@{
    Shortcut = $shortcut.FullName
    TargetPath = $lnk.TargetPath
    IconLocation = $lnk.IconLocation
    WorkingDirectory = $lnk.WorkingDirectory
  }
}

Write-Host "TAHAI_BROWSER_SHORTCUT_INSPECT=OK"
