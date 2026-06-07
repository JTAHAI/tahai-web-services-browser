#!/usr/bin/env node
/*
  PASS271-R10 — Webview Attach Fallback + GPU Rollback

  Fixes the R9 regression where disabling GPU/compositing by default could shrink the
  renderer texture into the top-left of a maximized Windows window, and hardens the
  actual webview attach blocker by repairing empty/untrusted will-attach-webview src
  values to a safe HTTPS fallback instead of preventing the guest from attaching.

  Browser-side only. No IT Docs backend. No PSA connector. No direct PSA/API calls.
*/
import fs from 'node:fs';
import path from 'node:path';

const PASS = 'PASS271_R10';
const root = process.cwd();
const VERIFY_SCRIPT = 'verify:pass-271-r10-webview-attach-fallback-gpu-rollback';
const VERIFY_CMD = 'node scripts/verify-pass271-r10-webview-attach-fallback-gpu-rollback.mjs';

function file(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, text) {
  const target = file(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && !fs.existsSync(`${target}.${PASS}.bak`)) fs.copyFileSync(target, `${target}.${PASS}.bak`);
  fs.writeFileSync(target, text, 'utf8');
}
function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing needle`);
  return text.replace(needle, replacement);
}

function patchPackage() {
  const rel = 'package.json';
  const pkg = JSON.parse(read(rel));
  pkg.scripts = pkg.scripts || {};
  const changed = pkg.scripts[VERIFY_SCRIPT] !== VERIFY_CMD;
  pkg.scripts[VERIFY_SCRIPT] = VERIFY_CMD;
  write(rel, `${JSON.stringify(pkg, null, 2)}\n`);
  return changed ? 'updated' : 'present';
}

function patchMain() {
  const rel = 'src/main/main.ts';
  let text = read(rel);
  const changes = [];

  // R9 made GPU disable the default. That can produce a software-composited renderer
  // texture stuck at the top-left on high-DPI/maximized Windows. Keep it as explicit
  // opt-in diagnostics only.
  if (text.includes("if (process.env.TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR === '0') return;")) {
    text = text.replace(
      "if (process.env.TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR === '0') return;",
      "if (process.env.TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR !== '1') return;"
    );
    changes.push('r9-gpu-disable-default-rolled-back');
  }
  if (text.includes('PASS271_R9_GPU_REPAIR_DEFAULT=enabled')) {
    text = text.replace('PASS271_R9_GPU_REPAIR_DEFAULT=enabled', 'PASS271_R9_GPU_REPAIR_DEFAULT=explicit-opt-in-only');
  }

  const helperMarker = 'PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GATE';
  if (!text.includes(helperMarker)) {
    const helper = `
const PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GATE = 'PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GATE';

function pass271R10IsTrustedAttachSrc(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return true;
    if (parsed.protocol === 'file:') return trustedShellUrls().some((trusted) => raw === trusted || raw.startsWith(\`${'${trusted}'}?\`) || raw.startsWith(\`${'${trusted}'}#\`));
    return false;
  } catch {
    return false;
  }
}

function pass271R10RepairWebviewAttachParams(params: TahaiWebviewAttachRecord): void {
  if (pass271R10IsTrustedAttachSrc(params.src)) return;
  const original = typeof params.src === 'string' ? params.src : '';
  params.src = SOURCE_DEFAULT_HOME_URL;
  params['data-pass271-r10-webview-attach-fallback'] = PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GATE;
  console.warn('[PASS271_R10] repaired webview attach src to safe fallback; original=' + (original || 'empty'));
}
`;
    const anchor = 'function enforcePass153WebviewAttachBoundary(window: BrowserWindow): void {';
    text = replaceOnce(text, anchor, `${helper}\n${anchor}`, 'main webview attach fallback helper');
    changes.push('webview-attach-src-fallback-helper');
  }

  const before = `  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {\n    const decision = hardenWebviewAttachOptions(`;
  const after = `  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {\n    pass271R10RepairWebviewAttachParams(params as TahaiWebviewAttachRecord);\n    const decision = hardenWebviewAttachOptions(`;
  if (!text.includes('pass271R10RepairWebviewAttachParams(params as TahaiWebviewAttachRecord);')) {
    text = replaceOnce(text, before, after, 'main webview attach fallback call');
    changes.push('webview-attach-src-fallback-called-before-hardening');
  }

  write(rel, text);
  return changes;
}

function patchRendererApp() {
  const rel = 'src/renderer/app.ts';
  let text = read(rel);
  const changes = [];

  const marker = 'PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER';
  if (!text.includes(marker)) {
    const helper = `
const PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER = 'PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER';
function pass271R10MarkNormalWebviewRuntime(webview: Electron.WebviewTag, safeUrl: string, tabId: string): void {
  webview.dataset.pass271R10WebviewAttachFallback = PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER;
  webview.dataset.pass271R10RequestedUrl = String(safeUrl || '').slice(0, 500);
  webview.dataset.pass271R10TabId = tabId;
  webview.style.setProperty('display', 'inline-flex', 'important');
  webview.style.setProperty('position', 'absolute', 'important');
  webview.style.setProperty('inset', '0', 'important');
  webview.style.setProperty('width', '100%', 'important');
  webview.style.setProperty('height', '100%', 'important');
  webview.style.setProperty('pointer-events', 'auto', 'important');
  webview.style.setProperty('background', '#fff', 'important');
  document.body.dataset.pass271R10LastNormalWebview = tabId;
}
`;
    text = replaceOnce(text, 'function createTab(url: string): string {', `${helper}\nfunction createTab(url: string): string {`, 'renderer R10 runtime marker helper');
    changes.push('normal-webview-runtime-marker-helper');
  }

  if (!text.includes('pass271R10MarkNormalWebviewRuntime(webview, safeUrl, tabId);')) {
    const anchor = "  webview.dataset.pass106SiteViewTabId = tabId; pass236MarkWebviewDomPending(webview, tabId);";
    const replacement = `${anchor}\n  pass271R10MarkNormalWebviewRuntime(webview, safeUrl, tabId);`;
    text = replaceOnce(text, anchor, replacement, 'renderer R10 runtime marker call');
    changes.push('normal-webview-runtime-marker-called');
  }

  // If R9 is present, keep its post-attach src retry helper. The problem was not that
  // retry helper; the problem was R9's default GPU disable plus the main-process hard
  // block when params.src arrives empty.
  write(rel, text);
  return changes;
}

function patchCss() {
  const rel = 'src/renderer/styles/browser.css';
  let text = read(rel);
  const changes = [];
  if (!text.includes('PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GPU_ROLLBACK_CSS')) {
    text += `

/* PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GPU_ROLLBACK_CSS_START */
html, body, .app-shell {
  width: 100vw !important;
  height: 100vh !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
}
body[data-pass271-r10-last-normal-webview] #webview-stage:not(.mission-layout) {
  position: relative !important;
  display: block !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  contain: none !important;
  transform: none !important;
  pointer-events: auto !important;
  background: #fff !important;
}
body[data-pass271-r10-last-normal-webview] #webview-stage:not(.mission-layout) > webview.browser-view.active,
body[data-pass271-r10-last-normal-webview] webview.browser-view[data-pass271-r10-webview-attach-fallback="PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER"].active {
  display: inline-flex !important;
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  transform: none !important;
  filter: none !important;
  contain: none !important;
  -webkit-app-region: no-drag !important;
  background: #fff !important;
  z-index: 20 !important;
}
/* PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GPU_ROLLBACK_CSS_END */
`;
    changes.push('normal-webview-full-window-css');
  }
  write(rel, text);
  return changes;
}

function writeDoc() {
  const rel = 'docs/qa/PASS271-R10-webview-attach-fallback-gpu-rollback.md';
  const body = [
    '# PASS271-R10 — Webview Attach Fallback + GPU Rollback',
    '',
    '## Runtime blocker',
    '',
    'R9 made the website pane more visibly white and introduced a maximized-window compositor regression: the app rendered as a small texture in the upper-left while the rest of the BrowserWindow stayed black.',
    '',
    '## Fix',
    '',
    '- Roll R9 GPU/compositor disabling back to explicit opt-in only: TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR=1.',
    '- Repair empty or untrusted will-attach-webview params.src values to the safe TAHAI default home URL before PASS153 hardening runs, so Electron still attaches a guest instead of leaving a dead white DOM element.',
    '- Keep R8/R9 renderer src seeding/retry behavior so the requested safe URL can load immediately after attach.',
    '- Add runtime and CSS markers that force the normal-browsing active webview to occupy the real full website budget.',
    '',
    '## Scope',
    '',
    'Browser-side only. No IT Docs backend. No PSA connector. No direct provider/API secrets. No Store, GA, or signing claim.',
    ''
  ].join('\n');
  write(rel, body);
  return rel;
}

function writeReadme() {
  const rel = 'PASS271_R10_README.md';
  const body = [
    '# PASS271-R10 — Webview Attach Fallback + GPU Rollback',
    '',
    'Run:',
    '',
    '```powershell',
    'Set-Location C:\\dev\\browser\\app',
    'node scripts\\apply-pass271-r10-webview-attach-fallback-gpu-rollback.mjs',
    'npm run verify:pass-271-r10-webview-attach-fallback-gpu-rollback',
    'npm run build',
    'npm run dev',
    '```',
    '',
    'Do not set TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR unless you are intentionally testing the R9 GPU path.',
    ''
  ].join('\n');
  write(rel, body);
  return rel;
}

const packageState = patchPackage();
const mainChanges = patchMain();
const rendererChanges = patchRendererApp();
const cssChanges = patchCss();
const doc = writeDoc();
const readme = writeReadme();

console.log('PASS271_R10_APPLY=PASS');
console.log(`PASS271_R10_MAIN=${mainChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R10_RENDERER=${rendererChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R10_CSS=${cssChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R10_PACKAGE_SCRIPT=${packageState}`);
console.log(`PASS271_R10_DOC=${doc}`);
console.log(`PASS271_R10_README=${readme}`);
console.log('PASS271_R10_GPU_REPAIR_DEFAULT=disabled');
console.log('PASS271_R10_ATTACH_FALLBACK=enabled');
