#!/usr/bin/env node
/* Verify PASS261 — Store Submission Packet Finalizer */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.14';
const packetTemplatePath = path.join(root, 'docs', 'store', 'pass261-store-submission-packet.template.json');
const screenshotManifestPath = path.join(root, 'docs', 'store', 'pass261-store-screenshot-manifest.template.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS261-store-submission-packet-finalizer.md');
const checklistPath = path.join(root, 'docs', 'store', 'PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md');
const gateScriptPath = path.join(root, 'scripts', 'gate-pass261-store-submission-packet.mjs');
const packagePath = path.join(root, 'package.json');

const requiredSections = ['packageIdentityTruth','storeListingTruth','privacySupportTruth','screenshotManifest','pass260InstalledSmokeEvidence','checksumsAndProvenance','knownIssuesTruth','signingTruth','goNoGo'];
const requiredScreenshots = ['normal-browser-mode','mission-control-overview','quad-view-recipe-started','runbook-rail-and-evidence','operator-command-center','settings-about-unsigned-preview-truth'];
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build','release-candidate']);

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function readJson(file) { return JSON.parse(readText(file)); }
function fail(message, details = []) {
  console.error('PASS261_STORE_SUBMISSION_PACKET_FINALIZER=FAIL');
  console.error(message);
  for (const detail of details) console.error('- ' + detail);
  process.exit(1);
}
function exists(file) { if (!fs.existsSync(file)) fail('Missing required PASS261 file.', [rel(file)]); }
function walk(dir, predicate, hits = []) {
  if (!fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, hits);
    else if (predicate(full)) hits.push(full);
  }
  return hits;
}
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }

for (const file of [packetTemplatePath, screenshotManifestPath, docsPath, checklistPath, gateScriptPath]) exists(file);
if (fs.existsSync(packagePath)) {
  const pkg = readJson(packagePath);
  if (!versionAtLeast(pkg.version, requiredVersion)) fail('package.json version must be at least PASS261 target.', [pkg.version || '(missing)']);
  if (pkg.scripts?.['verify:pass-261-store-submission-packet-finalizer'] !== 'node scripts/verify-pass261-store-submission-packet-finalizer.mjs') fail('package.json missing PASS261 verifier script.');
  if (pkg.scripts?.['gate:pass-261-store-submission-packet'] !== 'node scripts/gate-pass261-store-submission-packet.mjs') fail('package.json missing PASS261 gate script.');
}

const packet = readJson(packetTemplatePath);
if (packet.schemaVersion !== 1 || packet.pass !== 'PASS261') fail('PASS261 packet template metadata invalid.');
if (packet.versionTarget !== requiredVersion) fail('PASS261 packet template version mismatch.', [packet.versionTarget]);
for (const section of requiredSections) if (!(section in packet)) fail('PASS261 packet template missing section.', [section]);
if (packet.status !== 'BLOCKED_PENDING_PASS260_INSTALLED_SMOKE_AND_OPERATOR_REVIEW') fail('PASS261 packet template must be blocked by default.');
if (packet.storeListingTruth?.microsoftStoreSubmissionClaim !== 'not-submitted') fail('PASS261 packet must not claim Microsoft Store submission.');
if (packet.storeListingTruth?.microsoftStoreApprovalClaim !== 'not-approved') fail('PASS261 packet must not claim Microsoft Store approval.');
if (packet.pass260InstalledSmokeEvidence?.gateCommand !== 'npm run gate:pass-260-installed-recipe-quad-store-smoke') fail('PASS261 packet must point at PASS260 installed smoke gate.');
if (packet.goNoGo?.status !== 'NO_GO' || packet.goNoGo?.readyForPartnerCenterUpload !== false || packet.goNoGo?.operatorApproved !== false) fail('PASS261 packet go/no-go must be fail-closed by default.');
if (!String(packet.signingTruth?.directMsiExeSigningStatus || '').includes('unsigned-preview')) fail('PASS261 signing truth must preserve unsigned-preview direct MSI/EXE posture.');

const shots = readJson(screenshotManifestPath);
if (shots.schemaVersion !== 1 || shots.pass !== 'PASS261') fail('PASS261 screenshot manifest metadata invalid.');
if (shots.versionTarget !== requiredVersion) fail('PASS261 screenshot manifest version mismatch.', [shots.versionTarget]);
if (shots.status !== 'TEMPLATE_PENDING_INSTALLED_APP_SCREENSHOTS') fail('PASS261 screenshot manifest must be pending by default.');
for (const id of requiredScreenshots) if (!shots.screenshots?.some((entry) => entry.id === id && entry.required === true)) fail('PASS261 screenshot manifest missing required screenshot.', [id]);
for (const entry of shots.screenshots || []) {
  if (entry.source !== 'installed-app') fail('PASS261 screenshots must be captured from installed app.', [entry.id]);
  if (entry.noSecrets !== false) fail('PASS261 screenshot template should require real no-secret review, not preclaim it.', [entry.id]);
}

const docsText = readText(docsPath);
for (const phrase of ['does **not** claim','not-submitted','not-approved','PASS260 installed','No direct PSA API calls']) {
  if (!docsText.includes(phrase)) fail('PASS261 docs missing truth language.', [phrase]);
}
const checklistText = readText(checklistPath);
for (const phrase of ['No blank panes','No bottom-only webview rendering','Operator explicitly approves upload','Store approval remains `not-approved`']) {
  if (!checklistText.includes(phrase)) fail('PASS261 checklist missing required review item.', [phrase]);
}
const gateText = readText(gateScriptPath);
for (const token of ['PASS261_STORE_SUBMISSION_PACKET_GATE=BLOCKED','readyForPartnerCenterUpload','operatorApproved','not-submitted','not-approved','PASS260']) {
  if (!gateText.includes(token)) fail('PASS261 gate script missing fail-closed token.', [token]);
}

const forbiddenHits = [];
const sourceFiles = walk(root, (file) => /\.(mjs|js|ts|tsx|json|md)$/i.test(file));
const forbiddenPatterns = [
  { re: /fetch\s*\(\s*['\"]https?:\/\/[^'\"]*(connectwise|autotask|halo|syncro|zendesk|freshservice|psa)/i, label: 'direct PSA/provider fetch' },
  { re: /(psa[_-]?api[_-]?key|client_secret|refresh_token|BEGIN PRIVATE KEY|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['\"][^'\"]{6,}/i, label: 'secret-like material' },
];
for (const file of sourceFiles) {
  const text = readText(file);
  for (const item of forbiddenPatterns) {
    if (item.re.test(text)) forbiddenHits.push(`${rel(file)}: ${item.label}`);
  }
}
if (forbiddenHits.length) fail('PASS261 detected forbidden direct integration/secret/false-claim patterns.', forbiddenHits.slice(0, 80));
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS261_STORE_SUBMISSION_PACKET_FINALIZER=PASS');
console.log('PASS261_VERSION=' + requiredVersion);
console.log('PASS261_PACKET_TEMPLATE=' + rel(packetTemplatePath));
console.log('PASS261_SCREENSHOT_MANIFEST=' + rel(screenshotManifestPath));
console.log('PASS261_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS261_GO_NO_GO_DEFAULT=NO_GO_UNTIL_PASS260_AND_OPERATOR_APPROVAL');
