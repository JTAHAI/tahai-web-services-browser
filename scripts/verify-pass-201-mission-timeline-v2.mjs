#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const types = read('src/shared/mission-types.ts');
const contract = read('src/shared/mission-timeline-v2-contract.ts');
const validators = read('src/shared/mission-validators.ts');
const model = read('src/renderer/mission-model.ts');
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css') + read('src/renderer/styles/browser.css');
const doc = read('docs/pass-201-mission-timeline-v2.md');
const summary = read('PASS_201_MISSION_TIMELINE_V2_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS201 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-201-mission-timeline-v2'] === 'node scripts/verify-pass-201-mission-timeline-v2.mjs', 'package.json exposes PASS201 verifier.');
ok(getReleaseBlockersContract(pkg).includes('verify:pass-201-mission-timeline-v2'), 'release-blockers chain includes PASS201 verifier.');
ok(getReleaseBlockersContract(pkg).indexOf('verify:pass-201-mission-timeline-v2') > getReleaseBlockersContract(pkg).indexOf('verify:pass-200-runbook-rail-v2'), 'PASS201 must run after PASS200.');

for (const file of [
  'src/shared/mission-timeline-v2-contract.ts',
  'scripts/verify-pass-201-mission-timeline-v2.mjs',
  'docs/pass-201-mission-timeline-v2.md',
  'PASS_201_MISSION_TIMELINE_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS201 file: ${file}`);

for (const token of [
  'PASS201_MISSION_TIMELINE_V2_PASS',
  'MISSION_TIMELINE_V2_CONTRACT_ID',
  'mission-timeline-v2',
  'MISSION_TIMELINE_V2_SCHEMA_VERSION = 2',
  'MISSION_TIMELINE_V2_FILTERS',
  'MISSION_TIMELINE_V2_SURFACES',
  'MissionTimelineV2KindModel',
  'MissionTimelineV2Guardrails',
  'MissionTimelineV2Diagnostics',
  'MISSION_TIMELINE_V2_GUARDRAILS',
  'localOnly: true',
  'browserSideOnly: true',
  'exportSafeSummariesOnly: true',
  'redactionBeforeExport: true',
  'noSecretBearingPayloads: true',
  'noCookieCapture: true',
  'noConnectorWrites: true',
  'noPsaWriteback: true',
  'noItDocsWriteWithoutServerAuthorization: true',
  'boundedEventList: true',
  'missionTimelineV2KindModel',
  'missionTimelineV2SafeSummary',
  'missionTimelineV2Diagnostics',
  'missionTimelineV2FilterEvents',
  'missionTimelineV2GuardrailSummary'
]) ok(contract.includes(token), `PASS201 contract missing token: ${token}`);

for (const filter of ['all', 'mission', 'tabs', 'layout', 'pane', 'runbook', 'evidence', 'tools', 'export']) {
  ok(contract.includes(`'${filter}'`), `PASS201 contract missing filter: ${filter}`);
}
for (const surface of ['mission-control', 'browser-tabs', 'mission-layout', 'active-pane-routing', 'runbook-rail', 'evidence-pack', 'operator-tools', 'export-preview', 'local-store']) {
  ok(contract.includes(`'${surface}'`), `PASS201 contract missing surface: ${surface}`);
}

for (const token of [
  'MissionTimelineEventKind',
  "| 'tab-removed'",
  "| 'pane-focused'",
  "| 'tool-run'",
  'surface?: string',
  'paneId?: string',
  'tabId?: string',
  'exportSafeSummary?: string',
  'operatorTime?: string'
]) ok(types.includes(token), `PASS201 mission type missing token: ${token}`);

for (const token of [
  'MISSION_TIMELINE_KINDS',
  'isMissionTimelineKind',
  'sanitizeMissionTimelineSurface',
  'MISSION_TIMELINE_V2_SURFACES',
  'missionTimelineV2SafeSummary',
  'exportSafeSummary',
  'operatorTime',
  'surface',
  "'tool-run'",
  "'pane-focused'",
  "'tab-removed'"
]) ok(validators.includes(token), `PASS201 validator missing token: ${token}`);

for (const token of [
  'missionTimelineV2Filters',
  'PASS201_MISSION_TIMELINE_V2_PASS',
  'missionTimelineV2Diagnostics',
  'missionTimelineV2GuardrailSummary',
  'missionTimelineV2KindModel',
  'missionTimelineV2SafeSummary',
  'MissionTimelineAppendMeta',
  'exportSafeSummary = missionTimelineV2SafeSummary',
  'surface: meta.surface || model.surface',
  'operatorTime: now',
  'Timeline v2'
]) ok(model.includes(token), `PASS201 model/export missing token: ${token}`);

for (const token of [
  'PASS201_MISSION_TIMELINE_V2_PASS',
  'missionTimelineV2Diagnostics',
  'missionTimelineV2Filters',
  'missionTimelineV2GuardrailSummary',
  'missionTimelineV2KindModel',
  'missionTimelineV2SafeSummary',
  'missionTimelineV2ActiveFilter',
  'missionTimelineEventIfActive',
  'data-mission-timeline-v2-filter',
  'mission-timeline-v2-filterbar',
  'mission-timeline-v2-event',
  'data-pass201-event-kind',
  'data-pass201-event-filter',
  'data-pass201-event-surface',
  "missionTimelineEvent('pane-focused'",
  "missionTimelineEventIfActive('tool-run'",
  "missionTimelineEvent('tab-removed'",
  'document.body.dataset.pass201MissionTimelineV2',
  'document.body.dataset.pass201MissionTimelineV2Guardrails',
  'document.body.dataset.pass201MissionTimelineV2Diagnostics',
  'document.body.dataset.pass201MissionTimelineV2Filter'
]) ok(app.includes(token), `PASS201 renderer missing token: ${token}`);

for (const token of [
  'data-pass201-mission-timeline-v2',
  'filterable v2',
  'mission-timeline'
]) ok(html.includes(token), `PASS201 HTML missing token: ${token}`);

for (const token of [
  'PASS201',
  'mission-timeline-v2-diagnostics',
  'mission-timeline-v2-filterbar',
  'mission-timeline-v2-filter',
  'mission-timeline-v2-event',
  'mission-timeline-v2-rail',
  'mission-timeline-v2-body',
  'tone-layout',
  'tone-pane',
  'tone-evidence',
  'tone-tool'
]) ok(css.includes(token), `PASS201 CSS missing token: ${token}`);

for (const token of [
  'PASS201',
  'Mission Timeline v2 UX',
  'visual event model',
  'event filters',
  'operator timestamps',
  'layout/change/evidence events',
  'export-safe summaries',
  'No direct PSA API calls',
  'No provider secrets',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS201 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS201: 24'), 'PASS201 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS201 docs must not contain TODO markers.');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY', 'Set-Cookie:', 'Authorization: Bearer']) {
  ok(!contract.toLowerCase().includes(unsafe.toLowerCase()), `PASS201 contract must not contain secret literal: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS201 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:timeline|ticket|psa|provider)/i.test(app + contract), 'PASS201 must not add unsafe direct shell.openExternal for timeline paths.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS201][FAIL] Mission Timeline v2 UX verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS201][OK] Mission Timeline v2 UX verified.');
