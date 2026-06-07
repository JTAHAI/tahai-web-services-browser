#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const root = process.cwd(); const failures = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const need = (condition, message) => { if (!condition) failures.push(message); };
for (const file of ['docs/kb/README.md','docs/kb/screenshot-intake.md','docs/kb/screenshot-manifest.json','docs/kb/article-authoring-contract.md','browser/onboarding/index.html','browser/onboarding/styles.css','browser/onboarding/kb-manifest.json','scripts/verify-pass-129-kb-repo-foundation.mjs','package.json']) need(exists(file), `missing ${file}`);
if (!failures.length) {
  const pkg = readJson('package.json');
  const kbManifest = readJson('browser/onboarding/kb-manifest.json');
  const screenshotManifest = readJson('docs/kb/screenshot-manifest.json');
  const html = read('browser/onboarding/index.html');
  const css = read('browser/onboarding/styles.css');
  const readme = read('docs/kb/README.md');
  const intake = read('docs/kb/screenshot-intake.md');
  const contract = read('docs/kb/article-authoring-contract.md');
  need(kbManifest.sourcePass === 'PASS129', 'KB manifest sourcePass must remain PASS129 for continuity');
  need(['PASS130','PASS131','PASS135','PASS136','PASS137'].includes(kbManifest.lastHardenedPass), 'KB manifest must record PASS130 or later hardening');
  need(kbManifest.screenshotManifest === 'docs/kb/screenshot-manifest.json', 'KB manifest must point to docs screenshot manifest');
  need([1,2].includes(screenshotManifest.schemaVersion), 'screenshot manifest schemaVersion must be 1 or PASS135 schemaVersion 2');
  need(['PASS130','PASS135'].includes(screenshotManifest.sourcePass), 'screenshot manifest sourcePass must be PASS130 or PASS135');
  need(Array.isArray(screenshotManifest.screenshots), 'screenshot manifest screenshots must be an array');
  need(Array.isArray(kbManifest.articles), 'KB manifest articles must be an array');
  need(screenshotManifest.screenshots.length === kbManifest.articles.length, 'screenshot manifest and KB manifest article counts must match');
  need(screenshotManifest.screenshots.length >= 18, 'screenshot manifest must keep at least the initial 18 screenshot slots');
  const byId = new Map(kbManifest.articles.map((article) => [article.id, article]));
  const orders = new Set(); const files = new Set(); const validPriorities = new Set(['required', 'recommended', 'optional']);
  for (const shot of screenshotManifest.screenshots) {
    const article = byId.get(shot.id);
    need(Boolean(article), `screenshot references unknown article ${shot.id}`);
    need(Number.isInteger(shot.order) && shot.order >= 1, `invalid screenshot order for ${shot.id}`);
    need(!orders.has(shot.order), `duplicate screenshot order ${shot.order}`); orders.add(shot.order);
    need(/^[a-z0-9-]+$/.test(shot.id || ''), `invalid screenshot article id ${shot.id}`);
    need(/^\d{2}-[a-z0-9-]+\.png$/.test(shot.fileName || ''), `invalid screenshot file name for ${shot.id}`);
    need(!files.has(shot.fileName), `duplicate screenshot file ${shot.fileName}`); files.add(shot.fileName);
    need(shot.docsTarget === `docs/kb/screenshots/${shot.fileName}`, `invalid docs target for ${shot.id}`);
    need(shot.appTarget === `browser/onboarding/screenshots/${shot.fileName}`, `invalid app target for ${shot.id}`);
    need(shot.article === `docs/kb/articles/${shot.id}.md`, `invalid article path for ${shot.id}`);
    need(validPriorities.has(shot.priority), `invalid priority for ${shot.id}`);
    need(typeof shot.capturePrompt === 'string' && shot.capturePrompt.length > 24, `missing useful capture prompt for ${shot.id}`);
    need(Array.isArray(shot.mustShow) && shot.mustShow.length >= 3, `mustShow checklist too thin for ${shot.id}`);
    need(Array.isArray(shot.avoid) && shot.avoid.length >= 2, `avoid checklist too thin for ${shot.id}`);
    need(['awaiting-user-screenshot','awaiting-or-ingestable'].includes(shot.status), `screenshot ${shot.id} should still await or be ingestable`);
    if (article) {
      need(article.screenshot === shot.fileName, `manifest screenshot mismatch for ${shot.id}`);
      need(article.screenOrder === shot.order, `manifest order mismatch for ${shot.id}`);
      need(article.captureTitle === shot.captureTitle, `manifest capture title mismatch for ${shot.id}`);
      need(article.capturePrompt === shot.capturePrompt, `manifest capture prompt mismatch for ${shot.id}`);
      need(article.priority === shot.priority, `manifest priority mismatch for ${shot.id}`);
    }
    need(exists(shot.article), `missing markdown article ${shot.article}`);
    if (exists(shot.article)) {
      const md = read(shot.article);
      need(md.includes('## Screenshot capture checklist'), `article missing screenshot checklist: ${shot.id}`);
      need(md.includes(shot.fileName), `article missing screenshot file: ${shot.id}`);
      need(md.includes(shot.capturePrompt), `article missing capture prompt: ${shot.id}`);
    }
    need(html.includes(`data-screenshot-id="${shot.fileName}"`), `HTML missing screenshot slot ${shot.fileName}`);
    need(html.includes(shot.capturePrompt), `HTML missing capture prompt ${shot.fileName}`);
    need(intake.includes(shot.fileName) && intake.includes(shot.capturePrompt), `intake doc missing ${shot.fileName}`);
    need(readme.includes(shot.fileName), `README missing screenshot ${shot.fileName}`);
  }
  need(html.includes('data-pass130-kb-screenshot-intake="true"'), 'onboarding HTML missing PASS130 marker');
  need(html.includes('id="capture-checklist"'), 'onboarding HTML missing capture checklist section');
  need(html.includes('Awaiting screenshot'), 'onboarding HTML must show awaiting-screenshot placeholders');
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)]; need(scriptTags.every((m) => /src=\"\.\/kb-search\.js\"/.test(m[1]) && /defer/.test(m[1])), 'KB page may only load the self-hosted deferred kb-search.js script'); need(html.includes("script-src 'self'"), 'KB CSP must keep scripts self-hosted only');
  need(!html.includes('Authorization:') && !html.includes('Bearer '), 'KB HTML must not include auth secret examples');
  need(css.includes('data-pass130-kb-screenshot-intake') && css.includes('.capture-checklist'), 'KB CSS missing PASS130 capture checklist styling');
  need(readme.includes('PASS130 screenshot intake hardening'), 'README missing PASS130 hardening section');
  need(intake.includes('Global capture rules') && intake.includes('Screenshot list'), 'screenshot intake doc missing required sections');
  need(contract.includes('Required article shape') && contract.includes('Sync rule'), 'authoring contract missing required rules');
  const allowlistedScreenshots = new Set(files);
  const screenshotDirs = ['browser/onboarding/screenshots', 'docs/kb/screenshots'];
  const committedScreenshots = [];
  for (const dir of screenshotDirs) {
    if (!exists(dir)) continue;
    for (const entry of fs.readdirSync(rel(dir))) {
      if (entry === '.gitkeep' || entry === 'README.md') continue;
      if (!allowlistedScreenshots.has(entry)) committedScreenshots.push(`${dir}/${entry}`);
    }
  }
  need(committedScreenshots.length === 0, `PASS135 permits only allowlisted KB screenshots; unlisted files found: ${committedScreenshots.join(', ')}`);
  for (const forbidden of ['node_modules', 'dist', 'release', '.git', '.pass-runs', 'artifacts']) need(!Array.from(files).some((file) => file.includes(forbidden)), `screenshot manifest must not reference ${forbidden}`);
  need(pkg.scripts?.['verify:pass-130-kb-screenshot-intake'] === 'node scripts/verify-pass-130-kb-screenshot-intake.mjs', 'missing package script for PASS130');
  need(getReleaseBlockersContract(pkg).includes('verify:pass-130-kb-screenshot-intake'), 'release blockers missing PASS130');
}
if (failures.length) { console.error('PASS130 KB screenshot intake verification failed:'); for (const failure of failures) console.error(` - ${failure}`); process.exit(1); }
console.log('PASS130 KB screenshot intake verification passed.');
