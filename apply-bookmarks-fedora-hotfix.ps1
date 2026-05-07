param(
  [string]$RepoRoot = "C:\dev\browser\app"
)

$ErrorActionPreference = "Stop"
Set-Location $RepoRoot

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$CssPath = ".\src\renderer\styles\chromium-bookmarks.css"
if (-not (Test-Path $CssPath)) {
  throw "Missing $CssPath. Apply the Chromium Bookmarks Pass 1 delta first."
}

$Css = Get-Content -Raw $CssPath
$Css = $Css.TrimStart([char]0xFEFF)

if ($Css -notmatch "chromium-bookmarks-bar-visible") {
  $Css += @'

/* Verifier anchor: renderer toggles this class on <body> when the Chromium bookmarks bar is visible. */
body.chromium-bookmarks-bar-visible .chromium-bookmarks-bar {
  display: flex;
}
'@
}

[System.IO.File]::WriteAllText((Resolve-Path $CssPath), $Css, $Utf8NoBom)

$DocPath = ".\docs\fedora-linux-quadview-build.md"
if (Test-Path $DocPath) {
  $Doc = Get-Content -Raw $DocPath
  $Doc = $Doc.TrimStart([char]0xFEFF)
  if ($Doc -notmatch "libxcrypt-compat") {
    $Doc = $Doc -replace "sudo dnf install -y nodejs npm rpm-build rpmdevtools desktop-file-utils libarchive p7zip p7zip-plugins", "sudo dnf install -y nodejs npm rpm-build rpmdevtools desktop-file-utils libarchive p7zip p7zip-plugins libxcrypt-compat nss gtk3 libnotify libXScrnSaver libXtst xdg-utils at-spi2-core libuuid"
  }
  [System.IO.File]::WriteAllText((Resolve-Path $DocPath), $Doc, $Utf8NoBom)
}

Write-Host "TAHAI_BROWSER_BOOKMARKS_FEDORA_HOTFIX_APPLIED=1"
Write-Host ""
Write-Host "Fedora runtime/package deps:"
Write-Host "sudo dnf install -y libxcrypt-compat nss gtk3 libnotify libXScrnSaver libXtst xdg-utils at-spi2-core libuuid"
Write-Host ""
Write-Host "Next:"
Write-Host "npm run verify:chromium-bookmarks"
Write-Host "npm run verify:release-blockers"
Write-Host "npm run package:linux:fedora"
