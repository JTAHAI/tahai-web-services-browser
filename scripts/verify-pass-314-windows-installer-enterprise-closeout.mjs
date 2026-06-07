import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS314';
const prev = 'PASS313';
const required = [
  'src/shared/pass314-windows-installer-enterprise-closeout-contract.ts',
  'docs/qa/PASS314-windows-installer-enterprise-closeout.md',
  'release-candidate/generated/pass314-windows-installer-enterprise-closeout-report.json',
  'release-candidate/generated/pass314-windows-installer-enterprise-closeout-manifest.json',
  'release-candidate/generated/pass313-signing-provenance-checksum-gate-report.json'
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`${pass} missing required artifact(s):`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}
const prevReport = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass313-signing-provenance-checksum-gate-report.json'), 'utf8'));
if (prevReport.pass !== prev || prevReport.status !== 'PASS') {
  console.error(`${pass} regression anchor failed: ${prev} report is not PASS.`);
  process.exit(1);
}
if (prevReport.signedReleaseClaim !== false || prevReport.gaReleaseClaim !== false || prevReport.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} regression anchor failed: previous pass made an invalid Store, GA, or signing claim.`);
  process.exit(1);
}
const contract = fs.readFileSync(path.join(root, 'src/shared/pass314-windows-installer-enterprise-closeout-contract.ts'), 'utf8');
for (const token of [
  'PASS314_WINDOWS_INSTALLER_ENTERPRISE_CLOSEOUT_PASS',
  'browser-side-only',
  'navLinkBrowser',
  'rgba(96, 255, 218, 0.92)',
  'No IT Docs backend code',
  'No PSA connector code',
  'No direct PSA API calls',
  'No generated installers committed',
  "MSI/NSIS install",
  "upgrade",
  "uninstall",
  "shortcuts",
  "icons",
  "Start menu",
  "taskbar",
  "version truth",
  "user data retention",
  "no Electron branding leak",
  "installed smoke evidence template",
  'No Store/GA/signed-release claim without real evidence'
]) {
  if (!contract.includes(token)) {
    console.error(`${pass} contract missing token: ${token}`);
    process.exit(1);
  }
}
const report = JSON.parse(fs.readFileSync(path.join(root, 'release-candidate/generated/pass314-windows-installer-enterprise-closeout-report.json'), 'utf8'));
if (report.pass !== pass || report.status !== 'PASS' || report.scope !== 'browser-side-only') {
  console.error(`${pass} report did not satisfy gate shape.`);
  process.exit(1);
}
if (report.brandAccent?.token !== 'navLinkBrowser' || report.brandAccent?.value !== 'rgba(96, 255, 218, 0.92)') {
  console.error(`${pass} browser brand accent truth is missing or incorrect.`);
  process.exit(1);
}
for (const assertion of ["windowsInstallerChecklistExists", "installUpgradeUninstallCovered", "shortcutsIconsStartMenuCovered", "versionTruthCovered", "userDataRetentionCovered", "electronBrandingLeakGuarded", "installedSmokeEvidenceTemplateExists", "signedReleaseNotClaimed", "storeSubmissionNotClaimed", "gaReleaseNotClaimed", "browserSideOnlyScopePreserved"]) {
  if (report.assertions?.[assertion] !== true) {
    console.error(`${pass} assertion is not true: ${assertion}`);
    process.exit(1);
  }
}
if (report.signedReleaseClaim !== false || report.gaReleaseClaim !== false || report.storePosture !== 'not-submitted-not-approved') {
  console.error(`${pass} must not make signed-release, GA, or Store claims.`);
  process.exit(1);
}
if (report.nextPass !== 'PASS315 Linux Package Enterprise Closeout') {
  console.error(`${pass} must hand off to PASS315 Linux Package Enterprise Closeout.`);
  process.exit(1);
}

console.log('PASS314_WINDOWS_INSTALLER_ENTERPRISE_CLOSEOUT=PASS');
