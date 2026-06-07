#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS100 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/active-capture-boundary.ts',[
  'sanitizeActiveCaptureText',
  'sanitizeActiveCaptureUrl',
  'sanitizeActiveCaptureOrigin',
  'sanitizeActiveCapturePath',
  'sanitizeActiveCaptureList',
  'sanitizeActiveCaptureLink',
  'sanitizeActiveCaptureNumber',
  'scanAndRedact',
  'sanitizeEvidenceUrl',
  'CONTROL_AND_BIDI',
  'MAX_CAPTURE_URL = 2048'
]);
need(/parsed\.username = ''/.test(boundary),'captured origins/URLs must strip usernames');
need(/parsed\.password = ''/.test(boundary),'captured origins/URLs must strip passwords');
need(/\[redacted-uuid\]/.test(boundary),'captured paths must redact UUID-like segments');
need(/\[redacted-number\]/.test(boundary),'captured paths must redact large numeric segments');
const renderer=includes('src/renderer/app.ts',[
  "from '../shared/active-capture-boundary'",
  'function activeCaptureSourceUrl',
  'sanitizeActiveCaptureText(raw?.title, tab.title)',
  "sanitizeActiveCaptureUrl(raw?.url, tab.url, 'operational-handoff')",
  'sanitizeActiveCaptureOrigin(raw?.origin, safeUrl)',
  'sanitizeActiveCaptureLink(link, \'operational-handoff\')',
  'sanitizeActiveCapturePath(sample?.path, \'\')',
  'sanitizeActiveCaptureUrl(form?.action, \'\', \'operational-handoff\')',
  'sanitizeActiveCaptureUrl(resource.name, \'\', \'operational-handoff\')',
  'latestCapture = { markdown, sourceUrl: activeCaptureSourceUrl(page.url, tab.url) }',
  'latestDevAudit = { markdown, sourceUrl: activeCaptureSourceUrl(page.url, tab.url), page, consoleMessages: messages }'
]);
need(!/latestCapture = \{ markdown, sourceUrl: page\.url \|\| tab\.url \}/.test(renderer),'capture sourceUrl must not fall back to raw tab.url');
need(!/latestDevAudit = \{ markdown, sourceUrl: page\.url \|\| tab\.url/.test(renderer),'developer audit sourceUrl must not fall back to raw tab.url');
need(!/links: Array\.isArray\(raw\?\.links\) \? raw\.links\.map\(\(link\) => \(\{ text: compactText/.test(renderer),'active capture links must use shared link sanitizer');
const main=includes('src/main/main.ts',[
  "import { sanitizeActiveCaptureUrl } from '../shared/active-capture-boundary'",
  'function safeDiagnosticRequestUrl(inputUrl: string): string',
  "inputUrl: sanitizeActiveCaptureUrl(inputUrl, '', 'operational-handoff') || ''",
  'const normalizedUrl = safeDiagnosticRequestUrl(inputUrl);'
]);
need(
  main.includes("sanitizeActiveCaptureUrl(proposed, SOURCE_DEFAULT_HOME_URL, 'operational-handoff')") || main.includes('safeDiagnosticsRequestUrl(inputUrl, SOURCE_DEFAULT_HOME_URL)'),
  'diagnostics must sanitize normalized URL through the active-capture boundary or newer PASS102 diagnostics boundary'
);
need(!/inputUrl: String\(inputUrl \|\| ''\)/.test(main),'diagnostics must not return raw inputUrl');
need(!/const normalizedUrl = normalizeDiagnosticUrl\(inputUrl\);/.test(main),'diagnostics must not use raw normalized URL directly');
includes('src/renderer/index.html',[
  'data-pass100-active-capture-boundary="true"',
  'active tab URL, title, visible page structure'
]);
includes('src/renderer/styles/browser.css',[
  'PASS100 active-page capture boundary',
  'Capture safety'
]);
includes('PASS_100_ACTIVE_CAPTURE_BOUNDARY_SUMMARY.md',[
  'PASS100 — Active Capture Boundary',
  '`webview.executeJavaScript(...)` return values are treated as untrusted'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-100-active-capture-boundary']==='node scripts/verify-pass-100-active-capture-boundary.mjs','package.json missing PASS100 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-100-active-capture-boundary'),'release blockers missing PASS100 verifier');
console.log('PASS100 active capture boundary verification passed.');
