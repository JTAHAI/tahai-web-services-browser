#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const failures = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'browser/onboarding/index.html',
  'browser/onboarding/styles.css',
  'browser/onboarding/kb-search.js',
  'browser/onboarding/kb-manifest.json',
  'docs/kb/search-index.json',
  'docs/kb/README.md',
  'docs/kb/article-authoring-contract.md',
  'docs/kb/pass-131-kb-search-navigation-polish.md',
  'PASS_131_KB_SEARCH_NAVIGATION_POLISH_SUMMARY.md',
  'scripts/verify-pass-129-kb-repo-foundation.mjs',
  'scripts/verify-pass-130-kb-screenshot-intake.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('browser/onboarding/index.html');
  const css = read('browser/onboarding/styles.css');
  const js = read('browser/onboarding/kb-search.js');
  const manifest = readJson('browser/onboarding/kb-manifest.json');
  const index = readJson('docs/kb/search-index.json');
  const readme = read('docs/kb/README.md');
  const contract = read('docs/kb/article-authoring-contract.md');
  const summary = read('PASS_131_KB_SEARCH_NAVIGATION_POLISH_SUMMARY.md');
  const verify129 = read('scripts/verify-pass-129-kb-repo-foundation.mjs');
  const verify130 = read('scripts/verify-pass-130-kb-screenshot-intake.mjs');
  const pkg = readJson('package.json');

  need(manifest.lastHardenedPass === 'PASS131', 'KB manifest must record PASS131 hardening');
  need(manifest.searchIndex === 'docs/kb/search-index.json', 'KB manifest must point to search index');
  need(typeof manifest.searchPolicy === 'string' && manifest.searchPolicy.includes('No inline script') && manifest.searchPolicy.includes('remote script'), 'KB manifest must document strict search policy');
  need(index.schemaVersion === 1, 'KB search index schemaVersion must be 1');
  need(index.sourcePass === 'PASS131', 'KB search index sourcePass must be PASS131');
  need(Array.isArray(index.entries) && index.entries.length === manifest.articles.length, 'KB search index must mirror manifest articles');

  const manifestById = new Map(manifest.articles.map((article) => [article.id, article]));
  const indexIds = new Set();
  for (const entry of index.entries) {
    const article = manifestById.get(entry.id);
    need(Boolean(article), `search index references unknown article ${entry.id}`);
    need(!indexIds.has(entry.id), `duplicate search index article ${entry.id}`);
    indexIds.add(entry.id);
    need(Array.isArray(entry.keywords) && entry.keywords.length >= 4, `search index keywords too thin for ${entry.id}`);
    need(article && article.title === entry.title, `search index title mismatch for ${entry.id}`);
    need(article && article.screenshot === entry.screenshot, `search index screenshot mismatch for ${entry.id}`);
    need(article && Array.isArray(article.keywords) && article.keywords.join('|') === entry.keywords.join('|'), `manifest/search keyword mismatch for ${entry.id}`);
    need(html.includes(`id="${entry.id}"`), `HTML missing article ${entry.id}`);
    need(html.includes(`data-kb-target="${entry.id}"`), `HTML missing search-aware nav link for ${entry.id}`);
    need(html.includes(`data-kb-search=`) && html.includes(entry.screenshot), `HTML missing searchable metadata or screenshot for ${entry.id}`);
  }

  need(html.includes('data-pass131-kb-search-navigation="true"'), 'HTML missing PASS131 marker');
  need(html.includes('id="kb-search-panel"'), 'HTML missing KB search panel');
  need(html.includes('data-kb-search-input'), 'HTML missing KB search input');
  need(html.includes('data-kb-search-clear'), 'HTML missing KB search clear control');
  for (const filter of ['mission','tri-view','tools','evidence','installers','troubleshooting']) need(html.includes(`data-kb-filter="${filter}"`), `HTML missing quick filter ${filter}`);
  need(html.includes('<script src="./kb-search.js" defer></script>'), 'HTML must load only the deferred self-hosted KB search script');
  need(html.includes("script-src 'self'"), 'HTML CSP must restrict scripts to self');
  need(!html.includes('http://') && !html.includes('https://'), 'KB HTML must not load remote links or scripts');
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
  need(scriptTags.length === 1, 'KB HTML must have exactly one script tag');
  need(scriptTags.every((m) => /src="\.\/kb-search\.js"/.test(m[1]) && /defer/.test(m[1])), 'KB script tag must be the deferred local kb-search.js only');

  need(css.includes('PASS131') && css.includes('.kb-search-panel') && css.includes('.kb-search-empty'), 'KB CSS missing PASS131 search styling');
  need(js.includes('data-kb-search-input') && js.includes('data-kb-filter') && js.includes('pass131KbSearchReady'), 'KB search JS missing required hooks');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'document.cookie', 'eval(', 'Function(']) need(!js.includes(forbidden), `KB search JS must not use ${forbidden}`);
  need(!/https?:\/\//i.test(js), 'KB search JS must not reference remote URLs');
  need(!/Authorization:|Bearer |x-api-key|access_token|refresh_token/i.test(html + js + JSON.stringify(index)), 'KB search surface must not include secret examples');

  need(verify129.includes('kb-search.js') && verify129.includes("script-src 'self'"), 'PASS129 verifier must tolerate only strict local KB script');
  need(verify130.includes('kb-search.js') && verify130.includes("script-src 'self'"), 'PASS130 verifier must tolerate only strict local KB script');
  need(readme.includes('PASS131 search/navigation polish'), 'KB README missing PASS131 note');
  need(contract.includes('PASS131 search metadata rule'), 'KB authoring contract missing PASS131 metadata rule');
  need(summary.includes('Version') && summary.includes('1.8.30 unchanged'), 'PASS131 summary must preserve version truth');

  const screenshotFiles = new Set((manifest.articles || []).map((article) => article.screenshot));
  const committedScreenshots = [...screenshotFiles].filter((file) => exists(`browser/onboarding/screenshots/${file}`) || exists(`docs/kb/screenshots/${file}`));
  need(committedScreenshots.length === 0, `real screenshots should not be committed in PASS131: ${committedScreenshots.join(', ')}`);

  need(pkg.scripts?.['verify:pass-131-kb-search-navigation-polish'] === 'node scripts/verify-pass-131-kb-search-navigation-polish.mjs', 'missing package script for PASS131');
  need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-131-kb-search-navigation-polish'), 'release blockers missing PASS131');
}

if (failures.length) {
  console.error('PASS131 KB search/navigation verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('PASS131 KB search/navigation verification passed.');
