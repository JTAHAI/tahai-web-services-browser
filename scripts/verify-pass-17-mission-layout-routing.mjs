import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function fail(message) { console.error(`PASS17_MISSION_LAYOUT_ROUTING_FAIL=${message}`); process.exit(1); }
for (const token of [
  'PASS 17 Mission Control layout routing',
  'function activeMissionPaneId',
  'function activeNavigationTarget',
  'function goBackTarget',
  'function goForwardTarget',
  'function reloadTarget',
  'function swapActiveMissionPane',
  "backButton.addEventListener('click', goBackTarget)",
  "forwardButton.addEventListener('click', goForwardTarget)",
  "reloadButton.addEventListener('click', reloadTarget)",
  'mission-pane-swap-left',
  'mission-pane-swap-right',
  'Ctrl+Alt+Shift+←',
  'Ctrl+Alt+Shift+→'
]) {
  if (!app.includes(token)) fail(`missing-app-token:${token}`);
}
for (const token of [
  'PASS 17 Mission Control layout polish',
  '.webview-stage.mission-layout .browser-view::before',
  '.webview-stage.mission-layout .browser-view.mission-active-pane::before'
]) {
  if (!css.includes(token)) fail(`missing-css-token:${token}`);
}
if (pkg.scripts?.['verify:pass-17-mission-layout-routing'] !== 'node scripts/verify-pass-17-mission-layout-routing.mjs') fail('missing-package-script');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-17-mission-layout-routing')) fail('release-blockers-not-wired');
console.log('PASS17_MISSION_LAYOUT_ROUTING_OK=1');
