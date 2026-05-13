#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const failures = [];
function file(rel) { return path.join(repo, rel); }
function exists(rel) { return fs.existsSync(file(rel)); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}
function requireIncludes(rel, needle, message) {
  const text = read(rel);
  if (!text.includes(needle)) failures.push(`${rel}: ${message || `missing ${needle}`}`);
}
function requireRegex(rel, regex, message) {
  const text = read(rel);
  if (!regex.test(text)) failures.push(`${rel}: ${message}`);
}
function parseJson(rel) {
  const text = read(rel);
  try { return JSON.parse(text); }
  catch (error) { failures.push(`${rel}: invalid JSON: ${error.message}`); return null; }
}
function walk(dir, results = []) {
  const full = file(dir);
  if (!fs.existsSync(full)) return results;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git', '.next', 'out', 'tmp', 'temp', 'release', 'release-msix', 'msix-output', '.msix-work', '.msix-cache', 'store-submission-output', 'store-assets-generated', 'store-listing-generated', 'store-submission-generated', 'ga-store-deploy-decision-generated', 'store-deploy-decision-output', 'production-release-output', 'public-ga-generated', 'store-review-generated'].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(rel, results);
    else results.push(rel.replace(/^\.\//, ''));
  }
  return results;
}
function checkPackageWiring() {
  const pkg = parseJson('package.json');
  if (!pkg) return;
  const scripts = pkg.scripts || {};
  if (pkg.version !== '1.8.30') failures.push(`package.json: version must remain 1.8.30 for PASS230 unless a separate explicit version increment is made; found ${pkg.version}`);
  if (scripts['package:win:msix'] !== 'node scripts/package-win-msix-lane.mjs') failures.push('package.json: package:win:msix must remain wired to scripts/package-win-msix-lane.mjs');
  if (scripts['prepare:win:msix-manifest'] !== 'node scripts/render-msix-manifest-readiness.mjs') failures.push('package.json: prepare:win:msix-manifest must remain wired to scripts/render-msix-manifest-readiness.mjs');
  if (scripts['prepare:store-submission-packet'] !== 'node scripts/render-store-submission-packet.mjs') failures.push('package.json: prepare:store-submission-packet must remain wired to scripts/render-store-submission-packet.mjs');
  if (scripts['prepare:ga-store-deploy-decision-gate'] !== 'node scripts/render-ga-store-deploy-decision-gate.mjs') failures.push('package.json: prepare:ga-store-deploy-decision-gate must be wired to scripts/render-ga-store-deploy-decision-gate.mjs');
  if (scripts['verify:pass-230-ga-store-deploy-decision-gate'] !== 'node scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs') failures.push('package.json: verify:pass-230-ga-store-deploy-decision-gate must be wired to scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs');
  const releaseBlockers = scripts['verify:release-blockers'] || '';
  if (!releaseBlockers.includes('verify:pass-230-ga-store-deploy-decision-gate')) failures.push('package.json: verify:release-blockers must include verify:pass-230-ga-store-deploy-decision-gate');
}
function checkGateConfig() {
  const gate = parseJson('config/ga-store-deploy-decision-gate.example.json');
  if (!gate) return;
  if (gate.schemaVersion !== 1) failures.push('config/ga-store-deploy-decision-gate.example.json: schemaVersion must be 1');
  if (gate.pass !== 'PASS230') failures.push('config/ga-store-deploy-decision-gate.example.json: pass must be PASS230');
  if (gate.name !== 'GA / Store Deploy Decision Gate') failures.push('config/ga-store-deploy-decision-gate.example.json: name mismatch');
  if (gate.sourceSideGateOnly !== true) failures.push('config/ga-store-deploy-decision-gate.example.json: sourceSideGateOnly must be true');
  if (gate.noNewFeatures !== true) failures.push('config/ga-store-deploy-decision-gate.example.json: noNewFeatures must be true');
  for (const key of ['publicGaAllowed', 'microsoftStoreSubmissionAllowed', 'broadPublicInstallerPushAllowed', 'directDownloadTrustedSigningClaimAllowed']) {
    if (gate.defaultDecision?.[key] !== false) failures.push(`config/ga-store-deploy-decision-gate.example.json: defaultDecision.${key} must be false`);
    if (gate.decisionOutputs?.defaultSourceSideOutcome?.[key] !== false) failures.push(`config/ga-store-deploy-decision-gate.example.json: decisionOutputs.defaultSourceSideOutcome.${key} must be false`);
  }
  for (const key of ['thisPassDoesNotAddFeatures', 'thisPassDoesNotSubmitToStore', 'thisPassDoesNotCreateMsixUpload', 'thisPassDoesNotLoadPartnerCenterCredentials', 'thisPassDoesNotClaimStoreApproval', 'thisPassDoesNotClaimDirectDownloadSigning', 'thisPassDoesNotCommitGeneratedArtifacts', 'thisPassDoesNotAddSecretsOrCertificates']) {
    if (gate.hardBoundaries?.[key] !== true) failures.push(`config/ga-store-deploy-decision-gate.example.json: hardBoundaries.${key} must be true`);
  }
  const requiredGateIds = ['g1-full-ux-hardening', 'g2-enterprise-security-data', 'g3-release-evidence', 'g4-external-distribution'];
  if (!Array.isArray(gate.requiredGateEvidence) || gate.requiredGateEvidence.length < requiredGateIds.length) failures.push('config/ga-store-deploy-decision-gate.example.json: requiredGateEvidence must include G1-G4');
  for (const id of requiredGateIds) {
    const item = gate.requiredGateEvidence?.find((entry) => entry.id === id);
    if (!item) { failures.push(`config/ga-store-deploy-decision-gate.example.json: missing gate ${id}`); continue; }
    if (item.required !== true) failures.push(`config/ga-store-deploy-decision-gate.example.json: ${id}.required must be true`);
    if (!String(item.defaultStatus || '').startsWith('blocked-')) failures.push(`config/ga-store-deploy-decision-gate.example.json: ${id}.defaultStatus must be blocked-*`);
    if (!Array.isArray(item.sourcePasses) || item.sourcePasses.length < 4) failures.push(`config/ga-store-deploy-decision-gate.example.json: ${id}.sourcePasses must list prior passes`);
    if (!Array.isArray(item.mustProve) || item.mustProve.length < 4) failures.push(`config/ga-store-deploy-decision-gate.example.json: ${id}.mustProve must list proof requirements`);
  }
  for (const command of [
    'npm run prepare:win:msix-manifest',
    'npm run prepare:store-submission-packet',
    'npm run prepare:ga-store-deploy-decision-gate',
    'npm run verify:pass-230-ga-store-deploy-decision-gate',
    'npm run verify:release-blockers',
    'npm run build'
  ]) {
    if (!gate.requiredCommands?.includes(command)) failures.push(`config/ga-store-deploy-decision-gate.example.json: requiredCommands missing ${command}`);
  }
  if (!Array.isArray(gate.manualEvidenceChecklist) || gate.manualEvidenceChecklist.length < 8) failures.push('config/ga-store-deploy-decision-gate.example.json: manualEvidenceChecklist must include at least 8 items');
}
function checkRenderScript() {
  const result = spawnSync(process.execPath, ['scripts/render-ga-store-deploy-decision-gate.mjs'], { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) failures.push(`render-ga-store-deploy-decision-gate.mjs failed:\n${result.stdout}${result.stderr}`);
  if (!String(result.stdout || '').includes('Default source-side decision remains blocked')) failures.push('render-ga-store-deploy-decision-gate.mjs: expected blocked default decision output');
}
function checkDocs() {
  for (const rel of ['docs/ga-store-deploy-decision-gate.md', 'docs/qa/pass230-ga-store-deploy-decision-gate.md', 'README-PASS230.md']) {
    requireIncludes(rel, 'PASS230', 'missing PASS230 marker');
    requireIncludes(rel, 'GA / Store Deploy Decision Gate', 'missing gate name');
    requireIncludes(rel, 'does not add features', 'missing no-new-features boundary');
    requireIncludes(rel, 'does not submit to Microsoft Store', 'missing Store submission boundary');
    requireIncludes(rel, 'does not create `.msixupload`', 'missing msixupload boundary');
    requireIncludes(rel, 'does not load Partner Center credentials', 'missing Partner Center credential boundary');
    requireIncludes(rel, 'does not claim Store approval', 'missing Store approval false-claim boundary');
    requireIncludes(rel, 'does not claim direct-download trusted signing', 'missing direct-download signing boundary');
    requireIncludes(rel, '1.8.30', 'missing version truth');
    requireIncludes(rel, 'verify:pass-230-ga-store-deploy-decision-gate', 'missing verifier command');
  }
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'G1 — Full UX Hardening Gate', 'missing G1 description');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'G2 — Enterprise Security and Data Gate', 'missing G2 description');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'G3 — Release Evidence Gate', 'missing G3 description');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'G4 — External Distribution and Signing Gate', 'missing G4 description');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'publicGaAllowed: false', 'missing default publicGaAllowed false');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'microsoftStoreSubmissionAllowed: false', 'missing default Store submission false');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'broadPublicInstallerPushAllowed: false', 'missing default broad installer false');
  requireIncludes('docs/ga-store-deploy-decision-gate.md', 'directDownloadTrustedSigningClaimAllowed: false', 'missing default signing claim false');
}
function checkGitignore() {
  const rel = '.gitignore';
  for (const token of [
    'PASS230 GA / Store deploy decision generated artifacts',
    'ga-store-deploy-decision-generated/',
    'ga-store-deploy-decision-summary.json',
    'store-deploy-decision-output/',
    'production-release-output/',
    'public-ga-generated/',
    'store-review-generated/'
  ]) requireIncludes(rel, token, `missing generated artifact ignore token ${token}`);
}
function checkNoGeneratedArtifacts() {
  const forbiddenPathRe = /(?:^|\/)(?:.+\.(?:msix|msixbundle|msixupload|msixsym|appx|appxbundle|appxupload|appinstaller|pfx|pvk|spc|cer|pri|exe|msi|dmg|appimage)|resources\.pri|Package\.StoreAssociation\.xml|StoreAssociation\.xml|AppxManifest\.xml|package-identity\.json|store-identity\.json|PartnerCenter.*\.json|partner-center.*\.json|ga-store-deploy-decision-summary\.json|public-ga-approval\.json|store-review-result\.json)$/i;
  for (const rel of walk('.')) {
    const normalized = rel.replace(/^\.\//, '');
    if (normalized === 'config/package-identity.example.json') continue;
    if (normalized === 'config/msix-manifest.template.xml') continue;
    if (forbiddenPathRe.test(normalized)) failures.push(`Generated/package/signing/Store artifact must not be committed: ${normalized}`);
  }
}
function checkNoSecretsOrUnsupportedClaims() {
  const dangerousContentRe = /(?:-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----|PRIVATEKEYBLOB|PFXCERTIFICATE|client_secret\s*[:=]\s*['\"][^'\"]+|PartnerCenterRefreshToken|TenantSecret|AZURE_CLIENT_SECRET\s*=|refresh_token\s*[:=]\s*['\"][^'\"]+)/i;
  const unsupportedClaimRe = /\b(?:submitted to (?:the )?Store|Store submission completed|Microsoft Store approved|Store approved|\.msixupload created|direct-download package is signed|trusted public signed installer|signed MSI|signed EXE|signed MSIX|public GA release is ready|public GA is ready|broad public installer push is approved)\b/i;
  const qualifierRe = /\b(?:does not|not |blocked|until|unless|must not|source-side|future|manual evidence|external approvals|accurately described|false|no .*claim|without manual evidence)\b/i;
  for (const rel of walk('.')) {
    if (!/\.(ts|tsx|js|mjs|cjs|json|md|txt|yml|yaml|html|css|xml|gitignore)$/i.test(rel)) continue;
    if (/scripts\/verify-pass-\d+.*\.mjs$/.test(rel)) continue;
    const text = read(rel);
    if (dangerousContentRe.test(text)) failures.push(`${rel}: signing secret or Partner Center secret-looking material detected`);
    if (unsupportedClaimRe.test(text) && !qualifierRe.test(text)) failures.push(`${rel}: possible unsupported Store/MSIX/signing/GA claim`);
  }
}

for (const rel of [
  'scripts/apply-pass230-ga-store-deploy-decision-gate.mjs',
  'scripts/render-ga-store-deploy-decision-gate.mjs',
  'scripts/verify-pass-230-ga-store-deploy-decision-gate.mjs',
  'config/ga-store-deploy-decision-gate.example.json',
  'docs/ga-store-deploy-decision-gate.md',
  'docs/qa/pass230-ga-store-deploy-decision-gate.md',
  'README-PASS230.md',
  'scripts/package-win-msix-lane.mjs',
  'scripts/render-msix-manifest-readiness.mjs',
  'scripts/render-store-submission-packet.mjs',
  'config/msix-store-readiness.example.json',
  'config/msix-manifest.template.xml',
  'config/store-listing-submission-packet.example.json',
  'docs/microsoft-store-listing-submission-packet.md'
]) {
  if (!exists(rel)) failures.push(`Missing required PASS230/PASS229/PASS228/PASS227 file: ${rel}`);
}

checkPackageWiring();
checkGateConfig();
checkRenderScript();
checkDocs();
checkGitignore();
checkNoGeneratedArtifacts();
checkNoSecretsOrUnsupportedClaims();

if (failures.length) {
  console.error('[PASS230][FAIL] GA / Store Deploy Decision Gate verifier failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[PASS230][OK] GA / Store Deploy Decision Gate guard verified. Default release decision remains blocked until manual evidence and external approvals exist.');
