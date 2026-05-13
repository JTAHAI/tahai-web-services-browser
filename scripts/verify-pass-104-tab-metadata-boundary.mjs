#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS104 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/tab-metadata-boundary.ts',[
  'PASS104_TAB_METADATA_BOUNDARY',
  'MAX_TAB_METADATA_TEXT_CHARS',
  'MAX_STATUS_METADATA_TEXT_CHARS',
  'CONTROL_AND_BIDI_RE',
  'scanAndRedact',
  'sanitizeEvidenceUrl',
  'evaluateBrowserNavigationUrl',
  'sanitizeTabMetadataTitle',
  'sanitizeRemotePageTitle',
  'sanitizeStatusMetadataText',
  'sanitizeTabMetadataUrl',
  'sanitizeTabMetadataRecord',
  "decision.kind === 'trusted-local'",
  "decision.kind !== 'remote'"
]);
need(boundary.includes('sanitizeEvidenceUrl(decision.url, profile)'), 'remote metadata URLs must route through evidence URL sanitizer');
need(boundary.includes('replace(CONTROL_AND_BIDI_RE'), 'tab metadata text must strip control/bidi characters');
const app=includes('src/renderer/app.ts',[
  "../shared/tab-metadata-boundary",
  'sanitizeRemotePageTitle',
  'sanitizeStatusMetadataText',
  'sanitizeTabMetadataRecord',
  'sanitizeTabMetadataTitle',
  'sanitizeTabMetadataUrl',
  'statusText.textContent = sanitizeStatusMetadataText(message',
  'securityText.textContent = sanitizeStatusMetadataText(detail',
  'const nextTitle = patch.title !== undefined ? sanitizeRemotePageTitle',
  "webview.addEventListener('page-title-updated'",
  'sanitizeRemotePageTitle(event.title',
  'const safeUrl = sanitizeTabMetadataUrl(input.url || currentActiveUrl()',
  "sanitizeEvidenceMarkdown(input.operatorNote || '', 'operational-handoff')",
  'metadata: sanitizeTabMetadataRecord(input.metadata)',
  'appendMissionTimelineEvent(ensureCurrentMission(), kind, sanitizeTabMetadataTitle',
  'missionTab.title = sanitizeTabMetadataTitle(tab.title',
  'missionTab.url = sanitizeTabMetadataUrl(tab.url, trustedLocalUrls()) || config.newTabUrl',
  'mission.tabs.push({ tabId, role, url: sanitizeTabMetadataUrl(tab.url, trustedLocalUrls()) || config.newTabUrl, title: sanitizeTabMetadataTitle(tab.title'
]);
need(!app.includes('page-title-updated\', (event: any) => updateTab(tab, { title: event.title || titleFromUrl'), 'raw remote page title event must not flow directly into tab state');
need(!app.includes('title: input.title.trim().slice(0, 180)'), 'Mission evidence titles must use PASS104 sanitizer');
need(!app.includes('url: (input.url || currentActiveUrl() || \'\').slice(0, 2048)'), 'Mission evidence URLs must not use raw slice-only handling');
includes('src/renderer/index.html',[
  'data-pass104-tab-metadata-boundary="true"',
  'Remote page titles, status text, Mission timeline entries, and Mission metadata URLs are sanitized before display or local Mission use',
  'bidi spoofing',
  'tokenized query strings'
]);
includes('src/renderer/styles/browser.css',[
  'PASS104 tab/page metadata trust boundary',
  'data-pass104-tab-metadata-boundary="true"'
]);
includes('PASS_104_TAB_METADATA_BOUNDARY_SUMMARY.md',[
  'PASS104 — Tab Metadata Boundary',
  'Remote `page-title-updated` values are sanitized',
  'Mission metadata URLs are sanitized',
  'Remote page metadata is treated as hostile'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-104-tab-metadata-boundary']==='node scripts/verify-pass-104-tab-metadata-boundary.mjs','package.json missing PASS104 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-104-tab-metadata-boundary'),'release blockers missing PASS104 verifier');
console.log('PASS104 tab metadata boundary verification passed.');
