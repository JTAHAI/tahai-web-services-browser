# PASS150 — RC2 final ship candidate / GA manifest

PASS150 closes the bounded browser hardening lane as the RC2 final ship-candidate manifest pass.

Version remains `1.8.30`.
Release pass is `PASS150`.
Release phase is `rc2-final-ship-candidate-ga-manifest`.
Release channel remains `public-rc`.
Update channel remains `manual-release`.
No silent auto-update lane is enabled.

## Scope

PASS150 is not a feature pass. It is a final release-truth and manifest pass with one release-blocking chrome regression fix:

- Keep the empty topbar/tab-strip track draggable.
- Keep actual tabs and buttons `no-drag` so tab clicks, tab close, and the new-tab button remain interactive.
- Preserve PASS149 no-new-features freeze.
- Preserve PASS138 Windows installer closeout continuity.
- Preserve PASS139 Linux RPM/AppImage/DEB handoff continuity.
- Preserve PASS142 Electron security final audit boundaries.
- Preserve PASS143 mission redaction closeout.
- Preserve PASS144 public repo and supply-chain hardening.
- Preserve PASS145 privacy/support/known-issues truth.
- Preserve PASS146/PASS147/PASS148 local evidence runners.

## Required local proof

Run:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:pass-138-windows-installer-closeout
npm run verify:pass-149-rc1-freeze
npm run verify:pass-150-final-ship-candidate
npm run verify:release-blockers
```

## Manual UI smoke required before public release

Because titlebar dragging is OS/window-manager behavior, the final installed Windows smoke must include:

1. Drag from the brand area.
2. Drag from empty tab-strip space between/after tabs.
3. Confirm clicking tabs still activates tabs.
4. Confirm clicking tab close still closes the tab.
5. Confirm the `+` new-tab control still opens a new tab.
6. Confirm native caption controls still work.

## Not included

PASS150 does not include generated installers, generated manifests, `release/`, `dist/`, `artifacts/`, `.pass-runs/`, `node_modules/`, runtime profiles, local mission data, or evidence data.

- Titlebar drag-region manual smoke completed on Windows.
