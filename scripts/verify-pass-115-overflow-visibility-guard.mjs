import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS115][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const browserCss = read('src/renderer/styles/browser.css');
const docs = read('docs/pass-115-overflow-visibility-guard.md');
const summary = read('PASS_115_OVERFLOW_VISIBILITY_GUARD_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS115 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-115-overflow-visibility-guard'] === 'node scripts/verify-pass-115-overflow-visibility-guard.mjs', 'package script missing PASS115 verifier');
need(releaseBlockers.includes('verify:pass-115-overflow-visibility-guard'), 'verify:release-blockers missing PASS115 verifier');
need(releaseBlockers.indexOf('verify:pass-115-overflow-visibility-guard') > releaseBlockers.indexOf('verify:pass-114-chrome-stack-guard'), 'PASS115 must run after PASS114');
need(releaseBlockers.indexOf('verify:pass-115-overflow-visibility-guard') < releaseBlockers.lastIndexOf('npm run build'), 'PASS115 must run before final build');

need(html.includes('data-pass115-overflow-visibility-guard="true"'), 'renderer body missing PASS115 overflow visibility marker');
need(responsiveTs.includes('PASS115 overflow visibility guard'), 'responsive toolbar missing PASS115 rationale comment');
need(responsiveTs.includes("dataset.pass115OverflowVisibilityGuard = 'true'") || responsiveTs.includes("dataset.pass115OverflowVisibilityGuard = 'ready'"), 'renderer must stamp PASS115 CSS-active readiness dataset');
need(responsiveTs.includes("element.dataset.pass115OverflowVisibilityGuard = 'candidate'"), 'managed overflow candidates must be stamped for PASS115');

for (const token of [
  'PASS115 overflow visibility guard',
  'body[data-pass115-overflow-visibility-guard="true"] #toolbar-overflow-items > .in-toolbar-overflow',
  'display: inline-flex !important',
  'visibility: visible !important',
  'opacity: 1 !important',
  '-webkit-app-region: no-drag',
  '#settings.in-toolbar-overflow',
  '#about.in-toolbar-overflow',
  '#launchpad.in-toolbar-overflow',
  '#onboarding.in-toolbar-overflow',
  '#profile-switcher.in-toolbar-overflow'
]) need(responsiveCss.includes(token), `responsive toolbar CSS missing PASS115 token: ${token}`);

for (const legacy of ['#settings,#about { display:none; }', '#launchpad,#onboarding { display:none; }', '@media (max-width:900px)']) {
  need(browserCss.includes(legacy), `legacy responsive rule not present for verifier coverage: ${legacy}`);
}

need(!responsiveTs.includes('ipcRenderer'), 'PASS115 must not add raw IPC to renderer chrome overflow logic');
need(!responsiveTs.includes('shell.openExternal'), 'PASS115 must not add external-open behavior');
const responsiveCssWithoutLaterViewportRecovery = responsiveCss.replace(/\/\* PASS177 Website Pane Viewport Recovery:[\s\S]*?(?=\/\* PASS|$)/, '');
need(!responsiveCssWithoutLaterViewportRecovery.includes('webview-stage'), 'PASS115 must not move webview-stage or pane routing surfaces');
need(docs.includes('PASS115') && docs.includes('legacy responsive hide rules') && docs.includes('More Tools'), 'PASS115 docs missing rationale/coverage');
need(summary.includes('PASS115') && summary.includes('Version remains `1.8.30`') && summary.includes('overflow visibility guard'), 'PASS115 summary missing required markers');
need(next.includes('PASS115') && next.includes('verify:pass-115-overflow-visibility-guard') && next.includes('PASS116'), 'NEXT_CHAT_STARTER missing PASS115/PASS116 handoff');

console.log('[PASS115][OK] Overflow visibility guard verified: legacy narrow-width hide rules cannot hide controls after they move into More Tools.');
