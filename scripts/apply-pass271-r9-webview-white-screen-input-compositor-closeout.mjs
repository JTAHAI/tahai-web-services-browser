#!/usr/bin/env node
/*
  PASS271-R9 — Webview White-Screen Input/Compositor Hard Close

  Fixes the remaining runtime white-screen / non-interactive content surface after R8.
  R8 correctly repaired the failed R7 script and seeded src before attach, but the user's
  installed/dev runtime still showed a white guest surface. This pass hardens the two
  remaining likely runtime failure classes without weakening the security model:

  1) Windows/Electron guest compositor white surface: disable GPU acceleration for this
     release-confidence lane unless explicitly overridden with TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR=0.
  2) Guest navigation never paints after attach: set a Chrome-compatible UA and force the
     sanitized src through a small post-attach settle sequence while keeping protocols and
     attach policy strict.

  Browser-side only. No IT Docs backend. No PSA connector. No direct PSA/API calls. No secrets.
*/
import fs from 'node:fs';
import path from 'node:path';

const PASS = 'PASS271_R9';
const root = process.cwd();
const VERIFY_SCRIPT = 'verify:pass-271-r9-webview-white-screen-input-compositor-closeout';
const VERIFY_CMD = 'node scripts/verify-pass271-r9-webview-white-screen-input-compositor-closeout.mjs';

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
function ensureAfter(text, anchor, insert, marker, label) {
  if (text.includes(marker)) return { text, changed: false };
  if (!text.includes(anchor)) throw new Error(`${label}: missing anchor`);
  return { text: text.replace(anchor, `${anchor}\n${insert}`), changed: true };
}
function ensureBefore(text, anchor, insert, marker, label) {
  if (text.includes(marker)) return { text, changed: false };
  if (!text.includes(anchor)) throw new Error(`${label}: missing anchor`);
  return { text: text.replace(anchor, `${insert}\n${anchor}`), changed: true };
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

  const marker = 'PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT';
  const insert = `
// PASS271-R9: Windows/Electron can leave guest webview surfaces white/non-interactive
// when GPU compositing wedges. Disable hardware acceleration for the release-confidence
// lane unless explicitly overridden for local comparison testing.
const PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT = 'PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT';
function installPass271R9WebviewCompositorCloseout(): void {
  if (process.env.TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR === '0') return;
  try {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  } catch (error) {
    console.warn('[PASS271_R9] unable to apply webview compositor closeout', error);
  }
}
installPass271R9WebviewCompositorCloseout();
`;
  const anchor = 'const WINDOWS_TITLEBAR_CAPTION_RESERVE_PX = 168;';
  const out = ensureAfter(text, anchor, insert, marker, 'main compositor closeout');
  text = out.text;
  if (out.changed) changes.push('disable-gpu-compositor-white-surface-default');

  // Keep the app startup logs useful if the guest still fails after the compositor closeout.
  const attachLogMarker = 'PASS271_R9_DID_ATTACH_WEBVIEW_LOG';
  if (!text.includes(attachLogMarker)) {
    const createWindowAnchor = '  enforcePass153WebviewAttachBoundary(window);';
    const logBlock = `  // PASS271_R9_DID_ATTACH_WEBVIEW_LOG: make webview guest attach/load state visible in dev logs.
  window.webContents.on('did-attach-webview', (_event, guest) => {
    try {
      guest.setUserAgent((guest.getUserAgent() || '').replace(/\\sElectron\\/[0-9A-Za-z_.-]+/g, '').trim());
      console.info('[PASS271_R9] did-attach-webview url=' + (guest.getURL() || 'about:blank'));
      guest.on('did-fail-load', (_failEvent, errorCode, errorDescription, validatedURL) => {
        console.warn('[PASS271_R9] guest did-fail-load ' + errorCode + ' ' + (errorDescription || '') + ' ' + (validatedURL || ''));
      });
      guest.on('did-finish-load', () => console.info('[PASS271_R9] guest did-finish-load url=' + (guest.getURL() || 'unknown')));
    } catch (error) {
      console.warn('[PASS271_R9] guest attach diagnostic failed', error);
    }
  });
`;
    text = replaceOnce(text, createWindowAnchor, `${createWindowAnchor}\n${logBlock}`, 'main did-attach diagnostic');
    changes.push('guest-attach-load-diagnostics');
  }

  write(rel, text);
  return changes;
}

function patchRendererApp() {
  const rel = 'src/renderer/app.ts';
  let text = read(rel);
  const changes = [];

  const helperMarker = 'PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT';
  if (!text.includes(helperMarker)) {
    const helper = `
const PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT = 'PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT';

function pass271R9ChromiumCompatibleUserAgent(): string {
  const fallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
  try {
    const ua = String(navigator.userAgent || '').replace(/\\sElectron\\/[0-9A-Za-z_.-]+/g, '').replace(/\\sTAHAI[^\\s]*/gi, '').trim();
    return ua && /Chrome\\//.test(ua) ? ua : fallback;
  } catch {
    return fallback;
  }
}

function pass271R9SetWebviewSrc(webview: Electron.WebviewTag, safeUrl: string, reason: string): void {
  const target = String(safeUrl || '').trim();
  if (!target) return;
  webview.dataset.pass271R9WebviewWhiteScreenCloseout = PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT;
  webview.dataset.pass271R9LastSrcReason = reason;
  webview.dataset.pass271R9LastSrcAt = new Date().toISOString();
  webview.setAttribute('src', target);
  try { (webview as Electron.WebviewTag & { src?: string }).src = target; } catch { /* older Electron type/runtime may expose src as attribute-only. */ }
}

function pass271R9ArmWebviewBlankSurfaceRecovery(webview: Electron.WebviewTag, safeUrl: string, tabId: string): void {
  webview.dataset.pass271R9RecoveryArmed = 'true';
  webview.addEventListener('did-attach', () => {
    webview.dataset.pass271R9DidAttach = 'true';
    pass271R9SetWebviewSrc(webview, safeUrl, 'did-attach');
  });
  webview.addEventListener('dom-ready', () => {
    webview.dataset.pass271R9DomReady = 'true';
    webview.dataset.pass271R9DomReadyAt = new Date().toISOString();
  });
  webview.addEventListener('did-finish-load', () => {
    webview.dataset.pass271R9DidFinishLoad = 'true';
    webview.dataset.pass271R9DidFinishLoadAt = new Date().toISOString();
  });
  webview.addEventListener('did-fail-load', (event: any) => {
    webview.dataset.pass271R9DidFailLoad = String(event?.errorCode || 'unknown');
    webview.dataset.pass271R9DidFailLoadDescription = String(event?.errorDescription || '').slice(0, 260);
  });
  for (const [delay, reason] of [[180, 'settle-180'], [900, 'settle-900'], [2200, 'blank-surface-retry-2200']] as const) {
    window.setTimeout(() => {
      if (!document.documentElement.contains(webview)) return;
      if (webview.dataset.pass271R9DomReady === 'true' || webview.dataset.pass236DomReady === 'true') return;
      pass271R9SetWebviewSrc(webview, safeUrl, reason);
      if (reason === 'blank-surface-retry-2200') setStatus('Retrying webview load', titleFromUrl(safeUrl));
    }, delay);
  }
  document.body.dataset.pass271R9LastArmedTab = tabId;
}
`;
    const out = ensureBefore(text, 'function createTab(url: string): string {', helper, helperMarker, 'renderer R9 helper');
    text = out.text;
    changes.push('renderer-post-attach-src-ua-recovery-helper');
  }

  const createStart = text.indexOf('function createTab(url: string): string {');
  const createEnd = text.indexOf('function active(): TabState | undefined', createStart);
  if (createStart < 0 || createEnd < 0) throw new Error('Unable to locate createTab bounds.');
  let block = text.slice(createStart, createEnd);
  const originalBlock = block;

  if (!block.includes("webview.setAttribute('useragent', pass271R9ChromiumCompatibleUserAgent());")) {
    block = replaceOnce(
      block,
      "  webview.setAttribute('webpreferences', normalizeTahaiWebviewPreferences(TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES));",
      "  webview.setAttribute('webpreferences', normalizeTahaiWebviewPreferences(TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES));\n  webview.setAttribute('useragent', pass271R9ChromiumCompatibleUserAgent());",
      'webview compatible useragent'
    );
    changes.push('chromium-compatible-webview-useragent');
  }

  if (block.includes("webview.setAttribute('src', safeUrl);") && !block.includes("pass271R9SetWebviewSrc(webview, safeUrl, 'before-attach')")) {
    block = block.replace("  webview.setAttribute('src', safeUrl);", "  pass271R9SetWebviewSrc(webview, safeUrl, 'before-attach');");
    changes.push('replace-pre-attach-src-with-r9-setter');
  }

  if (!block.includes("pass271R9ArmWebviewBlankSurfaceRecovery(webview, safeUrl, tabId);")) {
    block = replaceOnce(
      block,
      '  stageEl.appendChild(webview);',
      "  stageEl.appendChild(webview);\n  pass271R9ArmWebviewBlankSurfaceRecovery(webview, safeUrl, tabId);",
      'arm blank surface recovery'
    );
    changes.push('arm-post-attach-blank-surface-recovery');
  }

  if (block !== originalBlock) text = text.slice(0, createStart) + block + text.slice(createEnd);

  write(rel, text);
  return changes;
}

function patchCss() {
  const rel = 'src/renderer/styles/browser.css';
  let text = read(rel);
  const changes = [];
  if (!text.includes('PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT_CSS')) {
    text += `

/* PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT_CSS_START */
/* Keep normal browsing hit testing simple: only the active guest webview receives the website budget. */
#webview-stage:not(.mission-layout) > webview.browser-view:not(.active) {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
#webview-stage:not(.mission-layout) > webview.browser-view.active[data-pass271-r9-webview-white-screen-closeout="PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT"] {
  display: flex !important;
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  -webkit-app-region: no-drag !important;
  background: #fff !important;
}
body:not(.mission-tab-dragging):not(.pass66-mission-pane-pointer-dragging) #webview-stage:not(.mission-layout),
body:not(.mission-tab-dragging):not(.pass66-mission-pane-pointer-dragging) #webview-stage:not(.mission-layout) > webview.browser-view.active {
  pointer-events: auto !important;
}
/* PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT_CSS_END */
`;
    changes.push('normal-browsing-active-webview-only-hit-test');
  }
  write(rel, text);
  return changes;
}

function writeDoc() {
  const rel = 'docs/qa/PASS271-R9-webview-white-screen-input-compositor-closeout.md';
  const body = [
    '# PASS271-R9 — Webview White-Screen Input/Compositor Closeout',
    '',
    '## Runtime blocker',
    '',
    'After R8, the R7 script failure was fixed and the webview src was seeded before attach, but the Windows dev runtime still displayed a white, non-interactive website surface.',
    '',
    '## Fix',
    '',
    '- Disable Electron/GPU compositing by default for the release-confidence lane unless TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR=0 is set.',
    '- Strip Electron from the webview user agent so ordinary sites see a Chromium-compatible browser identity.',
    '- Force the sanitized src once before attach and again after did-attach / settle if dom-ready has not fired.',
    '- Preserve main-process attach hardening, URL validation, popup-as-tab boundaries, and no direct PSA/API behavior.',
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
  const rel = 'PASS271_R9_README.md';
  const body = [
    '# PASS271-R9 — Webview White-Screen Input/Compositor Closeout',
    '',
    'Run:',
    '',
    '```powershell',
    'Set-Location C:\\dev\\browser\\app',
    'node scripts\\apply-pass271-r9-webview-white-screen-input-compositor-closeout.mjs',
    'npm run verify:pass-271-r9-webview-white-screen-input-compositor-closeout',
    'npm run build',
    'npm run dev',
    '```',
    '',
    'Debug-only GPU comparison:',
    '',
    '```powershell',
    '$env:TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR = "0"',
    'npm run dev',
    '```',
    ''
  ].join('\n');
  write(rel, body);
  return rel;
}

const mainChanges = patchMain();
const rendererChanges = patchRendererApp();
const cssChanges = patchCss();
const packageState = patchPackage();
const doc = writeDoc();
const readme = writeReadme();

console.log('PASS271_R9_APPLY=PASS');
console.log(`PASS271_R9_MAIN=${mainChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R9_RENDERER=${rendererChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R9_CSS=${cssChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R9_PACKAGE_SCRIPT=${packageState}`);
console.log(`PASS271_R9_DOC=${doc}`);
console.log(`PASS271_R9_README=${readme}`);
console.log('PASS271_R9_GPU_REPAIR_DEFAULT=enabled');
console.log('PASS271_R9_OVERRIDE=TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR=0');
