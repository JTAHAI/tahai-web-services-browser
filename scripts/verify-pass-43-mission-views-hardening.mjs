import fs from 'node:fs';
const fail = (m) => { console.error(`PASS43_MISSION_VIEWS_HARDENING_FAIL=${m}`); process.exit(1); };
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const renderer = fs.readFileSync('src/renderer/app.ts','utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css','utf8');
const summary = fs.readFileSync('PASS_43_MISSION_VIEWS_HARDENING_SUMMARY.md','utf8');
for (const [content, needle, code] of [
  [renderer, 'PASS 43 Mission Views hardening', 'renderer-marker-missing'],
  [renderer, 'renderMissionPaneHeads', 'pane-head-renderer-missing'],
  [renderer, 'mission-pane-heads', 'pane-head-class-missing'],
  [renderer, 'normalizeMissionPaneId', 'pane-normalizer-missing'],
  [renderer, 'visibleLayoutForPane', 'visible-layout-router-missing'],
  [renderer, 'startMissionTabDrag', 'browser-tab-drag-missing'],
  [renderer, 'application/x-tahai-browser-tab-id', 'browser-tab-dnd-mime-missing'],
  [renderer, 'upsertBrowserTabIntoMissionPane', 'pane-upsert-missing'],
  [renderer, 'makeQuadFromOpenTabs', 'quad-from-tabs-missing'],
  [renderer, 'toggleMissionFocusPane();', 'focus-shortcut-toggle-missing'],
  [css, 'PASS 43: Mission Views hardening', 'css-marker-missing'],
  [css, '.mission-pane-heads', 'pane-head-css-missing'],
  [css, '.mission-pane-head.active', 'active-pane-head-css-missing'],
  [summary, 'Mission Views hardening', 'summary-missing']
]) {
  if (!content.includes(needle)) fail(code);
}
if (!pkg.scripts?.['verify:pass-43-mission-views-hardening']) fail('package-script-missing');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-43-mission-views-hardening')) fail('release-blockers-not-wired');
console.log('PASS43_MISSION_VIEWS_HARDENING_OK=1');
