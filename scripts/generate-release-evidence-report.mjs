#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const relPath = (abs) => path.relative(root, abs).replaceAll('\\\\', '/').replaceAll('\\', '/');

const REQUIRED_PASS_GUARDS = [
  ['PASS112', 'verify:pass-112-tabs-titlebar-chrome', 'tabs titlebar chrome'],
  ['PASS113', 'verify:pass-113-adaptive-chrome-density', 'adaptive chrome density'],
  ['PASS114', 'verify:pass-114-chrome-stack-guard', 'chrome stack guard'],
  ['PASS115', 'verify:pass-115-overflow-visibility-guard', 'overflow visibility guard'],
  ['PASS116', 'verify:pass-116-overlay-arbitration', 'overlay arbitration'],
  ['PASS117', 'verify:pass-117-overlay-focus-recovery', 'overlay focus recovery'],
  ['PASS118', 'verify:pass-118-overlay-dismiss-recovery', 'overlay dismiss recovery'],
  ['PASS119', 'verify:pass-119-overlay-aria-contract', 'overlay ARIA contract'],
  ['PASS120', 'verify:pass-120-overlay-pointer-boundary', 'overlay pointer boundary'],
  ['PASS121', 'verify:pass-121-overlay-scroll-containment', 'overlay scroll containment'],
  ['PASS122', 'verify:pass-122-overlay-viewport-reflow', 'overlay viewport reflow'],
  ['PASS123', 'verify:pass-123-overlay-cycle-guard', 'overlay cycle guard'],
  ['PASS124', 'verify:pass-124-linux-rpm-toolchain-recovery', 'Linux RPM toolchain recovery'],
  ['PASS125', 'verify:pass-125-linux-package-target-verifier', 'Linux package target verifier'],
  ['PASS126', 'verify:pass-126-linux-rpm-handoff-manifest', 'Linux RPM handoff manifest'],
  ['PASS127', 'verify:pass-127-enterprise-release-readiness', 'enterprise release readiness evidence'],
];

const REQUIRED_SURFACES = [
  ['main process shell', 'src/main/main.ts'],
  ['preload bridge', 'src/preload/preload.ts'],
  ['renderer shell', 'src/renderer/app.ts'],
  ['renderer chrome css', 'src/renderer/styles/browser.css'],
  ['mission control css', 'src/renderer/styles/mission-control.css'],
  ['site view rail source', 'src/renderer/site-view-mission-rail.ts'],
  ['mission model source', 'src/renderer/mission-model.ts'],
  ['mission type contract', 'src/shared/mission-types.ts'],
  ['mission validator contract', 'src/shared/mission-validators.ts'],
  ['evidence/redaction safety', 'src/shared/evidence-safety.ts'],
  ['redaction scanner', 'src/shared/redaction.ts'],
  ['active pane navigation boundary', 'src/shared/navigation-boundary.ts'],
  ['Linux package builder', 'scripts/build-linux-installers.sh'],
  ['Linux handoff verifier', 'scripts/verify-linux-installer-handoff.mjs'],
  ['enterprise release verifier', 'scripts/verify-enterprise-release.mjs'],
];

const REQUIRED_HYGIENE_PATTERNS = [
  'node_modules/',
  'dist/',
  'release/',
  'out/',
  'build-output/',
  'artifacts/',
  '.pass-runs/',
  'profiles/',
  'user-data/',
  '.local-data/',
  'mission-data/',
  'evidence-data/',
  '*.zip',
  '*.exe',
  '*.msi',
  '*.dmg',
  '*.AppImage',
  '*.deb',
  '*.rpm',
  '*.blockmap',
  '.env',
  '.env.*',
  '*.pfx',
  '*.p12',
  '*.pem',
  '*.key',
  'id_rsa',
  'id_ed25519',
];

const GENERATED_HANDOFF_OUTPUTS = [
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-manifest.txt',
];

function parseArgs(argv) {
  const args = { format: 'text', output: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.format = 'json';
    else if (arg === '--markdown') args.format = 'markdown';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--output') {
      args.output = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--output=')) {
      args.output = arg.slice('--output='.length);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      args.unknown = args.unknown || [];
      args.unknown.push(arg);
    }
  }
  return args;
}

function usage() {
  return `Usage:\n  node scripts/generate-release-evidence-report.mjs --json\n  node scripts/generate-release-evidence-report.mjs --markdown\n  node scripts/generate-release-evidence-report.mjs --markdown --output artifacts/release-evidence/tahai-browser-release-evidence.md\n\nOutput files are allowed only under artifacts/ or .pass-runs/ so generated evidence never becomes source.`;
}

function assertSafeOutputPath(outputPath) {
  if (!outputPath) return null;
  const absolute = path.resolve(root, outputPath);
  const relative = relPath(absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`output must stay inside the repository workspace: ${outputPath}`);
  }
  if (!(relative.startsWith('artifacts/') || relative.startsWith('.pass-runs/'))) {
    throw new Error(`release evidence output must be generated under artifacts/ or .pass-runs/, got: ${relative}`);
  }
  return { absolute, relative };
}

function findPresentGeneratedRoots() {
  return ['node_modules', 'dist', 'release', 'out', 'build-output', 'artifacts', '.pass-runs', 'profiles', 'user-data', '.local-data', 'mission-data', 'evidence-data']
    .filter((rel) => exists(rel));
}

function collectReport() {
  const errors = [];
  const warnings = [];
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');
  const gitignore = exists('.gitignore') ? read('.gitignore') : '';

  const requiredPasses = REQUIRED_PASS_GUARDS.map(([pass, script, purpose]) => {
    const scriptValue = pkg.scripts?.[script];
    const expectedFile = `scripts/${script.replace('verify:', 'verify-')}.mjs`;
    const presentInReleaseBlockers = releaseBlockers.includes(`npm run ${script}`) || releaseBlockers.includes(script);
    const scriptFileExists = exists(expectedFile);
    if (!scriptValue) errors.push(`${pass} package script missing: ${script}`);
    if (!scriptFileExists) errors.push(`${pass} verifier file missing: ${expectedFile}`);
    if (!presentInReleaseBlockers) errors.push(`${pass} not represented in verify:release-blockers: ${script}`);
    return { pass, script, purpose, scriptValue: scriptValue || '', expectedFile, scriptFileExists, presentInReleaseBlockers };
  });

  let lastIndex = -1;
  for (const [pass, script] of REQUIRED_PASS_GUARDS) {
    const idx = releaseBlockers.indexOf(script);
    if (idx < 0) continue;
    if (idx <= lastIndex) errors.push(`release-blockers order drift around ${pass} (${script})`);
    lastIndex = idx;
  }

  const buildIndex = releaseBlockers.lastIndexOf('npm run build');
  if (buildIndex < 0) errors.push('verify:release-blockers must end with a build gate');
  const pass127Index = releaseBlockers.indexOf('verify:pass-127-enterprise-release-readiness');
  const pass126Index = releaseBlockers.indexOf('verify:pass-126-linux-rpm-handoff-manifest');
  if (pass126Index >= 0 && pass127Index >= 0 && pass127Index <= pass126Index) errors.push('PASS127 must run after PASS126');
  if (buildIndex >= 0 && pass127Index >= 0 && pass127Index >= buildIndex) errors.push('PASS127 must run before the final build gate');

  for (const forbiddenReleaseBlockerToken of [
    'verify:linux-installer-handoff',
    'package:linux:release',
    'package:linux:rpm',
    'package:linux:appimage',
    'package:linux:deb',
    'package:win:release',
    'release:friend:zip',
  ]) {
    if (releaseBlockers.includes(forbiddenReleaseBlockerToken)) {
      errors.push(`verify:release-blockers must not require generated/package target: ${forbiddenReleaseBlockerToken}`);
    }
  }

  const sourceHygiene = REQUIRED_HYGIENE_PATTERNS.map((pattern) => {
    const present = gitignore.includes(pattern);
    if (!present) errors.push(`.gitignore missing source hygiene pattern: ${pattern}`);
    return { pattern, present };
  });

  const surfaces = REQUIRED_SURFACES.map(([label, rel]) => {
    const present = exists(rel);
    if (!present) errors.push(`required release surface missing: ${rel}`);
    return { label, path: rel, present };
  });

  const handoffOutputs = GENERATED_HANDOFF_OUTPUTS.map((rel) => ({
    path: rel,
    currentlyPresentInWorkspace: exists(rel),
    generatedOnly: rel.startsWith('release/'),
  }));
  const presentGeneratedRoots = findPresentGeneratedRoots();
  if (presentGeneratedRoots.length) {
    warnings.push(`local generated/runtime folders currently present: ${presentGeneratedRoots.join(', ')}; verify-source ZIP packaging must exclude them`);
  }

  const linuxScripts = {
    rpm: pkg.scripts?.['package:linux:rpm'] || '',
    appImage: pkg.scripts?.['package:linux:appimage'] || '',
    deb: pkg.scripts?.['package:linux:deb'] || '',
    release: pkg.scripts?.['package:linux:release'] || '',
    handoffVerifier: pkg.scripts?.['verify:linux-installer-handoff'] || '',
  };
  if (linuxScripts.rpm !== 'bash scripts/build-linux-installers.sh rpm') errors.push('package:linux:rpm must target only rpm');
  if (linuxScripts.appImage !== 'bash scripts/build-linux-installers.sh AppImage') errors.push('package:linux:appimage must target only AppImage');
  if (linuxScripts.deb !== 'bash scripts/build-linux-installers.sh deb') errors.push('package:linux:deb must target only deb');
  if (linuxScripts.release !== 'bash scripts/build-linux-installers.sh AppImage deb rpm') errors.push('package:linux:release must remain the explicit full Linux release target');
  if (linuxScripts.handoffVerifier !== 'node scripts/verify-linux-installer-handoff.mjs') errors.push('verify:linux-installer-handoff must remain a post-build artifact verifier, not a release-blocker source verifier');

  return {
    schemaVersion: 1,
    pass: 'PASS127',
    product: pkg.productName || pkg.name,
    packageName: pkg.name,
    version: pkg.version,
    generatedAt: new Date().toISOString(),
    sourceOnly: true,
    ok: errors.length === 0,
    errors,
    warnings,
    releaseReadiness: {
      releaseBlockersPresent: Boolean(releaseBlockers),
      finalBuildGatePresent: buildIndex >= 0,
      pass127BeforeBuild: buildIndex >= 0 && pass127Index >= 0 && pass127Index < buildIndex,
      pass126BeforePass127: pass126Index >= 0 && pass127Index >= 0 && pass126Index < pass127Index,
      requiredPasses,
    },
    sourceHygiene: {
      requiredPatterns: sourceHygiene,
      presentGeneratedRoots,
      generatedOutputsPolicy: handoffOutputs,
      zipExclusionRule: 'Source zips must exclude node_modules, dist, release, artifacts, .git, .pass-runs, runtime profiles, local browser data, and installer/package outputs.',
    },
    packageTargets: linuxScripts,
    surfaces,
    manualCloseout: [
      'npm ci',
      'npm run build',
      'npm run verify:release-blockers',
      'npm run package:linux:rpm',
      'npm run verify:linux-installer-handoff -- rpm',
      'npm run dev',
    ],
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# TAHAI Browser Release Evidence Report — ${report.pass}`);
  lines.push('');
  lines.push(`- Product: ${report.product}`);
  lines.push(`- Version: ${report.version}`);
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source-only: ${report.sourceOnly ? 'yes' : 'no'}`);
  lines.push(`- Status: ${report.ok ? 'OK' : 'FAIL'}`);
  lines.push('');
  lines.push('## PASS112–PASS127 guardrail ledger');
  for (const item of report.releaseReadiness.requiredPasses) {
    lines.push(`- ${item.pass}: \`${item.script}\` — ${item.purpose} — ${item.presentInReleaseBlockers && item.scriptFileExists ? 'represented' : 'missing'}`);
  }
  lines.push('');
  lines.push('## Source hygiene');
  lines.push(report.sourceHygiene.zipExclusionRule);
  lines.push('');
  lines.push('Required ignore patterns:');
  for (const item of report.sourceHygiene.requiredPatterns) lines.push(`- ${item.present ? 'OK' : 'MISSING'} \`${item.pattern}\``);
  lines.push('');
  lines.push('Generated handoff outputs are build outputs only:');
  for (const item of report.sourceHygiene.generatedOutputsPolicy) lines.push(`- \`${item.path}\` — generated only${item.currentlyPresentInWorkspace ? ' (currently present locally)' : ''}`);
  lines.push('');
  lines.push('## Manual closeout commands');
  for (const command of report.manualCloseout) lines.push(`- \`${command}\``);
  if (report.warnings.length) {
    lines.push('');
    lines.push('## Warnings');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  if (report.errors.length) {
    lines.push('');
    lines.push('## Errors');
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}
if (args.unknown?.length) {
  console.error(`Unknown argument(s): ${args.unknown.join(', ')}`);
  console.error(usage());
  process.exit(2);
}

let output;
try {
  const report = collectReport();
  output = args.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (args.output && !args.dryRun) {
    const target = assertSafeOutputPath(args.output);
    fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
    fs.writeFileSync(target.absolute, output, 'utf8');
    console.log(`TAHAI_BROWSER_RELEASE_EVIDENCE_REPORT=${target.relative}`);
  } else {
    process.stdout.write(output);
  }
  if (!report.ok) process.exit(1);
} catch (error) {
  console.error(`TAHAI_BROWSER_RELEASE_EVIDENCE_REPORT_ERROR=${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
