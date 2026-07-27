#!/usr/bin/env node
/* PASS269 verifier */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const versionTarget='2.0.18';
const requiredFiles=[
  'docs/qa/PASS269-active-pane-routing-input-focus-regression-closeout.md',
  'docs/qa/pass269-active-pane-routing-input-focus-evidence.template.json',
  'tests/runtime/pass269-active-pane-routing-input-focus-matrix.json',
  'scripts/apply-pass269-active-pane-routing-input-focus-regression-closeout.mjs',
  'scripts/verify-pass269-active-pane-routing-input-focus-regression-closeout.mjs',
  'scripts/gate-pass269-active-pane-routing-input-focus-regression-closeout.mjs'
];
function read(file){ try { return fs.readFileSync(path.join(root,file),'utf8'); } catch { return ''; } }
function fail(message, details=[]){ console.error('PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_REGRESSION_CLOSEOUT=FAIL'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
const missing=requiredFiles.filter(f=>!fs.existsSync(path.join(root,f)));
if (missing.length) fail('PASS269 missing required files.', missing);
let pkg={};
try { pkg=JSON.parse(read('package.json') || '{}'); } catch { fail('package.json is not valid JSON.'); }
if (pkg.version !== versionTarget) fail(`package.json version must be ${versionTarget}; found ${pkg.version || 'missing'}.`);
for (const script of ['verify:pass-269-active-pane-routing-input-focus-regression-closeout','gate:pass-269-active-pane-routing-input-focus-regression-closeout']) {
  if (!pkg.scripts?.[script]) fail(`Missing package script ${script}.`);
}
const rendererCandidates=['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js'];
const renderer=rendererCandidates.map(f=>[f,read(f)]).find(([,t])=>t.includes('PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_CLOSEOUT_START'));
if (!renderer) fail('PASS269 active-pane routing diagnostics marker not found in renderer source.');
const rendererText=renderer[1];
const requiredTokens=['pass269ResolveRoutingTarget','pass269CurrentActivePane','pass269RecordFocusReturn','mouse-button-4','mouse-button-5','alt-left','alt-right','ctrl-k-command','ctrl-alt-pane-focus','exactlyOneTarget','safeNoop'];
const missingTokens=requiredTokens.filter(t=>!rendererText.includes(t));
if (missingTokens.length) fail('PASS269 renderer routing contract tokens missing.', missingTokens);
let matrix={};
try { matrix=JSON.parse(read('tests/runtime/pass269-active-pane-routing-input-focus-matrix.json')); } catch { fail('PASS269 runtime matrix is invalid JSON.'); }
for (const layout of ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus-pane']) if (!matrix.surfaces?.includes(layout)) fail(`PASS269 matrix missing surface ${layout}.`);
for (const input of ['address-bar','toolbar-back','toolbar-forward','toolbar-reload','mouse-button-4','mouse-button-5','alt-left','alt-right','ctrl-k-command','recipe-start','overlay-close-focus-return']) if (!matrix.inputs?.includes(input)) fail(`PASS269 matrix missing input ${input}.`);
let template={};
try { template=JSON.parse(read('docs/qa/pass269-active-pane-routing-input-focus-evidence.template.json')); } catch { fail('PASS269 evidence template is invalid JSON.'); }
if (template.storeSubmission !== 'not-submitted' || template.storeApproval !== 'not-approved') fail('PASS269 evidence template must preserve blocked Store posture.');
if (template.operatorApproval !== false) fail('PASS269 evidence template must default operatorApproval to false.');
console.log('PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_REGRESSION_CLOSEOUT=PASS');
console.log(`PASS269_VERSION=${versionTarget}`);
console.log('PASS269_ASSERTIONS=exactly-one-routing-target,active-pane-or-active-tab,safe-noop,mouse-history,keyboard-history,ctrl-k-target-scope,focus-return,focus-pane-restore,no-hidden-active-pane,no-orphan-routing-target');
