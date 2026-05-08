#!/usr/bin/env bash
set -euo pipefail

# PASS 60 Linux installer hardening: always prefer Linux-native node/npm and never package from /mnt/c.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TARGETS=("$@")
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=(AppImage deb rpm)
fi

NATIVE_BUILD_DIR="${TAHAI_LINUX_NATIVE_BUILD_DIR:-$HOME/tahai-browser-linux-build}"

# PASS124 Linux RPM toolchain recovery guard: split-brain WSL installs can leave npm present while node is missing.
print_node_toolchain_repair() {
  cat >&2 <<'EOF'
TAHAI_LINUX_BUILD_REPAIR=Install Linux-native Node.js 22+ inside Fedora WSL, then rerun npm run package:linux:rpm.
TAHAI_LINUX_BUILD_REPAIR_FEDORA=sudo dnf install -y nodejs npm rpm-build libarchive libxcrypt-compat tar gzip python3 make gcc gcc-c++
TAHAI_LINUX_BUILD_REPAIR_VERIFY=node -v && npm -v && command -v node && command -v npm
TAHAI_LINUX_BUILD_REPAIR_NOTE=Do not use Windows node.exe/npm.cmd for Linux RPM packaging; the guarded builder mirrors source into a Linux-native folder before electron-builder runs.
EOF
}

fail_node_toolchain() {
  local reason="$1"
  echo "TAHAI_LINUX_BUILD_ERROR=$reason" >&2
  print_node_toolchain_repair
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "TAHAI_LINUX_BUILD_ERROR=$1 is required in this Linux environment" >&2
    exit 1
  fi
}

clean_path_force() {
  local target="$1"
  if [ ! -e "$target" ]; then
    return 0
  fi
  rm -rf "$target" 2>/tmp/tahai-linux-build-rm.err || {
    echo "TAHAI_LINUX_BUILD_NOTICE=normal cleanup failed for $target" >&2
    if command -v sudo >/dev/null 2>&1; then
      echo "TAHAI_LINUX_BUILD_NOTICE=retrying cleanup with sudo for stale permission-broken build output" >&2
      sudo rm -rf "$target"
    else
      echo "TAHAI_LINUX_BUILD_ERROR=unable to remove $target and sudo is unavailable" >&2
      cat /tmp/tahai-linux-build-rm.err >&2 || true
      exit 1
    fi
  }
}

reject_windows_tool() {
  local label="$1"
  local value="$2"
  case "${value,,}" in
    *.exe|*.cmd|*.bat|*.ps1|/mnt/*|*appdata*|*'program files'*|*windows*)
      echo "TAHAI_LINUX_BUILD_ERROR=$label must resolve to a Linux-native tool, found $value" >&2
      exit 1
      ;;
  esac
}

if [[ "$SOURCE_ROOT" == /mnt/* ]]; then
  require_cmd rsync
  echo "TAHAI_LINUX_BUILD_SOURCE=$SOURCE_ROOT"
  echo "TAHAI_LINUX_BUILD_NATIVE_MIRROR=$NATIVE_BUILD_DIR"
  clean_path_force "$NATIVE_BUILD_DIR"
  mkdir -p "$NATIVE_BUILD_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude release \
    --exclude .git \
    "$SOURCE_ROOT/" \
    "$NATIVE_BUILD_DIR/"
  cd "$NATIVE_BUILD_DIR"
  exec env \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    TAHAI_LINUX_SOURCE_ROOT="$SOURCE_ROOT" \
    TAHAI_LINUX_NATIVE_BUILD_ACTIVE=1 \
    TAHAI_LINUX_NATIVE_BUILD_DIR="$NATIVE_BUILD_DIR" \
    /usr/bin/env bash scripts/build-linux-installers.sh "${TARGETS[@]}"
fi

cd "$SOURCE_ROOT"

if [[ "$PWD" == /mnt/* ]]; then
  echo "TAHAI_LINUX_BUILD_ERROR=refusing to package from mounted Windows path: $PWD" >&2
  exit 1
fi

NODE_BIN="${TAHAI_NODE_BIN:-/usr/bin/node}"
NPM_BIN="${TAHAI_NPM_BIN:-/usr/bin/npm}"
if [ ! -x "$NODE_BIN" ]; then NODE_BIN="$(command -v node || true)"; fi
if [ ! -x "$NPM_BIN" ]; then NPM_BIN="$(command -v npm || true)"; fi

if [ -z "$NODE_BIN" ] && [ -n "$NPM_BIN" ]; then
  fail_node_toolchain "Linux node binary is missing while npm exists; install Node.js 22 inside the distro"
elif [ -n "$NODE_BIN" ] && [ -z "$NPM_BIN" ]; then
  fail_node_toolchain "Linux npm CLI is missing while node exists; install npm inside the distro"
elif [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
  fail_node_toolchain "Linux node/npm are required; install Node.js 22 inside the distro"
fi

reject_windows_tool node "$NODE_BIN"
reject_windows_tool npm "$NPM_BIN"

NODE_MAJOR="$($NODE_BIN -p "Number(process.versions.node.split('.')[0])")"
NODE_MINOR="$($NODE_BIN -p "Number(process.versions.node.split('.')[1])")"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 12 ]; }; then
  fail_node_toolchain "Node 22.12+ is required for the current Electron buildchain, found $($NODE_BIN -v)"
fi

if command -v lsb_release >/dev/null 2>&1; then
  echo "TAHAI_LINUX_BUILD_DISTRO=$(lsb_release -ds)"
elif [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "TAHAI_LINUX_BUILD_DISTRO=${PRETTY_NAME:-unknown}"
else
  echo "TAHAI_LINUX_BUILD_DISTRO=unknown"
fi

echo "TAHAI_LINUX_BUILD_TARGETS=${TARGETS[*]}"
echo "TAHAI_LINUX_BUILD_NODE=$($NODE_BIN -v) at $NODE_BIN"
echo "TAHAI_LINUX_BUILD_NPM=$($NPM_BIN -v) at $NPM_BIN"

export CSC_IDENTITY_AUTO_DISCOVERY=false

"$NODE_BIN" scripts/assert-linux-native-build-env.mjs
clean_path_force node_modules
clean_path_force dist
clean_path_force release
"$NPM_BIN" cache verify
"$NPM_BIN" ci --include=dev
"$NODE_BIN" -e "require.resolve('typescript'); require.resolve('electron-builder'); require.resolve('yargs'); console.log('LINUX_NODE_DEPS_OK')"

"$NPM_BIN" run verify:builder-truth
"$NPM_BIN" run verify:linux-installers-config
"$NPM_BIN" run verify:linux-native-build-guard
"$NPM_BIN" run build

test -f dist/main/main.js || {
  echo "DIST_MAIN_MISSING" >&2
  find dist -maxdepth 4 -type f | sort >&2 || true
  exit 1
}

./node_modules/.bin/electron-builder --linux "${TARGETS[@]}" --x64 --config electron-builder.yml
"$NODE_BIN" scripts/verify-linux-installers.mjs "${TARGETS[@]}"

printf '\nTAHAI_LINUX_INSTALLER_OUTPUTS\n'
find release -maxdepth 2 -type f \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' \) -printf '%p %s bytes\n' | sort

if [ -n "${TAHAI_LINUX_SOURCE_ROOT:-}" ] && [ -d "$TAHAI_LINUX_SOURCE_ROOT" ]; then
  APP_VERSION="$($NODE_BIN -p "require('./package.json').version")"
  COPY_DIR="$TAHAI_LINUX_SOURCE_ROOT/release/linux"
  mkdir -p "$COPY_DIR"

  appimage_src="$(find release -maxdepth 2 -type f \( -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.AppImage" -o -name "*.AppImage" \) | head -n 1)"
  deb_src="$(find release -maxdepth 2 -type f \( -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.deb" -o -name "*.deb" \) | head -n 1)"
  rpm_src="$(find release -maxdepth 2 -type f \( -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.rpm" -o -name "*.rpm" \) | head -n 1)"

  test -n "$appimage_src" && cp -v "$appimage_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.AppImage"
  test -n "$deb_src" && cp -v "$deb_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.deb"
  test -n "$rpm_src" && cp -v "$rpm_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.rpm"

  # PASS126 Linux RPM handoff manifest guard: every mirrored Linux package gets a checksum
  # and a machine-readable manifest for downstream OS/import pipelines.
  "$NODE_BIN" - "$COPY_DIR" "$APP_VERSION" "${TARGETS[@]}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const [copyDir, appVersion, ...targets] = process.argv.slice(2);
const artifactPattern = /\.(AppImage|deb|rpm)$/;
const files = fs.readdirSync(copyDir)
  .filter((name) => artifactPattern.test(name))
  .sort();

const shaLines = [];
const artifacts = [];
for (const file of files) {
  const abs = path.join(copyDir, file);
  const data = fs.readFileSync(abs);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const ext = path.extname(file).replace(/^\./, '');
  const kind = ext === 'AppImage' ? 'AppImage' : ext;
  shaLines.push(`${sha256}  ${file}`);
  artifacts.push({ file, kind, bytes: data.length, sha256 });
}

fs.writeFileSync(
  path.join(copyDir, 'TAHAI-Linux-installers-SHA256SUMS.txt'),
  `${shaLines.join('\n')}\n`,
);
fs.writeFileSync(
  path.join(copyDir, 'TAHAI-Linux-installers-manifest.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    pass: 'PASS126',
    product: 'TAHAI Web Services Browser',
    version: appVersion,
    builtAt: new Date().toISOString(),
    requestedTargets: targets.length ? targets : ['AppImage', 'deb', 'rpm'],
    artifacts,
  }, null, 2)}\n`,
);
NODE

  {
    echo "TAHAI Linux installer mirror"
    date -u +"builtAt=%Y-%m-%dT%H:%M:%SZ"
    echo "sourceRoot=$TAHAI_LINUX_SOURCE_ROOT"
    echo "nativeBuildDir=$PWD"
    echo "node=$($NODE_BIN -v) at $NODE_BIN"
    echo "npm=$($NPM_BIN -v) at $NPM_BIN"
    echo "targets=${TARGETS[*]}"
    find "$COPY_DIR" -maxdepth 1 -type f \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' \) -printf '%f %s bytes\n' | sort
    echo "sha256Sums=TAHAI-Linux-installers-SHA256SUMS.txt"
    echo "jsonManifest=TAHAI-Linux-installers-manifest.json"
  } > "$COPY_DIR/TAHAI-Linux-installers-manifest.txt"

  printf '\nTAHAI_LINUX_INSTALLERS_COPIED_TO=%s\n' "$COPY_DIR"
  ls -lh "$COPY_DIR"
fi
