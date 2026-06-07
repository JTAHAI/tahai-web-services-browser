import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS169][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = getReleaseBlockersContract(pkg);
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const appTs = read('src/renderer/app.ts');
const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
const css = read('src/renderer/styles/responsive-toolbar.css');

need(pkg.version === '1.8.30', 'PASS169 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-169-delayed-overlay-focus-guard'] === 'node scripts/verify-pass-169-delayed-overlay-focus-guard.mjs', 'package script missing PASS169 verifier');
need(releaseBlockers.includes('verify:pass-169-delayed-overlay-focus-guard'), 'verify:release-blockers missing PASS169 verifier');
need(releaseBlockers.indexOf('verify:pass-169-delayed-overlay-focus-guard') > releaseBlockers.indexOf('verify:pass-168-overlay-open-age-stamp'), 'PASS169 must run after PASS168');
need(releaseBlockers.indexOf('verify:pass-169-delayed-overlay-focus-guard') < releaseBlockers.lastIndexOf('npm run build'), 'PASS169 must run before final build');

need(html.includes('data-pass169-delayed-overlay-focus-guard="true"'), 'renderer body missing PASS169 marker');

for (const token of [
  'PASS169 delayed overlay focus guard',
  'if (!menuEl || menuEl.hidden || menuEl.getAttribute(\'aria-hidden\') === \'true\') return;',
  'if (!document.contains(menuEl) || !document.contains(target)) return;',
  "document.body.dataset.pass169DelayedOverlayFocusGuard = 'more-tools'",
  "document.body.dataset.pass169DelayedOverlayFocusGuard = 'true'"
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS169 token: ${token}`);

for (const token of [
  'PASS169 delayed overlay focus guard',
  'if (!document.contains(scope) || !document.contains(target)) return;',
  'if (scope instanceof HTMLDialogElement && !scope.open) return;',
  "if (scope.hidden || scope.getAttribute('aria-hidden') === 'true') return;",
  'if (!scope.getClientRects().length) return;',
  "document.body.dataset.pass169DelayedOverlayFocusGuard = 'app-overlay'",
  "document.body.dataset.pass169DelayedOverlayFocusGuard = 'true'"
]) need(appTs.includes(token), `app overlay focus guard missing token: ${token}`);

for (const token of [
  'PASS169 delayed overlay focus guard',
  'if (!isRailOpen()) return;',
  'if (!document.contains(rail) || !document.contains(target)) return;',
  "if (rail.getAttribute('aria-hidden') === 'true') return;",
  "document.body.dataset.pass169DelayedOverlayFocusGuard = 'site-view'",
  "document.body.dataset.pass117SiteViewFocusRecovery = 'true'",
  "document.body.dataset.pass118SiteViewDismissRecovery = 'true'",
  "document.body.dataset.pass116SiteViewOverlayArbitration = 'true'"
]) need(siteViewTs.includes(token), `Site View focus guard missing token: ${token}`);

for (const forbidden of [
  "document.body.dataset.pass118MoreToolsDismissRecovery = 'ready'",
  "document.body.dataset.pass116SiteViewOverlayArbitration = 'ready'",
  "document.body.dataset.pass117SiteViewFocusRecovery = 'ready'",
  "document.body.dataset.pass118SiteViewDismissRecovery = 'ready'"
]) {
  need(!responsiveTs.includes(forbidden) && !siteViewTs.includes(forbidden), `stale runtime ready marker remains: ${forbidden}`);
}

need(css.includes('PASS169') && css.includes('body[data-pass169-delayed-overlay-focus-guard="true"]'), 'PASS169 CSS guard missing');
need(!responsiveTs.includes('ipcRenderer') && !appTs.includes('ipcRenderer') && !siteViewTs.includes('ipcRenderer'), 'PASS169 must not add raw IPC');
need(!responsiveTs.includes('shell.openExternal') && !appTs.includes('shell.openExternal') && !siteViewTs.includes('shell.openExternal'), 'PASS169 must not add external-open behavior');
need(!appTs.includes('eval(') && !responsiveTs.includes('eval(') && !siteViewTs.includes('eval('), 'PASS169 must not introduce eval');

console.log('[PASS169][OK] Delayed overlay focus guard verified.');
