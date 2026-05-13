#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS191][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }

const pkg = JSON.parse(read('package.json'));
const app = read('src/renderer/app.ts');
const nav = read('src/shared/navigation-boundary.ts');
const contract = read('src/shared/address-bar-enterprise-reliability-contract.ts');
const doc = read('docs/pass-191-address-bar-enterprise-reliability.md');
const summary = read('PASS_191_ADDRESS_BAR_ENTERPRISE_RELIABILITY_SUMMARY.md');

need(pkg.version === '1.8.30', 'version-must-not-change-without-explicit-approval');
need(pkg.scripts?.['verify:pass-191-address-bar-enterprise-reliability'] === 'node scripts/verify-pass-191-address-bar-enterprise-reliability.mjs', 'package-script-missing');
need(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-191-address-bar-enterprise-reliability'), 'release-blockers-missing-pass191');
need(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-191-address-bar-enterprise-reliability') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-190-overlay-state-machine-closeout'), 'pass191-must-run-after-pass190');

for (const token of [
  'PASS191_ADDRESS_BAR_ENTERPRISE_RELIABILITY_VERSION',
  'Pass191AddressBarCaseId',
  'PASS191_ADDRESS_BAR_CASES',
  'address-submit-resolves-before-loadURL',
  'explicit-unsafe-schemes-block-instead-of-silent-launchpad-navigation',
  'active-pane-target-is-recorded',
  'loading-state-is-reflected'
]) need(contract.includes(token), `contract-missing-token: ${token}`);

for (const token of [
  'AddressBarResolution',
  'AddressBarResolutionAction',
  'sanitizeAddressBarInput',
  'resolveBrowserAddressBarTarget',
  'EXPLICIT_SCHEME_RE.test(value)',
  "return addressBarResolution(false, value, options.fallbackUrl || '', 'blocked', direct.reason",
  "HOST_LIKE_RE.test(value)",
  "LOCALHOST_RE.test(value)",
  "searchUrlForInput",
  "Address input is too long.",
  "Address input is empty."
]) need(nav.includes(token), `navigation-boundary-missing-token: ${token}`);

for (const token of [
  "resolveBrowserAddressBarTarget",
  "sanitizeAddressBarInput",
  "PASS191_ADDRESS_BAR_ENTERPRISE_RELIABILITY_VERSION",
  "type Pass191AddressResolutionState",
  "pass191ResolveAddressBarInput",
  "pass191RecordAddressResolution",
  "pass191SanitizeAddressInputValue",
  "pass191NavigateAddressInput",
  "addressInput.addEventListener('input'",
  "addressInput.addEventListener('paste'",
  "addressForm.addEventListener('submit', (event) => { event.preventDefault(); pass191NavigateAddressInput(); })",
  "navigateTarget(target, decision.url, 'address', { alreadyResolved: true, addressDecision: decision })",
  "browserNavigationSafeUrl(url)",
  "document.body.dataset.pass191AddressTargetPane",
  "document.body.dataset.pass191AddressTargetTab",
  "document.body.dataset.pass191AddressBlocked",
  "addressInput.dataset.pass191LoadingState = 'loading'",
  "addressInput.dataset.pass191LoadingState = 'idle'"
]) need(app.includes(token), `app-missing-token: ${token}`);

need(/function pass191NavigateAddressInput\(\): void \{[\s\S]*const target = activeNavigationTarget\('address'\);[\s\S]*const decision = pass191ResolveAddressBarInput\(addressInput\.value\);[\s\S]*if \(!decision\.ok\)[\s\S]*return;[\s\S]*navigateTarget\(target, decision\.url, 'address', \{ alreadyResolved: true, addressDecision: decision \}\)/.test(app), 'address-submit-does-not-resolve-before-navigation');
need(/function navigateTarget[\s\S]*const target = options\.alreadyResolved \? browserNavigationSafeUrl\(url\) : normalizeTarget\(url\);[\s\S]*if \(!target\)[\s\S]*setStatus\('Navigation blocked', reason\)/.test(app), 'navigate-target-does-not-fail-closed-for-resolved-invalid-url');
need(doc.includes('wrong-pane navigation is diagnosable'), 'doc-missing-wrong-pane-diagnostics');
need(summary.includes('PASS191'), 'summary-missing-pass191');

console.log('[PASS191][OK] Address bar enterprise reliability verified.');
