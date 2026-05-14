#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function readJson(path) { return JSON.parse(read(path)); }
function fail(message) { console.error(`[PASS195][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }
function includesAll(path, tokens) {
  const text = read(path);
  for (const token of tokens) need(text.includes(token), `${path}-missing:${token}`);
  return text;
}
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const pkg = readJson('package.json');
const contract = includesAll('src/shared/first-run-operator-walkthrough.ts', [
  "PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_PASS = 'PASS195'",
  'PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_VERSION = 2',
  'FIRST_RUN_OPERATOR_MILESTONES',
  "'normal-browsing'",
  "'mission-control'",
  "'admin-profiles'",
  "'runbook-rail'",
  "'evidence-export'",
  "'safe-settings'",
  "'troubleshooting'",
  'FIRST_RUN_OPERATOR_WALKTHROUGH_PRIVACY_SUMMARY',
  "FIRST_RUN_OPERATOR_WALKTHROUGH_START_ANCHOR = 'operator-first-ten-minutes'",
  "FIRST_RUN_OPERATOR_WALKTHROUGH_QUERY = 'walkthrough=operator-v2'",
  'firstRunOperatorWalkthroughState'
]);
need(!contract.includes('localStorage') && !contract.includes('sessionStorage') && !contract.includes('fetch('), 'contract must remain local/static');

includesAll('src/main/first-run.ts', [
  "import { firstRunOperatorWalkthroughState } from '../shared/first-run-operator-walkthrough'",
  'operatorWalkthrough: ReturnType<typeof firstRunOperatorWalkthroughState>',
  'existing.operatorWalkthrough?.version === 2',
  'operatorWalkthrough: firstRunOperatorWalkthroughState()'
]);

includesAll('src/preload/preload.ts', [
  "import type { FirstRunOperatorMilestone } from '../shared/first-run-operator-walkthrough'",
  'operatorWalkthrough: {',
  'milestones: FirstRunOperatorMilestone[]'
]);

includesAll('src/renderer/app.ts', [
  'function pass195OperatorWalkthroughUrl()',
  'walkthrough=operator-v2#operator-first-ten-minutes',
  "if (command === 'guide') navigate(pass195OperatorWalkthroughUrl(), 'guide')",
  "if (actionId === 'onboarding') navigate(pass195OperatorWalkthroughUrl(), 'guide')",
  "onboardingButton.addEventListener('click', () => navigate(pass195OperatorWalkthroughUrl(), 'guide'))"
]);

const html = includesAll('browser/onboarding/index.html', [
  'data-pass195-first-run-operator-walkthrough="true"',
  'id="operator-first-ten-minutes"',
  'Operator walkthrough v2',
  'First 10 minutes',
  'data-kb-operator-step',
  'Local-only guide. No telemetry, no remote KB service, no cookies, no browser storage, and no IT Docs or PSA backend dependency.',
  'data-screenshot-id="19-first-run-walkthrough.png"'
]);
need((html.match(/id="first-run-walkthrough"/g) || []).length === 1, 'first-run walkthrough article must not be duplicated');
need(!/>PASS\d+<|>PASS\d+\s/i.test(html), 'visible HTML must not contain development pass labels');
need(!/https?:\/\//i.test(html), 'KB HTML must not load or link remote URLs');
need(!/\bPASS\d+\b/.test(visibleText(html)), 'public KB visible text must not expose PASS labels');

includesAll('browser/onboarding/styles.css', [
  'PASS195 — first-run operator walkthrough v2',
  '.kb-operator-path-panel',
  '.kb-operator-path-steps',
  '.kb-operator-path-note'
]);

const js = includesAll('browser/onboarding/kb-search.js', [
  'pass195KbOperatorWalkthroughReady',
  'operatorSteps',
  'pass195ApplyOperatorWalkthroughRoute',
  "params.get('walkthrough') !== 'operator-v2'",
  "document.getElementById('operator-first-ten-minutes')"
]);
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'document.cookie', 'eval(', 'Function(']) need(!js.includes(forbidden), `KB JS must not use ${forbidden}`);
need(!/https?:\/\//i.test(js), 'KB JS must not reference remote URLs');

const manifest = readJson('browser/onboarding/kb-manifest.json');
need(manifest.operatorWalkthroughPolicy?.sourcePass === 'PASS195', 'KB manifest missing PASS195 operator policy');
need(manifest.operatorWalkthroughPolicy?.version === 2, 'operator walkthrough manifest version mismatch');
need(manifest.operatorWalkthroughPolicy?.startAnchor === 'operator-first-ten-minutes', 'operator start anchor mismatch');
need(manifest.operatorWalkthroughPolicy?.query === 'walkthrough=operator-v2', 'operator query mismatch');
need(manifest.operatorWalkthroughPolicy?.localOnly === true, 'operator policy must be local only');
need(manifest.operatorWalkthroughPolicy?.noTelemetry === true, 'operator policy must forbid telemetry');
need(manifest.operatorWalkthroughPolicy?.noStorage === true, 'operator policy must forbid storage');
need(manifest.operatorWalkthroughPolicy?.noRemoteKbService === true, 'operator policy must forbid remote KB service');
need(manifest.operatorWalkthroughPolicy?.noItDocsOrPsaDependency === true, 'operator policy must not depend on IT Docs or PSA');
need((manifest.operatorWalkthroughPolicy?.milestoneAnchors || []).includes('mission-control'), 'operator manifest missing mission-control milestone');

const search = readJson('docs/kb/search-index.json');
need(search.operatorWalkthroughSearchPolicy?.sourcePass === 'PASS195', 'search index missing PASS195 policy');
need((search.entries || []).some((entry) => entry.id === 'first-run-walkthrough' && String(entry.summary || '').includes('operator order')), 'search index entry not upgraded for operator order');

includesAll('docs/kb/articles/first-run-walkthrough.md', [
  '# First-run walkthrough',
  'Screenshot target: `docs/kb/screenshots/19-first-run-walkthrough.png`',
  '## Screenshot capture checklist',
  '## What this feature does',
  '## How to use it',
  '## Safety notes',
  'First 10 minutes',
  'operator path',
  'screenshot ingestion workflow'
]);
includesAll('docs/pass-195-first-run-operator-walkthrough-v2.md', [
  'PASS195',
  'First-Run Operator Walkthrough v2',
  'No telemetry',
  'Version remains `1.8.30`'
]);
includesAll('PASS_195_FIRST_RUN_OPERATOR_WALKTHROUGH_V2_SUMMARY.md', [
  'PASS195',
  'First 10 minutes',
  'release-blocker',
  'Version: 1.8.30 unchanged'
]);

need(pkg.version === '1.8.30', 'version must remain unchanged without explicit approval');
need(pkg.scripts?.['verify:pass-195-first-run-operator-walkthrough-v2'] === 'node scripts/verify-pass-195-first-run-operator-walkthrough-v2.mjs', 'package script missing PASS195 verifier');
need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-195-first-run-operator-walkthrough-v2'), 'release blockers missing PASS195 verifier');
need(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-195-first-run-operator-walkthrough-v2') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-194-download-artifact-shelf-ux'), 'PASS195 must run after PASS194');

console.log('[PASS195][OK] First-run operator walkthrough v2 verified.');
