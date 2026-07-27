#!/usr/bin/env node
/* PASS271 — Release Candidate Flagship Freeze Gate */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271';
const versionTarget = '2.0.18';
const remainingPassesAfterThisPass = 0;
const packageScripts = {
  'verify:pass-271-release-candidate-flagship-freeze-gate': 'node scripts/verify-pass271-release-candidate-flagship-freeze-gate.mjs',
  'gate:pass-271-release-candidate-flagship-freeze-gate': 'node scripts/gate-pass271-release-candidate-flagship-freeze-gate.mjs'
};
function read(file){ try { return fs.readFileSync(file,'utf8'); } catch { return ''; } }
function write(file,text){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text); }
function parseVersion(v){ const m=String(v||'').match(/^(\d+)\.(\d+)\.(\d+)/); return m?{major:+m[1],minor:+m[2],patch:+m[3]}:null; }
function versionAtLeast(actual, expected){
  const a=parseVersion(actual), e=parseVersion(expected);
  if (!a||!e) return false;
  if (a.major!==e.major) return a.major>e.major;
  if (a.minor!==e.minor) return a.minor>e.minor;
  return a.patch>=e.patch;
}
function patchPackageJson(){
  const pkgPath=path.join(root,'package.json');
  if (!fs.existsSync(pkgPath)) return {found:false,changed:false};
  const pkg=JSON.parse(read(pkgPath));
  let changed=false;
  if (!versionAtLeast(pkg.version, versionTarget)) { pkg.version=versionTarget; changed=true; }
  pkg.scripts=pkg.scripts||{};
  for (const [name,value] of Object.entries(packageScripts)) if (pkg.scripts[name]!==value) { pkg.scripts[name]=value; changed=true; }
  if (changed) write(pkgPath, JSON.stringify(pkg,null,2)+'\n');
  for (const lockName of ['package-lock.json','npm-shrinkwrap.json']){
    const lockPath=path.join(root,lockName);
    if (!fs.existsSync(lockPath)) continue;
    try {
      const lock=JSON.parse(read(lockPath)); let lockChanged=false;
      if (lock.version && !versionAtLeast(lock.version, versionTarget)) { lock.version=versionTarget; lockChanged=true; }
      if (lock.packages?.['']?.version && !versionAtLeast(lock.packages[''].version, versionTarget)) { lock.packages[''].version=versionTarget; lockChanged=true; }
      if (lockChanged) write(lockPath, JSON.stringify(lock,null,2)+'\n');
    } catch {}
  }
  return {found:true,changed,scripts:Object.keys(packageScripts),version:pkg.version};
}
function writeFreezeManifest(){
  const manifest={
    pass,
    passName:'Release Candidate Flagship Freeze Gate',
    versionTarget,
    remainingPassesAfterThisPass,
    noNewFeatures:true,
    requiredPriorPasses:['PASS267','PASS268','PASS269','PASS270'],
    requiredVerifierChain:[
      'npm run verify:pass-267-installed-mission-control-brutal-runtime-harness',
      'npm run verify:pass-268-webview-dom-ready-lifecycle-hardening',
      'npm run verify:pass-269-active-pane-routing-input-focus-regression-closeout',
      'npm run verify:pass-270-restored-maximized-small-window-visual-soak',
      'npm run verify:pass-271-release-candidate-flagship-freeze-gate'
    ],
    requiredEvidence:'release-candidate/evidence/pass271-release-candidate-flagship-freeze-evidence.json',
    storePosture:{ storeSubmission:'not-submitted', storeApproval:'not-approved', publicGaClaim:false, signedReleaseClaim:false },
    releaseCandidate:{ freezeGateAdded:true, freezeApproved:false, publicReleaseApproved:false, storeSubmissionApproved:false, gaApproved:false },
    generatedAt:new Date().toISOString()
  };
  write(path.join(root,'release-candidate/generated/pass271-release-candidate-flagship-freeze-manifest.json'), JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
const packageJson=patchPackageJson();
const freezeManifest=writeFreezeManifest();
const report={ pass, versionTarget, remainingPassesAfterThisPass, packageJson, freezeManifestPath:'release-candidate/generated/pass271-release-candidate-flagship-freeze-manifest.json', storeSubmission:'not-submitted', storeApproval:'not-approved', publicGaClaim:false, signedReleaseClaim:false, generatedAt:new Date().toISOString() };
write(path.join(root,'release-candidate/generated/pass271-release-candidate-flagship-freeze-apply-report.json'), JSON.stringify(report,null,2)+'\n');
console.log('PASS271_APPLY=PASS');
console.log(`PASS271_VERSION=${versionTarget}`);
console.log(`PASS271_REMAINING_PASSES_AFTER_THIS=${remainingPassesAfterThisPass}`);
console.log('PASS271_NO_NEW_FEATURES=true');
console.log('PASS271_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
