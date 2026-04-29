$ErrorActionPreference = "Stop"

param(
  [switch]$RestartExplorer
)

Write-Host "TAHAI_BROWSER_TASKBAR_PIN_REPAIR=START"

$targets = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq "TAHAI Web Services Browser.exe") -or
    ($_.ExecutablePath -like "*\TAHAI Web Services Browser.exe") -or
    ($_.CommandLine -like "*TAHAI Web Services Browser*") -or
    ($_.Name -eq "Electron.exe") -or
    ($_.CommandLine -like "*tahai-web-services-browser*")
  }

foreach ($target in $targets) {
  try {
    Write-Host "Stopping browser-related process pid=$($target.ProcessId) name=$($target.Name)"
    Stop-Process -Id ([int]$target.ProcessId) -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not stop pid=$($target.ProcessId): $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 1

$taskbarPins = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"

if (Test-Path $taskbarPins) {
  Get-ChildItem $taskbarPins -Filter "*.lnk" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "*TAHAI*" -or
      $_.Name -like "*Browser*" -or
      $_.Name -like "*Electron*"
    } |
    ForEach-Object {
      Write-Host "Removing stale taskbar pin: $($_.FullName)"
      Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    }
}

$ie4uinit = "$env:WINDIR\System32\ie4uinit.exe"
if (Test-Path $ie4uinit) {
  & $ie4uinit -show
}

Add-Type -Namespace Win32 -Name ShellNotify -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, uint uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);
"@

[Win32.ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

if ($RestartExplorer) {
  Write-Host "Restarting Explorer to flush pinned icon cache..."
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Start-Process explorer.exe
}

Write-Host "TAHAI_BROWSER_TASKBAR_PIN_REPAIR=OK"
Write-Host "Now install the new build, launch TAHAI Browser from Start, then pin the RUNNING app. Do not reuse an old pinned icon."
