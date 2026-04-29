#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-/mnt/c/dev/browser/app}"
TARGET_VERSION="${2:-}"
cd "$REPO_ROOT"

python3 - <<'PY'
from pathlib import Path
import json
import re
import os

root = Path.cwd()
for rel in [
    "src/renderer/chromium-bookmarks.ts",
    "src/renderer/styles/chromium-bookmarks.css",
    "scripts/verify-chromium-bookmarks.mjs",
    "docs/chromium-bookmarks-menu.md",
]:
    p = root / rel
    if not p.exists():
        raise SystemExit(f"Missing patch file: {rel}")
    p.write_text(p.read_text(encoding="utf-8-sig"), encoding="utf-8")

index_path = root / "src/renderer/index.html"
index = index_path.read_text(encoding="utf-8-sig")
if "chromium-bookmarks.js" not in index:
    if "site-view-mission-rail.js" in index:
        index = re.sub(r'(<script[^>]+site-view-mission-rail\.js[^>]*>\s*</script>)', r'\1\n  <script src="./chromium-bookmarks.js"></script>', index)
    elif "app.js" in index:
        index = re.sub(r'(<script[^>]+app\.js[^>]*>\s*</script>)', r'\1\n  <script src="./chromium-bookmarks.js"></script>', index)
    else:
        index = index.replace("</body>", '  <script src="./chromium-bookmarks.js"></script>\n</body>')
index_path.write_text(index, encoding="utf-8")

pkg_path = root / "package.json"
pkg = json.loads(pkg_path.read_text(encoding="utf-8-sig"))
scripts = pkg.setdefault("scripts", {})
scripts["verify:chromium-bookmarks"] = "node scripts/verify-chromium-bookmarks.mjs"
release = scripts.get("verify:release-blockers", "")
if release and "verify:chromium-bookmarks" not in release:
    scripts["verify:release-blockers"] = release.replace("npm run build", "npm run verify:chromium-bookmarks && npm run build")

target = os.environ.get("TARGET_VERSION", "").strip()
if target:
    old = str(pkg.get("version", ""))
    pkg["version"] = target
    verifier = root / "scripts/verify-enterprise-release.mjs"
    if verifier.exists() and old:
        text = verifier.read_text(encoding="utf-8-sig").replace(old, target)
        verifier.write_text(text, encoding="utf-8")

pkg_path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
PY

echo "TAHAI_BROWSER_CHROMIUM_BOOKMARKS_PASS1_APPLIED=1"
echo
echo "Next:"
echo "npm run typecheck"
echo "npm run build"
echo "npm run verify:chromium-bookmarks"
echo "npm run verify:release-blockers"
