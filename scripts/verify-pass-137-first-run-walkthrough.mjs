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
  'docs/kb/README.md',
  'docs/kb/article-authoring-contract.md',
  'docs/kb/screenshot-intake.md',
  'docs/kb/screenshot-manifest.json',
  'docs/kb/search-index.json',
  'docs/kb/articles/first-run-walkthrough.md',
  'docs/kb/pass-137-first-run-walkthrough.md',
  'PASS_137_FIRST_RUN_WALKTHROUGH_SUMMARY.md',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('browser/onboarding/index.html');
  const css = read('browser/onboarding/styles.css');
  const js = read('browser/onboarding/kb-search.js');
  const manifest = readJson('browser/onboarding/kb-manifest.json');
  const screenshots = readJson('docs/kb/screenshot-manifest.json');
  const search = readJson('docs/kb/search-index.json');
  const article = read('docs/kb/articles/first-run-walkthrough.md');
  const readme = read('docs/kb/README.md');
  const contract = read('docs/kb/article-authoring-contract.md');
  const intake = read('docs/kb/screenshot-intake.md');
  const summary = read('PASS_137_FIRST_RUN_WALKTHROUGH_SUMMARY.md');
  const pkg = readJson('package.json');

  need(html.includes('data-pass137-first-run-walkthrough="true"'), 'HTML missing PASS137 body/panel marker');
  need(html.includes('id="first-run-walkthrough-panel"'), 'HTML missing walkthrough panel');
  need(html.includes('data-kb-walkthrough-start'), 'HTML missing Start walkthrough control');
  need(html.includes('data-kb-walkthrough-step'), 'HTML missing walkthrough step links');
  need(html.includes('id="first-run-walkthrough"'), 'HTML missing first-run walkthrough article');
  need(html.includes('data-screenshot-id="19-first-run-walkthrough.png"'), 'HTML missing first-run screenshot slot');
  need(html.includes('data-kb-filter="walkthrough"'), 'HTML missing walkthrough quick filter');
  for (const anchor of ['getting-started','guide-kb','mission-control','mission-tabs','mission-views','active-pane-routing','runbook-rail','command-center','devops-tools','it-tools','evidence-export','settings-security','troubleshooting-states']) {
    need(html.includes(`data-kb-walkthrough-target="${anchor}"`) || html.includes(`href="#${anchor}"`), `HTML walkthrough missing ${anchor}`);
  }
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
  need(scriptTags.length === 1, 'KB HTML must have exactly one script tag');
  need(scriptTags.every((m) => /src="\.\/kb-search\.js"/.test(m[1]) && /defer/.test(m[1])), 'KB script tag must remain the deferred local kb-search.js only');
  need(html.includes("script-src 'self'"), 'HTML CSP must keep scripts self-hosted only');
  need(!/https?:\/\//i.test(html), 'KB HTML must not load remote links or assets');

  need(css.includes('PASS137 — first-run walkthrough'), 'CSS missing PASS137 block');
  for (const needle of ['kb-walkthrough-panel','kb-walkthrough-start','kb-walkthrough-steps','kb-walkthrough-active']) need(css.includes(needle), `CSS missing ${needle}`);

  need(js.includes('pass137KbWalkthroughReady'), 'KB JS missing PASS137 readiness marker');
  need(js.includes('focusWalkthroughTarget'), 'KB JS missing walkthrough focus helper');
  need(js.includes('data-kb-walkthrough-step'), 'KB JS missing walkthrough step handling');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'document.cookie', 'eval(', 'Function(']) need(!js.includes(forbidden), `KB JS must not use ${forbidden}`);
  need(!/https?:\/\//i.test(js), 'KB JS must not reference remote URLs');

  need(manifest.sourcePass === 'PASS129', 'KB manifest sourcePass must remain PASS129');
  need(manifest.lastHardenedPass === 'PASS137', 'KB manifest lastHardenedPass must be PASS137');
  need(manifest.walkthroughPolicy?.sourcePass === 'PASS137', 'KB manifest missing PASS137 walkthrough policy');
  need(manifest.walkthroughPolicy?.localOnly === true, 'walkthrough policy must be local-only');
  need(manifest.walkthroughPolicy?.noTelemetry === true, 'walkthrough policy must forbid telemetry');
  need(manifest.walkthroughPolicy?.noStorage === true, 'walkthrough policy must forbid browser storage');
  const walkthroughArticle = (manifest.articles || []).find((item) => item.id === 'first-run-walkthrough');
  need(Boolean(walkthroughArticle), 'KB manifest missing first-run walkthrough article');
  if (walkthroughArticle) {
    need(walkthroughArticle.screenshot === '19-first-run-walkthrough.png', 'walkthrough manifest screenshot mismatch');
    need(walkthroughArticle.screenOrder === 19, 'walkthrough manifest order mismatch');
    need(walkthroughArticle.screenshotStatus === 'awaiting-or-ingestable', 'walkthrough screenshot status mismatch');
  }

  need(screenshots.lastHardenedPass === 'PASS137', 'screenshot manifest lastHardenedPass must be PASS137');
  need(screenshots.walkthroughScreenshotPolicy?.sourcePass === 'PASS137', 'screenshot manifest missing PASS137 policy');
  const slot = (screenshots.screenshots || []).find((item) => item.id === 'first-run-walkthrough');
  need(Boolean(slot), 'screenshot manifest missing first-run walkthrough slot');
  if (slot) {
    need(slot.fileName === '19-first-run-walkthrough.png', 'walkthrough screenshot file mismatch');
    need(slot.docsTarget === 'docs/kb/screenshots/19-first-run-walkthrough.png', 'walkthrough docs screenshot target mismatch');
    need(slot.appTarget === 'browser/onboarding/screenshots/19-first-run-walkthrough.png', 'walkthrough app screenshot target mismatch');
    need(Array.isArray(slot.mustShow) && slot.mustShow.length >= 3, 'walkthrough screenshot mustShow too thin');
    need(Array.isArray(slot.avoid) && slot.avoid.length >= 2, 'walkthrough screenshot avoid too thin');
  }

  need(search.lastHardenedPass === 'PASS137', 'search index lastHardenedPass must be PASS137');
  need(search.walkthroughSearchPolicy?.entryId === 'first-run-walkthrough', 'search index missing PASS137 walkthrough entry policy');
  need((search.entries || []).some((entry) => entry.id === 'first-run-walkthrough' && entry.screenshot === '19-first-run-walkthrough.png'), 'search index missing first-run walkthrough entry');

  need(article.includes('# First-run walkthrough'), 'walkthrough article title mismatch');
  need(article.includes('Screenshot target: `docs/kb/screenshots/19-first-run-walkthrough.png`'), 'walkthrough article missing screenshot target');
  need(article.includes('## Screenshot capture checklist'), 'walkthrough article missing screenshot checklist');
  need(article.includes('## What this feature does'), 'walkthrough article missing feature section');
  need(article.includes('## How to use it'), 'walkthrough article missing how-to section');
  need(article.includes('## Safety notes'), 'walkthrough article missing safety notes');
  need(readme.includes('PASS137 first-run walkthrough'), 'KB README missing PASS137 section');
  need(readme.includes('19-first-run-walkthrough.png'), 'KB README missing PASS137 screenshot slot');
  need(contract.includes('PASS137 walkthrough rule'), 'KB authoring contract missing PASS137 rule');
  need(intake.includes('PASS137 walkthrough capture'), 'screenshot intake missing PASS137 capture guidance');
  need(summary.includes('1.8.30 unchanged'), 'PASS137 summary must preserve version truth');

  need(pkg.scripts?.['verify:pass-137-first-run-walkthrough'] === 'node scripts/verify-pass-137-first-run-walkthrough.mjs', 'package.json missing PASS137 verifier script');
  need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-137-first-run-walkthrough'), 'verify:release-blockers missing PASS137 verifier');
}

if (failures.length) {
  console.error('PASS137 first-run walkthrough verification FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('PASS137 first-run walkthrough verification OK');
console.log('PASS137_FIRST_RUN_WALKTHROUGH=PASS');
