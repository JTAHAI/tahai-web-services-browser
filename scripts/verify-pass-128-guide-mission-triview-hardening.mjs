import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };

const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const toolbar = read('src/renderer/responsive-toolbar.ts');
const toolbarCss = read('src/renderer/styles/responsive-toolbar.css');
const missionCss = read('src/renderer/styles/mission-control.css');
const pkg = JSON.parse(read('package.json'));

need(html.includes('data-pass128-guide-mission-triview-hardening="true"'), 'shell missing PASS128 body contract');
need(html.includes('title="Guide / Knowledge Base"'), 'Guide button was not promoted to Guide / KB copy');
need(toolbar.includes('GUIDE_QUICK_ID'), 'responsive toolbar missing Guide quick anchor constant');
need(toolbar.includes('toolbar-guide-quick'), 'responsive toolbar missing Guide quick anchor creation');
need(toolbar.includes('updateGuideQuickAnchor'), 'responsive toolbar missing Guide quick anchor state updater');
need(toolbar.includes("byId<HTMLButtonElement>('onboarding')?.click()"), 'Guide quick anchor must invoke the canonical Guide button');
need(toolbarCss.includes('.toolbar-guide-quick') && toolbarCss.includes('PASS128'), 'responsive toolbar CSS missing PASS128 Guide quick anchor rules');
need(html.includes('data-mission-layout="triple-top"') && html.includes('3-Up Top'), 'Mission layout strip missing direct 3-Up Top entry');
need(html.includes('data-mission-layout="triple-bottom"') && html.includes('3-Up Bottom'), 'Mission layout strip missing direct 3-Up Bottom entry');
need(app.includes('pass128UpdateMissionViewportMode'), 'app missing PASS128 Mission viewport mode updater');
need(app.includes('pass128ShowMissionDialog'), 'app missing resilient Mission dialog opener');
need(app.includes('missionDialog.showModal()') && app.includes('missionDialog.show()') && app.includes("missionDialog.setAttribute('open', '')"), 'Mission dialog opener must include modal, non-modal, and attribute fallbacks');
need(app.includes("window.innerWidth < 760 || window.innerHeight < 680"), 'Mission compact viewport threshold missing');
need(app.includes("mission-triad-top") && app.includes("setMissionLayout('triple-top')"), 'Command palette missing 3-Up Top action');
need(app.includes("mission-triad-bottom") && app.includes("setMissionLayout('triple-bottom')"), 'Command palette missing 3-Up Bottom action');
need(app.includes("event.shiftKey ? 'triple-top' : 'triple-bottom'") || (app.includes("/^(?:Digit3|Numpad3)$/.test(event.code)") && app.includes("setMissionLayout('triple-top')") && app.includes("setMissionLayout('triple-bottom')")), 'Ctrl+Alt+3 tri-view shortcut must expose top/bottom variant via Shift or PASS133 event.code-safe handling');
need(missionCss.includes('PASS128') && missionCss.includes('mission-compact-viewport') && missionCss.includes('data-pass128-mission-viewport="compact"'), 'Mission CSS missing compact small-window PASS128 rules');
need(missionCss.includes('.mission-layouts .mission-triview-entry'), 'Mission CSS missing direct tri-view entry styling');
need(pkg.scripts['verify:pass-128-guide-mission-triview-hardening'] === 'node scripts/verify-pass-128-guide-mission-triview-hardening.mjs', 'package script missing PASS128 verifier');
need(getReleaseBlockersContract(pkg).includes('verify:pass-128-guide-mission-triview-hardening'), 'release blockers missing PASS128 verifier');

if (failures.length) {
  console.error('PASS128 Guide / Mission / Tri-view hardening verification failed:');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('PASS128 Guide / Mission / Tri-view hardening verification passed.');
