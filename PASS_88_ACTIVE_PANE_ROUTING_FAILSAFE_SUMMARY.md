# PASS88 — Active Pane Routing Failsafe

PASS88 hardens the next weakest real browser surface after PASS87: active-pane routing and focus drift across Mission Control layouts.

## Added / changed

- Fixed PASS87 TypeScript build drift so `npm run build` can compile again.
- Added `Active Pane Routing Failsafe` command.
- Added `Copy Active Pane Routing Report` command.
- Added `Ctrl+Alt+Shift+P` shortcut and shortcut help row.
- Hardened the real address form submit path to repair visible-pane drift before navigation.
- Hardened `setMissionActivePane` so Ctrl+Alt+1..4 and command-center pane focus cannot leave the mission targeting a hidden pane after 1-Up/2-Up/3-Up/4-Up/Focus changes.
- Added source-level mouse back/forward routing in renderer for XButton mouse events.
- Added main-process `app-command` routing for OS/browser mouse back/forward commands through the existing safe renderer menu-command channel.
- Added focus-visible CSS and route-target attributes for address, toolbar, layout controls, webviews, and active Mission panes.
- Added `verify:pass-88-active-pane-routing-failsafe` and wired it into `verify:release-blockers`.
- Hardened PASS55, PASS81, and PASS84-PASS88 source verifiers so `verify:release-blockers` can run after `npm ci`; generated artifact exclusion is enforced by `.gitignore` and ZIP verification instead of falsely failing because `node_modules` exists locally.

## Guardrails preserved

- Browser-side work only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No secrets, tokens, profiles, generated installers, `dist`, `release`, or `node_modules` committed.
- Webviews remain unprivileged and active-pane routing stays renderer/main-command mediated.

## Verification

Run:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:pass-87-operator-recovery-mesh
npm run verify:pass-88-active-pane-routing-failsafe
npm run build
npm run verify:release-blockers
```
