#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/mission-evidence-pack-v2-contract.ts');
const types = read('src/shared/mission-types.ts');
const validators = read('src/shared/mission-validators.ts');
const evidencePack = read('src/shared/evidence-pack.ts');
const missionStore = read('src/main/mission-store.ts');
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css') + read('src/renderer/styles/browser.css');
const doc = read('docs/pass-202-evidence-pack-v2.md');
const summary = read('PASS_202_EVIDENCE_PACK_V2_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS202 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-202-evidence-pack-v2'] === 'node scripts/verify-pass-202-evidence-pack-v2.mjs', 'package.json exposes PASS202 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-202-evidence-pack-v2'), 'release-blockers chain includes PASS202 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-202-evidence-pack-v2') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-201-mission-timeline-v2'), 'PASS202 must run after PASS201.');

for (const file of [
  'src/shared/mission-evidence-pack-v2-contract.ts',
  'scripts/verify-pass-202-evidence-pack-v2.mjs',
  'docs/pass-202-evidence-pack-v2.md',
  'PASS_202_EVIDENCE_PACK_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS202 file: ${file}`);

for (const token of [
  'PASS202_MISSION_EVIDENCE_PACK_V2_PASS',
  'MISSION_EVIDENCE_PACK_V2_CONTRACT_ID',
  'mission-evidence-pack-v2',
  'MISSION_EVIDENCE_PACK_V2_SCHEMA_VERSION = 2',
  'MISSION_EVIDENCE_PACK_V2_CAPTURE_SCOPES',
  'active-pane',
  'all-panes',
  'tool-output',
  'recipe-prompt',
  'MissionEvidencePackV2Guardrails',
  'localOnly: true',
  'browserSideOnly: true',
  'explicitCaptureOnly: true',
  'activePaneScopeRequired: true',
  'allPaneCaptureUsesSummariesOnly: true',
  'urlTitleTimeMetadataRequired: true',
  'notesRedactionScanned: true',
  'exportProfileVisible: true',
  'clearSuccessErrorStates: true',
  'noCookieCapture: true',
  'noCredentialCapture: true',
  'noRequestBodyCapture: true',
  'noResponseBodyCapture: true',
  'noBrowserStorageCapture: true',
  'redactionBeforeExport: true',
  'noConnectorWrites: true',
  'missionEvidencePackV2Diagnostics',
  'missionEvidencePackV2GuardrailSummary',
  'missionEvidencePackV2ProfileLabel',
  'missionEvidencePackV2ProfileDetail',
  'missionEvidencePackV2CaptureScope',
  'missionEvidencePackV2Status'
]) ok(contract.includes(token), `PASS202 contract missing token: ${token}`);

for (const token of [
  'MissionEvidenceExportProfile',
  'MissionEvidenceEntry',
  'createdAt: string',
  'operatorNote: string',
  'metadata: Record<string, string>'
]) ok(types.includes(token), `PASS202 type baseline missing token: ${token}`);

for (const token of [
  'sanitizeMissionEvidenceMetadata',
  'sanitizeEvidenceCaptureMetadata',
  'validateEvidenceEntry',
  'createdAt: cleanIso',
  'operatorNote: cleanEvidenceText',
  'metadata'
]) ok(validators.includes(token), `PASS202 validator baseline missing token: ${token}`);

for (const token of [
  'PASS202_MISSION_EVIDENCE_PACK_V2_PASS',
  'missionEvidencePackV2CaptureScope',
  'missionEvidencePackV2Diagnostics',
  'missionEvidencePackV2GuardrailSummary',
  'missionEvidencePackV2ProfileDetail',
  'Evidence capture scope',
  'captureScope',
  'captured',
  'status'
]) ok(evidencePack.includes(token), `PASS202 evidence packet export missing token: ${token}`);

ok(missionStore.includes("profile: result.mission.runbook?.exportProfile || 'sanitized-handoff'"), 'main export path must use selected Mission export profile.');
ok(missionStore.includes("profile: mission.runbook?.exportProfile || 'sanitized-handoff'"), 'missionMarkdown path must use selected Mission export profile.');

for (const token of [
  'data-pass202-mission-evidence-pack-v2',
  'mission-evidence-diagnostics',
  'mission-export-profile',
  'mission-evidence-note',
  'mission-pin-active-page',
  'mission-pin-all-panes',
  'mission-pin-latest-evidence',
  'Active pane · all panes · export profiles',
  'Sanitized Handoff',
  'Internal Markdown',
  'Incident Packet',
  'Change Record',
  'IT Docs Sync',
  'PSA Ticket Note'
]) ok(html.includes(token), `PASS202 HTML missing token: ${token}`);

for (const token of [
  'PASS202_MISSION_EVIDENCE_PACK_V2_PASS',
  'missionEvidencePackV2Diagnostics',
  'missionEvidencePackV2GuardrailSummary',
  'missionEvidencePackV2ProfileDetail',
  'missionEvidencePackV2ProfileLabel',
  'missionEvidencePackV2Status',
  'MissionEvidencePackV2CaptureScope',
  'missionEvidenceTargetForActivePane',
  'captureScope',
  'captureStatus',
  'urlTitleTimeMetadata',
  'pinAllMissionPanesToMission',
  'document.body.dataset.pass202MissionEvidencePackV2',
  'document.body.dataset.pass202MissionEvidencePackV2Guardrails',
  'document.body.dataset.pass202MissionEvidencePackV2Diagnostics',
  'document.body.dataset.pass202LastEvidenceStatus',
  'data-pass202-capture-scope',
  'data-pass202-capture-status',
  "missionTimelineEvent('evidence-added'",
  "missionTimelineEvent('runbook-updated', 'Evidence export profile changed'"
]) ok(app.includes(token), `PASS202 renderer missing token: ${token}`);

for (const token of [
  'PASS202',
  'mission-evidence-v2-diagnostics',
  'mission-evidence-profile',
  'mission-evidence-note',
  'mission-evidence-v2-item',
  'data-pass202-capture-scope="active-pane"',
  'data-pass202-capture-scope="all-panes"',
  'data-pass202-capture-scope="tool-output"'
]) ok(css.includes(token), `PASS202 CSS missing token: ${token}`);

for (const token of [
  'PASS202',
  'Evidence Pack v2 UX',
  'active-pane',
  'all-visible-pane',
  'export profile',
  'URL/title/time',
  'No IT Docs backend implementation',
  'No PSA connector implementation',
  'Version remains `1.8.30`'
]) ok(doc.includes(token) || summary.includes(token), `PASS202 docs missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS202: 23'), 'PASS202 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS202 docs must not contain TODO markers.');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY', 'Set-Cookie:', 'Authorization: Bearer']) {
  ok(!contract.toLowerCase().includes(unsafe.toLowerCase()), `PASS202 contract must not contain secret literal: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS202 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:evidence|ticket|psa|provider)/i.test(app + contract), 'PASS202 must not add unsafe direct shell.openExternal for evidence paths.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS202][FAIL] Evidence Pack v2 UX verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS202][OK] Evidence Pack v2 UX verified.');
