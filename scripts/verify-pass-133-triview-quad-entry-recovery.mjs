#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };
const required = ['src/renderer/index.html','src/renderer/app.ts','src/renderer/styles/browser.css','docs/pass-133-triview-quad-entry-recovery.md','PASS_133_TRIVIEW_QUAD_ENTRY_RECOVERY_SUMMARY.md','package.json'];
for (const file of required) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const html = read('src/renderer/index.html'); const app = read('src/renderer/app.ts'); const css = read('src/renderer/styles/browser.css'); const doc = read('docs/pass-133-triview-quad-entry-recovery.md'); const summary = read('PASS_133_TRIVIEW_QUAD_ENTRY_RECOVERY_SUMMARY.md'); const pkg = JSON.parse(read('package.json'));
  for (const layout of ['triple-top','triple-bottom','triple-left','triple-right']) need(html.includes(`data-mission-layout="${layout}"`), `Mission layout controls missing ${layout}`);
  need(html.includes('data-pass133-cycle-triview="true"'), 'Mission layout controls missing PASS133 cycle 3-Up control');
  need(html.includes('data-pass133-recover-view="true"'), 'Mission layout controls missing PASS133 recover view control');
  need(app.includes('function pass133CycleTriViewVariant'), 'app missing PASS133 tri-view cycle function');
  need(app.includes('function pass133RecoverMissionView'), 'app missing PASS133 recover function');
  need(app.includes('function pass133AfterLayoutEntry'), 'app missing PASS133 layout-entry settle hook');
  need(app.includes('document.body.dataset.pass133LastTriViewCycle'), 'tri-view cycle must stamp operator-visible recovery evidence');
  need(app.includes('document.body.dataset.pass133LastRecoverView'), 'recover view must stamp operator-visible recovery evidence');
  need(app.includes('pass68ClearMissionPaneClickSwap()'), 'recover view must clear stale click-swap overlay state');
  need(app.includes("pass108HideMissionPaneSwapTargets('pass133-recover')"), 'recover view must clear PASS108 swap overlay targets');
  need(app.includes('pass70ClearTransientMissionPaneUiState()'), 'recover view must clear transient pane drag state');
  need(app.includes('pass72ScheduleMissionPanePixelLayout()'), 'PASS133 must force native webview pixel-layout settle');
  need(app.includes('pass78RepaintMissionView(`pass133-${reason}`)'), 'recover view must repaint/fit Mission panes');
  need(app.includes('pass89ScheduleMissionPaneRestoreFailsafe(`pass133-${reason}`)'), 'recover view must run Mission pane restore failsafe');
  need(app.includes('pass107ScheduleMissionViewportSettle(`pass133-${reason}`)'), 'recover view must settle Site View / Mission viewport geometry');
  need(app.includes("target.closest<HTMLButtonElement>('[data-pass133-cycle-triview]')"), 'layout controls missing PASS133 cycle click handler');
  need(app.includes("target.closest<HTMLButtonElement>('[data-pass133-recover-view]')"), 'layout controls missing PASS133 recover click handler');
  for (const commandId of ['mission-triad-left','mission-triad-right','mission-triad-cycle','mission-view-recover']) need(app.includes(`id: '${commandId}'`), `Command palette missing ${commandId}`);
  need(app.includes("!event.shiftKey && ['1','2','3','4'].includes(event.key)"), 'pane focus shortcut must ignore Shift to avoid colliding with Ctrl+Alt+Shift+3 layout entry');
  need(app.includes('/^(?:Digit3|Numpad3)$/.test(event.code)'), 'Ctrl+Alt+Shift+3 must use event.code so keyboard layout symbols do not break 3-Up Top entry');
  need(css.includes('PASS133') && css.includes('[data-pass133-cycle-triview]') && css.includes('[data-pass133-recover-view]'), 'browser CSS missing PASS133 layout control styling');
  need(doc.includes('PASS133') && doc.includes('Tri-view') && doc.includes('Recover View'), 'PASS133 doc missing tri-view/recovery coverage');
  need(summary.includes('1.8.30 unchanged') && summary.includes('PASS133'), 'PASS133 summary must preserve version truth');
  need(pkg.scripts?.['verify:pass-133-triview-quad-entry-recovery'] === 'node scripts/verify-pass-133-triview-quad-entry-recovery.mjs', 'missing package script for PASS133');
  need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-133-triview-quad-entry-recovery'), 'release blockers missing PASS133 verifier');
}
if (failures.length) { console.error('PASS133 Tri-view / Quad View entry + recovery verification failed:'); for (const failure of failures) console.error(` - ${failure}`); process.exit(1); }
console.log('PASS133 Tri-view / Quad View entry + recovery verification passed.');
