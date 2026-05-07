#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS102 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/diagnostics-boundary.ts',[
  'MAX_DIAGNOSTIC_URL_CHARS = 2048',
  'DIAGNOSTIC_TIMEOUT_MS = 15000',
  'evaluateDiagnosticsRequestUrl',
  'safeDiagnosticsRequestUrl',
  'sanitizeDiagnosticHeaderMap',
  'safeDiagnosticText',
  'BLOCKED_DIAGNOSTIC_HEADERS',
  'www-authenticate',
  'proxy-authenticate',
  'sanitizeEvidenceUrl',
  'scanAndRedact',
  'parsed.username || parsed.password',
  'Diagnostic target includes embedded credentials',
  'Cookie-free HTTP(S) diagnostic request allowed'
]);
need(boundary.includes("const SAFE_DIAGNOSTIC_PROTOCOLS = new Set(['http:', 'https:']);"),'diagnostic boundary must restrict protocols to HTTP(S)');
need(boundary.includes("'location'"),'diagnostic header allowlist must include location only through sanitizer');
need(boundary.includes('sanitizeDiagnosticRedirectLocation') || /safe = safe\.replace\(\/\\bhttps\?:\\\/\\\/\[\^\\s<\>\)\\\]\]\+\/gi/.test(boundary) || boundary.includes("safe.replace(/\\bhttps?:\\/\\/[^\\s<>)\\]]+/gi"),'location values must sanitize embedded URLs or block unsafe redirects');
const main=includes('src/main/main.ts',[
  "import http from 'node:http'",
  "import https from 'node:https'",
  "from '../shared/diagnostics-boundary'",
  'safeDiagnosticsRequestUrl(inputUrl, SOURCE_DEFAULT_HOME_URL)',
  'evaluateDiagnosticsRequestUrl(inputUrl, SOURCE_DEFAULT_HOME_URL)',
  'sanitizeDiagnosticHeaderMap(result.headers',
  'safeDiagnosticText(result.statusMessage',
  'safeDiagnosticText(result.error',
  'const transport = requestUrl.protocol === \'https:\' ? https : http',
  'transport.request(requestUrl',
  'DIAGNOSTIC_TIMEOUT_MS',
  "'cache-control': 'no-cache'",
  'response.resume()'
]);
need(!main.includes("import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net,"),'main process must not import Electron net for diagnostics');
need(!/net\.request\(\{ method: 'HEAD'/.test(main),'runUrlDiagnostics must not use Electron net.request');
need(!main.includes('normalizeDiagnosticUrl(inputUrl)'),'diagnostics must not use legacy broad normalizer');
includes('src/renderer/index.html',[
  'data-pass102-diagnostics-boundary="true"',
  'cookie-free Node request boundary',
  'never include Cookie or Authorization output'
]);
includes('src/renderer/styles/browser.css',[
  'PASS102 ops diagnostics network boundary',
  'data-pass102-diagnostics-boundary="true"'
]);
includes('PASS_102_OPS_DIAGNOSTICS_NETWORK_BOUNDARY_SUMMARY.md',[
  'PASS102 — Ops Diagnostics Network Boundary',
  'Electron `net.request`',
  'Node `http` / `https` HEAD requests',
  'Cookie',
  'Authorization'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-102-ops-diagnostics-network-boundary']==='node scripts/verify-pass-102-ops-diagnostics-network-boundary.mjs','package.json missing PASS102 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-102-ops-diagnostics-network-boundary'),'release blockers missing PASS102 verifier');
console.log('PASS102 ops diagnostics network boundary verification passed.');
