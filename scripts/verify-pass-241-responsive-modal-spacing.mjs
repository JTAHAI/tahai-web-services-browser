#!/usr/bin/env node
import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`[PASS241][FAIL] Missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}
function need(condition, message) {
  if (!condition) {
    console.error(`[PASS241][FAIL] ${message}`);
    process.exit(1);
  }
}
function has(body, needle) { return body.includes(needle); }

const html = read('src/renderer/index.html');
const browserCss = read('src/renderer/styles/browser.css');
const missionCss = read('src/renderer/styles/mission-control.css');
const occ = read('src/renderer/operator-command-center-v2.ts');
const docs = read('docs/pass-241-responsive-modal-spacing.md');
const pkg = JSON.parse(read('package.json'));

need(pkg.scripts?.['verify:pass-241-responsive-modal-spacing'] === 'node scripts/verify-pass-241-responsive-modal-spacing.mjs', 'package script missing');
need(has(html, 'data-pass241-responsive-modal-spacing="true"'), 'command palette dialog pass marker missing');
need(has(browserCss, 'PASS241-RC1 — responsive modal overlap closeout'), 'browser CSS pass marker missing');
need(has(browserCss, 'grid-auto-rows: max-content'), 'command list must auto-size rows instead of overlaying');
need(has(browserCss, 'overscroll-behavior: contain'), 'command palette scroll containment missing');
need(has(browserCss, '-webkit-line-clamp: 2'), 'command row description clamp missing');
need(has(browserCss, 'max-height: calc(100vh - 32px)'), 'modal viewport max-height containment missing');
need(has(missionCss, 'PASS241-RC1 — compact Operator Command Center inside Ctrl+K'), 'mission CSS pass marker missing');
need(has(missionCss, 'operator-command-family-details:not([open]) .operator-command-family-grid'), 'dense family grid must be hidden unless expanded');
need(has(missionCss, 'flex-wrap: wrap'), 'quick filters must wrap');
need(has(occ, 'operator-command-family-summary'), 'compact family summary missing');
need(has(occ, 'report.quickFilters.slice(0, 6)'), 'quick filters must be bounded');
need(has(occ, "document.createElement('details')"), 'family cards must move behind a details expander');
need(has(docs, 'No backend, IT Docs, PSA'), 'docs boundary missing');

console.log('[PASS241][OK] Responsive modal and command palette spacing closeout verified.');
