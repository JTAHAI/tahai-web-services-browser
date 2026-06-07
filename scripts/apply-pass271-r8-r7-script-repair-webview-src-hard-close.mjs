import fs from 'node:fs';
import path from 'node:path';

const PASS = 'PASS271_R8';
const root = process.cwd();

function file(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, text) {
  const target = file(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.${PASS}.bak`);
  fs.writeFileSync(target, text, 'utf8');
}
function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing needle: ${needle}`);
  return text.replace(needle, replacement);
}

function ensurePackageScript() {
  const rel = 'package.json';
  const pkg = JSON.parse(read(rel));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-271-r8-r7-script-repair-webview-src-hard-close'] = 'node scripts/verify-pass271-r8-r7-script-repair-webview-src-hard-close.mjs';
  write(rel, `${JSON.stringify(pkg, null, 2)}\n`);
  return 'updated';
}

function patchRendererApp() {
  const rel = 'src/renderer/app.ts';
  let text = read(rel);
  const changes = [];

  const createStart = text.indexOf('function createTab(url: string): string {');
  const createEnd = text.indexOf('function active(): TabState | undefined', createStart);
  if (createStart < 0 || createEnd < 0) throw new Error('Unable to locate createTab function bounds.');
  const createBlock = text.slice(createStart, createEnd);
  const appendMarker = '  stageEl.appendChild(webview);';
  const appendIndex = createBlock.indexOf(appendMarker);
  if (appendIndex < 0) throw new Error('Unable to locate webview append marker inside createTab.');
  const beforeAppend = createBlock.slice(0, appendIndex);

  if (!beforeAppend.includes("webview.setAttribute('src', safeUrl);")) {
    const srcSeedBlock = [
      "  // PASS271-R8: hard-close the R7 apply-script failure and seed src before attach.",
      "  // Electron's main-process will-attach-webview boundary validates params.src at attach time.",
      "  // If the element is appended with an empty src, the guest can be blocked before PASS236",
      "  // post-append safe loading runs, leaving a white, non-interactive content pane.",
      "  webview.dataset.pass271R8WebviewAttachSrcHardClose = 'PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE';",
      "  webview.dataset.pass271R8InitialSrcSeededBeforeAttach = 'true';",
      "  webview.addEventListener('did-attach', () => {",
      "    webview.dataset.pass271R8DidAttach = 'true';",
      "    if (!webview.getAttribute('src')) webview.setAttribute('src', safeUrl);",
      "  });",
      "  webview.setAttribute('src', safeUrl);",
      "",
      ""
    ].join('\n');
    text = replaceOnce(text, appendMarker, `${srcSeedBlock}${appendMarker}`, 'createTab src seed');
    changes.push('seed-webview-src-before-stage-append');
  } else if (!beforeAppend.includes('PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE')) {
    const existingSrc = "  webview.setAttribute('src', safeUrl);";
    const decorated = [
      "  webview.dataset.pass271R8WebviewAttachSrcHardClose = 'PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE';",
      "  webview.dataset.pass271R8InitialSrcSeededBeforeAttach = 'true';",
      existingSrc
    ].join('\n');
    const nextBlock = createBlock.replace(existingSrc, decorated);
    text = text.slice(0, createStart) + nextBlock + text.slice(createEnd);
    changes.push('decorate-existing-pre-append-src-seed');
  }

  const legacyDeferred = "  webview.dataset.pass239InitialSrcDeferred = 'true';";
  if (text.includes(legacyDeferred)) {
    text = text.replace(legacyDeferred, "  webview.dataset.pass239InitialSrcDeferred = 'false';");
    changes.push('mark-initial-src-not-deferred');
  }

  write(rel, text);
  return changes;
}

function patchMain() {
  const rel = 'src/main/main.ts';
  let text = read(rel);
  const changes = [];

  // This keeps the security boundary strict while making its decision visible in local dev logs.
  const oldWarn = "      console.warn(`[${TAHAI_WEBVIEW_ATTACH_SECURITY_PASS}] blocked webview attach: ${decision.blockedReasons.join(',') || 'unknown-reason'}`);";
  const newWarn = "      console.warn(`[${TAHAI_WEBVIEW_ATTACH_SECURITY_PASS}] blocked webview attach: ${decision.blockedReasons.join(',') || 'unknown-reason'} src=${String((params as TahaiWebviewAttachRecord).src || '').slice(0, 240)}`);";
  if (text.includes(oldWarn) && !text.includes('src=${String((params as TahaiWebviewAttachRecord).src')) {
    text = text.replace(oldWarn, newWarn);
    changes.push('webview-attach-block-log-includes-src');
  }

  write(rel, text);
  return changes;
}

function patchCss() {
  const rel = 'src/renderer/styles/browser.css';
  let text = read(rel);
  const changes = [];

  if (!text.includes('PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE_CSS')) {
    text += [
      '',
      '',
      '/* PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE_CSS_START */',
      '/* Normal 1-Up browsing must leave the active Electron webview as the top hit-test surface. */',
      '#webview-stage:not(.mission-layout) > webview.browser-view.active,',
      '#webview-stage > webview.browser-view.active[data-pass271-r8-webview-attach-src-hard-close="PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE"] {',
      '  display: flex !important;',
      '  position: absolute !important;',
      '  inset: 0 !important;',
      '  width: 100% !important;',
      '  height: 100% !important;',
      '  min-width: 0 !important;',
      '  min-height: 0 !important;',
      '  opacity: 1 !important;',
      '  visibility: visible !important;',
      '  pointer-events: auto !important;',
      '  -webkit-app-region: no-drag !important;',
      '  z-index: 50 !important;',
      '  background: #fff !important;',
      '}',
      'body:not(.mission-tab-dragging):not(.pass66-mission-pane-pointer-dragging) #webview-stage > webview.browser-view.active {',
      '  pointer-events: auto !important;',
      '}',
      'body:not(.mission-tab-dragging):not(.pass66-mission-pane-pointer-dragging) .mission-pane-drop-zones,',
      'body:not(.mission-tab-dragging):not(.pass66-mission-pane-pointer-dragging) .mission-pane-heads {',
      '  pointer-events: none !important;',
      '}',
      '/* PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE_CSS_END */',
      ''
    ].join('\n');
    changes.push('active-webview-hit-test-css');
  }

  write(rel, text);
  return changes;
}

function writeVerifierCompatibility() {
  // R7 was distributed with a broken template literal. Overwrite it so any old command no longer explodes.
  const rel = 'scripts/apply-pass271-r7-webview-attach-src-click-runtime-closeout.mjs';
  const body = [
    "import { spawnSync } from 'node:child_process';",
    "",
    "console.log('PASS271_R7_SUPERSEDED_BY_PASS271_R8=TRUE');",
    "const result = spawnSync(process.execPath, ['scripts/apply-pass271-r8-r7-script-repair-webview-src-hard-close.mjs'], { stdio: 'inherit', shell: false });",
    "process.exit(result.status ?? 1);",
    ""
  ].join('\n');
  write(rel, body);
  return rel;
}

function writeDoc() {
  const rel = 'docs/qa/PASS271-R8-r7-script-repair-webview-src-hard-close.md';
  const body = [
    '# PASS271-R8 — R7 Script Repair + Webview Src Hard Close',
    '',
    '## Problem',
    '',
    'PASS271-R7 did not apply because the apply script contained an unescaped template-literal backtick inside its Markdown body. That is why the local app showed no runtime change after R7.',
    '',
    'The underlying runtime issue remains: the renderer creates an Electron webview and appends it before a safe src is present. The main-process webview attach boundary validates params.src during will-attach-webview, so an empty src can be blocked before the post-append safe-load path executes.',
    '',
    '## Fix',
    '',
    '- Seed the sanitized safeUrl on the webview before stageEl.appendChild(webview).',
    '- Mark the legacy PASS239 initial-src-deferred flag false for this path.',
    '- Preserve the existing PASS236 post-append safe-load telemetry.',
    '- Add CSS to keep normal 1-Up browsing webviews as the top interactive surface.',
    '- Replace the broken R7 apply script with a small wrapper that delegates to R8.',
    '',
    '## Scope',
    '',
    'Browser-side only. No IT Docs backend code. No PSA connector code. No direct PSA/API calls. No secrets.',
    ''
  ].join('\n');
  write(rel, body);
  return rel;
}

const rendererChanges = patchRendererApp();
const mainChanges = patchMain();
const cssChanges = patchCss();
const packageScript = ensurePackageScript();
const r7Wrapper = writeVerifierCompatibility();
const doc = writeDoc();

console.log('PASS271_R8_APPLY=PASS');
console.log(`PASS271_R8_RENDERER=${rendererChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R8_MAIN=${mainChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R8_CSS=${cssChanges.join(',') || 'already-compliant'}`);
console.log(`PASS271_R8_PACKAGE_SCRIPT=${packageScript}`);
console.log(`PASS271_R8_R7_WRAPPER=${r7Wrapper}`);
console.log(`PASS271_R8_DOC=${doc}`);
console.log('PASS271_R8_ROOT_CAUSE=R7-script-syntax-failed-and-webview-src-empty-at-attach');
