#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS344';
const reportDir = path.join(root, 'release-candidate', 'generated');
const reportPath = path.join(reportDir, 'pass344-microsoft-store-repo-cleanup-closeout.json');
const checks = [];

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function check(id, ok, detail = '') {
  checks.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ' - ' + detail : ''}`);
}

function runGit(args) {
  const result = childProcess.spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    status: result.status,
  };
}

function listFiles(dir) {
  const full = path.join(root, dir);
  const out = [];
  if (!fs.existsSync(full)) return out;
  const stack = [full];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      const childRel = rel(child);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'release', 'release-msix', '.git'].includes(entry.name)) stack.push(child);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  }
  return out;
}

function hasAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

function ordered(source, first, second) {
  const a = source.indexOf(first);
  const b = source.indexOf(second);
  return a >= 0 && b >= 0 && a < b;
}

const pkg = readJson('package.json');
const version = String(pkg.version || '');
const msixVersion = `${version}.0`;
const pass344Script = 'verify:pass-344-microsoft-store-repo-cleanup-closeout';
const pass344Command = 'node scripts/verify-pass-344-microsoft-store-repo-cleanup-closeout.mjs';
const releaseContract = String(pkg.scripts?.['verify:release-blockers:contract'] || '');

check('package-script-present', pkg.scripts?.[pass344Script] === pass344Command, `${pass344Script} must run ${pass344Command}`);
check('store-evidence-refresh-script-present', pkg.scripts?.['store:evidence:refresh'] === 'npm run store:evidence:capture && npm run store:evidence:init', 'store:evidence:refresh must refresh ignored Store evidence');
check('store-evidence-reset-placeholder-script-present', pkg.scripts?.['store:evidence:reset-placeholder'] === 'node scripts/reset-store-submission-evidence-placeholder.mjs', 'tracked Store placeholder must be resettable from source');
check('release-contract-includes-pass344', releaseContract.includes(`npm run ${pass344Script}`), 'PASS344 must be wired into verify:release-blockers:contract');
check('release-contract-order', ordered(releaseContract, 'verify:pass-343-it-devops-priority-browser-kit', pass344Script) && ordered(releaseContract, pass344Script, 'npm run build'), 'PASS344 runs after PASS343 and before build/runtime E2E');

check('store-source-files-present', [
  'config/msix-manifest.template.xml',
  'packaging/windows/build-windows-msix.ps1',
  'packaging/windows/msix/package-identity.store.json',
  'packaging/windows/msix/package-identity.store.example.json',
  'docs/store/PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md',
  'docs/store/PARTNER_CENTER_IDENTITY_PREP.md',
  'docs/store/MICROSOFT_STORE_LISTING_PACKET.md',
  'release-candidate/store-submission/store-submission-evidence.json',
  'scripts/capture-store-package-evidence.mjs',
  'scripts/init-store-submission-evidence.mjs',
  'scripts/reset-store-submission-evidence-placeholder.mjs',
  'scripts/verify-store-submission-gate.mjs',
].every(exists), 'Store/MSIX source, docs, evidence, and gates must exist');

const gitignore = read('.gitignore');
check('generated-artifacts-ignored', [
  'release/',
  'release-msix/',
  'release-candidate/generated/',
  '*.msix',
  '*.msixupload',
  '*.appxupload',
  '*.msi',
  '*.exe',
  '*.pfx',
  'PartnerCenter*.json',
].every((pattern) => gitignore.split(/\r?\n/).some((line) => line.trim() === pattern)), 'package, certificate, and generated evidence paths remain ignored');

const trackedFiles = runGit(['ls-files']);
const trackedPackageArtifacts = trackedFiles.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => /\.(msix|msixupload|appxupload|msi|exe|pfx|p12|pem|key|cer)$/i.test(file));
check('no-package-or-private-key-artifacts-tracked', trackedFiles.ok && trackedPackageArtifacts.length === 0, trackedPackageArtifacts.slice(0, 12).join(', '));

const evidence = readJson('release-candidate/store-submission/store-submission-evidence.json');
const evidenceRaw = read('release-candidate/store-submission/store-submission-evidence.json');
check('tracked-store-evidence-is-sanitized-placeholder', evidence.generatedBy === 'source-controlled-sanitized-placeholder' && /BLOCKED/.test(String(evidence.submissionStatus || '')), 'tracked evidence must be a sanitized fail-closed placeholder');
check('tracked-store-evidence-has-no-stale-local-source-state', !/DIRTY_WORKING_TREE|SOURCE_TAG_MISMATCH|521bf6d13b727ee11c1eb0e4a0d01b2a75af581a|v2\.0\.0/.test(evidenceRaw), 'tracked evidence must not preserve old local dirty tree or old tag metadata');
check('tracked-store-evidence-does-not-claim-submission', evidence.releaseTruth?.storeSubmissionClaim === 'blocked-not-submitted' && evidence.releaseTruth?.storeApprovalClaim === 'not-approved' && evidence.releaseTruth?.publicGaClaim === 'not-ga-from-this-evidence', 'Store, approval, and GA claims remain blocked');
check('tracked-store-evidence-keeps-live-scans-generated', evidence.packageArtifact?.packageEvidencePath === 'release-candidate/generated/store-submission/package-evidence.generated.json' && Array.isArray(evidence.packageArtifact?.artifacts) && evidence.packageArtifact.artifacts.length === 0, 'tracked evidence points to ignored generated package scans and does not embed local artifacts');

const captureScript = read('scripts/capture-store-package-evidence.mjs');
check('package-evidence-capture-current-version-aware', hasAll(captureScript, ['currentVersionArtifactCount', 'storePackageCandidateStatus', 'CURRENT_STORE_PACKAGE_FOUND', 'legacyVersionArtifactCandidates', 'workingTreeReview', 'sourceTagReview']), 'package evidence capture classifies current-version artifacts and source provenance');
check('package-evidence-generated-under-ignored-dir', captureScript.includes("release-candidate', 'generated', 'store-submission") && captureScript.includes('package-evidence.generated.json'), 'live package evidence is written under ignored generated evidence');

const initScript = read('scripts/init-store-submission-evidence.mjs');
check('evidence-init-fail-closed', hasAll(initScript, ['BLOCKED_PENDING_PARTNER_CENTER_AND_CURRENT_MSIX', 'PENDING_CURRENT_STORE_PACKAGE_REVIEW', 'BLOCKED_NO_STORE_PACKAGE_ARTIFACT', 'automatedInstalledRuntime', 'does not replace the manual Store installed smoke checklist']), 'Store evidence init remains fail-closed and preserves manual smoke ownership');
check('evidence-init-writes-generated-local-file', initScript.includes("release-candidate', 'generated', 'store-submission") && initScript.includes('store-submission-evidence.generated.json'), 'Store evidence init must write ignored local evidence, not tracked source state');

const placeholderScript = read('scripts/reset-store-submission-evidence-placeholder.mjs');
check('tracked-placeholder-reset-script-preserves-sanitized-owner', hasAll(placeholderScript, ['source-controlled-sanitized-placeholder', 'BLOCKED_PENDING_PARTNER_CENTER_IDENTITY_INSTALLED_SMOKE_AND_OPERATOR_REVIEW', 'package-evidence.generated.json']), 'tracked Store placeholder reset must preserve fail-closed source truth');

const storeGate = read('scripts/verify-store-submission-gate.mjs');
check('store-gate-requires-real-external-evidence', hasAll(storeGate, ['partnerCenterIdentity.status must be READY', 'privacySupport.urlsPubliclyReachable must be true', 'installedSmoke.status must be PASS', 'knownIssues.noHiddenBlockers must be true', 'STORE_APPROVAL_CLAIM=not-approved']), 'Store submission gate requires Partner Center, URL, installed smoke, and known-issues evidence');
check('store-gate-no-false-approval-output', !/approved|submitted/i.test(storeGate.match(/STORE_APPROVAL_CLAIM=.*|STORE_SUBMISSION_CLAIM=.*/g)?.join('\n') || '') || storeGate.includes('not-approved'), 'Store gate output cannot claim approval');
check('store-gate-prefers-generated-local-evidence', storeGate.includes('release-candidate/generated/store-submission/store-submission-evidence.generated.json'), 'Store gate must prefer ignored local evidence over tracked placeholder');

const manifest = read('config/msix-manifest.template.xml');
const identity = readJson('packaging/windows/msix/package-identity.store.json');
check('msix-version-tracks-package-json', manifest.includes(`__TAHAI_MSIX_PACKAGE_VERSION__`) || manifest.includes(`Version="${msixVersion}"`), `MSIX version must be ${msixVersion}`);
check('partner-center-identity-is-reserved-in-source-of-truth', identity.name === 'TAHAIWebServices.TAHAIWebServicesBrowser' && identity.publisher === 'CN=D75EE668-B409-45ED-87E5-E37AA5FE3868' && identity.publisherDisplayName === 'TAHAI Web Services' && identity.storeId === '9PJ1RHFW9GL8', 'source of truth identity must match the reserved Partner Center values');
check('msix-manifest-uses-safe-identity-tokens-or-real-values', !manifest.includes('TAHAI Web Services Placeholder') && !manifest.includes('REPLACE_WITH_PARTNER_CENTER') && !manifest.includes('PARTNER_CENTER_PENDING') && (manifest.includes('__TAHAI_MSIX_PACKAGE_IDENTITY_NAME__') || manifest.includes('TAHAIWebServices.TAHAIWebServicesBrowser')) && (manifest.includes('__TAHAI_MSIX_PACKAGE_IDENTITY_PUBLISHER__') || manifest.includes('CN=D75EE668-B409-45ED-87E5-E37AA5FE3868')), 'source must use safe identity tokens or the real reserved identity, never the placeholder publisher');
check('msix-manifest-capabilities-minimal', manifest.includes('Name="runFullTrust"') && manifest.includes('Name="internetClient"') && !/broadFileSystemAccess|enterpriseAuthentication|privateNetworkClientServer/i.test(manifest), 'MSIX capabilities remain minimal for a full-trust browser shell');

const main = read('src/main/main.ts');
const renderer = read('src/renderer/app.ts');
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const preload = read('src/preload/preload.ts');
const securitySource = `${main}\n${renderer}\n${html}\n${preload}`;
const unsafeWebviewPopup = /(<webview[^>]*allowpopups|setAttribute\(['"]allowpopups|\sallowpopups\s*=)/i.test(securitySource);
const unsafeBrowserWindowSecurity = /(nodeIntegration\s*:\s*true|webSecurity\s*:\s*false|contextIsolation\s*:\s*false|enableRemoteModule\s*:\s*true)/i.test(securitySource);
check('no-unsafe-webview-or-browserwindow-security-regression', !unsafeWebviewPopup && !unsafeBrowserWindowSecurity, 'no unsafe webview/BrowserWindow security toggles are introduced');
check('external-open-stays-safe', main.includes('safeOpenExternal(url)') && !/shell\.openExternal\((?!url\))/.test(main), 'external open remains centralized behind the safe main-process owner');
check('preload-no-raw-ipc-exposure', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer|window\.ipcRenderer|ipcRenderer\s*,/is.test(preload), 'preload does not expose raw ipcRenderer');
check('no-direct-psa-provider-secret-patterns', !/(psa|connectwise|autotask|halo|syncro|kaseya|datto)[_-]?(api[_-]?key|secret|token)\s*[:=]/i.test(securitySource), 'browser source does not introduce direct PSA/provider secrets');

check('loaded-browser-css-retains-clickability-contract', html.includes('<link rel="stylesheet" href="./styles/browser.css"') && hasAll(css, ['PASS341_NORMAL_BROWSER_AND_FEATURE_CLICKABILITY_CLOSEOUT', 'PASS343_IT_DEVOPS_PRIORITY_BROWSER_KIT', '-webkit-app-region: no-drag !important', 'pointer-events: auto !important']), 'loaded stylesheet carries chrome clickability and Browser Kit contracts');
check('browser-core-and-feature-controls-bound', [
  '#back', '#forward', '#reload', '#home', '#address', '#new-tab', '#launchpad', '#onboarding', '#profile-switcher', '#devops-tools', '#it-tools', '#ops-hub-toggle', '#mission-control-toggle', '#settings', '#browser-kit',
].every((token) => renderer.includes(token.replace('#', '')) || html.includes(`id="${token.replace('#', '')}"`)), 'core browser, IT, DevOps, Mission, Settings, Profile, Guide, and Browser Kit controls are present');
check('runtime-e2e-still-covers-primary-surfaces', hasAll(renderer, ['PASS158 Runtime E2E Mission', 'Mission Control opens', 'Guide/KB entry', 'shell-overlays-open-close', 'DevOps panel did not open', 'IT Tools panel did not open', 'Browser Kit panel did not open', 'Find bar did not open from Browser Kit', 'Ops Panel did not open', 'Settings dialog did not open', 'Profile dialog did not open', 'Command Palette did not open']), 'runtime E2E includes primary shell surfaces');

const docs = [
  'docs/store/PARTNER_CENTER_FINAL_SUBMISSION_CHECKLIST.md',
  'docs/store/PARTNER_CENTER_IDENTITY_PREP.md',
  'docs/store/PASS250-microsoft-store-submission-readiness.md',
  'docs/store/MICROSOFT_STORE_LISTING_PACKET.md',
].map(read).join('\n');
check('store-docs-preserve-truth', hasAll(docs, ['not yet submitted', 'not approved', 'Partner Center', 'installed smoke']) && !/Microsoft Store approved|Store submission completed|public GA is ready|signed MSI|signed EXE/i.test(docs), 'Store docs preserve no-submission/no-approval/no-false-signing truth');

const activeStoreFiles = [
  'config/msix-manifest.template.xml',
  'packaging/windows/msix/package-identity.store.json',
  'release-msix/Package.appxmanifest',
  'release-candidate/store-submission/store-submission-evidence.json',
  'release-candidate/generated/store-submission/store-submission-evidence.generated.json',
  'release-candidate/generated/store-submission/package-evidence.generated.json',
].filter(exists);
const publicClaimHits = [];
for (const file of activeStoreFiles) {
  const text = read(file);
  if (/\b(?:Microsoft Store approved|Store approved|Store submission completed|public GA is ready|trusted public signed installer|signed MSI|signed EXE)\b/i.test(text)) {
    publicClaimHits.push(file);
  }
}
check('no-source-false-store-ga-signing-claims', publicClaimHits.length === 0, publicClaimHits.slice(0, 12).join(', '));

const generatedEvidencePath = path.join(root, 'release-candidate', 'generated', 'store-submission', 'package-evidence.generated.json');
let generatedPackageEvidence = null;
if (fs.existsSync(generatedEvidencePath)) {
  try {
    generatedPackageEvidence = JSON.parse(fs.readFileSync(generatedEvidencePath, 'utf8'));
  } catch {
    generatedPackageEvidence = null;
  }
}
if (generatedPackageEvidence) {
  check('generated-package-evidence-current-version-sane', generatedPackageEvidence.version === version && generatedPackageEvidence.msixVersion === msixVersion && generatedPackageEvidence.currentVersionArtifactCount >= 1, 'current ignored generated package scan sees current MSIX candidate');
  check('generated-package-evidence-does-not-override-store-gate', generatedPackageEvidence.submissionReadiness !== 'READY_FOR_STORE_SUBMISSION', 'generated package evidence alone cannot claim Store readiness');
} else {
  check('generated-package-evidence-optional-not-tracked', true, 'run npm run store:evidence:capture to refresh ignored package scans');
}

const gitStatus = runGit(['status', '--short']);
const head = runGit(['rev-parse', 'HEAD']);
const result = checks.every((entry) => entry.ok) ? 'PASS' : 'FAIL';
const report = {
  pass,
  result,
  generatedAt: new Date().toISOString(),
  version,
  msixVersion,
  sourceCommit: head.ok ? head.stdout.trim() : null,
  workingTreeStatus: gitStatus.ok ? gitStatus.stdout.trim() : null,
  workingTreeReview: gitStatus.ok && gitStatus.stdout.trim() ? 'DIRTY_REVIEW_REQUIRED_BEFORE_FINAL_TAG_OR_PACKAGE_UPLOAD' : 'CLEAN_WORKING_TREE',
  storeSubmissionTruth: 'not-submitted-not-approved',
  microsoftStoreBoundary: 'source-ready-for-partner-center-evidence-only',
  generatedPackageEvidence: generatedPackageEvidence
    ? {
        path: rel(generatedEvidencePath),
        version: generatedPackageEvidence.version,
        msixVersion: generatedPackageEvidence.msixVersion,
        sourceCommit: generatedPackageEvidence.sourceCommit,
        sourceTagReview: generatedPackageEvidence.sourceTagReview,
        workingTreeReview: generatedPackageEvidence.workingTreeReview,
        currentVersionArtifactCount: generatedPackageEvidence.currentVersionArtifactCount,
        storePackageCandidateStatus: generatedPackageEvidence.storePackageCandidateStatus,
      }
    : null,
  checks,
};
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`PASS344_VERIFY_RESULT=${result}`);
console.log(`PASS344_REPORT=${rel(reportPath)}`);
process.exit(result === 'PASS' ? 0 : 1);
