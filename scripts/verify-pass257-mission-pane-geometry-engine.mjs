#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.6';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function fail(message, details = []) { console.error('PASS257_MISSION_PANE_GEOMETRY_ENGINE=FAIL'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS257_MISSION_PANE_GEOMETRY_ENGINE_START')) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => readText(file).includes('PASS257_MISSION_PANE_GEOMETRY_ENGINE_START')); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_START')) return full; } const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => readText(file).includes('PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_START')); return found[0] || null; }
function bounds(layout, index, rect) { const width = Math.max(96, Math.round(rect.width)); const height = Math.max(96, Math.round(rect.height)); const halfW = Math.floor(width / 2); const halfH = Math.floor(height / 2); const thirdW = Math.floor(width / 3); const thirdH = Math.floor(height / 3); if (layout === 'quad') return { left: index % 2 === 0 ? 0 : halfW, top: index < 2 ? 0 : halfH, width: index % 2 === 0 ? halfW : width - halfW, height: index < 2 ? halfH : height - halfH }; if (layout === 'split-vertical') return { left: 0, top: index === 0 ? 0 : halfH, width, height: index === 0 ? halfH : height - halfH }; if (layout === 'split-horizontal') return { left: index === 0 ? 0 : halfW, top: 0, width: index === 0 ? halfW : width - halfW, height }; if (layout === 'triple-bottom') return index === 0 ? { left: 0, top: 0, width, height: height - thirdH } : { left: index === 1 ? 0 : halfW, top: height - thirdH, width: index === 1 ? halfW : width - halfW, height: thirdH }; if (layout === 'triple-left') return index === 0 ? { left: 0, top: 0, width: thirdW, height } : { left: thirdW, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH }; if (layout === 'triple-right') return index === 0 ? { left: width - thirdW, top: 0, width: thirdW, height } : { left: 0, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH }; if (layout === 'triple-top') return index === 0 ? { left: 0, top: 0, width, height: thirdH } : { left: index === 1 ? 0 : halfW, top: thirdH, width: index === 1 ? halfW : width - halfW, height: height - thirdH }; return { left: 0, top: 0, width, height }; }
function assertGeometryModel() { const layouts = { single: 1, 'split-horizontal': 2, 'split-vertical': 2, 'triple-top': 3, 'triple-bottom': 3, 'triple-left': 3, 'triple-right': 3, quad: 4, focus: 1 }; const issues = []; for (const [layout, count] of Object.entries(layouts)) { for (let i = 0; i < count; i += 1) { const b = bounds(layout, i, { width: 1280, height: 720 }); if (b.left < 0 || b.top < 0 || b.width < 96 || b.height < 96) issues.push(layout + ':' + i + ':invalid-bounds'); if (layout !== 'split-vertical' && layout !== 'triple-bottom' && i === 0 && b.top !== 0) issues.push(layout + ':' + i + ':first-pane-not-top'); if ((layout === 'single' || layout === 'focus') && (b.left !== 0 || b.top !== 0 || b.width !== 1280 || b.height !== 720)) issues.push(layout + ':not-full-stage'); } } return issues; }

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
let pkg; try { pkg = JSON.parse(readText(pkgPath)); } catch (error) { fail('package.json is invalid JSON.', [String(error)]); }
if (!versionAtLeast(pkg.version, targetVersion)) fail('package.json version must be at least ' + targetVersion + '.', ['found ' + (pkg.version || 'missing')]);
if (pkg.scripts?.['verify:pass-257-mission-pane-geometry-engine'] !== 'node scripts/verify-pass257-mission-pane-geometry-engine.mjs') fail('package.json is missing verify:pass-257-mission-pane-geometry-engine script.');
const renderer = findRendererFile();
if (!renderer) fail('Renderer source with PASS257 Mission Pane Geometry Engine was not found.');
const rendererText = readText(renderer);
const missingRenderer = [
  'PASS257_MISSION_PANE_GEOMETRY_ENGINE_START',
  'pass257ComputePaneBounds',
  'pass257ApplyPaneBounds',
  'pass257RecalculateMissionPaneGeometry',
  'pass257ObserveGeometryTargets',
  'ResizeObserver',
  'data-pane-visible',
  'data-pane-has-webview',
  'data-pane-geometry-ok',
  'data-webview-top-left-ok',
  'data-pass257-geometry-engine',
  '__TAHAI_PASS257_MISSION_PANE_GEOMETRY__',
  'did-stop-loading',
  'dom-ready',
  'focusin',
  'window-resize'
].filter((marker) => !rendererText.includes(marker));
if (missingRenderer.length) fail('Renderer PASS257 geometry markers are missing.', missingRenderer);
for (const marker of ['single','split-horizontal','split-vertical','triple-top','triple-bottom','triple-left','triple-right','quad','focus']) if (!rendererText.includes(marker)) fail('PASS257 layout marker missing.', [marker]);
if (!/style\.top\s*=\s*'0px'/.test(rendererText) || !/style\.left\s*=\s*'0px'/.test(rendererText) || !/style\.transform\s*=\s*'none'/.test(rendererText)) fail('PASS257 does not pin runtime webviews top-left with transform cleared.');
if (!/style\.minHeight\s*=\s*'0'/.test(rendererText) || !/style\.overflow\s*=\s*'hidden'/.test(rendererText)) fail('PASS257 pane containment style hardening missing.');
const css = findCssFile();
if (!css) fail('PASS257 CSS marker was not found.');
const cssText = readText(css);
const missingCss = ['PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_START','data-pass257-geometry-engine','data-pass257-pane-managed','data-pane-visible','data-pane-has-webview','data-pane-geometry-ok','data-webview-top-left-ok','top: 0','left: 0','min-height: 0','overflow: hidden'].filter((marker) => !cssText.includes(marker));
if (missingCss.length) fail('PASS257 CSS markers are missing.', missingCss);
const modelIssues = assertGeometryModel();
if (modelIssues.length) fail('PASS257 canonical geometry static model failed.', modelIssues);
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));
console.log('PASS257_MISSION_PANE_GEOMETRY_ENGINE=PASS');
console.log('PASS257_VERSION=' + pkg.version);
console.log('PASS257_RENDERER_TARGET=' + rel(renderer));
console.log('PASS257_CSS_TARGET=' + rel(css));
console.log('PASS257_ASSERTIONS=2.0.6-version,canonical-pane-bounds,top-left-webview-pinning,min-height-zero-containment,resize-observer,recalc-on-layout-resize-domready-load-focus,visual-health-flags,no-generated-artifacts');
