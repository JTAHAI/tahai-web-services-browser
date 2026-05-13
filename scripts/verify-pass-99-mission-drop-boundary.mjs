#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS99 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/drop-boundary.ts',[
  'PASS99_DROP_BOUNDARY',
  'TAH_BROWSER_TAB_DRAG_MIME',
  'TAH_MISSION_TAB_DRAG_MIME',
  'TAH_INTERNAL_DRAG_SENTINEL_MIME',
  'MAX_INTERNAL_DRAG_ID_CHARS = 128',
  'writeTahaiInternalDragPayload',
  'evaluateTahaiInternalDrop',
  'isExternalDropPayload',
  'clearBlockedDropPayload',
  'External file, HTML, or URL drops are not Mission pane targets.',
  'TAHAI internal Mission drag'
]);
need(/EXTERNAL_DROP_TYPES = new Set\(\['Files', 'text\/uri-list', 'text\/html'\]\)/.test(boundary),'boundary must classify file/url/html drops as external');
need(/INTERNAL_ID_RE =/.test(boundary),'boundary must validate internal drag IDs');
const renderer=includes('src/renderer/app.ts',[
  "from '../shared/drop-boundary'",
  'installPass99ExternalDropBoundary',
  "document.body.dataset.pass99DropBoundary = 'true'",
  "document.body.dataset.pass99ExternalDropBoundary = 'blocked'",
  'writeTahaiInternalDragPayload(event.dataTransfer, TAH_BROWSER_TAB_DRAG_MIME, tabId)',
  'writeTahaiInternalDragPayload(event.dataTransfer, TAH_MISSION_TAB_DRAG_MIME, missionTabId)',
  "evaluateTahaiInternalDrop(event.dataTransfer, ['browser-tab', 'mission-tab'])",
  "evaluateTahaiInternalDrop(event.dataTransfer, ['mission-tab'])",
  "setStatus('Blocked unsafe Mission drop', decision.reason)",
  "setStatus('Blocked external drop'"
]);
need(!/setData\('text\/plain', tab\.url\)/.test(renderer),'browser tab drag must not leak tab.url in text/plain');
need(!/getData\('application\/x-tahai-browser-tab-id'\)/.test(renderer),'renderer pane drop must not read browser-tab MIME directly');
need(!/getData\('application\/x-tahai-mission-tab-id'\)/.test(renderer),'renderer mission drop must not read mission-tab MIME directly');
need(/window\.addEventListener\('dragover', blockExternalDrop, true\)/.test(renderer),'external dragover guard must run in capture phase');
need(/window\.addEventListener\('drop', blockExternalDrop, true\)/.test(renderer),'external drop guard must run in capture phase');
includes('src/renderer/index.html',[
  'data-pass99-drop-boundary="true"',
  'Mission drag-and-drop accepts only internal TAHAI mission payloads.'
]);
includes('src/renderer/styles/browser.css',[
  'PASS99 Mission drop boundary',
  'Mission drag safety',
  'Internal TAHAI drags only'
]);
includes('PASS_99_MISSION_DROP_BOUNDARY_SUMMARY.md',[
  'PASS99 — Mission Drop Boundary',
  'Browser tab drag no longer exposes the tab URL through `text/plain`.'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-99-mission-drop-boundary']==='node scripts/verify-pass-99-mission-drop-boundary.mjs','package.json missing PASS99 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-99-mission-drop-boundary'),'release blockers missing PASS99 verifier');
console.log('PASS99 mission drop boundary verification passed.');
