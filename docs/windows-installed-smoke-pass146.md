# PASS146 — Windows manual smoke checklist + evidence runner

PASS146 closes the Windows installed-app QA handoff gap. It does **not** claim the installed Windows app was manually smoked inside CI or this source pass. It gives the operator a repeatable checklist and a local evidence runner for the real Windows machine after NSIS/MSI packaging and install.

Version remains `1.8.30`. Release channel remains `public-rc`. Update channel remains `manual-release`. The Windows build remains an unsigned preview until the approved signing lane is active.

## Scope

Browser-side source only:

- Add a Windows installed-app smoke checklist.
- Add a Windows evidence runner that writes local evidence under `artifacts/windows-installed-smoke/`.
- Keep generated evidence excluded from source.
- Verify the checklist covers install, launch, version truth, Guide/KB, Mission Control, 2-Up, Tri-view, Quad, small-window behavior, active-pane routing, Evidence export redaction, DevTools, and uninstall path awareness.

Out of scope:

- No direct PSA API calls.
- No IT Docs backend changes.
- No generated installers or evidence files committed to source.
- No claim of manual installed-app success until the Windows runner and checklist are actually completed on Windows.

## Build and install first

From Windows PowerShell:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run package:win:release
npm run verify:windows-installer-handoff
```

Verify the installer checksum against `release/windows/TAHAI-Windows-installers-SHA256SUMS.txt` before install.

## Evidence runner

After installing the NSIS or MSI preview, run:

```powershell
Set-Location C:\dev\browser\app
npm run evidence:windows-installed-smoke -- -InstallerType nsis -Launch
```

If the app is installed in a non-default path:

```powershell
npm run evidence:windows-installed-smoke -- -InstallerType msi -InstalledExePath "C:\Path\To\TAHAI Web Services Browser.exe" -Launch
```

The runner writes:

- `artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence-*.json`
- `artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence-*.md`

These files are local evidence outputs and must not be committed.

## Manual checklist

Complete this checklist on the installed Windows app:

1. **Installer checksum verified** — confirm SHA256 before running installer.
2. **Installer completes cleanly** — NSIS/MSI install or upgrade completes without error dialogs.
3. **Installed app launches** — launch from Start menu, shortcut, or installed executable path; do not use `npm run dev` for this proof.
4. **About/version truth** — About page shows v1.8.30/public-rc/manual-release/unsigned preview truth and does not claim GA.
5. **Normal navigation** — address bar, reload, back, forward, and regular browsing still work.
6. **Guide/KB opens** — Guide is discoverable from primary nav or More Tools when the window is constrained.
7. **Mission Control opens** — Mission opens cleanly and does not require an oversized main window to be usable.
8. **2-Up / Tri-view / Quad** — each view can be entered and recovered without hidden or overlapping panes.
9. **Small-window reflow** — chrome, tools, and Mission surfaces remain reachable at constrained sizes.
10. **Active-pane routing** — address bar, reload, back, forward, and pane focus target the active pane/tab only.
11. **Evidence export redaction** — secret-like sample text is warned/redacted before export handoff.
12. **DevTools available** — F12 or the menu path opens Chromium DevTools for diagnostics.
13. **No console/crash noise** — no repeated renderer crashes, missing critical resources, or unhandled promise loops.
14. **Uninstall path understood** — Add/Remove Programs entry is present; uninstall is explicit, not silently triggered by the evidence runner.

## Redaction rule

Do not include secrets, cookies, tokens, customer screenshots, raw customer records, or private browser profile data in evidence notes or screenshots. If screenshots are needed, redact them before sharing.

## Pass/fail rule

PASS146 source verification only proves the checklist and evidence runner exist and are wired into release blockers. Installed-app QA is not complete until a human operator runs the installed Windows app, completes the checklist, and retains the generated evidence packet outside the source tree.
