#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function readJson(path) { return JSON.parse(read(path)); }
function fail(message) { console.error(`[PASS196][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }
function includesAll(path, tokens) {
  const text = read(path);
  for (const token of tokens) need(text.includes(token), `${path}-missing:${token}`);
  return text;
}

const pkg = readJson('package.json');
const html = includesAll('src/renderer/index.html', [
  'id="mission-command-deck"',
  'data-pass196-mission-control-ia="true"',
  'data-pass196-card="identity"',
  'data-pass196-card="active-pane"',
  'data-pass196-card="layout"',
  'data-pass196-card="runbook"',
  'data-pass196-card="evidence"',
  'data-pass196-card="timeline"',
  'data-pass196-card="export"',
  'aria-label="Mission Control command deck"'
]);
need((html.match(/data-pass196-card=/g) || []).length === 7, 'Mission command deck must expose exactly seven static card shells');

const app = includesAll('src/renderer/app.ts', [
  "const missionCommandDeck = document.getElementById('mission-command-deck') as HTMLElement",
  'function renderMissionCommandDeck(mission: MissionState | null, invariantIssueCount: number): void',
  'missionCommandDeck.dataset.pass196Cards = String(cards.length)',
  'missionCommandDeck.dataset.pass196ActivePane = activePaneId',
  'missionCommandDeck.dataset.pass196Layout = mission?.layout.type || \'single\'',
  'renderMissionCommandDeck(mission, pass92InvariantIssues.length)',
  'missionPaneLabel(activePaneId)',
  'missionLayoutLabel(mission.layout.type)',
  'ensureMissionRunbook(mission)',
  'ensureMissionEvidence(mission).length',
  'mission?.timeline.length',
  'Preview before sharing'
]);
for (const unsafe of ['innerHTML = mission?.name', 'innerHTML = mission.name', 'card.value +', 'card.detail +']) {
  need(!app.includes(unsafe), `Mission command deck must not interpolate unsanitized HTML pattern: ${unsafe}`);
}
need((app.match(/escapeHtml\(card\./g) || []).length >= 3, 'Mission command deck card values must be escaped before HTML insertion');

includesAll('src/renderer/styles/mission-control.css', [
  'PASS196 — Mission Control IA rebuild',
  '.mission-command-deck',
  '.mission-command-card',
  '.mission-command-card[data-pass196-card="identity"]',
  'grid-template-columns: minmax(210px, 1.25fr) repeat(6, minmax(130px, 1fr))',
  'body.mission-small-window-stress .mission-command-deck',
  '.mission-dialog[data-pass132-mission-viewport="micro"] .mission-command-card'
]);

const contract = includesAll('src/shared/mission-control-ia-contract.ts', [
  "PASS196_MISSION_CONTROL_IA_PASS = 'PASS196'",
  'PASS196_MISSION_CONTROL_IA_VERSION = 1',
  "PASS196_MISSION_CONTROL_IA_CONTRACT_ID = 'mission-control-ia-rebuild-v1'",
  'PASS196_MISSION_COMMAND_DECK_CARDS',
  "'identity'",
  "'active-pane'",
  "'layout'",
  "'runbook'",
  "'evidence'",
  "'timeline'",
  "'export'",
  'pass196MissionControlIaSummary'
]);
need(!contract.includes('fetch(') && !contract.includes('localStorage') && !contract.includes('sessionStorage'), 'PASS196 contract must remain static/local');

includesAll('docs/pass-196-mission-control-ia-rebuild.md', [
  'PASS196',
  'Mission Control IA Rebuild',
  'Mission, Active pane, Layout, Runbook, Evidence, Timeline, and Export',
  'browser-side-only boundary',
  'Version remains `1.8.30`'
]);
includesAll('PASS_196_MISSION_CONTROL_IA_REBUILD_SUMMARY.md', [
  'PASS196',
  'Mission Control IA Rebuild',
  'seven operator cards',
  'release-blocker',
  'Version: 1.8.30 unchanged'
]);

need(pkg.version === '1.8.30', 'version must remain unchanged without explicit approval');
need(pkg.scripts?.['verify:pass-196-mission-control-ia-rebuild'] === 'node scripts/verify-pass-196-mission-control-ia-rebuild.mjs', 'package script missing PASS196 verifier');
const blockers = pkg.scripts?.['verify:release-blockers'] || '';
need(blockers.includes('verify:pass-196-mission-control-ia-rebuild'), 'release blockers missing PASS196 verifier');
need(blockers.indexOf('verify:pass-196-mission-control-ia-rebuild') > blockers.indexOf('verify:pass-195-first-run-operator-walkthrough-v2'), 'PASS196 must run after PASS195');
need(blockers.indexOf('verify:pass-196-mission-control-ia-rebuild') < blockers.lastIndexOf('npm run build'), 'PASS196 must run before build in release blockers');

console.log('[PASS196][OK] Mission Control IA rebuild verified.');
