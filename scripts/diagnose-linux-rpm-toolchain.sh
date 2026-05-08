#!/usr/bin/env bash
set -euo pipefail
# PASS124 Linux RPM toolchain recovery guard: diagnose the exact Node/npm/RPM readiness state.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r
# PASS124 static verifier literals: TAHAI_LINUX_RPM_TOOLCHAIN_MISSING=node TAHAI_LINUX_RPM_TOOLCHAIN_MISSING=npm TAHAI_LINUX_RPM_TOOLCHAIN_MISSING=rpmbuild
status=0
print_missing() { local name="$1"; echo "TAHAI_LINUX_RPM_TOOLCHAIN_MISSING=$name"; status=1; }
node_path="$(command -v node || true)"; npm_path="$(command -v npm || true)"; rpm_path="$(command -v rpm || true)"; rpmbuild_path="$(command -v rpmbuild || true)"
[ -n "$node_path" ] || print_missing node; [ -n "$npm_path" ] || print_missing npm; [ -n "$rpm_path" ] || print_missing rpm; [ -n "$rpmbuild_path" ] || print_missing rpmbuild
if [ -n "$node_path" ]; then echo "TAHAI_LINUX_RPM_TOOLCHAIN_NODE=$($node_path -v) at $node_path"; major="$($node_path -p "Number(process.versions.node.split('.')[0])")"; minor="$($node_path -p "Number(process.versions.node.split('.')[1])")"; if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then echo "TAHAI_LINUX_RPM_TOOLCHAIN_NODE_TOO_OLD=$($node_path -v)"; status=1; fi; fi
if [ -n "$npm_path" ]; then echo "TAHAI_LINUX_RPM_TOOLCHAIN_NPM=$($npm_path -v) at $npm_path"; fi
if [ -n "$rpm_path" ]; then echo "TAHAI_LINUX_RPM_TOOLCHAIN_RPM=$($rpm_path --version | head -n 1) at $rpm_path"; fi
if [ -n "$rpmbuild_path" ]; then echo "TAHAI_LINUX_RPM_TOOLCHAIN_RPMBUILD=$($rpmbuild_path --version | head -n 1) at $rpmbuild_path"; fi
if [ "$status" -ne 0 ]; then cat <<'EOF'
TAHAI_LINUX_RPM_TOOLCHAIN_REPAIR=sudo dnf install -y nodejs npm rpm-build libarchive libxcrypt-compat tar gzip python3 make gcc gcc-c++
TAHAI_LINUX_RPM_TOOLCHAIN_VERIFY=node -v && npm -v && command -v node && command -v npm && command -v rpmbuild
TAHAI_LINUX_RPM_TOOLCHAIN_NEXT=npm ci && npm run build && npm run package:linux:rpm
EOF
exit 1; fi
echo "TAHAI_LINUX_RPM_TOOLCHAIN=OK"
