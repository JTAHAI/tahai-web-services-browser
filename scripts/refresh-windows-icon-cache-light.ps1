$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_SHELL_ICON_REFRESH=START"

# This is safe and usually enough after shortcut/icon changes.
$ie4uinit = "$env:WINDIR\System32\ie4uinit.exe"
if (Test-Path $ie4uinit) {
  & $ie4uinit -show
}

# Broadcast a shell association/icon update.
Add-Type -Namespace Win32 -Name ShellNotify -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, uint uFlags, System.IntPtr dwItem1, System.IntPtr dwItem2);
"@

[Win32.ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "TAHAI_BROWSER_SHELL_ICON_REFRESH=OK"
Write-Host "Close and reopen Start search. If it still shows the old icon, sign out/in or restart Explorer."
