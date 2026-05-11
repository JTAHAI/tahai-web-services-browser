#!/usr/bin/env bash
set -euo pipefail

# PASS147 Linux installed package smoke evidence runner.
# Source-only helper. Generated evidence is written under artifacts/ and must not be committed.

INSTALLED_BIN=""
PACKAGE_TYPE="unknown"
PACKAGE_PATH=""
EXPECTED_VERSION="1.8.30"
LAUNCH=0
OUTPUT_DIR="artifacts/linux-installed-smoke"
OPERATOR_NOTES=""

usage() {
  cat <<'EOF_USAGE'
Usage: scripts/run-pass147-linux-installed-smoke.sh [options]

Options:
  --installed-bin PATH        Explicit installed executable or AppImage path.
  --package-type TYPE         rpm, deb, appimage, or unknown.
  --package-path PATH         Package/AppImage file used for checksum evidence.
  --expected-version VERSION  Expected version, default 1.8.30.
  --launch                    Launch the resolved binary for manual smoke; runner does not install or uninstall.
  --output-dir DIR            Evidence output directory, default artifacts/linux-installed-smoke.
  --operator-notes TEXT       Non-secret operator note to place in evidence JSON.
  -h, --help                  Show this help.
EOF_USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --installed-bin)
      INSTALLED_BIN="${2:-}"; shift 2 ;;
    --package-type)
      PACKAGE_TYPE="${2:-unknown}"; shift 2 ;;
    --package-path)
      PACKAGE_PATH="${2:-}"; shift 2 ;;
    --expected-version)
      EXPECTED_VERSION="${2:-1.8.30}"; shift 2 ;;
    --launch)
      LAUNCH=1; shift ;;
    --output-dir)
      OUTPUT_DIR="${2:-artifacts/linux-installed-smoke}"; shift 2 ;;
    --operator-notes)
      OPERATOR_NOTES="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "PASS147_LINUX_INSTALLED_SMOKE_ERROR=unknown argument: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

case "$(printf '%s' "$PACKAGE_TYPE" | tr '[:upper:]' '[:lower:]')" in
  rpm|deb|appimage|unknown) PACKAGE_TYPE="$(printf '%s' "$PACKAGE_TYPE" | tr '[:upper:]' '[:lower:]')" ;;
  *) echo "PASS147_LINUX_INSTALLED_SMOKE_ERROR=package type must be rpm, deb, appimage, or unknown" >&2; exit 2 ;;
esac

if [ "$(uname -s 2>/dev/null || true)" != "Linux" ]; then
  echo "PASS147_LINUX_INSTALLED_SMOKE_ERROR=runner must be executed from Linux or Fedora WSL" >&2
  exit 1
fi

sha256_file() {
  local path_value="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path_value" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path_value" | awk '{print $1}'
  else
    echo "sha256-tool-missing"
  fi
}

json_escape() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1] || ''))" "$1"
}

resolve_binary() {
  local candidate
  if [ -n "$INSTALLED_BIN" ] && [ -f "$INSTALLED_BIN" ]; then
    readlink -f "$INSTALLED_BIN"
    return 0
  fi
  if [ "$PACKAGE_TYPE" = "appimage" ] && [ -n "$PACKAGE_PATH" ] && [ -f "$PACKAGE_PATH" ]; then
    readlink -f "$PACKAGE_PATH"
    return 0
  fi
  for name in tahai-web-services-browser TAHAI-Web-Services-Browser "TAHAI Web Services Browser"; do
    if command -v "$name" >/dev/null 2>&1; then
      command -v "$name"
      return 0
    fi
  done
  for candidate in \
    "/opt/TAHAI Web Services Browser/tahai-web-services-browser" \
    "/opt/TAHAI Web Services Browser/TAHAI Web Services Browser" \
    "/opt/tahai-web-services-browser/tahai-web-services-browser" \
    "/usr/bin/tahai-web-services-browser" \
    "/usr/local/bin/tahai-web-services-browser"; do
    if [ -f "$candidate" ]; then
      readlink -f "$candidate"
      return 0
    fi
  done
  return 1
}

file_evidence_json() {
  local path_value="$1"
  if [ -z "$path_value" ] || [ ! -f "$path_value" ]; then
    printf 'null'
    return 0
  fi
  local resolved size sha kind mtime mode
  resolved="$(readlink -f "$path_value")"
  size="$(stat -c '%s' "$resolved" 2>/dev/null || echo 0)"
  sha="$(sha256_file "$resolved")"
  kind="$(file -b "$resolved" 2>/dev/null | head -c 500 || true)"
  mtime="$(date -u -r "$resolved" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || true)"
  mode="$(stat -c '%A' "$resolved" 2>/dev/null || true)"
  printf '{"path":%s,"sizeBytes":%s,"sha256":%s,"fileSummary":%s,"mode":%s,"lastWriteTimeUtc":%s}' \
    "$(json_escape "$resolved")" "$size" "$(json_escape "$sha")" "$(json_escape "$kind")" "$(json_escape "$mode")" "$(json_escape "$mtime")"
}

command_json() {
  local label="$1"
  shift
  local out status
  set +e
  out="$($@ 2>&1 | head -c 4000)"
  status=$?
  set -e
  printf '{"command":%s,"exitCode":%s,"output":%s}' "$(json_escape "$label")" "$status" "$(json_escape "$out")"
}

collect_manifest_json() {
  local first=1
  printf '['
  for candidate in \
    "release/linux/TAHAI-Linux-installers-manifest.json" \
    "release/linux/TAHAI-Linux-installers-manifest.txt" \
    "release/linux/TAHAI-Linux-installers-SHA256SUMS.txt"; do
    if [ -f "$candidate" ]; then
      [ "$first" -eq 0 ] && printf ','
      file_evidence_json "$candidate"
      first=0
    fi
  done
  printf ']'
}

collect_desktop_entries_json() {
  local first=1
  printf '['
  for candidate in /usr/share/applications/*tahai*.desktop "$HOME"/.local/share/applications/*tahai*.desktop; do
    if [ -f "$candidate" ]; then
      [ "$first" -eq 0 ] && printf ','
      file_evidence_json "$candidate"
      first=0
    fi
  done
  printf ']'
}

RESOLVED_BIN=""
if RESOLVED_BIN="$(resolve_binary)"; then
  :
else
  echo "PASS147_LINUX_INSTALLED_SMOKE_ERROR=installed Linux executable/AppImage was not found. Pass --installed-bin or --package-path for AppImage." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
STAMP="$(date -u '+%Y%m%d-%H%M%S')"
JSON_PATH="$OUTPUT_DIR/PASS147-linux-installed-smoke-evidence-$STAMP.json"
MD_PATH="$OUTPUT_DIR/PASS147-linux-installed-smoke-evidence-$STAMP.md"

DISTRO="unknown"
if [ -f /etc/os-release ]; then
  DISTRO="$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-unknown}")"
fi
KERNEL="$(uname -srmo 2>/dev/null || uname -a)"
ARCH="$(uname -m 2>/dev/null || true)"
NODE_VERSION="$(node -v 2>/dev/null || true)"
NPM_VERSION="$(npm -v 2>/dev/null || true)"

RPM_QUERY="null"
if command -v rpm >/dev/null 2>&1; then
  RPM_QUERY="$(command_json 'rpm -qi tahai-web-services-browser' rpm -qi tahai-web-services-browser)"
fi
DPKG_QUERY="null"
if command -v dpkg-query >/dev/null 2>&1; then
  DPKG_QUERY="$(command_json 'dpkg-query -s tahai-web-services-browser' dpkg-query -s tahai-web-services-browser)"
fi

LAUNCH_JSON='{"attempted":false,"started":false,"processId":null,"warning":null,"logPath":null}'
if [ "$LAUNCH" -eq 1 ]; then
  LOG_PATH="$OUTPUT_DIR/PASS147-linux-installed-smoke-launch-$STAMP.log"
  set +e
  "$RESOLVED_BIN" >"$LOG_PATH" 2>&1 &
  PID=$!
  sleep 4
  if kill -0 "$PID" >/dev/null 2>&1; then
    STARTED=true
  else
    STARTED=false
  fi
  set -e
  LAUNCH_JSON="{\"attempted\":true,\"started\":$STARTED,\"processId\":$PID,\"warning\":\"Runner launched the app only. Complete the manual checklist, capture screenshots separately, then close the app yourself.\",\"logPath\":$(json_escape "$LOG_PATH") }"
fi

VERSION_LOOKS_EXPECTED=false
case "$RESOLVED_BIN" in
  *"$EXPECTED_VERSION"*) VERSION_LOOKS_EXPECTED=true ;;
esac
if [ -n "$PACKAGE_PATH" ] && [ -f "$PACKAGE_PATH" ]; then
  case "$PACKAGE_PATH" in
    *"$EXPECTED_VERSION"*) VERSION_LOOKS_EXPECTED=true ;;
  esac
fi

MANUAL_CHECKLIST='["linux-package-checksum-verified","linux-package-installs-cleanly","installed-command-resolves","package-manager-truth","desktop-entry-and-icon-truth","installed-app-launches","about-version-truth","normal-navigation","guide-kb-opens","mission-control-entry","split-triview-quad-entry","small-window-reflow","active-pane-routing","evidence-export-redaction","devtools-available","no-console-crash-noise","remove-clean-path-understood"]'
CHECKLIST_JSON="$(node -e "const ids=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(ids.map(id=>({id,status:'manual-pending',evidence:''}))))" "$MANUAL_CHECKLIST")"

cat > "$JSON_PATH" <<EOF_JSON
{
  "pass": "PASS147",
  "product": "TAHAI Web Services Browser",
  "expectedVersion": $(json_escape "$EXPECTED_VERSION"),
  "packageType": $(json_escape "$PACKAGE_TYPE"),
  "collectedAtUtc": $(json_escape "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"),
  "repoRoot": $(json_escape "$(pwd -P)"),
  "linux": {
    "distro": $(json_escape "$DISTRO"),
    "kernel": $(json_escape "$KERNEL"),
    "architecture": $(json_escape "$ARCH"),
    "nodeVersion": $(json_escape "$NODE_VERSION"),
    "npmVersion": $(json_escape "$NPM_VERSION")
  },
  "installedExecutable": $(file_evidence_json "$RESOLVED_BIN"),
  "packageFile": $(file_evidence_json "$PACKAGE_PATH"),
  "releaseManifestFiles": $(collect_manifest_json),
  "desktopEntries": $(collect_desktop_entries_json),
  "packageManager": {
    "rpm": $RPM_QUERY,
    "dpkg": $DPKG_QUERY
  },
  "launch": $LAUNCH_JSON,
  "versionLooksExpected": $VERSION_LOOKS_EXPECTED,
  "manualChecklist": $CHECKLIST_JSON,
  "operatorNotes": $(json_escape "$OPERATOR_NOTES"),
  "redactionReminder": "Do not include secrets, cookies, tokens, customer screenshots, or raw customer data in attached notes/screenshots."
}
EOF_JSON

cat > "$MD_PATH" <<EOF_MD
# PASS147 Linux Installed Package Smoke Evidence

- Product: TAHAI Web Services Browser
- Expected version: $EXPECTED_VERSION
- Package type: $PACKAGE_TYPE
- Collected UTC: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
- Linux distro: $DISTRO
- Kernel: $KERNEL
- Installed executable/AppImage: $RESOLVED_BIN
- Version looks expected from paths: $VERSION_LOOKS_EXPECTED
- Launch attempted: $([ "$LAUNCH" -eq 1 ] && echo true || echo false)

## Manual checklist

Mark each item in the JSON after completing the installed-app smoke run:

- [ ] linux-package-checksum-verified
- [ ] linux-package-installs-cleanly
- [ ] installed-command-resolves
- [ ] package-manager-truth
- [ ] desktop-entry-and-icon-truth
- [ ] installed-app-launches
- [ ] about-version-truth
- [ ] normal-navigation
- [ ] guide-kb-opens
- [ ] mission-control-entry
- [ ] split-triview-quad-entry
- [ ] small-window-reflow
- [ ] active-pane-routing
- [ ] evidence-export-redaction
- [ ] devtools-available
- [ ] no-console-crash-noise
- [ ] remove-clean-path-understood

## Redaction reminder

Do not include secrets, cookies, tokens, customer screenshots, or raw customer data in attached notes/screenshots.
EOF_MD

printf 'PASS147_LINUX_INSTALLED_SMOKE_EVIDENCE_JSON=%s\n' "$JSON_PATH"
printf 'PASS147_LINUX_INSTALLED_SMOKE_EVIDENCE_MD=%s\n' "$MD_PATH"
if [ "$VERSION_LOOKS_EXPECTED" != true ]; then
  echo "PASS147_LINUX_INSTALLED_SMOKE_WARNING=resolved path/package path did not visibly include expected version $EXPECTED_VERSION; review package manager/About evidence before claiming installed-app success" >&2
fi
