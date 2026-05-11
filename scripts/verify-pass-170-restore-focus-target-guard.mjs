#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'package.json',
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'scripts/verify-pass-170-restore-focus-target-guard.mjs',
  'docs/pass-170-restore-focus-target-guard.md',
  'PASS_170_RESTORE_FOCUS_TARGET_GUARD_SUMMARY.md'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const pkg = JSON.parse(read('package.json'));
  const release = pkg.scripts?.['verify:release-blockers'] || '';
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/app.ts');
  const responsive = read('src/renderer/responsive-toolbar.ts');
  const siteView = read('src/renderer/site-view-mission-rail.ts');
  const css = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-170-restore-focus-target-guard.md');
  const summary = read('PASS_170_RESTORE_FOCUS_TARGET_GUARD_SUMMARY.md');

  need(pkg.version === '1.8.30', 'PASS170 must not increment version without explicit approval');
  need(pkg.scripts?.['verify:pass-170-restore-focus-target-guard'] === 'node scripts/verify-pass-170-restore-focus-target-guard.mjs', 'package script missing PASS170 verifier');
  need(release.includes('verify:pass-169-delayed-overlay-focus-guard'), 'release blockers must include PASS169 before PASS170');
  need(release.includes('verify:pass-170-restore-focus-target-guard'), 'release blockers must include PASS170');
  need(release.indexOf('verify:pass-170-restore-focus-target-guard') > release.indexOf('verify:pass-169-delayed-overlay-focus-guard'), 'PASS170 must run after PASS169');
  need(release.indexOf('verify:pass-170-restore-focus-target-guard') < release.lastIndexOf('npm run build'), 'PASS170 must run before final build');

  need(html.includes('data-pass170-restore-focus-target-guard="true"'), 'renderer body missing PASS170 marker');

  for (const [name, source, helper, surface] of [
    ['app.ts', app, 'pass170RestoreFocusToOpener', 'mission-control'],
    ['responsive-toolbar.ts', responsive, 'pass170RestoreFocusToMoreToolsOpener', 'more-tools'],
    ['site-view-mission-rail.ts', siteView, 'pass170RestoreFocusToSiteViewOpener', 'site-view']
  ]) {
    need(source.includes('PASS170 restore-focus target guard') || source.includes('pass170RestoreFocusTargetGuard'), `${name} missing PASS170 comment/marker`);
    need(source.includes('function pass170ElementCanRestoreFocus'), `${name} missing target validity guard`);
    need(source.includes(helper), `${name} missing ${helper}`);
    need(source.includes('document.contains(target)'), `${name} must require mounted restore target`);
    need(source.includes("getAttribute('aria-hidden') === 'true'"), `${name} must reject aria-hidden restore target`);
    need(source.includes('target.hidden'), `${name} must reject hidden restore target`);
    need(source.includes('target.getClientRects().length'), `${name} must reject non-rendered restore target`);
    need(source.includes('document.body.dataset.pass170RestoreFocusSkipped'), `${name} must record skipped restore focus`);
    need(source.includes('document.body.dataset.pass170RestoreFocusApplied'), `${name} must record applied restore focus`);
    need(source.includes(surface), `${name} must reference ${surface}`);
  }

  need(!responsive.includes('(pass117MoreToolsOpener || buttonEl).focus()'), 'More Tools close path still directly focuses opener');
  need(!siteView.includes('pass117SiteViewOpener?.focus()'), 'Site View close path still has unguarded opener focus timer');
  need(!app.includes('opener.focus(), 0'), 'app overlay clear path still has unguarded opener focus timer');
  need(!app.includes('restoreTarget?.focus(), 0'), 'command toolbar close path still has unguarded restore focus timer');
  need(!app.includes('pass117MissionControlOpener || missionControlButton)?.focus()'), 'Mission Control close path still directly focuses opener');

  need(css.includes('PASS170') && css.includes('body[data-pass170-restore-focus-target-guard="true"]'), 'PASS170 CSS guard missing');
  need(doc.includes('restore-focus') && doc.includes('More Tools') && doc.includes('Mission Control') && doc.includes('Site View'), 'PASS170 doc must describe affected overlay surfaces');
  need(summary.includes('PASS170') && summary.includes('restore-focus'), 'PASS170 summary must describe restore-focus fix');

  for (const source of [app, responsive, siteView]) {
    need(!source.includes('ipcRenderer'), 'PASS170 must not add raw IPC');
    need(!source.includes('shell.openExternal'), 'PASS170 must not add external-open behavior');
    need(!source.includes('eval('), 'PASS170 must not introduce eval');
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[PASS170][FAIL] ${failure}`);
  process.exit(1);
}
console.log('[PASS170][OK] Restore-focus target guard verified.');
