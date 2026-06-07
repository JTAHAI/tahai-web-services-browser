#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const generatedDir = path.join(root, 'release-candidate', 'generated');
const bugHuntDir = path.join(root, 'release-candidate', 'bug-hunt');
fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(bugHuntDir, { recursive: true });

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'release', 'coverage', '.git', '.pass329-backup'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const findings = [];
function add(f) { findings.push({ releaseBlocking: false, ...f }); }

const files = walk(srcDir);
let pkg = {};
try { pkg = JSON.parse(read(path.join(root, 'package.json')) || '{}'); } catch (error) {
  add({ kind: 'package-json-parse-failed', severity: 'critical', file: 'package.json', releaseBlocking: true, why: `package.json could not be parsed: ${error.message}`, action: 'Restore valid package.json before release verification.' });
}

const sentryPath = path.join(root, 'src', 'renderer', 'pass329-viewport-lifecycle-sentry.ts');
const sentryText = read(sentryPath);
if (!sentryText) {
  add({ kind: 'missing-sentry', severity: 'critical', file: 'src/renderer/pass329-viewport-lifecycle-sentry.ts', releaseBlocking: true, why: 'PASS329 viewport lifecycle sentry file is missing.', action: 'Apply PASS329 or restore the sentry file.' });
} else {
  for (const token of ['__TAHAI_PASS329_VIEWPORT_LIFECYCLE__', 'root-upper-left-island', 'webview-too-small-after-load', 'stage-inline-geometry-owner', 'webview-transform-owner']) {
    if (!sentryText.includes(token)) add({ kind: 'sentry-token-missing', severity: 'critical', file: 'src/renderer/pass329-viewport-lifecycle-sentry.ts', releaseBlocking: true, why: `PASS329 sentry missing required token ${token}.`, action: 'Restore the complete PASS329 sentry implementation.' });
  }
}

const rendererEntries = [
  'src/renderer/app.ts',
  'src/renderer/main.ts',
  'src/renderer/index.ts',
  'src/renderer/app.tsx',
  'src/renderer/main.tsx',
  'src/renderer/index.tsx',
  'src/renderer/app.js',
  'src/renderer/main.js',
  'src/renderer/index.js',
];
const importedBy = rendererEntries.filter((p) => read(path.join(root, p)).includes('pass329-viewport-lifecycle-sentry'));
if (!importedBy.length) {
  add({ kind: 'sentry-not-imported', severity: 'critical', file: 'src/renderer/*', releaseBlocking: true, why: 'PASS329 sentry exists but is not imported by a known renderer entry.', action: "Import './pass329-viewport-lifecycle-sentry' from the renderer entry that actually boots the browser shell." });
}

if (!pkg.scripts?.['verify:pass-329-runtime-lifecycle-geometry-sentry']) {
  add({ kind: 'missing-package-script', severity: 'critical', file: 'package.json', releaseBlocking: true, why: 'PASS329 verifier script is not registered.', action: 'Add verify:pass-329-runtime-lifecycle-geometry-sentry.' });
}

const lifecycleOwnerPattern = /(new\s+(ResizeObserver|MutationObserver)\s*\(|addEventListener\s*\(\s*["'](resize|load|DOMContentLoaded|visibilitychange)["']|requestAnimationFrame\s*\(|setInterval\s*\()/;
const geometryContextPattern = /(webview|browser[-_ ]?stage|content[-_ ]?stage|viewport|pane|mission[-_ ]?pane|geometry|bounds|resize|layout|PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-9]|upper-left|black space|compositor|scale forensic|root-cause)/i;
const passResiduePattern = /(PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-8]|upper-left|black space|compositor|scale forensic|root-cause)/i;
const inlineGeometryPattern = /(\.style\.(width|height|top|left|right|bottom|inset|transform|zoom)\s*=|\.style\.setProperty\s*\(\s*["'](width|height|top|left|right|bottom|inset|transform|zoom)["']|setAttribute\s*\(\s*["']style["'])/;
const zoomPattern = /(setZoomFactor\s*\(|webFrame\.setZoomFactor|zoomFactor\s*=)/;
const boundsPattern = /\.(setBounds|setSize|setContentSize)\s*\(/;

const lifecycleCandidates = [];
for (const file of files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f))) {
  if (rel(file) === 'src/renderer/pass329-viewport-lifecycle-sentry.ts') continue;
  const lines = read(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const ctx = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 9)).join('\n');
    if (geometryContextPattern.test(ctx) && lifecycleOwnerPattern.test(line)) {
      const gated = /TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS|PASS329: legacy viewport lifecycle observer|pass329-viewport-lifecycle-sentry/.test(ctx);
      const passResidue = passResiduePattern.test(ctx);
      lifecycleCandidates.push({ file: rel(file), lineNumber: i + 1, line: line.trim(), gated, passResidue });
      if (!gated && passResidue) {
        add({ kind: 'ungated-stale-viewport-lifecycle-owner', severity: 'critical', file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: 'A stale pass-residue lifecycle observer/timer can still run after load/resize and rewrite geometry.', action: 'Delete it or gate it behind TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS=1.', line: line.trim(), context: ctx });
      } else if (!gated) {
        add({ kind: 'active-viewport-lifecycle-owner-review', severity: 'warn', file: rel(file), lineNumber: i + 1, why: 'A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.', action: 'Review this owner against PASS329 sentry output and PASS328 geometry report.', line: line.trim(), context: ctx });
      }
    }
    if (geometryContextPattern.test(ctx) && inlineGeometryPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_INLINE_WEBVIEW_GEOMETRY|PASS328/.test(ctx)) {
      add({ kind: 'post-pass328-inline-geometry-owner', severity: 'critical', file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: 'An active inline geometry writer remains after PASS328.', action: 'Move geometry to source CSS/layout or gate as a legacy rollback path.', line: line.trim(), context: ctx });
    }
    if (geometryContextPattern.test(ctx) && zoomPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_SHELL_ZOOM|PASS328/.test(ctx)) {
      add({ kind: 'post-pass328-zoom-owner', severity: 'critical', file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: 'A zoom owner remains active near viewport/webview code.', action: 'Remove or gate zoom writes; viewport scale must remain source-default unless explicitly user-controlled.', line: line.trim(), context: ctx });
    }
    if (passResiduePattern.test(ctx) && boundsPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_WINDOW_BOUNDS_WRITES|PASS328/.test(ctx)) {
      add({ kind: 'post-pass328-window-bounds-owner', severity: 'critical', file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: 'A pass-residue BrowserWindow bounds/content-size writer remains active.', action: 'Remove or gate window bounds writes; BrowserWindow geometry is user/window-manager owned.', line: line.trim(), context: ctx });
    }
  }
}

const releaseBlockingFindings = findings.filter((f) => f.releaseBlocking);
const byKind = findings.reduce((m, f) => { m[f.kind] = (m[f.kind] || 0) + 1; return m; }, {});
const report = {
  pass: 'PASS329',
  repair: 'REPAIRED3_ESM_VERIFIER',
  name: 'Runtime Lifecycle Geometry Sentry',
  result: releaseBlockingFindings.length ? 'BLOCKED_REVIEW_REQUIRED' : 'PASS',
  repo: root,
  expectedRepo: 'D:/dev/browser/app',
  nodeModuleMode: 'ESM',
  scannedFileCount: files.length,
  sentry: {
    file: 'src/renderer/pass329-viewport-lifecycle-sentry.ts',
    present: Boolean(sentryText),
    importedBy,
  },
  lifecycleCandidateCount: lifecycleCandidates.length,
  ungatedPassResidueLifecycleCandidateCount: lifecycleCandidates.filter((c) => c.passResidue && !c.gated).length,
  lifecycleCandidates: lifecycleCandidates.slice(0, 220),
  findingCount: findings.length,
  releaseBlockingFindingCount: releaseBlockingFindings.length,
  byKind,
  findings,
  releaseTruth: {
    storeSubmitted: false,
    storeApproved: false,
    signedReleaseClaimAllowed: false,
    publicGaClaimAllowed: false,
    localRuntimeVerificationRequired: true,
  },
  runtimeManualProbe: {
    consoleProbe: "window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')",
    expectedHealthyDataset: "document.documentElement.dataset.pass329ViewportHealth === 'ok'",
    failureDatasetValues: ['warn', 'critical'],
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(generatedDir, 'pass329-runtime-lifecycle-geometry-sentry-report.json'), JSON.stringify(report, null, 2));
let md = '# PASS329 — Runtime Lifecycle Geometry Sentry\n\n';
md += `Verifier repair: **REPAIRED3_ESM_VERIFIER**\n\n`;
md += `Result: **${report.result}**\n\n`;
md += `Scanned files: ${report.scannedFileCount}\n\n`;
md += `Sentry imported by: ${importedBy.length ? importedBy.map((f) => `\`${f}\``).join(', ') : 'none'}\n\n`;
md += `Lifecycle candidates: ${report.lifecycleCandidateCount}\n\n`;
md += `Ungated pass-residue lifecycle candidates: ${report.ungatedPassResidueLifecycleCandidateCount}\n\n`;
md += '## Runtime console probe\n\n';
md += "`window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')`\n\n";
md += "Expected healthy value: `document.documentElement.dataset.pass329ViewportHealth === 'ok'`\n\n";
md += '## Finding categories\n\n';
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) md += `- ${k}: ${v}\n`;
md += '\n## Lifecycle candidates\n\n';
for (const c of lifecycleCandidates.slice(0, 120)) md += `- ${c.gated ? 'gated' : 'active'}${c.passResidue ? ', pass-residue' : ''}: \`${c.file}:${c.lineNumber}\` — ${c.line}\n`;
md += '\n## Findings\n\n';
for (const f of findings.slice(0, 180)) {
  md += `### ${String(f.severity).toUpperCase()} — ${f.kind}${f.releaseBlocking ? ' — RELEASE BLOCKING' : ''}\n\n`;
  md += `File: \`${f.file}${f.lineNumber ? `:${f.lineNumber}` : ''}\`\n\n`;
  md += `Why: ${f.why}\n\nAction: ${f.action}\n\n`;
  if (f.context || f.line) md += `\`\`\`text\n${f.context || f.line}\n\`\`\`\n\n`;
}
fs.writeFileSync(path.join(bugHuntDir, 'pass329-runtime-lifecycle-geometry-sentry.md'), md);

console.log(`PASS329_VERIFY_RESULT=${report.result}`);
console.log(`PASS329_ESM_VERIFIER_REPAIR=PASS`);
console.log(`PASS329_SCANNED_FILES=${report.scannedFileCount}`);
console.log(`PASS329_SENTRY_IMPORTED_BY=${importedBy.join(',') || 'none'}`);
console.log(`PASS329_LIFECYCLE_CANDIDATES=${report.lifecycleCandidateCount}`);
console.log(`PASS329_UNGATED_PASS_RESIDUE_LIFECYCLE_CANDIDATES=${report.ungatedPassResidueLifecycleCandidateCount}`);
console.log(`PASS329_FINDINGS=${report.findingCount}`);
console.log(`PASS329_RELEASE_BLOCKERS=${report.releaseBlockingFindingCount}`);
console.log(`PASS329_REPORT=${path.relative(root, path.join(generatedDir, 'pass329-runtime-lifecycle-geometry-sentry-report.json')).replace(/\\/g, '/')}`);
if (releaseBlockingFindings.length) process.exitCode = 1;
