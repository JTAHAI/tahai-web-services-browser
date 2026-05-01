#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGETS=("${@:-AppImage deb rpm}")
if [ "$#" -eq 0 ]; then
  TARGETS=(AppImage deb rpm)
fi

if ! command -v node >/dev/null 2>&1; then
  echo "TAHAI_LINUX_BUILD_ERROR=node is required in this WSL distro" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "TAHAI_LINUX_BUILD_ERROR=npm is required in this WSL distro" >&2
  exit 1
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
export CSC_IDENTITY_AUTO_DISCOVERY=false

npm ci
npm run verify:builder-truth
npm run verify:linux-installers-config
npm run build
npx electron-builder --linux "${TARGETS[@]}" --x64 --config electron-builder.yml
npm run verify:package:linux

printf '\nTAHAI_LINUX_INSTALLER_OUTPUTS\n'
find release -maxdepth 2 -type f \( -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' \) -printf '%p %s bytes\n' | sort
