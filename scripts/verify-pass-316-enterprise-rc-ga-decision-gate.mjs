import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS316';
const prev = 'PASS315';
const required = [
  'src/shared/pass316-enterprise-rc-ga-decision-gate-contract.ts',
  'docs/qa/PASS316-enterprise-rc-ga-decision-gate.md',
  'release-candidate/generated/pass316-enterprise-rc-ga-decision-gate-report.json',
  'release-candidate/generated/pass316-enterprise-rc-ga-decision-gate-manifest.json',
  'release-candidate/generated/pass315-linux-package-enterprise-closeout-report.json'
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`${pass} missing required artifact(s):`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}
const prevReport = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass315-linux-package-enterprise-closeout-report.json'), 'utf8'));
if (prevReport.pass !== prev || prevReport.status !== 'PASS') {
  console.error(`${pass} regression anchor failed: ${prev} report is not PASS.`);
  process.exit(1);
}
if (prevReport.signedReleaseClaim !== false || prevReport.gaReleaseClaim !== false || prevReport.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} regression anchor failed: previous pass made an invalid Store, GA, or signing claim.`);
  process.exit(1);
}
const contract = fs.readFileSync(path.join(root, 'src/shared/pass316-enterprise-rc-ga-decision-gate-contract.ts'), 'utf8');
for (const token of [
  'PASS316_ENTERPRISE_RC_GA_DECISION_GATE_PASS',
  'browser-side-only',
  'navLinkBrowser',
  'rgba(96, 255, 218, 0.92)',
  'No IT Docs backend code',
  'No PSA connector code',
  'No direct PSA API calls',
  'No generated installers committed',
  "normal browser runtime",
  "webview lifecycle",
  "clickable website",
  "popup policy",
  "navigation parity",
  "overlay state",
  "Mission Control runtime",
  "evidence/export/redaction",
  "Electron security",
  "IPC contract",
  "policy framework",
  "privacy inventory",
  "support bundle",
  "crash recovery",
  "Windows installed smoke",
  "Linux package smoke",
  "SBOM/provenance/checksums",
  "known issues",
  "not-submitted-not-approved",
  'No Store/GA/signed-release claim without real evidence'
]) {
  if (!contract.includes(token)) {
    console.error(`${pass} contract missing token: ${token}`);
    process.exit(1);
  }
}
const report = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass316-enterprise-rc-ga-decision-gate-report.json'), 'utf8'));
if (report.pass !== pass || report.status !== 'PASS' || report.scope !== 'browser-side-only') {
  console.error(`${pass} report did not satisfy gate shape.`);
  process.exit(1);
}
if (report.brandAccent?.token !== 'navLinkBrowser' || report.brandAccent?.value !== 'rgba(96, 255, 218, 0.92)') {
  console.error(`${pass} browser brand accent truth is missing or incorrect.`);
  process.exit(1);
}
for (const assertion of ["normalBrowserRuntimeGateReferenced", "webviewLifecycleGateReferenced", "clickableWebsiteGateReferenced", "popupPolicyGateReferenced", "navigationParityGateReferenced", "overlayStateGateReferenced", "missionControlRuntimeGateReferenced", "evidenceExportRedactionGateReferenced", "electronSecurityGateReferenced", "ipcContractGateReferenced", "policyFrameworkGateReferenced", "privacyInventoryGateReferenced", "supportBundleGateReferenced", "crashRecoveryGateReferenced", "windowsInstalledSmokeGateReferenced", "linuxPackageSmokeGateReferenced", "sbomProvenanceChecksumGateReferenced", "knownIssuesTruthRequired", "signedReleaseNotClaimed", "storeSubmissionNotClaimed", "gaReleaseNotClaimed", "browserSideOnlyScopePreserved"]) {
  if (report.assertions?.[assertion] !== true) {
    console.error(`${pass} assertion is not true: ${assertion}`);
    process.exit(1);
  }
}
if (report.signedReleaseClaim !== false || report.gaReleaseClaim !== false || report.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} must not make signed-release, GA, or Store claims.`);
  process.exit(1);
}
if (report.remainingRemediationPasses !== 0) {
  console.error(`${pass} must close the remediation lane with zero remaining passes.`);
  process.exit(1);
}
if (!String(report.decision || '').includes('PUBLIC_GA_CLAIM_BLOCKED')) {
  console.error(`${pass} must preserve truthful GA/signing/Store blocking language.`);
  process.exit(1);
}

console.log('PASS316_ENTERPRISE_RC_GA_DECISION_GATE=PASS');
