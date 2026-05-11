#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

const ts = read('src/renderer/responsive-toolbar.ts');
const css = read('src/renderer/styles/responsive-toolbar.css');
const html = read('src/renderer/index.html');
const pkg = JSON.parse(read('package.json'));
const doc = read('docs/pass-183-more-tools-overlay-collision-recovery.md');
const summary = read('PASS_183_MORE_TOOLS_OVERLAY_COLLISION_RECOVERY_SUMMARY.md');

ok(pkg.version === '1.8.30', 'PASS183 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-183-more-tools-overlay-collision-recovery'] === 'node scripts/verify-pass-183-more-tools-overlay-collision-recovery.mjs', 'package.json exposes PASS183 verifier.');
ok(html.includes('data-pass183-more-tools-overlay-collision-recovery="true"'), 'HTML boot state advertises PASS183 readiness.');

for (const token of [
  'PASS183 overlay collision recovery',
  'PASS183_OVERLAY_COLLISION_AUDIT_DELAYS_MS',
  'pass183OpenDialogIds',
  'dialog[open]',
  'pass183OpenCommandPanelIds',
  '.tool-menu-panel:not([hidden])',
  'pass183MoreToolsIsOpen',
  'pass183AuditMoreToolsOverlayCollision',
  'pass183ScheduleMoreToolsOverlayCollisionAudit',
  'pass183InstallMoreToolsOverlayCollisionRecovery',
  "closeMenu({ restoreFocus: false })",
  "setStatus(`More Tools closed so ${collisionId.replace(/-/g, ' ')} stays in focus.`)",
  "attributeFilter: ['open', 'hidden', 'aria-hidden', 'aria-expanded', 'class']",
  "document.addEventListener('toggle'",
  "pass183ScheduleMoreToolsOverlayCollisionAudit('more-tools-open', 0)",
  "document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true'"
]) ok(ts.includes(token), `responsive toolbar missing PASS183 token: ${token}`);

for (const token of [
  'PASS183 More Tools Overlay Collision Recovery',
  'body[data-pass183-more-tools-overlay-collision-recovery="true"] .toolbar-overflow-menu',
  'body[data-pass183-more-tools-overlay-collision-state="dialog-open"] .toolbar-overflow-toggle',
  'body[data-pass183-more-tools-overlay-collision-state="command-panel-open"] .toolbar-overflow-toggle',
  'pointer-events: none !important'
]) ok(css.includes(token), `responsive CSS missing PASS183 token: ${token}`);

ok(!ts.includes('ipcRenderer'), 'PASS183 must not add raw IPC.');
ok(!ts.includes('shell.openExternal'), 'PASS183 must not add external-open behavior.');
ok(!html.includes('onclick='), 'PASS183 must not add inline click handlers.');
ok(doc.includes('PASS183') && doc.includes('More Tools') && doc.includes('dialog') && doc.includes('command panel') && doc.includes('Version remains `1.8.30`'), 'PASS183 doc must describe overlay collision recovery.');
ok(summary.includes('PASS183') && summary.includes('Version remains `1.8.30`') && summary.includes('overlay collision'), 'PASS183 summary missing closeout markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS183][FAIL] More Tools overlay collision recovery verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS183][OK] More Tools overlay collision recovery verified.');
