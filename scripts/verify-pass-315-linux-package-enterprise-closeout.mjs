import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS315';
const prev = 'PASS314';
const required = [
  'src/shared/pass315-linux-package-enterprise-closeout-contract.ts',
  'docs/qa/PASS315-linux-package-enterprise-closeout.md',
  'release-candidate/generated/pass315-linux-package-enterprise-closeout-report.json',
  'release-candidate/generated/pass315-linux-package-enterprise-closeout-manifest.json',
  'release-candidate/generated/pass314-windows-installer-enterprise-closeout-report.json'
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`${pass} missing required artifact(s):`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}
const prevReport = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass314-windows-installer-enterprise-closeout-report.json'), 'utf8'));
if (prevReport.pass !== prev || prevReport.status !== 'PASS') {
  console.error(`${pass} regression anchor failed: ${prev} report is not PASS.`);
  process.exit(1);
}
if (prevReport.signedReleaseClaim !== false || prevReport.gaReleaseClaim !== false || prevReport.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} regression anchor failed: previous pass made an invalid Store, GA, or signing claim.`);
  process.exit(1);
}
const contract = fs.readFileSync(path.join(root, 'src/shared/pass315-linux-package-enterprise-closeout-contract.ts'), 'utf8');
for (const token of [
  'PASS315_LINUX_PACKAGE_ENTERPRISE_CLOSEOUT_PASS',
  'browser-side-only',
  'navLinkBrowser',
  'rgba(96, 255, 218, 0.92)',
  'No IT Docs backend code',
  'No PSA connector code',
  'No direct PSA API calls',
  'No generated installers committed',
  "AppImage",
  "RPM",
  "DEB",
  "desktop file",
  "icon",
  "metadata",
  "launch",
  "uninstall/remove docs",
  "checksum docs",
  "no unsupported signing claim",
  'No Store/GA/signed-release claim without real evidence'
]) {
  if (!contract.includes(token)) {
    console.error(`${pass} contract missing token: ${token}`);
    process.exit(1);
  }
}
const report = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass315-linux-package-enterprise-closeout-report.json'), 'utf8'));
if (report.pass !== pass || report.status !== 'PASS' || report.scope !== 'browser-side-only') {
  console.error(`${pass} report did not satisfy gate shape.`);
  process.exit(1);
}
if (report.brandAccent?.token !== 'navLinkBrowser' || report.brandAccent?.value !== 'rgba(96, 255, 218, 0.92)') {
  console.error(`${pass} browser brand accent truth is missing or incorrect.`);
  process.exit(1);
}
for (const assertion of ["linuxPackageChecklistExists", "appImageRpmDebCovered", "desktopFileCovered", "iconMetadataCovered", "installRemoveDocsCovered", "checksumDocsCovered", "unsupportedSigningClaimsBlocked", "signedReleaseNotClaimed", "storeSubmissionNotClaimed", "gaReleaseNotClaimed", "browserSideOnlyScopePreserved"]) {
  if (report.assertions?.[assertion] !== true) {
    console.error(`${pass} assertion is not true: ${assertion}`);
    process.exit(1);
  }
}
if (report.signedReleaseClaim !== false || report.gaReleaseClaim !== false || report.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} must not make signed-release, GA, or Store claims.`);
  process.exit(1);
}
if (report.nextPass !== 'PASS316 Enterprise RC / GA Decision Gate') {
  console.error(`${pass} must hand off to PASS316 Enterprise RC / GA Decision Gate.`);
  process.exit(1);
}

console.log('PASS315_LINUX_PACKAGE_ENTERPRISE_CLOSEOUT=PASS');
