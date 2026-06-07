#!/usr/bin/env node
/* PASS261 — Store Submission Packet Finalizer + 2.0.10 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS261';
const targetVersion = '2.0.10';
const packetTemplatePath = path.join(root, 'docs', 'store', 'pass261-store-submission-packet.template.json');
const screenshotManifestPath = path.join(root, 'docs', 'store', 'pass261-store-screenshot-manifest.template.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS261-store-submission-packet-finalizer.md');
const checklistPath = path.join(root, 'docs', 'store', 'PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md');
const readmePath = path.join(root, 'PASS261_README.md');

const requiredPacketSections = [
  'packageIdentityTruth',
  'storeListingTruth',
  'privacySupportTruth',
  'screenshotManifest',
  'pass260InstalledSmokeEvidence',
  'checksumsAndProvenance',
  'knownIssuesTruth',
  'signingTruth',
  'goNoGo'
];

const packetTemplate = {
  schemaVersion: 1,
  pass: 'PASS261',
  packetName: 'TAHAI Web Services Browser Microsoft Store Submission Packet',
  status: 'BLOCKED_PENDING_PASS260_INSTALLED_SMOKE_AND_OPERATOR_REVIEW',
  versionTarget: targetVersion,
  generatedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  preparedBy: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  packageIdentityTruth: {
    partnerCenterReserved: false,
    packageFamilyName: 'REPLACE_WITH_PARTNER_CENTER_PACKAGE_FAMILY_NAME',
    publisherDisplayName: 'TAHAI Web Services',
    publisherId: 'REPLACE_WITH_PARTNER_CENTER_PUBLISHER_ID',
    appIdentitySource: 'packaging/windows/msix/package-identity.store.example.json until Partner Center identity is reserved',
    identityPlaceholdersRemoved: false
  },
  storeListingTruth: {
    appName: 'TAHAI Web Services Browser',
    shortDescription: 'Enterprise DevOps and IT Admin command browser for Mission Control workflows.',
    descriptionSource: 'docs/store/MICROSOFT_STORE_LISTING_PACKET.md',
    category: 'Developer tools / Productivity',
    ageRatingNotes: 'No user-generated marketplace content; browser loads user-selected web content.',
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved'
  },
  privacySupportTruth: {
    privacyPolicyUrl: 'REPLACE_WITH_PUBLIC_PRIVACY_POLICY_URL',
    supportUrl: 'REPLACE_WITH_PUBLIC_SUPPORT_URL',
    websiteUrl: 'REPLACE_WITH_PUBLIC_BROWSER_LANDING_URL',
    noPersonalDataCollectedByDefaultClaimReviewed: false,
    localDataInventoryReviewed: false,
    supportBoundariesReviewed: false
  },
  screenshotManifest: {
    manifestPath: 'docs/store/pass261-store-screenshot-manifest.template.json',
    requiredScreenshots: [
      'normal-browser-mode',
      'mission-control-overview',
      'quad-view-recipe-started',
      'runbook-rail-and-evidence',
      'operator-command-center',
      'settings-about-unsigned-preview-truth'
    ],
    screenshotsCapturedFromInstalledApp: false,
    screenshotsContainNoSecrets: false,
    screenshotsMatchVersion: targetVersion
  },
  pass260InstalledSmokeEvidence: {
    required: true,
    evidencePath: 'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json',
    gateCommand: 'npm run gate:pass-260-installed-recipe-quad-store-smoke',
    gateResult: 'PENDING',
    noBlankPanes: false,
    noBottomOnlyWebview: false,
    noOrphanedWebview: false,
    noHiddenActivePane: false,
    focusRestorePassed: false,
    activePaneRoutingPassed: false
  },
  checksumsAndProvenance: {
    packageSha256: 'REPLACE_WITH_64_HEX_SHA256',
    releaseManifestPath: 'REPLACE_WITH_RELEASE_MANIFEST_PATH',
    sbomPath: 'REPLACE_WITH_SBOM_PATH_IF_AVAILABLE',
    sourceArchiveSha256: 'REPLACE_WITH_SOURCE_ARCHIVE_SHA256_IF_AVAILABLE',
    provenanceReviewed: false
  },
  knownIssuesTruth: {
    knownIssuesDocument: 'docs/known-issues.md or docs/store/KNOWN_ISSUES_TRUTH_TEMPLATE.md',
    blockersOpen: true,
    blockers: [
      'PASS260 installed Recipe + Quad/Tri/Split smoke evidence not yet attached.'
    ],
    falseClaimsRemoved: false
  },
  signingTruth: {
    storeMsixSigningTruth: 'Microsoft Store can sign Store-distributed MSIX during submission/review; do not claim approval until Partner Center approval exists.',
    directMsiExeSigningStatus: 'unsigned-preview unless trusted signing evidence is attached',
    directMsixSigningStatus: 'not a free public signing path by itself unless trusted cert path is proven',
    noPrivateCertificatesInRepo: true
  },
  goNoGo: {
    status: 'NO_GO',
    reason: 'PASS260 installed smoke evidence and operator review are required before Partner Center submission.',
    readyForPartnerCenterUpload: false,
    readyForPublicGA: false,
    operatorApproved: false
  }
};

const screenshotManifest = {
  schemaVersion: 1,
  pass: 'PASS261',
  versionTarget: targetVersion,
  captureSource: 'installed Windows app only for final Store screenshots',
  status: 'TEMPLATE_PENDING_INSTALLED_APP_SCREENSHOTS',
  screenshots: [
    { id: 'normal-browser-mode', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Clean normal browsing surface.' },
    { id: 'mission-control-overview', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Mission Control overview without clutter.' },
    { id: 'quad-view-recipe-started', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Recipe started with useful panes, no black/bottom-only pane.' },
    { id: 'runbook-rail-and-evidence', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Runbook Rail plus evidence/export affordance.' },
    { id: 'operator-command-center', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Ctrl+K command center with target scope.' },
    { id: 'settings-about-unsigned-preview-truth', required: true, path: 'REPLACE_WITH_SCREENSHOT_PATH', source: 'installed-app', noSecrets: false, versionVisibleOrRecorded: false, notes: 'Settings/About truth with no false signing or Store approval claims.' }
  ],
  reviewRules: [
    'No customer data, tokens, tenant IDs, private tickets, private emails, or live secrets.',
    'No screenshot may imply Microsoft Store approval before approval exists.',
    'No screenshot may show blank panes, bottom-only webviews, or orphaned active pane state.',
    'Screenshots must represent the same package/version as the submission packet.'
  ]
};

const docs = `# PASS261 — Store Submission Packet Finalizer\n\n## Goal\n\nPrepare one Partner Center submission packet that consolidates listing copy, screenshot manifest, privacy/support URLs, package identity truth, PASS260 installed-smoke status, checksum/provenance pointers, known issues, signing truth, and go/no-go posture.\n\n## Important truth\n\nPASS261 does **not** claim that the app has been submitted to Microsoft, approved by Microsoft, signed for direct download, or cleared for GA. It creates the packet and fail-closed checks needed before those claims can be made.\n\n## Packet files\n\n- \`docs/store/pass261-store-submission-packet.template.json\`\n- \`docs/store/pass261-store-screenshot-manifest.template.json\`\n- \`docs/store/PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md\`\n\n## Required go/no-go conditions\n\n- PASS260 installed Recipe + Quad/Tri/Split smoke gate passes from real installed Windows evidence.\n- Store listing copy is reviewed and does not overclaim.\n- Privacy, support, and website URLs are public and accurate.\n- Package identity placeholders are replaced only after Partner Center reserves identity.\n- Screenshots come from the installed app and contain no secrets.\n- Checksums/provenance pointers are attached.\n- Known issues are accurate.\n- Store submission remains \`not-submitted\` and approval remains \`not-approved\` until Partner Center evidence exists.\n\n## Commands\n\n\`\`\`powershell\nSet-Location C:\\dev\\browser\\app\nnode scripts\\apply-pass261-store-submission-packet-finalizer.mjs\nnpm run verify:pass-261-store-submission-packet-finalizer\n\`\`\`\n\nOptional hard gate after a real packet has been filled:\n\n\`\`\`powershell\nnpm run gate:pass-261-store-submission-packet\n\`\`\`\n\nThe gate is expected to block until the packet is filled with real installed-app evidence and operator approval.\n\n## Hard boundaries\n\n- Browser-side only.\n- No IT Docs backend code.\n- No PSA connector code.\n- No direct PSA API calls.\n- No PSA/API/provider secrets.\n- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.\n`;

const checklist = `# Partner Center Final Submission Checklist — PASS261\n\nThis checklist is the human-facing Store packet review. It is intentionally fail-closed.\n\n## 1. Installed-app evidence\n\n- [ ] PASS260 evidence file exists at \`release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json\`.\n- [ ] \`npm run gate:pass-260-installed-recipe-quad-store-smoke\` passes.\n- [ ] No blank panes.\n- [ ] No bottom-only webview rendering.\n- [ ] No orphaned webviews.\n- [ ] No hidden active pane.\n- [ ] Focus pane restores exactly.\n- [ ] Active-pane routing works in Recipe, Split, Tri, Quad, Focus, and restored 1-Up.\n\n## 2. Identity and package truth\n\n- [ ] Partner Center app/package identity is reserved.\n- [ ] Package identity placeholders are removed from the actual submission package.\n- [ ] Package version matches \`2.0.10\` or the current final submission target.\n- [ ] Package hash is recorded.\n- [ ] Generated Store artifacts are not committed to source.\n\n## 3. Listing copy\n\n- [ ] Listing title is accurate.\n- [ ] Short description is accurate.\n- [ ] Description does not claim Store approval before approval exists.\n- [ ] Description does not claim direct-download signing unless trusted signing evidence exists.\n- [ ] Description accurately explains Mission Control, recipes, evidence, and local/browser-side scope.\n\n## 4. Screenshots\n\n- [ ] Screenshots are from the installed app, not a dev-only mock.\n- [ ] Screenshots contain no secrets, tenant IDs, private customer data, private tickets, or private emails.\n- [ ] Screenshots show useful panes, not blank/bottom-only panes.\n- [ ] Screenshots match the package/version being submitted.\n\n## 5. Privacy/support\n\n- [ ] Privacy policy URL is public.\n- [ ] Support URL is public.\n- [ ] Website/download URL is public.\n- [ ] Known issues are accurate.\n- [ ] Support boundaries are truthful.\n\n## 6. Go / no-go\n\n- [ ] PASS261 packet JSON is filled with real values.\n- [ ] \`npm run gate:pass-261-store-submission-packet\` passes.\n- [ ] Operator explicitly approves upload.\n- [ ] Store status remains \`not-submitted\` until upload is actually completed.\n- [ ] Store approval remains \`not-approved\` until Microsoft approval exists.\n`;

const readme = `# PASS261 — Store Submission Packet Finalizer\n\nVersion target: ${targetVersion}\n\nPASS261 adds the final Store submission packet templates and go/no-go gate. It does not claim Microsoft Store submission or approval.\n\n## Run\n\n\`\`\`powershell\nSet-Location C:\\dev\\browser\\app\nnode scripts\\apply-pass261-store-submission-packet-finalizer.mjs\nnpm run verify:pass-261-store-submission-packet-finalizer\n\`\`\`\n\nExpected until real evidence exists:\n\n\`\`\`powershell\nnpm run gate:pass-261-store-submission-packet\n\`\`\`\n\nThe gate should block until the packet is filled with PASS260 installed smoke proof, screenshots, URLs, checksums, and operator approval.\n`;

function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }

function ensurePackage() {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return { packageJsonFound: false, version: targetVersion, changes: [] };
  const pkg = JSON.parse(readText(file));
  const before = pkg.version;
  if (!versionAtLeast(pkg.version, targetVersion)) pkg.version = targetVersion;
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-261-store-submission-packet-finalizer'] = 'node scripts/verify-pass261-store-submission-packet-finalizer.mjs';
  pkg.scripts['gate:pass-261-store-submission-packet'] = 'node scripts/gate-pass261-store-submission-packet.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(packetTemplatePath, JSON.stringify(packetTemplate, null, 2) + '\n');
writeText(screenshotManifestPath, JSON.stringify(screenshotManifest, null, 2) + '\n');
writeText(docsPath, docs);
writeText(checklistPath, checklist);
writeText(readmePath, readme);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass261-store-submission-packet-finalizer-apply-report.json');
const report = {
  pass,
  name: 'Store Submission Packet Finalizer',
  versionTarget: targetVersion,
  appliedAt: new Date().toISOString(),
  packageResult,
  requiredPacketSections,
  packetTemplate: rel(packetTemplatePath),
  screenshotManifest: rel(screenshotManifestPath),
  docs: rel(docsPath),
  checklist: rel(checklistPath),
  storePosture: 'NOT_SUBMITTED_NOT_APPROVED_BLOCKED_UNTIL_PASS260_AND_PASS261_GATES_PASS',
  hardScope: 'Browser-side only. No IT Docs backend code. No PSA connector code. No direct PSA API calls. No secrets.'
};
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log('PASS261_APPLY=PASS');
console.log('PASS261_VERSION=' + packageResult.version);
console.log('PASS261_PACKET_TEMPLATE=' + rel(packetTemplatePath));
console.log('PASS261_SCREENSHOT_MANIFEST=' + rel(screenshotManifestPath));
console.log('PASS261_REPORT=' + rel(reportPath));
