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
const doc = read('docs/pass-184-hidden-more-tools-focus-recovery.md');
const summary = read('PASS_184_HIDDEN_MORE_TOOLS_FOCUS_RECOVERY_SUMMARY.md');

ok(pkg.version === '1.8.30', 'PASS184 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-184-hidden-more-tools-focus-recovery'] === 'node scripts/verify-pass-184-hidden-more-tools-focus-recovery.mjs', 'package.json exposes PASS184 verifier.');
ok(html.includes('data-pass184-hidden-more-tools-focus-recovery="true"'), 'HTML boot state advertises PASS184 readiness.');

for (const token of [
  'PASS184 hidden-menu focus recovery',
  'PASS184_HIDDEN_MENU_FOCUS_REPAIR_DELAY_MS',
  'pass184HiddenMenuFocusRepairTimer',
  'pass184ActiveElementInsideMoreTools',
  'pass184PreferredFocusRecoveryTarget',
  "byId<HTMLInputElement>('address')",
  'pass184RepairHiddenMoreToolsFocus',
  "document.body.dataset.pass184HiddenMoreToolsFocusState = 'repaired'",
  "document.body.dataset.pass184HiddenMoreToolsFocusState = 'deferred-action-in-flight'",
  'pass184ScheduleHiddenMoreToolsFocusRepair',
  'pass184InstallHiddenMoreToolsFocusRecovery',
  "document.addEventListener('focusin'",
  "PASS122_CHROME_STACK_REFLOW_EVENT",
  "PASS118_CHROME_OVERLAY_CLOSE_EVENT",
  "if (wasOpen) pass184ScheduleHiddenMoreToolsFocusRepair(options.restoreFocus ? 'close-with-restore' : 'close-without-restore')",
  'pass184InstallHiddenMoreToolsFocusRecovery();',
  "document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true'",
  "setStatus('Focus restored after More Tools closed.')"
]) ok(ts.includes(token), `responsive toolbar missing PASS184 token: ${token}`);

for (const token of [
  'PASS184 Hidden More Tools Focus Recovery',
  'body[data-pass184-hidden-more-tools-focus-recovery="true"] .toolbar-overflow-menu[hidden]',
  'body[data-pass184-hidden-more-tools-focus-state="repaired"] #address:focus-visible',
  'body[data-pass184-hidden-more-tools-focus-state="repaired"] #toolbar-overflow-toggle:focus-visible',
  'pointer-events: none !important'
]) ok(css.includes(token), `responsive CSS missing PASS184 token: ${token}`);

ok(!ts.includes('ipcRenderer'), 'PASS184 must not add raw IPC.');
ok(!ts.includes('shell.openExternal'), 'PASS184 must not add external-open behavior.');
ok(!html.includes('onclick='), 'PASS184 must not add inline click handlers.');
ok(doc.includes('PASS184') && doc.includes('hidden More Tools focus') && doc.includes('address bar') && doc.includes('Version remains `1.8.30`'), 'PASS184 doc must describe hidden focus recovery.');
ok(summary.includes('PASS184') && summary.includes('Version remains `1.8.30`') && summary.includes('focus recovery'), 'PASS184 summary missing closeout markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS184][FAIL] Hidden More Tools focus recovery verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS184][OK] Hidden More Tools focus recovery verified.');
