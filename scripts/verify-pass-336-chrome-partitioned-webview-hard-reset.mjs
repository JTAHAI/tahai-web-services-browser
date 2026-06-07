import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const reportPath = path.join(repo, 'release-candidate', 'generated', 'pass336-chrome-partitioned-webview-hard-reset-report.json');
const findings = [];
const warnings = [];

function read(rel) {
  try { return fs.readFileSync(path.join(repo, rel), 'utf8'); } catch { return ''; }
}

function exists(rel) {
  return fs.existsSync(path.join(repo, rel));
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'release', 'coverage', '.git'].includes(entry.name)) continue;
    if (/^\.pass\d+-backup/.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function rel(full) {
  return path.relative(repo, full).replace(/\\/g, '/');
}

const pkg = JSON.parse(read('package.json') || '{}');
const script = pkg.scripts?.['verify:pass-336-chrome-partitioned-webview-hard-reset'];
if (script !== 'node scripts/verify-pass-336-chrome-partitioned-webview-hard-reset.mjs') {
  findings.push({ kind: 'missing-package-script', severity: 'critical', detail: 'package.json must expose verify:pass-336-chrome-partitioned-webview-hard-reset' });
}

const sentryRel = 'src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts';
const sentry = read(sentryRel);
if (!sentry) {
  findings.push({ kind: 'missing-pass336-sentry', severity: 'critical', detail: `${sentryRel} is missing` });
} else {
  const requiredTokens = [
    '__TAHAI_PASS336_CHROME_PARTITION__',
    'pass336ChromePartitionHealth',
    'detectChromeBottom',
    'webviewCoversChrome',
    'partitioned-webview-',
    'webview-still-hit-testing-over-browser-chrome',
    'demoteDeadOverlays',
    'TAHAI_BROWSER_ENABLE_PASS336_LEGACY_RECOVERY',
  ];
  for (const token of requiredTokens) {
    if (!sentry.includes(token)) findings.push({ kind: 'missing-sentry-token', severity: 'critical', detail: token });
  }
}

const entryCandidates = [
  'src/renderer/app.ts',
  'src/renderer/main.ts',
  'src/renderer/index.ts',
  'src/renderer/app.tsx',
  'src/renderer/main.tsx',
  'src/renderer/index.tsx',
];
const entries = entryCandidates.filter(exists).map((entry) => ({ entry, text: read(entry) }));
if (!entries.some(({ text }) => text.includes('pass336-chrome-partitioned-webview-hard-reset'))) {
  findings.push({ kind: 'pass336-not-imported', severity: 'critical', detail: 'No renderer entry imports PASS336 chrome partitioned hard reset' });
}

for (const { entry, text } of entries) {
  const activePriorImport = text.split(/\r?\n/).filter((line) => /^\s*import\s+["'].*pass(327|328|329|330|331|332|333|334|335)-.*["']\s*;?\s*$/.test(line));
  if (activePriorImport.length) {
    findings.push({ kind: 'prior-runtime-recovery-import-still-active', severity: 'critical', detail: `${entry}: ${activePriorImport.join(' | ')}` });
  }
}

const sourceFiles = walk(path.join(repo, 'src'), (full) => /\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/.test(full));
const contractMarkers = [];
for (const full of sourceFiles) {
  const text = fs.readFileSync(full, 'utf8');
  if (/PASS327_VIEWPORT_ROOT_CONTRACT_BEGIN|PASS328_WEBVIEW_STAGE_CONTRACT_BEGIN|PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_BEGIN|PASS334_DEAD_CHROME_STATIC_GUARD_BEGIN/.test(text)) {
    contractMarkers.push(rel(full));
  }
}
if (contractMarkers.length) {
  findings.push({ kind: 'old-broad-viewport-contract-remains', severity: 'critical', detail: contractMarkers.sort() });
}

const pass271Files = [];
for (const full of sourceFiles) {
  const text = fs.readFileSync(full, 'utf8');
  if (/PASS271_R9|PASS271_R10/.test(text)) pass271Files.push(rel(full));
}
if (pass271Files.length) {
  warnings.push({ kind: 'pass271-marker-files-remain-for-review', severity: 'warning', detail: pass271Files.sort() });
}

const report = {
  pass: 'PASS336',
  name: 'Chrome Partitioned WebView Hard Reset',
  result: findings.length ? 'FAIL' : 'PASS',
  criticalFindings: findings.length,
  warningFindings: warnings.length,
  findings,
  warnings,
  generatedAt: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(`PASS336_VERIFY_RESULT=${report.result}`);
console.log('PASS336_VERIFIER=ESM');
console.log(`PASS336_CRITICAL_FINDINGS=${findings.length}`);
console.log(`PASS336_WARNING_FINDINGS=${warnings.length}`);
console.log(`PASS336_REPORT=${reportPath}`);
if (findings.length) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(1);
}
