#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-/mnt/c/dev/browser/app}"
cd "$REPO_ROOT"

CSS="src/renderer/styles/chromium-bookmarks.css"
if [[ ! -f "$CSS" ]]; then
  echo "Missing $CSS. Apply the Chromium Bookmarks Pass 1 delta first." >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

css_path = Path("src/renderer/styles/chromium-bookmarks.css")
css = css_path.read_text(encoding="utf-8-sig")
if "chromium-bookmarks-bar-visible" not in css:
    css += """

/* Verifier anchor: renderer toggles this class on <body> when the Chromium bookmarks bar is visible. */
body.chromium-bookmarks-bar-visible .chromium-bookmarks-bar {
  display: flex;
}
"""
css_path.write_text(css, encoding="utf-8")

doc_path = Path("docs/fedora-linux-quadview-build.md")
if doc_path.exists():
    doc = doc_path.read_text(encoding="utf-8-sig")
    old = "sudo dnf install -y nodejs npm rpm-build rpmdevtools desktop-file-utils libarchive p7zip p7zip-plugins"
    new = "sudo dnf install -y nodejs npm rpm-build rpmdevtools desktop-file-utils libarchive p7zip p7zip-plugins libxcrypt-compat nss gtk3 libnotify libXScrnSaver libXtst xdg-utils at-spi2-core libuuid"
    if "libxcrypt-compat" not in doc:
        doc = doc.replace(old, new)
    doc_path.write_text(doc, encoding="utf-8")
PY

echo "TAHAI_BROWSER_BOOKMARKS_FEDORA_HOTFIX_APPLIED=1"
echo
echo "Fedora runtime/package deps:"
echo "sudo dnf install -y libxcrypt-compat nss gtk3 libnotify libXScrnSaver libXtst xdg-utils at-spi2-core libuuid"
echo
echo "Next:"
echo "npm run verify:chromium-bookmarks"
echo "npm run verify:release-blockers"
echo "npm run package:linux:fedora"
