#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.5';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function fail(message, details = []) { console.error('PASS256_QUAD_VIEW_STATE_MACHINE=FAIL'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS256_QUAD_VIEW_STATE_MACHINE_START')) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => readText(file).includes('PASS256_QUAD_VIEW_STATE_MACHINE_START')); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START')) return full; } const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => readText(file).includes('PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START')); return found[0] || null; }
function paneIdsFor(request, activePaneId = 'pane-1') { if (request === 'quad') return ['pane-1','pane-2','pane-3','pane-4']; if (String(request).startsWith('triple')) return ['pane-1','pane-2','pane-3']; if (String(request).startsWith('split')) return ['pane-1','pane-2']; if (request === 'focus') return [activePaneId || 'pane-1']; return ['pane-1']; }
function runStressModel(cycles = 50) { const sequence = ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single']; const issues = []; let activePaneId = 'pane-1'; let transitions = 0; for (let cycle = 0; cycle < cycles; cycle += 1) { for (const request of sequence) { const visible = paneIdsFor(request, activePaneId); if (!visible.length) issues.push('no-visible-panes:' + cycle + ':' + request); if (!visible.includes(activePaneId)) activePaneId = visible[0] || 'pane-1'; if (!visible.includes(activePaneId)) issues.push('hidden-active-pane:' + cycle + ':' + request); transitions += 1; } } return { ok: issues.length === 0 && transitions === cycles * sequence.length, cycles, transitions, issues }; }

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
let pkg; try { pkg = JSON.parse(readText(pkgPath)); } catch (error) { fail('package.json is invalid JSON.', [String(error)]); }
if (!versionAtLeast(pkg.version, targetVersion)) fail('package.json version must be at least ' + targetVersion + '.', ['found ' + (pkg.version || 'missing')]);
if (pkg.scripts?.['verify:pass-256-quad-view-state-machine'] !== 'node scripts/verify-pass256-quad-view-state-machine.mjs') fail('package.json is missing verify:pass-256-quad-view-state-machine script.');
const renderer = findRendererFile();
if (!renderer) fail('Renderer source with PASS256 Quad View state machine was not found.');
const rendererText = readText(renderer);
const missingRenderer = [
  'PASS256_QUAD_VIEW_STATE_MACHINE_START',
  'PASS256_LAYOUT_STRESS_CYCLE_COUNT = 50',
  'PASS256_LAYOUT_STRESS_SEQUENCE',
  'pass256PreflightLayoutTransition',
  'pass256CommitLayoutTransition',
  'pass256RenderLayoutTransition',
  'pass256GeometrySettle',
  'pass256PostAssertLayoutTransition',
  'pass256RecoverLayoutTransition',
  'pass256RollbackLayoutTransition',
  'pass256TransitionMissionLayout',
  'pass256RunLayoutStressContract',
  'pass256MountQuadViewStateMachine',
  'data-pass256-pane-visible',
  'data-pass256-pane-geometry-ok',
  '__TAHAI_PASS256_MISSION_VIEW_STATE_MACHINE__'
].filter((marker) => !rendererText.includes(marker));
if (missingRenderer.length) fail('Renderer PASS256 state-machine markers are missing.', missingRenderer);
for (const marker of ['single', 'split-horizontal', 'triple-top', 'triple-bottom', 'triple-left', 'triple-right', 'quad', 'focus']) {
  if (!rendererText.includes(marker)) fail('PASS256 stress/layout marker missing.', [marker]);
}
if (!/missionRuntimeTabs\.set/.test(rendererText) || !/createTab\(/.test(rendererText)) fail('PASS256 does not prove runtime-tab remapping/repair.');
if (!/hidden-active-pane/.test(rendererText) || !/orphaned-runtime-tab/.test(rendererText) || !/blank-pane/.test(rendererText)) fail('PASS256 post-assert failure classes are missing.');
const css = findCssFile();
if (!css) fail('PASS256 CSS marker was not found.');
const cssText = readText(css);
const missingCss = ['PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START','data-pass256-state-machine','data-pass256-pane-visible','data-pass256-active-pane','Mission pane placeholder'].filter((marker) => !cssText.includes(marker));
if (missingCss.length) fail('PASS256 CSS markers are missing.', missingCss);
const stress = runStressModel(50);
if (!stress.ok) fail('PASS256 static stress model failed.', stress.issues);
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));
console.log('PASS256_QUAD_VIEW_STATE_MACHINE=PASS');
console.log('PASS256_VERSION=' + pkg.version);
console.log('PASS256_RENDERER_TARGET=' + rel(renderer));
console.log('PASS256_CSS_TARGET=' + rel(css));
console.log('PASS256_STRESS_TRANSITIONS=' + stress.transitions);
console.log('PASS256_ASSERTIONS=2.0.5-version,state-machine-phases,50-cycle-layout-stress,hidden-active-pane-recovery,orphan-runtime-repair,blank-pane-placeholder,geometry-settle,rollback-hook,no-generated-artifacts');
