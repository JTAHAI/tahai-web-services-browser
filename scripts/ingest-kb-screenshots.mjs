#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueAfter = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 && args[i+1] ? args[i+1] : fallback; };
const apply = has('--apply');
const strict = has('--strict');
const sourceDir = valueAfter('--source', 'docs/kb/screenshots');
const reportPath = valueAfter('--report', 'artifacts/kb/kb-screenshot-ingestion-report.json');
const maxBytes = 8 * 1024 * 1024;
const pngSignature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const failures=[]; const warnings=[]; const copied=[]; const missing=[]; const checked=[];
const fail=(m)=>failures.push(m); const warn=(m)=>warnings.push(m); const rel=(p)=>path.join(root,p);
const readJson=(p)=>JSON.parse(fs.readFileSync(rel(p),'utf8'));
function isInside(parent, child){ const r=path.relative(parent,child); return r==='' || (!!r && !r.startsWith('..') && !path.isAbsolute(r)); }
function ensureInsideRoot(relativePath,label){ const resolved=path.resolve(root, relativePath); if(!isInside(root,resolved)) fail(`${label} escapes repo root: ${relativePath}`); return resolved; }
function validatePng(file, expectedName){ const stat=fs.statSync(file); if(!stat.isFile()) return `${expectedName} is not a regular file`; if(stat.size<=pngSignature.length) return `${expectedName} is too small to be a valid PNG`; if(stat.size>maxBytes) return `${expectedName} exceeds max size ${maxBytes} bytes`; const fd=fs.openSync(file,'r'); const header=Buffer.alloc(pngSignature.length); fs.readSync(fd,header,0,header.length,0); fs.closeSync(fd); if(!header.equals(pngSignature)) return `${expectedName} does not have a PNG signature`; return null; }
const screenshotManifestPath='docs/kb/screenshot-manifest.json'; const appManifestPath='browser/onboarding/kb-manifest.json';
if(!fs.existsSync(rel(screenshotManifestPath))) fail(`missing ${screenshotManifestPath}`); if(!fs.existsSync(rel(appManifestPath))) fail(`missing ${appManifestPath}`);
let screenshotManifest={screenshots:[]}; let appManifest={articles:[]}; if(!failures.length){ screenshotManifest=readJson(screenshotManifestPath); appManifest=readJson(appManifestPath); }
const screenshots=Array.isArray(screenshotManifest.screenshots)?screenshotManifest.screenshots:[];
const appScreenshots=new Set((appManifest.articles||[]).map((a)=>a.screenshot).filter(Boolean)); const expectedNames=new Set();
for(const shot of screenshots){ const name=shot.fileName; if(!/^[0-9]{2}-[a-z0-9-]+\.png$/.test(name||'')){ fail(`invalid screenshot fileName in manifest: ${name}`); continue; } if(expectedNames.has(name)) fail(`duplicate screenshot fileName: ${name}`); expectedNames.add(name); if(!appScreenshots.has(name)) fail(`browser/onboarding/kb-manifest.json missing screenshot ${name}`); if(shot.docsTarget!==`docs/kb/screenshots/${name}`) fail(`docsTarget mismatch for ${name}`); if(shot.appTarget!==`browser/onboarding/screenshots/${name}`) fail(`appTarget mismatch for ${name}`); }
const sourceRoot=ensureInsideRoot(sourceDir,'source directory'); const docsRoot=ensureInsideRoot('docs/kb/screenshots','docs screenshot directory'); const appRoot=ensureInsideRoot('browser/onboarding/screenshots','app screenshot directory');
if(fs.existsSync(sourceRoot)){ for(const entry of fs.readdirSync(sourceRoot)){ if(entry==='.gitkeep'||entry==='README.md') continue; const full=path.join(sourceRoot,entry); if(!expectedNames.has(entry)) fail(`unlisted file in screenshot source: ${path.relative(root,full)}`); } }
for(const name of expectedNames){ const source=path.join(sourceRoot,name); if(!fs.existsSync(source)){ missing.push(name); continue; } const pngError=validatePng(source,name); if(pngError){ fail(pngError); continue; } checked.push(name); if(apply){ fs.mkdirSync(docsRoot,{recursive:true}); fs.mkdirSync(appRoot,{recursive:true}); const docsTarget=path.join(docsRoot,name); const appTarget=path.join(appRoot,name); if(path.resolve(source)!==path.resolve(docsTarget)) fs.copyFileSync(source,docsTarget); fs.copyFileSync(path.resolve(docsTarget),appTarget); copied.push(name); } }
if(strict&&missing.length) fail(`strict mode missing screenshots: ${missing.join(', ')}`); if(!checked.length) warn('no screenshots ingested yet; awaiting-screenshot placeholders remain valid');
const report={ok:failures.length===0,mode:apply?'apply':'check',sourceDir:path.relative(root,sourceRoot)||'.',manifest:screenshotManifestPath,expectedCount:expectedNames.size,checkedCount:checked.length,copiedCount:copied.length,missingCount:missing.length,checked,copied,missing,warnings,failures};
if(apply||has('--report')){ const target=ensureInsideRoot(reportPath,'report path'); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n'); }
if(failures.length){ console.error('KB screenshot ingestion failed:'); for(const f of failures) console.error(` - ${f}`); process.exit(1); }
console.log(`KB screenshot ingestion ${apply?'apply':'check'} passed.`); console.log(`expected=${expectedNames.size} checked=${checked.length} copied=${copied.length} missing=${missing.length}`); if(warnings.length) for(const m of warnings) console.warn(`warning: ${m}`);
