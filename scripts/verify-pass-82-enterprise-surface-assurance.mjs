#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS82][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (file, token) => need(read(file).includes(token), `${file} missing token: ${token}`);

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

includes('src/renderer/app.ts', 'PASS82 Enterprise Surface Assurance');
includes('src/renderer/app.ts', 'pass82RunEnterpriseSurfaceAssurance');
includes('src/renderer/app.ts', 'pass82MountEnterpriseSurfaceAssurance');
includes('src/renderer/app.ts', "id: 'enterprise-surface-assurance'");
includes('src/renderer/app.ts', "id: 'copy-enterprise-surface-assurance'");
includes('src/renderer/app.ts', 'Ctrl+Alt+Shift+A');
includes('src/renderer/app.ts', 'data-export-redaction-boundary');
includes('src/renderer/app.ts', 'redaction-required-before-copy-save');
includes('src/renderer/app.ts', "statusBar.setAttribute('role', 'status')");
includes('src/renderer/app.ts', "commandPaletteList.setAttribute('role', 'listbox')");
includes('src/renderer/app.ts', 'Duplicate command id');
includes('src/renderer/app.ts', 'Shortcut collision found');
includes('src/renderer/app.ts', 'pass81ProtectMissionNonDropSurfaces');
includes('src/renderer/app.ts', 'pass153PopupBoundary');
includes('src/renderer/app.ts', "view.setAttribute('autosize', 'off')");
includes('src/renderer/app.ts', 'copyDevOpsCapture(pass82LastSurfaceAssuranceReport)');
includes('src/renderer/app.ts', 'Escape');
includes('src/renderer/styles/browser.css', 'PASS82 enterprise surface assurance');
includes('PASS_82_ENTERPRISE_SURFACE_ASSURANCE_SUMMARY.md', 'PASS82');

need(pkg.scripts?.['verify:pass-82-enterprise-surface-assurance'], 'package.json missing verify:pass-82-enterprise-surface-assurance script');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-82-enterprise-surface-assurance'), 'verify:release-blockers missing PASS82 verifier');

for (const forbidden of ['psa:direct-fetch', 'Browser -> PSA API directly', 'PSA_API_KEY']) {
  need(!app.includes(forbidden), `forbidden browser-side integration token present: ${forbidden}`);
}

console.log('[PASS82][OK] Enterprise surface assurance verified.');
