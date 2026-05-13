#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = [
  ['route map close listener', app.includes("closeRouteMapButton.addEventListener('click', () => routeMapDialog.close());")],
  ['developer audit close listener', app.includes("closeDevAuditButton.addEventListener('click', () => devAuditDialog.close());")],
  ['route map close control css', css.includes('#close-route-map') && css.includes('PASS246 — DevOps tool dialog close-control reliability')],
  ['developer audit close control css', css.includes('#close-dev-audit') && css.includes('pointer-events: auto')],
  ['verify script registered', Boolean(pkg.scripts?.['verify:pass-246-devops-tool-dialog-closeout'])]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`PASS246_${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failed = true;
}
console.log(`PASS246_VERIFY_RESULT=${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
