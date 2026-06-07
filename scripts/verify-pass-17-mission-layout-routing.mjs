import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

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
  'mission-pane-swap-left',
  'mission-pane-swap-right',
  'Ctrl+Alt+Shift+←',
  'Ctrl+Alt+Shift+→'
]) {
  if (!app.includes(token)) fail(`missing-app-token:${token}`);
}

const listenerFamilies = [
  ["backButton.addEventListener('click', goBackTarget)", "backButton.addEventListener('click', () => goBackTarget('toolbar'))"],
  ["forwardButton.addEventListener('click', goForwardTarget)", "forwardButton.addEventListener('click', () => goForwardTarget('toolbar'))"],
  ["reloadButton.addEventListener('click', reloadTarget)", "reloadButton.addEventListener('click', () => reloadTarget('toolbar'))"]
];
for (const family of listenerFamilies) {
  if (!family.some((token) => app.includes(token))) fail(`missing-app-token:${family[0]}`);
}
for (const token of [
  'PASS 17 Mission Control layout polish',
  '.webview-stage.mission-layout .browser-view::before',
  '.webview-stage.mission-layout .browser-view.mission-active-pane::before'
]) {
  if (!css.includes(token)) fail(`missing-css-token:${token}`);
}
if (pkg.scripts?.['verify:pass-17-mission-layout-routing'] !== 'node scripts/verify-pass-17-mission-layout-routing.mjs') fail('missing-package-script');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-17-mission-layout-routing')) fail('release-blockers-not-wired');
console.log('PASS17_MISSION_LAYOUT_ROUTING_OK=1');
