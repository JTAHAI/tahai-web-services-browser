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

ok(ts.includes('PASS182 compact hit-target focus'), 'renderer documents PASS182 compact hit-target/focus intent');
ok(ts.includes("PASS182_COMPACT_HIT_TARGET_CONTROLS"), 'renderer defines compact primary control allowlist');
ok(ts.includes('[data-pass182-compact-tooltip="true"]'), 'tooltip controller includes compact primary controls');
ok(ts.includes("element.dataset.pass182CompactTooltip = 'true'"), 'primary controls are marked for compact tooltips');
ok(ts.includes("element.dataset.pass182CompactHitTarget = 'true'"), 'primary controls are marked as compact hit targets');
ok(ts.includes('pass182InstallCompactPrimaryFocusController'), 'compact focus controller is installed');
ok(ts.includes('pass182AnnounceCompactPrimaryFocus'), 'compact focus/hover announces selected control to status');
ok(ts.includes('pass182CompactLastActivatedControl'), 'compact activation telemetry is tracked for pointer/keyboard');
ok(ts.includes("document.body.dataset.pass182CompactHitTargetFocus = 'true'"), 'runtime state exposes PASS182 readiness');
ok(css.includes('PASS182 Compact Hit-Target + Focus Hardening'), 'CSS documents PASS182 compact hit-target/focus hardening');
ok(css.includes('min-width: 40px !important'), 'compact hit targets are widened from the too-small prior state');
ok(css.includes('min-height: 38px !important'), 'compact hit targets have a stronger vertical target');
ok(css.includes('outline: 2px solid rgba(119,219,255,.72)'), 'compact focus state has an explicit visible outline');
ok(css.includes('content: none !important'), 'old detached fixed pseudo-tooltip is disabled under PASS182');
ok(css.includes('touch-action: manipulation'), 'compact controls use direct manipulation semantics');
ok(html.includes('data-pass182-compact-hit-target-focus="true"'), 'HTML boot state advertises PASS182 readiness');
ok(pkg.scripts?.['verify:pass-182-compact-hit-target-focus'] === 'node scripts/verify-pass-182-compact-hit-target-focus.mjs', 'package.json exposes PASS182 verifier');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS182][FAIL] Compact hit-target/focus guard failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS182][OK] Compact hit-target/focus UX hardening verified.');
