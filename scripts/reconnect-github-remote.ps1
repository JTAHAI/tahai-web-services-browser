<#
.SYNOPSIS
  Restores the canonical GitHub remote after expanding a full source ZIP into a new folder.

.DESCRIPTION
  Source ZIPs intentionally do not include .git. Run this after the browser boots cleanly in the new
  C:\dev\browser\app folder and before pushing the repaired source. No credentials or tokens are stored.
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$RemoteUrl = 'https://github.com/JTAHAI/tahai-web-services-browser.git',
  [string]$Branch = 'main',
  [switch]$Push
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

Write-Host 'TAHAI_BROWSER_GIT_RECONNECT_START=1'
Write-Host ("TAHAI_BROWSER_GIT_RECONNECT_REPO={0}" -f (Get-Location).Path)

if (-not (Test-Path '.\package.json')) {
  throw 'package.json not found. Run from C:\dev\browser\app or pass -RepoRoot C:\dev\browser\app.'
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git was not found on PATH.'
}

if (-not (Test-Path '.\.git')) {
  git init
}

git branch -M $Branch

$existingOrigin = ''
try { $existingOrigin = (git remote get-url origin) } catch { $existingOrigin = '' }
if ($existingOrigin) {
  git remote set-url origin $RemoteUrl
} else {
  git remote add origin $RemoteUrl
}

Write-Host ("TAHAI_BROWSER_GIT_REMOTE_ORIGIN={0}" -f (git remote get-url origin))
Write-Host 'TAHAI_BROWSER_GIT_STATUS_START'
git status --short
Write-Host 'TAHAI_BROWSER_GIT_STATUS_END'

if ($Push) {
  npm run verify:release-blockers
  git add .
  git commit -m 'Pass 12 source hardening and local repair guardrails'
  git push -u origin $Branch
  Write-Host 'TAHAI_BROWSER_GIT_PUSH_OK=1'
} else {
  Write-Host 'TAHAI_BROWSER_GIT_PUSH_SKIPPED=1'
  Write-Host 'Run again with -Push after reviewing git status and confirming the app works.'
}

Write-Host 'TAHAI_BROWSER_GIT_RECONNECT_OK=1'
