#!/usr/bin/env node
/* PASS260 — Installed Recipe + Quad Store Smoke Evidence Gate + 2.0.9 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS260';
const targetVersion = '2.0.9';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const fixturePath = path.join(root, 'tests', 'runtime', 'pass260-installed-recipe-quad-smoke-checks.json');
const templatePath = path.join(root, 'docs', 'store', 'pass260-installed-recipe-quad-smoke-evidence.template.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS260-installed-recipe-quad-store-smoke-evidence.md');

const pass260Checks = {
  schemaVersion: 1,
  pass: 'PASS260',
  name: 'Installed Recipe + Quad Store Smoke Evidence Gate',
  versionTarget: targetVersion,
  evidenceFile: 'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json',
  storePosture: 'BLOCKED_UNTIL_REAL_INSTALLED_RECIPE_QUAD_SMOKE_EVIDENCE',
  requiredEnvironment: {
    platform: 'windows',
    packageTypes: ['msix', 'msi'],
    appMustBeInstalled: true,
    sourceVerificationMustPass: true,
    directDownloadSigningTruth: 'unsigned-preview unless a trusted signing path is separately proven',
    microsoftStoreTruth: 'not submitted and not approved until Partner Center upload/review evidence exists'
  },
  requiredRecipes: [
    'dns-migration',
    'cloudflare-cutover',
    'github-actions-release',
    'production-deployment',
    'certificate-renewal',
    'm365-user-offboarding',
    'incident-triage',
    'vendor-support-handoff'
  ],
  requiredLayouts: ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'],
  requiredWindowSizes: ['small-restored','restored-laptop','maximized-1080p'],
  requiredEvidenceSections: [
    'packageTruth',
    'installedAppTruth',
    'sourceVerification',
    'recipeSmoke',
    'layoutStress',
    'paneHealth',
    'exportPreview',
    'storeTruth',
    'blockers'
  ],
  minimumRecipePassCount: 8,
  minimumLayoutCycleCount: 50,
  requiredPaneHealthFlags: [
    'noBlankPanes',
    'noBottomOnlyWebview',
    'noOrphanedWebview',
    'noHiddenActivePane',
    'usefulPlaceholderForEmptyPane',
    'focusRestorePassed',
    'activePaneRoutingPassed'
  ]
};

const evidenceTemplate = {
  schemaVersion: 1,
  pass: 'PASS260',
  submissionGate: 'INSTALLED_RECIPE_QUAD_STORE_SMOKE',
  status: 'BLOCKED_UNTIL_FILLED_WITH_REAL_INSTALLED_APP_EVIDENCE',
  testedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  tester: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  packageTruth: {
    packageType: 'msix-or-msi',
    packagePath: 'REPLACE_WITH_LOCAL_PACKAGE_PATH_OR_ARTIFACT_NAME',
    packageSha256: 'REPLACE_WITH_64_HEX_SHA256',
    packageSizeBytes: 0,
    packageInstalledForSmoke: false,
    packageVersion: targetVersion,
    packageIdentity: 'REPLACE_WITH_MSIX_OR_APP_IDENTITY_IF_APPLICABLE'
  },
  installedAppTruth: {
    appLaunchedFromInstall: false,
    aboutVersionShows: targetVersion,
    noRendererBootError: false,
    noWebViewDomReadyError: false,
    noConsoleUnhandledRejection: false,
    windowResizeSmokePassed: false,
    evidenceExportPreviewOpened: false
  },
  sourceVerification: {
    verifyPass250: 'PENDING',
    verifyPass251: 'PENDING',
    verifyPass252: 'PENDING',
    verifyPass253: 'PENDING',
    verifyPass254: 'PENDING',
    verifyPass255: 'PENDING',
    verifyPass256: 'PENDING',
    verifyPass257: 'PENDING',
    verifyPass258: 'PENDING',
    verifyPass259: 'PENDING',
    verifyPass260: 'PENDING',
    releaseBlockers: 'PENDING'
  },
  recipeSmoke: [
    { recipeId: 'dns-migration', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'cloudflare-cutover', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'github-actions-release', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'production-deployment', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'certificate-renewal', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'm365-user-offboarding', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'incident-triage', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' },
    { recipeId: 'vendor-support-handoff', result: 'PENDING', selected: false, started: false, missionCreated: false, paneCount: 0, exportPreview: false, notes: '' }
  ],
  layoutStress: {
    result: 'PENDING',
    cyclesCompleted: 0,
    sequence: pass260Checks.requiredLayouts,
    smallRestoredPassed: false,
    restoredLaptopPassed: false,
    maximized1080pPassed: false
  },
  paneHealth: {
    result: 'PENDING',
    noBlankPanes: false,
    noBottomOnlyWebview: false,
    noOrphanedWebview: false,
    noHiddenActivePane: false,
    usefulPlaceholderForEmptyPane: false,
    focusRestorePassed: false,
    activePaneRoutingPassed: false
  },
  exportPreview: {
    result: 'PENDING',
    openedForEveryRecipe: false,
    redactionPreviewVisible: false,
    noSecretsInPreview: false
  },
  storeTruth: {
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved',
    directMsiExeSigningStatus: 'unsigned-preview',
    msixStoreSigningTruthPreserved: true
  },
  blockers: [
    'Fill this template only with real installed Windows smoke results. Do not mark PASS from source-only checks.'
  ]
};

const docs = `# PASS260 — Installed Recipe + Quad Store Smoke Evidence Gate\n\n## Goal\n\nPrevent Microsoft Store submission claims until the installed Windows app proves that Recipe launch, Split/Tri/Quad/Focus layout switching, pane geometry, and export preview are clean.\n\n## Store posture\n\n**Blocked by default.** PASS260 adds the evidence gate and template. It does not claim that installed smoke passed. The Store path remains blocked until a real installed app produces \`release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json\` with PASS results.\n\n## Required installed smoke\n\n1. Install the current package candidate.\n2. Launch the installed app, not the dev server.\n3. Confirm no renderer boot error, WebView DOM-ready error, unhandled rejection, blank pane, bottom-only webview, orphaned webview, or hidden active pane.\n4. For each flagship recipe, select recipe, start mission, verify mission fields, verify pane count, switch through all layouts, and open export preview.\n5. Run at small restored, restored laptop, and maximized 1080p sizes.\n6. Preserve truthful signing and Store status: not submitted, not approved, direct MSI/EXE unsigned-preview unless separately signed with evidence.\n\n## Source verification\n\n\`\`\`powershell\nSet-Location C:\\dev\\browser\\app\nnode scripts\\apply-pass260-installed-recipe-quad-store-smoke-evidence.mjs\nnpm run verify:pass-260-installed-recipe-quad-store-smoke-evidence\n\`\`\`\n\n## Store gate verification\n\nThis gate is expected to fail until real installed-app evidence exists:\n\n\`\`\`powershell\nSet-Location C:\\dev\\browser\\app\nnpm run gate:pass-260-installed-recipe-quad-store-smoke\n\`\`\`\n\n## Hard boundaries\n\n- Browser-side only.\n- No IT Docs backend code.\n- No PSA connector code.\n- No direct PSA API calls.\n- No PSA/API/provider secrets.\n- No Microsoft Store submission, approval, or signed-release claim without evidence.\n`;

function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }

function ensurePackage() {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return { packageJsonFound: false, changes: [] };
  const pkg = JSON.parse(readText(file));
  const before = pkg.version;
  if (!versionAtLeast(pkg.version, targetVersion)) pkg.version = targetVersion;
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-260-installed-recipe-quad-store-smoke-evidence'] = 'node scripts/verify-pass260-installed-recipe-quad-store-smoke-evidence.mjs';
  pkg.scripts['gate:pass-260-installed-recipe-quad-store-smoke'] = 'node scripts/gate-pass260-installed-recipe-quad-store-smoke.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(fixturePath, JSON.stringify(pass260Checks, null, 2) + '\n');
writeText(templatePath, JSON.stringify(evidenceTemplate, null, 2) + '\n');
writeText(docsPath, docs);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass260-installed-recipe-quad-store-smoke-evidence-apply-report.json');
const report = { pass, appliedAt: new Date().toISOString(), packageResult, fixtureFile: rel(fixturePath), evidenceTemplate: rel(templatePath), docs: rel(docsPath), storeSubmissionStatus: pass260Checks.storePosture };
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || 'unknown'));
console.log(pass + '_FIXTURE=' + rel(fixturePath));
console.log(pass + '_EVIDENCE_TEMPLATE=' + rel(templatePath));
console.log(pass + '_REPORT=' + rel(reportPath));
console.log(pass + '_STORE_SUBMISSION_STATUS=' + pass260Checks.storePosture);
