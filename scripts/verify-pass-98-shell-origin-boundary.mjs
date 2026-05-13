#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS98 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/shell-origin-boundary.ts',[
  'PASS98_SHELL_ORIGIN_BOUNDARY',
  'MAX_SHELL_ORIGIN_URL_CHARS = 4096',
  'evaluateShellOrigin',
  'isTrustedShellOrigin',
  'assertTrustedShellOrigin',
  'Local file URL is not an allowlisted TAHAI shell page.',
  'parsed.username || parsed.password',
  "parsed.protocol.toLowerCase() !== 'file:'"
]);
need(/stripShellHashAndQuery\(normalized\)/.test(boundary),'shell boundary must strip query/hash before allowlist comparison');
need(/normalizeTrustedShellSet\(trustedShellUrls\)/.test(boundary),'shell boundary must normalize trusted shell allowlist');
const main=includes('src/main/main.ts',[
  "import { assertTrustedShellOrigin, isTrustedShellOrigin } from '../shared/shell-origin-boundary'",
  'function trustedShellUrls(): string[]',
  "pathToFileURL(distPath('renderer', 'index.html')).toString()",
  'pages.newTabUrl',
  'pages.settingsUrl',
  'pages.aboutUrl',
  'pages.errorPageUrl',
  'pages.onboardingUrl',
  'assertTrustedShellOrigin(senderUrl, trustedShellUrls())',
  "if (!isTrustedShellOrigin(url, trustedShellUrls())) event.preventDefault();"
]);
need(!/senderUrl\.startsWith\('file:\/\/'\)/.test(main),'main IPC guard must not trust every file:// URL');
need(!/if \(!url\.startsWith\('file:\/\/'\)\) event\.preventDefault\(\)/.test(main),'main-window navigation must not allow every file:// URL');
need(/window\.webContents\.setWindowOpenHandler\(\(\{ url \}\) => \{[\s\S]*normalizeSafeExternalWindowUrl\(url\)/.test(main),'window-open must remain behind PASS94 navigation sanitizer');
const preload=includes('src/preload/preload.ts',['contextBridge.exposeInMainWorld']);
need(!/ipcRenderer\.send\(/.test(preload),'preload must not expose send-style raw IPC');
includes('src/renderer/index.html',[
  'data-pass98-shell-origin-boundary="true"',
  'Privileged shell actions are allowlisted to packaged TAHAI shell pages only'
]);
includes('src/renderer/styles/browser.css',[
  'PASS98 shell origin boundary',
  'Privileged IPC is restricted to allowlisted TAHAI shell pages.'
]);
includes('PASS_98_SHELL_ORIGIN_BOUNDARY_SUMMARY.md',[
  'PASS98 — Shell Origin Boundary',
  'generic `file://` page'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-98-shell-origin-boundary']==='node scripts/verify-pass-98-shell-origin-boundary.mjs','package.json missing PASS98 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-98-shell-origin-boundary'),'release blockers missing PASS98 verifier');
console.log('PASS98 shell origin boundary verification passed.');
