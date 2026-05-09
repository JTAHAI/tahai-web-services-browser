import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const requireText = (rel, needle, label = needle) => {
  const text = read(rel);
  if (!text.includes(needle)) failures.push(`${rel} missing ${label}`);
  return text;
};
const requireJson = (rel) => JSON.parse(read(rel));

const index = requireText('browser/onboarding/index.html', 'data-pass136-kb-screenshot-navigation="true"', 'PASS136 body marker');
for (const needle of [
  'kb-screenshot-status-panel',
  'kb-screenshot-status-summary',
  'data-kb-first-missing',
  'data-kb-screenshot-filter="needs-screenshot"',
  'data-kb-screenshot-filter="screenshot-ready"'
]) {
  if (!index.includes(needle)) failures.push(`browser/onboarding/index.html missing ${needle}`);
}

const js = requireText('browser/onboarding/kb-search.js', 'pass136KbScreenshotNavigationReady', 'PASS136 JS readiness marker');
for (const needle of [
  'activeScreenshotFilter',
  'updateScreenshotCounts',
  'pass136KbScreenshotTotal',
  'pass136KbScreenshotsReady',
  'pass136KbScreenshotsAwaiting',
  'needs-screenshot',
  'screenshot-ready',
  'firstMissingLink'
]) {
  if (!js.includes(needle)) failures.push(`browser/onboarding/kb-search.js missing ${needle}`);
}
if (/https?:\/\//i.test(js)) failures.push('browser/onboarding/kb-search.js must not fetch remote screenshot/search assets');

const css = requireText('browser/onboarding/styles.css', 'PASS136 — screenshot-aware KB navigation polish', 'PASS136 CSS block');
for (const needle of ['kb-screenshot-status-panel', 'kb-screenshot-counts', 'kb-screenshot-actions']) {
  if (!css.includes(needle)) failures.push(`browser/onboarding/styles.css missing ${needle}`);
}

const manifest = requireJson('browser/onboarding/kb-manifest.json');
if (manifest.sourcePass !== 'PASS129') failures.push('browser/onboarding/kb-manifest.json sourcePass must remain PASS129');
if (manifest.lastHardenedPass !== 'PASS136') failures.push('browser/onboarding/kb-manifest.json lastHardenedPass must be PASS136');
if (!manifest.screenshotNavigationPolicy?.statusPanel) failures.push('kb manifest missing screenshotNavigationPolicy.statusPanel');
if (!manifest.screenshotNavigationPolicy?.allScreenshotsOptionalForSourceBuilds) failures.push('kb manifest must keep screenshots optional for source builds');

const pkg = requireJson('package.json');
if (pkg.scripts['verify:pass-136-kb-screenshot-aware-navigation'] !== 'node scripts/verify-pass-136-kb-screenshot-aware-navigation.mjs') failures.push('package.json missing PASS136 verifier script');
if (!pkg.scripts['verify:release-blockers']?.includes('verify:pass-136-kb-screenshot-aware-navigation')) failures.push('verify:release-blockers missing PASS136 verifier');

for (const rel of [
  'docs/kb/pass-136-kb-screenshot-aware-navigation.md',
  'PASS_136_KB_SCREENSHOT_AWARE_NAVIGATION_SUMMARY.md'
]) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing ${rel}`);
}

if (failures.length) {
  console.error('PASS136 KB screenshot-aware navigation verification FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('PASS136 KB screenshot-aware navigation verification OK');
console.log('PASS136_KB_SCREENSHOT_AWARE_NAVIGATION=PASS');
