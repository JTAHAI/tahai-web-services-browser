#!/usr/bin/env node
/* PASS266 — Final Version Truth + Store Gate Chain Repair */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS266';
const finalVersion = '2.0.18';
const remainingPassesAfterThisPass = 5;
const oldVersionPattern = /2\.0\.(9|10|11|12|13)/g;
const filesToPatch = [
  "scripts/verify-pass260-installed-recipe-quad-store-smoke-evidence.mjs",
  "scripts/verify-pass261-store-submission-packet-finalizer.mjs",
  "scripts/verify-pass262-store-asset-evidence-pack.mjs",
  "scripts/verify-pass263-store-listing-copy-truth-pack.mjs",
  "scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs",
  "scripts/gate-pass260-installed-recipe-quad-store-smoke.mjs",
  "scripts/gate-pass261-store-submission-packet.mjs",
  "scripts/gate-pass262-store-asset-evidence-pack.mjs",
  "scripts/gate-pass263-store-listing-copy-truth-pack.mjs",
  "scripts/gate-pass264-store-submission-dry-run-evidence.mjs",
  "docs/store/pass260-installed-recipe-quad-smoke-evidence.template.json",
  "docs/store/pass261-store-screenshot-manifest.template.json",
  "docs/store/pass261-store-submission-packet.template.json",
  "docs/store/pass262-public-url-review.template.json",
  "docs/store/pass262-store-asset-evidence-pack.template.json",
  "docs/store/pass262-store-listing-image-checklist.template.json",
  "docs/store/pass263-copy-claim-review.template.json",
  "docs/store/pass263-partner-center-field-map.template.json",
  "docs/store/pass263-store-listing-copy.template.json",
  "docs/store/pass264-store-submission-dry-run-checklist.template.json",
  "docs/store/pass264-store-submission-dry-run-evidence.template.json",
  "tests/runtime/pass260-installed-recipe-quad-smoke-checks.json",
  "tests/runtime/pass262-store-asset-required-slots.json",
  "tests/runtime/pass263-store-listing-claim-rules.json",
  "tests/runtime/pass264-store-submission-dry-run-required-gates.json",
  "docs/store/PASS260-installed-recipe-quad-store-smoke-evidence.md",
  "docs/store/PASS261-store-submission-packet-finalizer.md",
  "docs/store/PASS262-store-asset-evidence-pack.md",
  "docs/store/PASS263-store-listing-copy-truth-pack.md",
  "docs/store/PASS264-store-submission-dry-run-evidence-gate.md",
  "PASS260_README.md",
  "PASS261_README.md",
  "PASS262_README.md",
  "PASS263_README.md",
  "PASS264_README.md"
];

function writeFile(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function writeJson(rel, obj) { writeFile(rel, JSON.stringify(obj, null, 2) + '\n'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0,0,0]; }
function versionLt(a, b) { const x = parseVersion(a), y = parseVersion(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return false; }

let patchedFiles = [];
for (const rel of filesToPatch) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(oldVersionPattern, finalVersion).replaceAll('REPLACE_WITH_VERSION_SPECIFIC_RELEASE_NOTES_FOR_2_0_12', 'REPLACE_WITH_VERSION_SPECIFIC_RELEASE_NOTES_FOR_2_0_14');
  if (after !== before) { fs.writeFileSync(full, after); patchedFiles.push(rel); }
}

writeJson('docs/store/pass266-final-version-truth-gate-chain-repair.template.json', {
  "schemaVersion": 1,
  "pass": "PASS266",
  "packName": "TAHAI Browser Final Version Truth + Store Gate Chain Repair",
  "status": "TEMPLATE_PENDING_REAL_FINAL_VERSION_EVIDENCE",
  "versionTarget": "2.0.18",
  "remainingPassesAfterThisPass": 5,
  "generatedAt": "REPLACE_WITH_ISO_TIMESTAMP",
  "preparedBy": "REPLACE_WITH_OPERATOR_NAME",
  "sourceCommit": "REPLACE_WITH_GIT_COMMIT_SHA",
  "packageVersion": "2.0.18",
  "repairScope": {
    "pass260ThroughPass265UseOneFinalPackageVersion": true,
    "historicalPassProvenancePreserved": true,
    "finalEvidencePackageVersion": "2.0.18",
    "noStoreSubmissionPerformedByThisPass": true,
    "storeSubmissionStatus": "not-submitted",
    "storeApprovalStatus": "not-approved"
  },
  "scriptTruth": {
    "pass260GateRequiresFinalVersion": false,
    "pass261GateRequiresFinalVersion": false,
    "pass262GateRequiresFinalVersion": false,
    "pass263GateRequiresFinalVersion": false,
    "pass264GateRequiresFinalVersion": false,
    "pass265GateRequiresFinalVersion": false,
    "pass260VerifierRequiresFinalVersion": false,
    "pass261VerifierRequiresFinalVersion": false,
    "pass262VerifierRequiresFinalVersion": false,
    "pass263VerifierRequiresFinalVersion": false,
    "pass264VerifierRequiresFinalVersion": false,
    "pass265VerifierRequiresFinalVersion": false
  },
  "templateTruth": {
    "pass260TemplateFinalVersion": false,
    "pass261TemplateFinalVersion": false,
    "pass262TemplateFinalVersion": false,
    "pass263TemplateFinalVersion": false,
    "pass264TemplateFinalVersion": false,
    "pass265TemplateFinalVersion": false,
    "runtimeFixturesFinalVersion": false
  },
  "priorEvidenceVersionMatrix": [
    {
      "pass": "PASS260",
      "requiredGate": "npm run gate:pass-260-installed-recipe-quad-store-smoke",
      "evidencePath": "release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    },
    {
      "pass": "PASS261",
      "requiredGate": "npm run gate:pass-261-store-submission-packet",
      "evidencePath": "release-candidate/store-submission/pass261-store-submission-packet.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    },
    {
      "pass": "PASS262",
      "requiredGate": "npm run gate:pass-262-store-asset-evidence-pack",
      "evidencePath": "release-candidate/store-submission/pass262-store-asset-evidence-pack.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    },
    {
      "pass": "PASS263",
      "requiredGate": "npm run gate:pass-263-store-listing-copy-truth-pack",
      "evidencePath": "release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    },
    {
      "pass": "PASS264",
      "requiredGate": "npm run gate:pass-264-store-submission-dry-run-evidence",
      "evidencePath": "release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    },
    {
      "pass": "PASS265",
      "requiredGate": "npm run gate:pass-265-store-handoff-freeze-operator-approval",
      "evidencePath": "release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json",
      "packageVersion": "2.0.18",
      "versionMatchesFinalPackage": false,
      "gateOutputCaptured": false
    }
  ],
  "releaseTruth": {
    "microsoftStoreSubmissionClaim": "not-submitted",
    "microsoftStoreApprovalClaim": "not-approved",
    "publicGaClaim": false,
    "directMsiExeSigningStatus": "unsigned-preview",
    "noSignedInstallerClaimUnlessSeparatelyEvidenced": true,
    "noITDocsBackendOrPSAConnectorClaim": true,
    "noDirectPSAApiOrSecretStorageClaim": true
  },
  "operatorApproval": {
    "approvedVersionRepair": false,
    "approvedToProceedToPass267RuntimeHarness": false,
    "approvedForPartnerCenterManualSubmission": false,
    "approvedForPublicGA": false,
    "approvedBy": "REPLACE_WITH_OPERATOR_NAME",
    "approvedAt": "REPLACE_WITH_ISO_TIMESTAMP",
    "notes": "PENDING_REAL_OPERATOR_REVIEW"
  },
  "goNoGo": {
    "status": "NO_GO",
    "reason": "Template only. Fill with real version-truth review before relying on PASS260-PASS265 as one final package evidence chain.",
    "readyForPass267": false,
    "readyForPartnerCenterSubmission": false,
    "readyForPublicGA": false
  }
});
writeJson('tests/runtime/pass266-final-version-truth-required-gates.json', {
  "schemaVersion": 1,
  "pass": "PASS266",
  "versionTarget": "2.0.18",
  "remainingPassesAfterThisPass": 5,
  "name": "PASS266 Final Package Version Matrix",
  "finalPackageVersion": "2.0.18",
  "repairedPasses": [
    "PASS260",
    "PASS261",
    "PASS262",
    "PASS263",
    "PASS264",
    "PASS265"
  ],
  "versionPolicy": {
    "singleInstalledPackageEvidenceVersionRequired": true,
    "historicalPassVersionDriftBlocked": true,
    "packageVersionMustMatchAboutVersion": true,
    "screenshotsAssetsListingsDryRunAndHandoffMustMatchPackageVersion": true,
    "storeSubmissionStillManualAndBlocked": true
  },
  "scriptFilesThatMustRequireFinalVersion": [
    "scripts/gate-pass260-installed-recipe-quad-store-smoke.mjs",
    "scripts/gate-pass261-store-submission-packet.mjs",
    "scripts/gate-pass262-store-asset-evidence-pack.mjs",
    "scripts/gate-pass263-store-listing-copy-truth-pack.mjs",
    "scripts/gate-pass264-store-submission-dry-run-evidence.mjs",
    "scripts/gate-pass265-store-handoff-freeze-operator-approval.mjs",
    "scripts/verify-pass260-installed-recipe-quad-store-smoke-evidence.mjs",
    "scripts/verify-pass261-store-submission-packet-finalizer.mjs",
    "scripts/verify-pass262-store-asset-evidence-pack.mjs",
    "scripts/verify-pass263-store-listing-copy-truth-pack.mjs",
    "scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs",
    "scripts/verify-pass265-store-handoff-freeze-operator-approval.mjs"
  ],
  "jsonFilesThatMustUseFinalVersion": [
    "docs/store/pass260-installed-recipe-quad-smoke-evidence.template.json",
    "docs/store/pass261-store-submission-packet.template.json",
    "docs/store/pass261-store-screenshot-manifest.template.json",
    "docs/store/pass262-store-asset-evidence-pack.template.json",
    "docs/store/pass262-store-listing-image-checklist.template.json",
    "docs/store/pass262-public-url-review.template.json",
    "docs/store/pass263-store-listing-copy.template.json",
    "docs/store/pass263-partner-center-field-map.template.json",
    "docs/store/pass263-copy-claim-review.template.json",
    "docs/store/pass264-store-submission-dry-run-evidence.template.json",
    "docs/store/pass264-store-submission-dry-run-checklist.template.json",
    "docs/store/pass265-store-handoff-freeze-operator-approval.template.json",
    "docs/store/pass265-store-closeout-manifest.template.json",
    "docs/store/pass265-operator-approval-checklist.template.json",
    "tests/runtime/pass260-installed-recipe-quad-smoke-checks.json",
    "tests/runtime/pass262-store-asset-required-slots.json",
    "tests/runtime/pass263-store-listing-claim-rules.json",
    "tests/runtime/pass264-store-submission-dry-run-required-gates.json",
    "tests/runtime/pass265-store-handoff-freeze-required-gates.json"
  ]
});
writeFile('docs/store/PASS266-final-version-truth-store-gate-chain-repair.md', "# PASS266 \u2014 Final Version Truth + Store Gate Chain Repair\n\nTarget final package version: `2.0.18`\n\nRemaining release-confidence hardening passes after PASS266: **5**.\n\nPASS266 repairs the Store evidence chain so PASS260 through PASS265 prove one installed package version instead of a stale ladder of pass-version targets.\n\n## What this pass repairs\n\n- PASS260 installed Recipe + Quad smoke gate now requires final package version `2.0.18`.\n- PASS261 Store submission packet gate now requires final package version `2.0.18`.\n- PASS262 Store asset evidence gate now requires final package version `2.0.18`.\n- PASS263 Store listing copy truth gate now requires final package version `2.0.18`.\n- PASS264 Store dry-run evidence gate now requires final package version `2.0.18`.\n- PASS265 handoff freeze gate remains on final package version `2.0.18`.\n- PASS260-PASS264 verifiers and templates are aligned to the same final package version.\n- A new PASS266 fail-closed version-truth gate blocks release confidence unless the operator records the repair review.\n\n## What this pass does not do\n\n- It does **not** submit to Microsoft Store.\n- It does **not** claim Microsoft Store approval.\n- It does **not** claim public GA.\n- It does **not** claim signed MSI/EXE status.\n- It does **not** add IT Docs backend code, PSA connector code, direct PSA API calls, or provider secrets.\n\n## Commands\n\n```powershell\nSet-Location C:\\dev\browser\u0007pp\nnode scripts\u0007pply-pass266-final-version-truth-store-gate-chain-repair.mjs\nnpm run verify:pass-266-final-version-truth-store-gate-chain-repair\nnpm run gate:pass-266-final-version-truth-store-gate-chain\n```\n\nThe PASS266 gate expects real evidence at:\n\n`release-candidate/store-submission/pass266-final-version-truth-gate-chain-repair.json`\n\nUse the template at:\n\n`docs/store/pass266-final-version-truth-gate-chain-repair.template.json`\n\n## Next pass\n\nPASS267 \u2014 Installed Mission Control Brutal Runtime Harness.\n");
writeFile('PASS266_README.md', "# PASS266 \u2014 Final Version Truth + Store Gate Chain Repair\n\nVersion target: **2.0.18**\n\nRemaining release-confidence hardening passes after PASS266: **5**\n\n## Apply\n\n```powershell\nSet-Location C:\\dev\browser\u0007pp\nnode scripts\u0007pply-pass266-final-version-truth-store-gate-chain-repair.mjs\nnpm run verify:pass-266-final-version-truth-store-gate-chain-repair\n```\n\n## Gate when real evidence exists\n\n```powershell\nnpm run gate:pass-266-final-version-truth-store-gate-chain\n```\n\nPASS266 fixes final version truth drift across PASS260-PASS265. It does not submit to the Microsoft Store and does not claim approval or GA.\n");

const pkgPath = path.join(root, 'package.json');
let packageUpdated = false;
if (fs.existsSync(pkgPath)) {
  const pkg = readJson(pkgPath);
  if (!pkg.version || versionLt(pkg.version, finalVersion)) { pkg.version = finalVersion; packageUpdated = true; }
  pkg.scripts = pkg.scripts || {};
  const scripts = {
    'verify:pass-266-final-version-truth-store-gate-chain-repair': 'node scripts/verify-pass266-final-version-truth-store-gate-chain-repair.mjs',
    'gate:pass-266-final-version-truth-store-gate-chain': 'node scripts/gate-pass266-final-version-truth-store-gate-chain.mjs'
  };
  for (const [key, value] of Object.entries(scripts)) {
    if (pkg.scripts[key] !== value) { pkg.scripts[key] = value; packageUpdated = true; }
  }
  if (packageUpdated) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

const manifestPath = path.join(root, 'PATCH_MANIFEST.json');
let files = [];
if (fs.existsSync(manifestPath)) {
  try { files = Array.from(new Set((readJson(manifestPath).files || []).concat([]))); } catch { files = []; }
}
for (const rel of [
  'PASS266_README.md',
  'docs/store/PASS266-final-version-truth-store-gate-chain-repair.md',
  'docs/store/pass266-final-version-truth-gate-chain-repair.template.json',
  'tests/runtime/pass266-final-version-truth-required-gates.json',
  'scripts/apply-pass266-final-version-truth-store-gate-chain-repair.mjs',
  'scripts/verify-pass266-final-version-truth-store-gate-chain-repair.mjs',
  'scripts/gate-pass266-final-version-truth-store-gate-chain.mjs'
]) { if (!files.includes(rel)) files.push(rel); }
writeJson('PATCH_MANIFEST.json', {
  name: 'TAHAI Browser PASS266 Final Version Truth + Store Gate Chain Repair cumulative patch',
  pass: 'PASS266 — Final Version Truth + Store Gate Chain Repair',
  versionTarget: finalVersion,
  remainingPassesAfterThisPass,
  cumulativeFrom: ['PASS250','PASS251','PASS252','PASS253','PASS254','PASS255','PASS256','PASS257','PASS258','PASS259','PASS260','PASS261','PASS262','PASS263','PASS264','PASS265','PASS266'],
  storeSubmissionStatus: 'NOT_SUBMITTED_NOT_APPROVED_BLOCKED_UNTIL_REAL_INSTALLED_RUNTIME_AND_STORE_EVIDENCE',
  repairedVersionTruth: { finalPackageVersion: finalVersion, repairedPasses: ['PASS260','PASS261','PASS262','PASS263','PASS264','PASS265'], patchedFiles },
  nextPass: 'PASS267 — Installed Mission Control Brutal Runtime Harness',
  remainingPassNames: ['PASS267 — Installed Mission Control Brutal Runtime Harness','PASS268 — WebView DOM-Ready Lifecycle Hardening','PASS269 — Active Pane Routing + Input/Focus Regression Closeout','PASS270 — Restored/Maximized/Small-Window Visual Soak','PASS271 — Release Candidate Flagship Freeze Gate'],
  files: Array.from(new Set(files)).sort()
});

writeFile('NEXT_CHAT_STARTER.md', `We are continuing TAHAI Web Services Browser 2.0.x after PASS266 — Final Version Truth + Store Gate Chain Repair.

Repo:
C:\dev\browser\app

Public repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current version target after PASS266:
2.0.18

Latest patch ZIP:
TAHAI-browser-pass266-final-version-truth-store-gate-chain-repair-cumulative-patch-20260514.zip

Latest completed pass:
PASS266 — Final Version Truth + Store Gate Chain Repair

Remaining release-confidence hardening passes after PASS266: 5

Remaining passes:
- PASS267 — Installed Mission Control Brutal Runtime Harness
- PASS268 — WebView DOM-Ready Lifecycle Hardening
- PASS269 — Active Pane Routing + Input/Focus Regression Closeout
- PASS270 — Restored/Maximized/Small-Window Visual Soak
- PASS271 — Release Candidate Flagship Freeze Gate

Hard scope:
Only browser-side work in this repo. IT Docs and PSA integrations remain browser-side contracts/references only. No IT Docs backend code. No PSA connector code. No direct PSA API calls. No PSA/API/provider secrets in browser code or mission files.

Store posture:
Microsoft Store submission remains not-submitted and not-approved. PASS266 only repairs final version truth so PASS260-PASS265 can prove one installed package version: 2.0.18.

Run after overlay:
Set-Location C:\dev\browser\app
node scripts\apply-pass266-final-version-truth-store-gate-chain-repair.mjs
npm run verify:pass-266-final-version-truth-store-gate-chain-repair

Gate when real version evidence exists:
npm run gate:pass-266-final-version-truth-store-gate-chain

Next pass:
PASS267 — Installed Mission Control Brutal Runtime Harness

Goal:
Add a brutal installed-app Mission Control runtime harness/checklist for recipe start, Split/Tri/Quad/Focus layout cycles, pane health, export preview, and evidence capture. No Store submission or approval claim.
`);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
writeJson('release-candidate/generated/pass266-final-version-truth-store-gate-chain-repair-apply-report.json', {
  schemaVersion: 1,
  pass,
  status: 'APPLIED',
  versionTarget: finalVersion,
  remainingPassesAfterThisPass,
  patchedFiles,
  packageUpdated,
  storeSubmissionStatus: 'not-submitted',
  storeApprovalStatus: 'not-approved',
  nextPass: 'PASS267 — Installed Mission Control Brutal Runtime Harness'
});

console.log('PASS266_APPLY=PASS');
console.log('PASS266_VERSION_TARGET=' + finalVersion);
console.log('PASS266_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS266_PATCHED_FILES=' + patchedFiles.length);
console.log('PASS266_STORE_SUBMISSION=not-submitted');
console.log('PASS266_STORE_APPROVAL=not-approved');
