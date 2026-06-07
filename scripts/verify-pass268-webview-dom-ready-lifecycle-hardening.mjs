#!/usr/bin/env node
/* PASS268 source verifier — WebView DOM-ready lifecycle hardening */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const pass = 'PASS268';
const versionTarget = '2.0.14';
const remainingPassesAfterThisPass = 3;
const matrixPath = path.join(root, 'tests', 'runtime', 'pass268-webview-dom-ready-lifecycle-matrix.json');
const templatePath = path.join(root, 'docs', 'qa', 'pass268-webview-dom-ready-lifecycle-evidence.template.json');
const docsPath = path.join(root, 'docs', 'qa', 'PASS268-webview-dom-ready-lifecycle-hardening.md');
const gatePath = path.join(root, 'scripts', 'gate-pass268-webview-dom-ready-lifecycle-hardening.mjs');
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function fail(message, details = []) { console.error('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING=FAIL'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseJson(file) { try { return JSON.parse(read(file)); } catch (error) { fail('Could not parse JSON.', [rel(file), error.message]); } }
function walk(dir, accept, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (!accept || accept(full)) out.push(full);
  }
  return out;
}
function versionAtLeast(actual, expected) {
  const a = String(actual || '').split('.').map(Number); const e = String(expected || '').split('.').map(Number);
  if (a.length < 3 || e.length < 3 || a.some(Number.isNaN) || e.some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i += 1) { if (a[i] > e[i]) return true; if (a[i] < e[i]) return false; }
  return true;
}
function findRenderer() {
  const candidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
  for (const c of candidates) { const p = path.join(root, c); if (read(p).includes('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START')) return p; }
  const found = walk(root, (f) => /\.(ts|tsx|js|jsx)$/i.test(f) && read(f).includes('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START'));
  return found[0] || null;
}
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json missing.');
const pkg = parseJson(pkgPath);
if (!versionAtLeast(pkg.version, versionTarget)) fail('package.json version is below PASS268 target.', [String(pkg.version)]);
for (const [name, expected] of Object.entries({
  'verify:pass-268-webview-dom-ready-lifecycle-hardening': 'node scripts/verify-pass268-webview-dom-ready-lifecycle-hardening.mjs',
  'gate:pass-268-webview-dom-ready-lifecycle-hardening': 'node scripts/gate-pass268-webview-dom-ready-lifecycle-hardening.mjs'
})) if (pkg.scripts?.[name] !== expected) fail('PASS268 package script missing or incorrect.', [name]);
for (const file of [matrixPath, templatePath, docsPath, gatePath]) if (!fs.existsSync(file)) fail('Required PASS268 file missing.', [rel(file)]);
const matrix = parseJson(matrixPath);
if (matrix.pass !== pass || matrix.schemaVersion !== 1 || matrix.versionTarget !== versionTarget) fail('PASS268 runtime matrix metadata invalid.');
if (matrix.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) fail('PASS268 remaining pass count mismatch in matrix.');
for (const token of ['isConnected','dom-ready','destroyed-state','removed-from-dom','render-process-gone','safe-no-op-before-ready','method-exists-before-call']) if (!matrix.requiredLifecycleGuards?.includes(token)) fail('PASS268 matrix missing lifecycle guard.', [token]);
for (const method of ['goBack','goForward','reload','focus','loadURL','executeJavaScript','openDevTools']) if (!matrix.requiredGuardedMethods?.includes(method)) fail('PASS268 matrix missing guarded method.', [method]);
const template = parseJson(templatePath);
if (template.pass !== pass || template.versionTarget !== versionTarget) fail('PASS268 evidence template metadata invalid.');
if (template.storeTruth?.microsoftStoreSubmissionClaim !== 'not-submitted' || template.storeTruth?.microsoftStoreApprovalClaim !== 'not-approved') fail('PASS268 template must preserve Store not-submitted/not-approved truth.');
const renderer = findRenderer();
if (!renderer) fail('Renderer source missing PASS268 lifecycle guard block. Run apply-pass268 first.');
const rendererText = read(renderer);
for (const token of [
  'PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START',
  'pass268GuardWebViewMethod',
  'pass268WrapWebViewElement',
  'pass268IsWebViewReadyForMethod',
  'MutationObserver',
  'dom-ready',
  'isConnected',
  'render-process-gone',
  'removed-from-dom',
  'WebView must be attached to the DOM',
  '__PASS268_WEBVIEW_LIFECYCLE__',
  '__pass268_original_webview_methods__'
]) if (!rendererText.includes(token)) fail('Renderer lifecycle guard missing required token.', [token, rel(renderer)]);
const gateText = read(gatePath);
for (const token of ['PASS268_WEBVIEW_DOM_READY_LIFECYCLE_GATE=BLOCKED','noWebViewMustBeAttachedDomReadyError','approvedToProceedToPass269','not-approved']) if (!gateText.includes(token)) fail('PASS268 gate missing fail-closed token.', [token]);
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));
console.log('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING=PASS');
console.log('PASS268_VERSION=' + pkg.version);
console.log('PASS268_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS268_RENDERER_TARGET=' + rel(renderer));
console.log('PASS268_MATRIX=' + rel(matrixPath));
console.log('PASS268_TEMPLATE=' + rel(templatePath));
console.log('PASS268_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS268_ASSERTIONS=webview-dom-ready-guard,attached-check,destroyed-detached-render-gone-check,mutation-observer-wraps-new-webviews,safe-noop-before-ready,no-store-claim,no-generated-artifacts');
