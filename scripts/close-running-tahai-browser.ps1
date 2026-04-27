$ErrorActionPreference = "Stop"

Write-Host "TAHAI_BROWSER_CLOSE_PREFLIGHT=START"

$targets = @()

try {
  $targets = Get-CimInstance Win32_Process |
    Where-Object {
      ($_.Name -eq "TAHAI Web Services Browser.exe") -or
      ($_.ExecutablePath -like "*\TAHAI Web Services Browser.exe") -or
      ($_.CommandLine -like "*TAHAI Web Services Browser*")
    } |
    Sort-Object ProcessId -Unique
} catch {
  Write-Warning "CIM process lookup failed. Falling back to Get-Process name match."
  $targets = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -eq "TAHAI Web Services Browser" }
}

if (-not $targets -or $targets.Count -eq 0) {
  Write-Host "TAHAI_BROWSER_CLOSE_PREFLIGHT=NO_RUNNING_BROWSER_FOUND"
  exit 0
}

foreach ($target in $targets) {
  $targetPid = [int]$target.ProcessId
  if ($targetPid -eq $PID) { continue }

  Write-Host "TAHAI_BROWSER_CLOSE_PREFLIGHT=STOPPING pid=$targetPid name=$($target.Name)"
  try {
    Stop-Process -Id $targetPid -Force -ErrorAction Stop
  } catch {
    Write-Warning "Failed to stop pid=$targetPid : $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 2

$remaining = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -eq "TAHAI Web Services Browser.exe") -or
    ($_.ExecutablePath -like "*\TAHAI Web Services Browser.exe") -or
    ($_.CommandLine -like "*TAHAI Web Services Browser*")
  }

if ($remaining -and $remaining.Count -gt 0) {
  $remaining | ForEach-Object {
    Write-Warning "TAHAI_BROWSER_CLOSE_PREFLIGHT=STILL_RUNNING pid=$($_.ProcessId) name=$($_.Name)"
  }
  throw "TAHAI Web Services Browser still has running processes. Close Task Manager entries and retry."
}

Write-Host "TAHAI_BROWSER_CLOSE_PREFLIGHT=OK"
