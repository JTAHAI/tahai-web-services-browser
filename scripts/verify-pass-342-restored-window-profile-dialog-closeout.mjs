#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = JSON.parse(read('package.json'));
const app = read('src/renderer/app.ts');
const main = read('src/main/main.ts');
const preload = read('src/preload/preload.ts');
const findings = [];

function check(id, ok, detail = '') {
  findings.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' - ' + detail : ''}`);
}
function ordered(source, first, second) {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}
function functionBody(name) {
  const marker = `function ${name}`;
  const start = app.indexOf(marker);
  if (start < 0) return '';
  const next = app.indexOf('\nfunction ', start + marker.length);
  return app.slice(start, next < 0 ? app.length : next);
}

const scriptName = 'verify:pass-342-restored-window-profile-dialog-closeout';
const scriptCommand = 'node scripts/verify-pass-342-restored-window-profile-dialog-closeout.mjs';
check('package-script-present', pkg.scripts?.[scriptName] === scriptCommand, `${scriptName} must run ${scriptCommand}`);
check('release-blockers-contract-includes-pass342', typeof pkg.scripts?.['verify:release-blockers:contract'] === 'string' && pkg.scripts['verify:release-blockers:contract'].includes(`npm run ${scriptName}`), 'PASS342 must be in the enterprise release-blocker contract');
check('release-blockers-order', ordered(pkg.scripts?.['verify:release-blockers:contract'] || '', 'verify:pass-341-normal-browser-and-feature-clickability-closeout', 'verify:pass-342-restored-window-profile-dialog-closeout') && ordered(pkg.scripts?.['verify:release-blockers:contract'] || '', 'verify:pass-342-restored-window-profile-dialog-closeout', 'npm run build'), 'PASS342 runs after PASS341 and before build/runtime E2E');
check('contract-marker-present', app.includes('PASS342_RESTORED_WINDOW_MODAL_DIALOG_VIEWPORT_CLOSEOUT'), 'renderer exposes restored-window modal viewport closeout marker');
check('centered-modal-owner-present', app.includes('function pass122IsCenteredModalDialogOverlay') && app.includes('function pass122CenteredModalDialogFitsViewport'), 'PASS122 has a modal-specific viewport-fit path');
check('centered-modal-detection-electron-safe', app.includes("panel.tagName.toLowerCase() === 'dialog'") && app.includes("typeof (panel as HTMLDialogElement).showModal === 'function'"), 'centered modal detection does not rely only on instanceof HTMLDialogElement across Electron realms');
check('modal-sources-covered', ['profile-dialog', 'settings', 'command-palette', 'shortcut-dialog'].every((token) => app.includes(`source === '${token}'`)), 'profile/settings/command/shortcut dialogs are treated as centered modals');
const scrollSafeBody = functionBody('pass122OverlayHasScrollSafeViewport');
check('scroll-safe-prefers-centered-modal-fit', ordered(scrollSafeBody, 'pass122CenteredModalDialogFitsViewport(panel, source, rect, pass122ViewportHeight())', 'chromeTop - 36'), 'scroll-safe viewport logic validates centered modals before chrome-anchored top checks');
const fitsBody = functionBody('pass122OverlayFitsViewport');
check('fallback-prefers-centered-modal-fit', ordered(fitsBody, 'pass122CenteredModalDialogFitsViewport(panel, source, rect, viewportHeight)', 'chromeTop - 24'), 'fallback viewport logic validates centered modals before chrome-anchored fit checks');
check('modal-fit-uses-window-viewport', app.includes('function pass122ViewportWidth') && app.includes('rect.top >= margin - 16') && app.includes('rect.bottom <= viewportHeight - margin + 16'), 'centered modals fit inside the restored window viewport instead of below toolbar chrome');
check('profile-runtime-e2e-stability-wait', app.includes('pass158RuntimeE2eDelay(PASS122_OVERLAY_OPEN_SETTLE_MS + 260)') && app.includes('Profile dialog closed during restored-window viewport guard'), 'runtime E2E waits past PASS122 delayed reflow and fails if profile flashes closed');
check('profile-open-reflows-after-hydration', /async function openProfileManager\(\)[\s\S]*await refreshProfiles\(browserProfileState\?\.activeProfileId\);[\s\S]*requestAnimationFrame\(\(\) => pass122RunOverlayViewportReflow\('viewport-reflow'\)\)/.test(app), 'profile dialog reflows after async profile hydration so restored-window geometry is measured deterministically');
check('profile-dismissal-regression-caught', app.includes("document.body.dataset.pass122DismissedOverlay === 'profile-dialog'") && app.includes('PASS122 dismissed profile dialog during restored-window open stability check'), 'runtime E2E explicitly detects PASS122 profile dismissal');
check('profile-marker-required-by-e2e', app.includes('profileDialog.dataset.pass342RestoredWindowModalDialogViewportCloseout') && app.includes('Profile dialog did not receive restored-window modal viewport closeout marker'), 'runtime E2E requires the modal viewport closeout marker');
check('qa-doc-present', exists('docs/qa/PASS342-RESTORED-WINDOW-PROFILE-DIALOG-CLOSEOUT.md'), 'QA note documents the restored-window Default/profile regression and acceptance');
check('no-unsafe-allowpopups-added', !/(<webview[^>]*allowpopups|setAttribute\(['"]allowpopups|\sallowpopups\s*=)/i.test(app + main), 'webviews still do not enable unsafe allowpopups');
check('no-node-in-remote-content-added', !/nodeIntegration:\s*true/i.test(main + app), 'remote web content still has Node disabled');
check('no-raw-ipc-exposure-added', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/i.test(preload), 'preload still exposes only narrowed bridge methods');
check('no-direct-psa-provider-secret-patterns', !/(psa|connectwise|autotask|halo|syncro|kaseya|datto)[_-]?(api[_-]?key|secret|token)\s*[:=]/i.test(app + main + preload), 'browser source does not introduce direct PSA/provider secrets');

const result = findings.every((entry) => entry.ok) ? 'PASS' : 'FAIL';
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, 'pass342-restored-window-profile-dialog-closeout-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ pass: 'PASS342', result, generatedAt: new Date().toISOString(), findings }, null, 2));
console.log(`PASS342_VERIFY_RESULT=${result}`);
console.log(`PASS342_REPORT=${path.relative(root, reportPath).replace(/\\/g, '/')}`);
process.exit(result === 'PASS' ? 0 : 1);
