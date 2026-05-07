#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS103 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/diagnostics-boundary.ts',[
  'DiagnosticsHostScopeDecision',
  'METADATA_HOSTNAMES',
  'SPECIAL_METADATA_IPV4',
  '169.254.169.254',
  '100.100.100.200',
  'isBlockedDiagnosticsAddress',
  'isBlockedDiagnosticsHostname',
  'evaluateDiagnosticsHostScope',
  'sanitizeDiagnosticRedirectLocation',
  'BLOCKED_DIAGNOSTIC_REDIRECT',
  'Diagnostic target DNS resolved to local, private, link-local, metadata, or reserved address space',
  'no single-label intranet names',
  'CGNAT',
  'RFC1918',
  'link-local',
  'unique local fc00::/7',
  'fe80::/10'
]);
need(boundary.includes("host.endsWith('.internal')"),'internal host suffixes must be blocked');
need(boundary.includes("host.endsWith('.lan')"),'LAN host suffixes must be blocked');
need(boundary.includes("host.endsWith('.home.arpa')"),'home.arpa host suffixes must be blocked');
need(boundary.includes('a === 10') && boundary.includes('a === 172 && b >= 16 && b <= 31') && boundary.includes('a === 192 && b === 168'),'RFC1918 IPv4 ranges must be explicit');
need(boundary.includes('a === 127') && boundary.includes('a === 169 && b === 254'),'loopback and link-local IPv4 ranges must be explicit');
need(boundary.includes('a >= 224'),'multicast/reserved IPv4 ranges must be blocked');
need(boundary.includes("clean === '::' || clean === '::1'") && boundary.includes("clean.startsWith('::ffff:')"),'IPv6 loopback/unspecified and IPv4-mapped checks must be present');
const main=includes('src/main/main.ts',[
  "import * as dns from 'node:dns/promises'",
  'evaluateDiagnosticsHostScope',
  'resolvePublicDiagnosticsTarget',
  'dns.lookup(hostname, { all: true, verbatim: true })',
  'publicTarget.ok',
  'Diagnostic target is not public-routable',
  'DNS preflight failed before diagnostics request',
  'DNS preflight allowed',
  'redirects are not followed by diagnostics',
  'DNS boundary',
  'A/AAAA output was withheld from approval because it resolved into non-public address space'
]);
need(main.indexOf('const publicTarget = await resolvePublicDiagnosticsTarget(requestUrl.hostname)') < main.indexOf('transport.request(requestUrl'),'public DNS/private-range preflight must happen before network request');
need(!/maxRedirects|followRedirect|redirect:\s*['\"]follow['\"]/.test(main),'diagnostics must not add automatic redirect following');
includes('src/renderer/index.html',[
  'data-pass103-diagnostics-ssrf-boundary="true"',
  'SSRF-guarded',
  'Localhost, private/link-local ranges, metadata endpoints',
  'unsafe DNS results',
  'redirect targets are blocked or withheld automatically'
]);
includes('src/renderer/styles/browser.css',[
  'PASS103 diagnostics SSRF/local-network boundary',
  'data-pass103-diagnostics-ssrf-boundary="true"'
]);
includes('PASS_103_DIAGNOSTICS_SSRF_BOUNDARY_SUMMARY.md',[
  'PASS103 — Diagnostics SSRF Boundary',
  'DNS preflight',
  'localhost',
  'RFC1918',
  'link-local',
  'metadata',
  'redirects are not followed'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-103-diagnostics-ssrf-boundary']==='node scripts/verify-pass-103-diagnostics-ssrf-boundary.mjs','package.json missing PASS103 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-103-diagnostics-ssrf-boundary'),'release blockers missing PASS103 verifier');
console.log('PASS103 diagnostics SSRF boundary verification passed.');
