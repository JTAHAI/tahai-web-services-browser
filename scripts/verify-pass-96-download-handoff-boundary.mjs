#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS96 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/download-boundary.ts',[
  'PASS96_DOWNLOAD_HANDOFF_BOUNDARY',
  'MAX_DOWNLOAD_FILENAME_CHARS = 180',
  'BrowserDownloadState',
  'sensitivePathHidden: true',
  'sanitizeDownloadFilename',
  'sanitizeDownloadSourceOrigin',
  'downloadRiskWarning',
  'createDownloadStatePayload',
  'HIGH_RISK_DOWNLOAD_EXTENSIONS',
  'Executable or installer download. Verify publisher/signature before opening.',
  'RESERVED_WINDOWS_BASENAMES',
  'WINDOWS_UNSAFE_CHARS_RE'
]);
need(!/path\??:\s*string/.test(boundary),'download boundary payload must not expose a local path field');
need(/parsed\.username \|\| parsed\.password/.test(boundary),'download source origin must reject embedded credentials');
need(/parsed\.protocol !== 'https:' && parsed\.protocol !== 'http:'/.test(boundary),'download source origin must reject non-HTTP protocols');
const runtime=includes('src/main/runtime-security.ts',[
  "import type { BrowserDownloadState } from '../shared/download-boundary'",
  "import { createDownloadStatePayload, downloadRiskWarning, sanitizeDownloadFilename } from '../shared/download-boundary'",
  'function safeDownloadDirectory',
  'function sanitizeSelectedDownloadPath',
  'function sendDownloadState',
  'BrowserWindow.getAllWindows()',
  "isTrustedTahaiRendererEventChannel",
  "window.webContents.send(channel, payload)",
  'const filename = sanitizeDownloadFilename(item.getFilename())',
  'const sourceUrl = item.getURL()',
  'const warning = downloadRiskWarning(filename, item.getMimeType())',
  'createDownloadStatePayload({ state: \'started\', filename, sourceUrl, warning',
  'Local path hidden from renderer.'
]);
need(!/path:\s*result\.filePath/.test(runtime),'download state must not send result.filePath to renderer');
need(!/path:\s*item\.getSavePath\(\)/.test(runtime),'download state must not send item.getSavePath() to renderer');
need(!/[^.]webContents\.send\('tahai-browser:download-state'/.test(runtime),'runtime must not send download state directly to initiating webContents');
need(runtime.includes("const channel = 'tahai-browser:download-state'"),'runtime must declare the trusted download-state event channel before sending');
need(/item\.setSavePath\(sanitizeSelectedDownloadPath\(result\.filePath, filename\)\)/.test(runtime),'selected download path must be normalized through sanitizeSelectedDownloadPath');
const preload=includes('src/preload/preload.ts',[
  "import type { BrowserDownloadState } from '../shared/download-boundary'",
  'export type DownloadState = BrowserDownloadState'
]);
need(!/export type DownloadState = \{[\s\S]*path\??: string;[\s\S]*\};/.test(preload),'preload DownloadState must not define a path field');
const renderer=includes('src/renderer/app.ts',[
  'state.sourceOrigin ? `from ${state.sourceOrigin}` : \'\'',
  'state.warning || \'\'',
  'state.detail || \'\'',
  'Download state updated.'
]);
need(!/state\.path/.test(renderer),'renderer must not render local download paths');
includes('src/renderer/index.html',['data-pass96-download-boundary="true"','download events are routed back to the trusted shell with sanitized filenames only','Local filesystem paths are hidden from renderer status updates']);
includes('src/renderer/styles/browser.css',['PASS96 download handoff boundary','.download-boundary-note','Download handoff guard']);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-96-download-handoff-boundary']==='node scripts/verify-pass-96-download-handoff-boundary.mjs','package.json missing PASS96 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-96-download-handoff-boundary'),'release blockers missing PASS96 verifier');
console.log('PASS96 download handoff boundary verification passed.');
