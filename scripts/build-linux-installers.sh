#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TARGETS=("$@")
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=(AppImage deb rpm)
fi

NATIVE_BUILD_DIR="${TAHAI_LINUX_NATIVE_BUILD_DIR:-$HOME/tahai-browser-linux-build}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "TAHAI_LINUX_BUILD_ERROR=$1 is required in this Linux environment" >&2
    exit 1
  fi
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
  rm -rf "$NATIVE_BUILD_DIR"
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
    TAHAI_LINUX_SOURCE_ROOT="$SOURCE_ROOT" \
    TAHAI_LINUX_NATIVE_BUILD_ACTIVE=1 \
    TAHAI_LINUX_NATIVE_BUILD_DIR="$NATIVE_BUILD_DIR" \
    bash scripts/build-linux-installers.sh "${TARGETS[@]}"
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

if [ -z "$NODE_BIN" ] || [ -z "$NPM_BIN" ]; then
  echo "TAHAI_LINUX_BUILD_ERROR=Linux node/npm are required; install Node.js 22 inside the distro" >&2
  exit 1
fi

reject_windows_tool node "$NODE_BIN"
reject_windows_tool npm "$NPM_BIN"

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
rm -rf node_modules dist release
"$NPM_BIN" cache verify
"$NPM_BIN" ci --include=dev
"$NODE_BIN" -e "require.resolve('typescript'); require.resolve('electron-builder'); require.resolve('yargs'); console.log('LINUX_NODE_DEPS_OK')"

"$NPM_BIN" run verify:builder-truth
"$NPM_BIN" run verify:linux-installers-config
"$NPM_BIN" run build

test -f dist/main/main.js || {
  echo "DIST_MAIN_MISSING" >&2
  find dist -maxdepth 4 -type f | sort >&2 || true
  exit 1
}

./node_modules/.bin/electron-builder --linux "${TARGETS[@]}" --x64 --config electron-builder.yml
"$NPM_BIN" run verify:package:linux

printf '\nTAHAI_LINUX_INSTALLER_OUTPUTS\n'
find release -maxdepth 2 -type f \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' \) -printf '%p %s bytes\n' | sort

if [ -n "${TAHAI_LINUX_SOURCE_ROOT:-}" ] && [ -d "$TAHAI_LINUX_SOURCE_ROOT" ]; then
  APP_VERSION="$("$NODE_BIN" -p "require('./package.json').version")"
  COPY_DIR="$TAHAI_LINUX_SOURCE_ROOT/release/linux"
  mkdir -p "$COPY_DIR"

  appimage_src="$(find release -maxdepth 2 -type f -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.AppImage" | head -n 1)"
  deb_src="$(find release -maxdepth 2 -type f -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.deb" | head -n 1)"
  rpm_src="$(find release -maxdepth 2 -type f -name "TAHAI-Web-Services-Browser-${APP_VERSION}-*.rpm" | head -n 1)"

  test -n "$appimage_src" && cp -v "$appimage_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.AppImage"
  test -n "$deb_src" && cp -v "$deb_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.deb"
  test -n "$rpm_src" && cp -v "$rpm_src" "$COPY_DIR/TAHAI-Web-Services-Browser-${APP_VERSION}-x64.rpm"

  printf '\nTAHAI_LINUX_INSTALLERS_COPIED_TO=%s\n' "$COPY_DIR"
  ls -lh "$COPY_DIR"
fi

