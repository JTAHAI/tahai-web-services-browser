#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };
const required = ['src/renderer/index.html','src/renderer/app.ts','src/renderer/styles/mission-control.css','docs/pass-132-mission-small-window-stress.md','PASS_132_MISSION_SMALL_WINDOW_STRESS_SUMMARY.md','package.json'];
for (const file of required) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const html = read('src/renderer/index.html'); const app = read('src/renderer/app.ts'); const css = read('src/renderer/styles/mission-control.css'); const doc = read('docs/pass-132-mission-small-window-stress.md'); const summary = read('PASS_132_MISSION_SMALL_WINDOW_STRESS_SUMMARY.md'); const pkg = JSON.parse(read('package.json'));
  need(html.includes('id="mission-compact-jumpbar"'), 'Mission dialog missing compact jumpbar');
  need(html.includes('data-pass132-small-window-stress="true"'), 'compact jumpbar missing PASS132 marker');
  for (const section of ['recipes','tabs','runbook','evidence','export','saved']) need(html.includes(`data-pass132-jump="${section}"`), `compact jumpbar missing ${section} jump`);
  need(app.includes('const missionCompactJumpbar'), 'app missing compact jumpbar element binding');
  need(app.includes("type Pass132MissionViewportState = 'standard' | 'compact' | 'micro'"), 'app missing PASS132 viewport state type');
  need(app.includes('function pass132MissionViewportState'), 'app missing PASS132 viewport classifier');
  need(app.includes('window.innerWidth < 1040 || window.innerHeight < 760'), 'PASS132 must broaden small-window stress threshold beyond PASS128');
  need(app.includes('window.innerWidth < 620 || window.innerHeight < 560'), 'PASS132 must include micro-window stress threshold');
  need(app.includes('function pass132UpdateMissionSmallWindowStress'), 'app missing PASS132 stress updater');
  need(app.includes('missionDialog.dataset.pass132MissionViewport = state'), 'mission dialog must expose PASS132 viewport state');
  need(app.includes("document.body.classList.toggle('mission-small-window-stress'"), 'body must expose small-window stress class');
  need(app.includes("document.body.classList.toggle('mission-micro-window-stress'"), 'body must expose micro-window stress class');
  need(app.includes('pass132UpdateMissionSmallWindowStress(reason)'), 'PASS128 viewport update must feed PASS132 stress state');
  need(app.includes('function pass132JumpMissionSection'), 'app missing PASS132 jump handler');
  need(app.includes("scrollIntoView({ block: 'start'"), 'PASS132 section jumps must scroll target sections into view');
  need(app.includes("missionCompactJumpbar?.addEventListener('click'"), 'compact jumpbar missing click listener');
  need(app.includes('orientationchange'), 'PASS132 must handle orientationchange while Mission Control is open');
  need(app.includes("document.body.classList.remove('mission-small-window-stress', 'mission-micro-window-stress')"), 'close path must clear PASS132 stress classes');
  need(css.includes('PASS132') && css.includes('.mission-compact-jumpbar'), 'Mission CSS missing PASS132 jumpbar styles');
  need(css.includes('data-pass132-mission-viewport="compact"'), 'Mission CSS missing compact PASS132 selector');
  need(css.includes('data-pass132-mission-viewport="micro"'), 'Mission CSS missing micro PASS132 selector');
  need(css.includes('body.mission-small-window-stress .mission-dialog'), 'Mission CSS missing body small-window stress dialog rule');
  need(css.includes('body.mission-micro-window-stress .mission-form'), 'Mission CSS missing micro-window form rule');
  need(css.includes('position: sticky !important') && css.includes('top: 48px !important') && css.includes('top: 89px !important'), 'compact Mission controls must remain sticky under stress');
  need(css.includes('grid-template-areas:') && css.includes('"recipes"') && css.includes('"tabs"') && css.includes('"runbook"'), 'small-window workbench must collapse to one-column section order');
  need(css.includes('clamp(178px, 42dvh, 320px)'), 'small-window sections must have bounded responsive height');
  need(css.includes('#mission-export-preview') && css.includes('min-height: 178px'), 'export preview must stay usable under small-window stress');
  need(doc.includes('PASS132') && doc.includes('small-window stress'), 'PASS132 doc missing pass title');
  need(doc.includes('1040') && doc.includes('760') && doc.includes('620') && doc.includes('560'), 'PASS132 doc must record thresholds');
  need(summary.includes('Version') && summary.includes('1.8.30 unchanged'), 'PASS132 summary must preserve version truth');
  need(pkg.scripts?.['verify:pass-132-mission-small-window-stress'] === 'node scripts/verify-pass-132-mission-small-window-stress.mjs', 'missing package script for PASS132');
  need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-132-mission-small-window-stress'), 'release blockers missing PASS132 verifier');
}
if (failures.length) { console.error('PASS132 Mission small-window stress verification failed:'); for (const failure of failures) console.error(` - ${failure}`); process.exit(1); }
console.log('PASS132 Mission small-window stress verification passed.');
