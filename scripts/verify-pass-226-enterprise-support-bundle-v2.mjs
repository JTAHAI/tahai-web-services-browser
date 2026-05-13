#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
function walk(dir, results = []) {
  const full = file(dir);
  if (!fs.existsSync(full)) return results;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git', '.next', 'out', 'tmp', 'temp', 'release'].includes(entry.name)) continue;
    const rel = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) walk(rel, results);
    else results.push(rel);
  }
  return results;
}
function checkPackageWiring() {
  const pkgText = read('package.json');
  let pkg = {};
  try { pkg = JSON.parse(pkgText); } catch (error) { failures.push(`package.json invalid JSON: ${error.message}`); }
  if (!pkg.scripts?.['verify:pass-226-enterprise-support-bundle-v2']) {
    failures.push('package.json: missing verify:pass-226-enterprise-support-bundle-v2 script');
  }
  if (typeof pkg.scripts?.['verify:release-blockers'] === 'string' && !pkg.scripts['verify:release-blockers'].includes('verify:pass-226-enterprise-support-bundle-v2')) {
    failures.push('package.json: verify:release-blockers does not include PASS226 verifier');
  }
}
function checkContract() {
  const rel = 'src/shared/enterprise-support-bundle-v2-contract.ts';
  for (const token of [
    'PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_ID',
    'PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_VERSION',
    'PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS',
    'PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES',
    'PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT',
    'redacted-support',
    'internal-diagnostics',
    'public-triage',
    'app-version',
    'os-runtime',
    'package-type',
    'policy-truth',
    'install-truth',
    'recent-non-secret-errors',
    'mission-diagnostics',
    'browser-settings',
    'redaction-report',
    'local-data-inventory',
    'build-provenance-summary',
    'manual-proof-boundary',
    'authorization',
    'cookie',
    'set-cookie',
    'access_token',
    'refresh_token',
    'client_secret',
    'x-api-key',
    'psa_api_key',
    'aws_secret_access_key',
    'private_key',
    'redactedByDefault',
    'noRawTokensOrCookies',
    'noAuthorizationHeaders',
    'noPrivateKeysOrSigningSecrets',
    'noMissionRawNoteDump',
    'noBrowsingHistoryDump',
    'policyTruthRequired',
    'installTruthRequired',
    'packageTypeRequired',
    'recentErrorsMustBeNonSecret',
    'supportBundleGenerationRequiresUserAction',
    'supportBundleExportUsesAppOwnedTempOrUserSelectedPath',
    'redactionReportMustContainCountsOnly',
    'manualRuntimeProofRequiredForOneClickExport',
    'supportBundleDoesNotClaimInstalledSmokeSuccess',
    'supportBundleDoesNotClaimGAReadiness'
  ]) requireIncludes(rel, token, `missing support bundle v2 contract token ${token}`);

  const sectionCount = (read(rel).match(/key: '/g) || []).length;
  if (sectionCount < 12) failures.push(`${rel}: expected at least 12 required support bundle sections, found ${sectionCount}`);
}
function checkImplementation() {
  const rel = 'src/shared/enterprise-support-bundle-v2.ts';
  for (const token of [
    'pass226GetEnterpriseSupportBundleV2Contract',
    'pass226GetRequiredSupportBundleSections',
    'pass226IsForbiddenSupportBundleKey',
    'pass226ClassifySupportBundleField',
    'pass226RedactSupportBundleString',
    'pass226SanitizeSupportBundleSections',
    'pass226ValidateSupportBundleSections',
    'pass226BuildSupportBundleManifest',
    'pass226SummarizeSupportBundleValidation',
    'BLOCKING_SECRET_VALUE_PATTERNS',
    'REDACT_VALUE_PATTERNS',
    'bearer-token',
    'auth-or-cookie-header',
    'private-key-block',
    'github-token',
    'aws-access-key-id',
    'secret-field-value',
    'redacted-email',
    'redacted-ipv4',
    'redacted-ipv6',
    'redacted-user-path',
    'rawSecretMaterialIncluded: false',
    'sourceSideContractOnly: true',
    'installedWindowsSmokeClaimed: false',
    'installedLinuxSmokeClaimed: false',
    'gaReadinessClaimed: false'
  ]) requireIncludes(rel, token, `missing support bundle v2 implementation token ${token}`);
}
function checkDocs() {
  for (const rel of ['docs/enterprise-support-bundle-v2.md', 'docs/qa/pass226-enterprise-support-bundle-v2.md', 'README-PASS226.md']) {
    requireIncludes(rel, 'PASS226', 'missing PASS226 marker');
    requireIncludes(rel, 'Enterprise Support Bundle v2', 'missing pass title');
    requireIncludes(rel, 'redacted', 'missing redaction language');
    requireIncludes(rel, 'policy truth', 'missing policy truth language');
    requireIncludes(rel, 'install truth', 'missing install truth language');
    requireIncludes(rel, 'package type', 'missing package type language');
    requireIncludes(rel, 'mission diagnostics', 'missing mission diagnostics language');
    requireIncludes(rel, 'redaction report', 'missing redaction report language');
    requireIncludes(rel, 'no installed-app smoke success', 'missing false-claim boundary');
  }

  requireIncludes('docs/enterprise-support-bundle-v2.md', 'app version', 'missing app version section');
  requireIncludes('docs/enterprise-support-bundle-v2.md', 'OS/runtime', 'missing OS/runtime section');
  requireIncludes('docs/enterprise-support-bundle-v2.md', 'recent non-secret errors', 'missing recent errors section');
  requireIncludes('docs/enterprise-support-bundle-v2.md', 'local data inventory', 'missing local data inventory section');
  requireIncludes('docs/enterprise-support-bundle-v2.md', 'manual proof boundary', 'missing manual proof boundary section');
  requireIncludes('docs/qa/pass226-enterprise-support-bundle-v2.md', 'manual Windows/Linux proof still required', 'missing manual proof language');
}
function checkGeneratedArtifacts() {
  const generatedSupportBundleRe = /(?:^|\/)(?:support-bundles?|diagnostics?|artifacts|release|dist|out)\/.+\.(?:zip|tar|tgz|json|ndjson|log)$/i;
  const forbiddenSourcePathRe = /(?:^|\/)(?:.*support-bundle.*\.(?:zip|tar|tgz)|.*diagnostic.*bundle.*\.(?:zip|tar|tgz))$/i;
  for (const rel of walk('.')) {
    const normalized = rel.replace(/^\.\//, '');
    if (generatedSupportBundleRe.test(normalized) || forbiddenSourcePathRe.test(normalized)) {
      failures.push(`Generated support bundle artifact must not be committed: ${normalized}`);
    }
  }
}
function checkFalseClaims() {
  const claimRe = /\b(?:one-click support bundle export works|installed support bundle verified|installed-app smoke success|GA ready|public GA ready|support bundle runtime verified)\b/i;
  const qualifierRe = /\b(?:not claimed|no installed-app smoke success|manual proof required|source-side|cannot prove|must not claim|still required|blocked until installed)\b/i;
  for (const rel of walk('.')) {
    if (!/\.(ts|tsx|js|mjs|cjs|json|md|txt|yml|yaml|html|css)$/i.test(rel)) continue;
    const text = read(rel.replace(/^\.\//, ''));
    if (claimRe.test(text) && !qualifierRe.test(text)) failures.push(`${rel}: possible unsupported support bundle / GA claim`);
  }
}
function checkSecretFixturesDoNotIncludeLiveSecrets() {
  const secretPattern = /(?:-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\-/]{24,}|\bghp_[A-Za-z0-9_]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b)/i;
  for (const rel of walk('.')) {
    if (!/\.(ts|tsx|js|mjs|cjs|json|md|txt|yml|yaml|html|css)$/i.test(rel)) continue;
    const text = read(rel.replace(/^\.\//, ''));
    if (secretPattern.test(text)) failures.push(`${rel}: live-looking secret material detected in source/support bundle fixtures`);
  }
}

for (const rel of [
  'src/shared/enterprise-support-bundle-v2-contract.ts',
  'src/shared/enterprise-support-bundle-v2.ts',
  'scripts/apply-pass226-enterprise-support-bundle-v2.mjs',
  'scripts/verify-pass-226-enterprise-support-bundle-v2.mjs',
  'docs/enterprise-support-bundle-v2.md',
  'docs/qa/pass226-enterprise-support-bundle-v2.md',
  'README-PASS226.md'
]) {
  if (!exists(rel)) failures.push(`Missing required PASS226 file: ${rel}`);
}

checkPackageWiring();
checkContract();
checkImplementation();
checkDocs();
checkGeneratedArtifacts();
checkFalseClaims();
checkSecretFixturesDoNotIncludeLiveSecrets();

if (failures.length) {
  console.error('[PASS226][FAIL] Enterprise Support Bundle v2 guard failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[PASS226][OK] Enterprise Support Bundle v2 source contract, docs, redaction boundary, false-claim guard, and release-blocker wiring verified.');
