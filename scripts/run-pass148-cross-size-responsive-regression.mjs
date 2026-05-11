#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputDir = path.join(root, 'artifacts', 'cross-size-responsive-regression');
const jsonOut = path.join(outputDir, 'PASS148-cross-size-responsive-regression-evidence.json');
const mdOut = path.join(outputDir, 'PASS148-cross-size-responsive-regression-evidence.md');
const args = process.argv.slice(2);

const opts = {
  platform: process.platform === 'win32' ? 'windows' : process.platform === 'linux' ? 'linux' : 'unknown',
  operator: 'manual-operator',
  notes: '',
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--platform') opts.platform = String(args[++i] || 'unknown').toLowerCase();
  else if (arg === '--operator') opts.operator = String(args[++i] || 'manual-operator');
  else if (arg === '--notes') opts.notes = String(args[++i] || '');
  else if (arg === '--help' || arg === '-h') {
    console.log('PASS148 cross-size responsive regression evidence runner');
    console.log('Usage: node scripts/run-pass148-cross-size-responsive-regression.mjs [--platform windows|linux|unknown] [--operator name] [--notes text]');
    process.exit(0);
  }
}

const sanitize = (value) => String(value || '').replace(/(Authorization:|Cookie:|Bearer\s+|refresh[_-]?token|access[_-]?token|psa[_-]?api[_-]?key)\s*\S+/gi, '$1 [REDACTED]').slice(0, 2000);
const readJson = (relPath) => JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
const sha256File = (relPath) => {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
};

const pkg = readJson('package.json');
const releaseTruth = fs.existsSync(path.join(root, 'browser/about/release-truth.json'))
  ? readJson('browser/about/release-truth.json')
  : {};

const viewports = [
  { id: 'compact-960x640', width: 960, height: 640, status: 'manual-pending' },
  { id: 'small-1024x768', width: 1024, height: 768, status: 'manual-pending' },
  { id: 'laptop-1366x768', width: 1366, height: 768, status: 'manual-pending' },
  { id: 'desktop-1920x1080', width: 1920, height: 1080, status: 'manual-pending' },
  { id: 'wide-2560x1440', width: 2560, height: 1440, status: 'manual-pending' },
];

const checklistIds = [
  'normal-browser-first-paint',
  'titlebar-tabs-chrome-stack',
  'guide-kb-discoverable',
  'more-tools-overflow-reachable',
  'mission-control-opens-at-size',
  'mission-control-overlay-no-collision',
  'two-up-entry-recovery',
  'triview-entry-recovery',
  'quad-entry-recovery',
  'focus-pane-restore',
  'pane-move-and-drop-targets',
  'active-pane-visible-and-routed',
  'address-bar-reload-back-forward-target-active-pane',
  'command-center-available',
  'runbook-rail-usable',
  'evidence-export-redaction-accessible',
  'devtools-still-available',
  'no-critical-scroll-trap-or-cutoff',
  'no-unhandled-renderer-errors',
];

const evidence = {
  pass: 'PASS148',
  generatedAt: new Date().toISOString(),
  product: 'TAHAI Web Services Browser',
  expectedVersion: '1.8.30',
  packageVersion: pkg.version,
  releaseTruthVersion: releaseTruth.version || releaseTruth.releaseVersion || null,
  releaseChannel: releaseTruth.releaseChannel || null,
  updateChannel: releaseTruth.updateChannel || null,
  updatePolicy: releaseTruth.updatePolicy || null,
  platform: opts.platform,
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    osType: os.type(),
    osRelease: os.release(),
  },
  operator: sanitize(opts.operator),
  notes: sanitize(opts.notes),
  manualStatus: 'manual-pending',
  sourceTruth: {
    packageJsonSha256: sha256File('package.json'),
    releaseTruthSha256: sha256File('browser/about/release-truth.json'),
    rendererCssSha256: sha256File('src/renderer/styles.css'),
    onboardingCssSha256: sha256File('browser/onboarding/styles.css'),
  },
  viewports,
  checklist: checklistIds.map((id) => ({ id, status: 'manual-pending', evidence: '', result: '' })),
  guardrails: [
    'Guide/KB and Mission Control entries must be checked at every applicable viewport.',
    'Do not include secrets, cookies, tokens, customer data, or raw Authorization headers in screenshots/notes.',
    'Do not claim manual responsive success until each viewport and checklist item is actually tested on an installed app.',
    'Use installed Windows/Linux app builds, not dist/dev output, for release-candidate evidence.',
  ],
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonOut, `${JSON.stringify(evidence, null, 2)}\n`);

const md = [
  '# PASS148 Cross-size Responsive Regression Evidence',
  '',
  `Generated: ${evidence.generatedAt}`,
  `Product: ${evidence.product}`,
  `Expected version: ${evidence.expectedVersion}`,
  `Package version: ${evidence.packageVersion}`,
  `Platform lane: ${evidence.platform}`,
  `Manual status: ${evidence.manualStatus}`,
  '',
  '## Guardrails',
  ...evidence.guardrails.map((item) => `- ${item}`),
  '',
  '## Viewports',
  '| Viewport | Size | Status |',
  '|---|---:|---|',
  ...viewports.map((item) => `| ${item.id} | ${item.width}x${item.height} | ${item.status} |`),
  '',
  '## Checklist',
  '| Check | Status | Evidence | Result |',
  '|---|---|---|---|',
  ...evidence.checklist.map((item) => `| ${item.id} | ${item.status} |  |  |`),
  '',
  'No claim of manual responsive success is made by this generated template.',
  '',
].join('\n');
fs.writeFileSync(mdOut, md);

console.log(`PASS148_CROSS_SIZE_RESPONSIVE_EVIDENCE_JSON=${path.relative(root, jsonOut)}`);
console.log(`PASS148_CROSS_SIZE_RESPONSIVE_EVIDENCE_MD=${path.relative(root, mdOut)}`);
