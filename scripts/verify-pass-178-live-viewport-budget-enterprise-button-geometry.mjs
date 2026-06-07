#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const failures = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-178-live-viewport-budget-enterprise-button-geometry.md',
  'PASS_178_LIVE_VIEWPORT_BUDGET_ENTERPRISE_BUTTON_GEOMETRY_SUMMARY.md',
  'scripts/verify-pass-178-live-viewport-budget-enterprise-button-geometry.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-178-live-viewport-budget-enterprise-button-geometry.md');
  const summary = read('PASS_178_LIVE_VIEWPORT_BUDGET_ENTERPRISE_BUTTON_GEOMETRY_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);

  need(pkg.version === '1.8.30', 'PASS178 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-178-live-viewport-budget-enterprise-button-geometry'] === 'node scripts/verify-pass-178-live-viewport-budget-enterprise-button-geometry.mjs', 'package.json must expose PASS178 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-178-live-viewport-budget-enterprise-button-geometry'), 'release blocker chain must include PASS178 verifier.');
  need(releaseBlockers.indexOf('verify:pass-178-live-viewport-budget-enterprise-button-geometry') > releaseBlockers.indexOf('verify:pass-177-website-pane-viewport-recovery'), 'PASS178 verifier must run after PASS177 verifier.');
  need(releaseBlockers.indexOf('verify:pass-178-live-viewport-budget-enterprise-button-geometry') < releaseBlockers.lastIndexOf('npm run build'), 'PASS178 verifier must run before final build.');

  need(html.includes('data-pass178-viewport-budget-observer="true"'), 'renderer shell must expose PASS178 viewport observer marker.');
  need(html.includes('data-pass178-enterprise-button-geometry="true"'), 'renderer shell must expose PASS178 enterprise button geometry marker.');

  for (const token of [
    'PASS178 live viewport budget observer + enterprise button geometry',
    'const PASS178_VIEWPORT_BUDGET_AUDIT_DELAYS_MS = [0, 90, 260, 760]',
    'const PASS178_VIEWPORT_OBSERVER_RELAYOUT_COOLDOWN_MS = 180',
    'let pass178ViewportBudgetObserver: ResizeObserver | null = null',
    'function pass178ViewportBudgetNodes',
    'function pass178AuditViewportBudget',
    'function pass178ScheduleViewportBudgetAudit',
    'function pass178InstallViewportBudgetObserver',
    'document.body.dataset.pass178ViewportBudgetObserver = \'true\'',
    'document.body.dataset.pass178EnterpriseButtonGeometry = \'true\'',
    'document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT',
    'pass178ScheduleViewportBudgetAudit(\'window-resize\'',
    'pass178ViewportObserverRelayoutReason'
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS178 token: ${token}`);

  for (const token of [
    'PASS178 Persistent Viewport Budget + Enterprise Button Geometry',
    '--pass178-enterprise-control-radius: 8px',
    '--pass178-enterprise-menu-radius: 14px',
    '--pass178-enterprise-address-radius: 10px',
    'body[data-pass178-enterprise-button-geometry="true"] .toolbar .home-button',
    'body[data-pass178-enterprise-button-geometry="true"] #address',
    'body[data-pass178-enterprise-button-geometry="true"] .toolbar-overflow-menu',
    'body[data-pass178-enterprise-button-geometry="true"] #toolbar-overflow-items .utility-chrome-button',
    'border-radius: var(--pass178-enterprise-control-radius) !important',
    'border-radius: 8px !important'
  ]) need(responsiveCss.includes(token), `responsive CSS missing PASS178 token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS178 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS178 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS178 must not add inline click handlers.');
  need(doc.includes('PASS178') && doc.includes('ResizeObserver') && doc.includes('enterprise') && doc.includes('rounded rectangles'), 'PASS178 doc must describe observer and enterprise geometry.');
  need(summary.includes('PASS178') && summary.includes('Version remains `1.8.30`') && summary.includes('mobile-app pill'), 'PASS178 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS178][FAIL] Live viewport budget + enterprise button geometry verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS178][OK] Live viewport budget + enterprise button geometry verified.');
