#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^\uFEFF/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const gitTracked = (p) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const releaseBlockers = getReleaseBlockersContract(pkg);
const expectedVersion = '2.0.18';

need(pkg.version === expectedVersion, `version must remain ${expectedVersion} for PASS146, found ${pkg.version}`);
need(pkg.scripts?.['evidence:windows-installed-smoke'] === 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\run-pass146-windows-installed-smoke.ps1', 'package missing evidence:windows-installed-smoke script');
need(pkg.scripts?.['verify:pass-146-windows-installed-smoke'] === 'node scripts/verify-pass-146-windows-installed-smoke.mjs', 'package missing PASS146 verifier script');

const pass145Idx = releaseBlockers.indexOf('verify:pass-145-privacy-support-known-issues');
const pass146Idx = releaseBlockers.indexOf('verify:pass-146-windows-installed-smoke');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass146Idx >= 0, 'release blockers must include PASS146 verifier');
need(pass145Idx < 0 || pass146Idx > pass145Idx, 'PASS146 verifier should run after PASS145');
need(finalBuildIdx > pass146Idx, 'PASS146 verifier must run before final build gate');

for (const file of [
  'src/shared/windows-installed-smoke-contract.ts',
  'scripts/run-pass146-windows-installed-smoke.ps1',
  'scripts/verify-pass-146-windows-installed-smoke.mjs',
  'docs/windows-installed-smoke-pass146.md',
  'PASS_146_WINDOWS_INSTALLED_SMOKE_CHECKLIST_SUMMARY.md',
]) {
  need(exists(file), `missing PASS146 file: ${file}`);
}

const contract = includesAll('src/shared/windows-installed-smoke-contract.ts', [
  'WINDOWS_INSTALLED_SMOKE_PASS',
  'PASS146',
  'WINDOWS_INSTALLED_SMOKE_VERSION = TAHAI_RELEASE_VERSION',
  'WINDOWS_INSTALLED_SMOKE_OUTPUT_DIR',
  'artifacts/windows-installed-smoke',
  'WINDOWS_INSTALLED_SMOKE_CHECKLIST',
  'installer-checksum-verified',
  'installed-app-launches',
  'about-version-truth',
  'guide-kb-opens',
  'mission-control-entry',
  'split-triview-quad-entry',
  'small-window-reflow',
  'active-pane-routing',
  'evidence-export-redaction',
  'devtools-available',
  'uninstall-clean-path',
  'WINDOWS_INSTALLED_SMOKE_REQUIRED_DOC_TOKENS',
]);
need(!contract.includes('PASS147'), 'PASS146 contract must not drift into PASS147');

const runner = includesAll('scripts/run-pass146-windows-installed-smoke.ps1', [
  'PASS146 Windows installed-app smoke evidence runner',
  '[ValidateSet(\'nsis\',\'msi\',\'portable\',\'unknown\')]',
  '$InstalledExePath',
  '$InstallerType',
  '$InstallerPath',
  `$ExpectedVersion = '${expectedVersion}'`,
  '$Launch',
  '$OutputDir = \'artifacts/windows-installed-smoke\'',
  'TAHAI Web Services Browser.exe',
  'Get-FileHash',
  'Win32_OperatingSystem',
  'manual-pending',
  'versionLooksExpected',
  'Do not include secrets',
  'PASS146_WINDOWS_INSTALLED_SMOKE_EVIDENCE_JSON',
]);
need(!/Remove-Item\s+-Recurse/i.test(runner), 'PASS146 runner must not recursively delete data');
need(!/Start-Process\s+.*(?:uninstall|msiexec\s+\/x)/i.test(runner), 'PASS146 runner must not run uninstall operations');
need(!/Set-Content\s+.*release[\\/]/i.test(runner), 'PASS146 runner must not write into release outputs');
need(!/Start-Process.+msiexec/i.test(runner), 'PASS146 runner must not launch installers automatically');

const docs = includesAll('docs/windows-installed-smoke-pass146.md', [
  'PASS146',
  'Windows manual smoke checklist',
  'evidence runner',
  'installed Windows app',
  `Version remains \`${expectedVersion}\``,
  'manual-release',
  'unsigned preview',
  'npm run package:win:release',
  'npm run verify:windows-installer-handoff',
  'SHA256',
  'npm run evidence:windows-installed-smoke',
  'artifacts/windows-installed-smoke/',
  'Guide/KB',
  'Mission Control',
  '2-Up',
  'Tri-view',
  'Quad',
  'Small-window reflow',
  'Active-pane routing',
  'Evidence export redaction',
  'DevTools',
  'No console/crash noise',
  'Uninstall path',
  'Do not include secrets',
  'No direct PSA API calls',
  'No IT Docs backend changes',
]);
need(!/manual installed-app success until/i.test(docs) || docs.includes('No claim of manual installed-app success'), 'PASS146 docs must not overclaim installed-app success');

includesAll('PASS_146_WINDOWS_INSTALLED_SMOKE_CHECKLIST_SUMMARY.md', [
  'PASS146',
  'Windows Installed-App Smoke Checklist',
  `Version remains \`${expectedVersion}\``,
  'src/shared/windows-installed-smoke-contract.ts',
  'scripts/run-pass146-windows-installed-smoke.ps1',
  'scripts/verify-pass-146-windows-installed-smoke.mjs',
  'docs/windows-installed-smoke-pass146.md',
  'evidence:windows-installed-smoke',
  'verify:pass-146-windows-installed-smoke',
  'Generated evidence outputs remain excluded from source',
  'does not claim that Windows manual smoke was completed here',
]);

const gitignore = read('.gitignore');
for (const token of ['artifacts/', 'release/', 'dist/', 'node_modules/', '*.exe', '*.msi']) {
  need(gitignore.includes(token), `.gitignore missing ${token}`);
}

const generatedForbidden = [
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.md',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
];
for (const file of generatedForbidden) need(!gitTracked(file), `generated output must not be tracked for commit: ${file}`);

const allPass146Text = [contract, runner, docs, read('PASS_146_WINDOWS_INSTALLED_SMOKE_CHECKLIST_SUMMARY.md')].join('\n');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(allPass146Text), 'PASS146 must not include PSA credential assignment examples');
need(!/refresh[_-]?token\s*[:=]/i.test(allPass146Text), 'PASS146 must not include refresh token assignment examples');
need(!/access[_-]?token\s*[:=]/i.test(allPass146Text), 'PASS146 must not include access token assignment examples');
need(!/Cookie:\s+\S+/i.test(allPass146Text), 'PASS146 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(allPass146Text), 'PASS146 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS146][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS146][OK] Windows installed-app smoke checklist and evidence runner verified.');
