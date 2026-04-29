#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="${1:-/mnt/c/dev/browser/app}"
cd "$REPO_ROOT"
node <<'EOF_NODE'
const fs = require('node:fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));
pkg.scripts ||= {};
pkg.scripts['package:linux:rpm'] = 'npm run build && electron-builder --linux rpm --x64 --config electron-builder.yml';
pkg.scripts['package:linux:fedora'] = 'npm run verify:fedora-linux-build && npm run build && electron-builder --linux AppImage rpm --x64 --config electron-builder.yml';
pkg.scripts['verify:fedora-linux-build'] = 'node scripts/verify-fedora-linux-build.mjs';
if (pkg.scripts['verify:release-blockers'] && !pkg.scripts['verify:release-blockers'].includes('verify:fedora-linux-build')) {
  pkg.scripts['verify:release-blockers'] = pkg.scripts['verify:release-blockers'].replace('npm run build', 'npm run verify:fedora-linux-build && npm run build');
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
let builder = fs.readFileSync('electron-builder.yml', 'utf8').replace(/^\uFEFF/, '');
if (!builder.split(/\r?\n/).some((line) => line.trim() === '- rpm')) {
  builder = builder.replace('    - deb', '    - deb\n    - rpm');
}
fs.writeFileSync('electron-builder.yml', builder, 'utf8');
EOF_NODE
echo "TAHAI_BROWSER_FEDORA_LINUX_QUADVIEW_BUILD_DELTA_APPLIED=1"
echo
echo "Next:"
echo "npm run typecheck"
echo "npm run build"
echo "npm run verify:fedora-linux-build"
echo "npm run verify:release-blockers"
echo "npm run package:linux:fedora"
