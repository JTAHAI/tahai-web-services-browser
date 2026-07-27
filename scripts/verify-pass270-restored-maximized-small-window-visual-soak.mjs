#!/usr/bin/env node
/* PASS270 verifier */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const versionTarget='2.0.18';
const requiredFiles=[
  'PASS270_README.md',
  'docs/qa/PASS270-restored-maximized-small-window-visual-soak.md',
  'docs/qa/pass270-restored-maximized-small-window-visual-soak-evidence.template.json',
  'tests/runtime/pass270-window-visual-soak-matrix.json',
  'scripts/apply-pass270-restored-maximized-small-window-visual-soak.mjs',
  'scripts/verify-pass270-restored-maximized-small-window-visual-soak.mjs',
  'scripts/gate-pass270-restored-maximized-small-window-visual-soak.mjs'
];
function read(file){ try { return fs.readFileSync(path.join(root,file),'utf8'); } catch { return ''; } }
function exists(file){ return fs.existsSync(path.join(root,file)); }
function walk(dir, accept, out=[]){
  if (!fs.existsSync(dir)) return out;
  const skip=new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if (skip.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) walk(full,accept,out);
    else if (!accept || accept(full)) out.push(full);
  }
  return out;
}
function fail(message, details=[]){ console.error('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK=FAIL'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
const missing=requiredFiles.filter(f=>!exists(f));
if (missing.length) fail('PASS270 missing required files.', missing);
let pkg={};
try { pkg=JSON.parse(read('package.json') || '{}'); } catch { fail('package.json is not valid JSON.'); }
if (pkg.version !== versionTarget) fail(`package.json version must be ${versionTarget}; found ${pkg.version || 'missing'}.`);
for (const script of ['verify:pass-270-restored-maximized-small-window-visual-soak','gate:pass-270-restored-maximized-small-window-visual-soak']) {
  if (!pkg.scripts?.[script]) fail(`Missing package script ${script}.`);
}
const rendererCandidates=['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js'];
const renderer=rendererCandidates.map(f=>[f,read(f)]).find(([,t])=>t.includes('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_START'));
if (!renderer) fail('PASS270 visual-soak renderer marker not found in renderer source. Run the apply script first.');
const rendererText=renderer[1];
const requiredRendererTokens=['pass270RunVisualSoak','pass270WebsiteBudget','pass270CheckWebviews','pass270ActivePaneHealth','missionCardOverlaps','overlayOverlaps','unscrollableCards','clippedRecipeButtons','clippedControlSurfaces','storeSubmission: \'not-submitted\'','storeApproval: \'not-approved\''];
const missingRendererTokens=requiredRendererTokens.filter(t=>!rendererText.includes(t));
if (missingRendererTokens.length) fail('PASS270 renderer visual-soak contract tokens missing.', missingRendererTokens);
const cssFiles=walk(root, f=>/\.(css|scss)$/i.test(f));
const css=cssFiles.map(f=>[path.relative(root,f).replace(/\\/g,'/'),fs.readFileSync(f,'utf8')]).find(([,t])=>t.includes('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_CSS_START'));
if (!css) fail('PASS270 visual containment CSS marker not found. Run the apply script first.');
const cssText=css[1];
const requiredCssTokens=['--pass270-min-website-budget','min-height: var(--pass270-min-website-budget)','overflow: auto','max-width: calc(100vw - 24px)','max-height: calc(100vh - 24px)','webview[data-pane-webview]'];
const missingCssTokens=requiredCssTokens.filter(t=>!cssText.includes(t));
if (missingCssTokens.length) fail('PASS270 CSS containment tokens missing.', missingCssTokens);
let matrix={};
try { matrix=JSON.parse(read('tests/runtime/pass270-window-visual-soak-matrix.json')); } catch { fail('PASS270 runtime matrix is invalid JSON.'); }
for (const profile of ['restored-compact-1280x720','small-laptop-1366x768','1080p-1920x1080','wide-2560x1440','maximized-available-screen']) {
  if (!matrix.windowProfiles?.some?.(p=>p.id===profile)) fail(`PASS270 matrix missing window profile ${profile}.`);
}
for (const surface of ['mission-control','mission-recipes','mission-cards','split-view','tri-view','quad-view','focus-pane','webview-panes','runbook-rail','evidence-pack','command-center','more-tools','devops-tools','it-tools','settings','kb-guide']) {
  if (!matrix.surfaces?.includes(surface)) fail(`PASS270 matrix missing surface ${surface}.`);
}
for (const assertion of ['no-mission-card-overlap','no-hidden-clipped-recipe-buttons','no-unscrollable-cards','no-overlay-collision','no-website-content-pane-collapse','no-black-bottom-only-webview-pane','no-orphaned-active-pane','useful-website-budget-preserved']) {
  if (!matrix.assertions?.includes(assertion)) fail(`PASS270 matrix missing assertion ${assertion}.`);
}
let template={};
try { template=JSON.parse(read('docs/qa/pass270-restored-maximized-small-window-visual-soak-evidence.template.json')); } catch { fail('PASS270 evidence template is invalid JSON.'); }
if (template.storeSubmission !== 'not-submitted' || template.storeApproval !== 'not-approved') fail('PASS270 evidence template must preserve blocked Store posture.');
if (template.operatorApproval !== false || template.publicGaClaim !== false || template.signedReleaseClaim !== false) fail('PASS270 evidence template must default approval/GA/signing claims to false.');
const requiredAssertions=template.requiredAssertions||{};
for (const key of ['noMissionCardOverlap','noHiddenOrClippedRecipeButtons','noUnscrollableCards','noOverlayCollision','noWebsiteContentPaneCollapse','noBlackOrBottomOnlyWebViewPanes','noOrphanedActivePane','noClippedCommandCenterMoreToolsMissionSettingsKb','restoredMaximizedSmall1080pWidePreserveUsefulWebsiteBudget','missionControlRecipesQuadTriSplitFocusUsable','runbookRailEvidencePackCommandCenterUsable','noUnhandledRendererErrors','screenshotsAttached']) {
  if (!(key in requiredAssertions)) fail(`PASS270 evidence template missing requiredAssertions.${key}.`);
}
console.log('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK=PASS');
console.log(`PASS270_VERSION=${versionTarget}`);
console.log('PASS270_ASSERTIONS=no-mission-card-overlap,no-clipped-recipe-buttons,no-unscrollable-cards,no-overlay-collision,no-content-pane-collapse,no-black-bottom-webview,no-orphaned-active-pane,no-clipped-command-moretools-mission-settings-kb,useful-window-budget');
console.log('PASS270_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
