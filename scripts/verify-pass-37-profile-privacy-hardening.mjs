#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const settings = readFileSync('src/main/settings.ts', 'utf8');
const runtime = readFileSync('src/main/runtime-security.ts', 'utf8');
const main = readFileSync('src/main/main.ts', 'utf8');
const preload = readFileSync('src/preload/preload.ts', 'utf8');
const globals = readFileSync('src/renderer/global.d.ts', 'utf8');
const html = readFileSync('src/renderer/index.html', 'utf8');
const app = readFileSync('src/renderer/app.ts', 'utf8');

function versionAtLeast(actual, floor) {
  const a = String(actual || '').split('.').map((n) => Number(n) || 0);
  const b = String(floor || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

const failures = [];
for (const token of ['privacy:', 'sendDoNotTrack', 'blockThirdPartyCookies', 'reduceCrossSiteReferrers', 'clearProfileDataOnExit']) {
  if (!settings.includes(token)) failures.push('settings privacy token missing: ' + token);
}
for (const token of ['setPermissionCheckHandler', 'setPermissionRequestHandler', 'onBeforeSendHeaders', 'Sec-GPC', 'DNT', 'blockThirdPartyCookies', 'reduceCrossSiteReferrers']) {
  if (!runtime.includes(token)) failures.push('runtime privacy/session hardening token missing: ' + token);
}
for (const token of ['ClearBrowsingDataScope', 'clearProfileStorage', 'clearBrowsingDataForProfiles', 'clearAuthCache', "scope: 'all-profiles'", "app.on('before-quit'"]) {
  if (!main.includes(token)) failures.push('main profile data boundary token missing: ' + token);
}
for (const token of ['ClearBrowsingDataOptions', 'ClearBrowsingDataResult', 'clearBrowsingData: (options?: ClearBrowsingDataOptions)']) {
  if (!preload.includes(token) && !globals.includes(token)) failures.push('preload/global clear data type token missing: ' + token);
}
for (const id of ['setting-dnt', 'setting-third-party-cookies', 'setting-referrer', 'setting-clear-on-exit', 'clear-all-data', 'clear-selected-profile-data']) {
  if (!html.includes(`id="${id}"`)) failures.push('privacy/profile UI control missing: ' + id);
}
for (const token of ['settingDoNotTrack', 'settingThirdPartyCookies', 'settingReduceReferrers', 'settingClearOnExit', 'clearSelectedProfileData', "scope: 'active-profile'", "scope: 'selected-profile'", "scope: 'all-profiles'"]) {
  if (!app.includes(token)) failures.push('renderer privacy/profile workflow missing: ' + token);
}
if (!versionAtLeast(pkg.version, '1.8.14')) failures.push('package version expected >= 1.8.14, found ' + pkg.version);
if (!pkg.scripts?.['verify:pass-37-profile-privacy-hardening']) failures.push('package script missing verify:pass-37-profile-privacy-hardening');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-37-profile-privacy-hardening')) failures.push('pass37 verifier not wired into release blockers');

if (failures.length) {
  console.error('PASS37_PROFILE_PRIVACY_HARDENING_OK=0');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('PASS37_PROFILE_PRIVACY_HARDENING_OK=1');
