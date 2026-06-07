#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const types = read('src/shared/mission-types.ts');
const contract = read('src/shared/runbook-rail-v2-contract.ts');
const model = read('src/renderer/mission-model.ts');
const validators = read('src/shared/mission-validators.ts');
const evidencePack = read('src/shared/evidence-pack.ts');
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css') + read('src/renderer/styles/browser.css');
const doc = read('docs/pass-200-runbook-rail-v2.md');
const summary = read('PASS_200_RUNBOOK_RAIL_V2_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS200 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-200-runbook-rail-v2'] === 'node scripts/verify-pass-200-runbook-rail-v2.mjs', 'package.json exposes PASS200 verifier.');
ok(getReleaseBlockersContract(pkg).includes('verify:pass-200-runbook-rail-v2'), 'release-blockers chain includes PASS200 verifier.');
ok(getReleaseBlockersContract(pkg).indexOf('verify:pass-200-runbook-rail-v2') > getReleaseBlockersContract(pkg).indexOf('verify:pass-199-admin-console-profiles-v2'), 'PASS200 must run after PASS199.');

for (const file of [
  'src/shared/runbook-rail-v2-contract.ts',
  'scripts/verify-pass-200-runbook-rail-v2.mjs',
  'docs/pass-200-runbook-rail-v2.md',
  'PASS_200_RUNBOOK_RAIL_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS200 file: ${file}`);

for (const token of [
  'PASS200_RUNBOOK_RAIL_V2_PASS',
  'RUNBOOK_RAIL_V2_CONTRACT_ID',
  'runbook-rail-v2',
  'RUNBOOK_RAIL_V2_SCHEMA_VERSION = 2',
  'RunbookRailV2SectionId',
  'RunbookRailV2SectionContract',
  'RunbookRailV2Template',
  'RunbookRailV2Guardrails',
  'RunbookRailV2Diagnostics',
  'RUNBOOK_RAIL_V2_GUARDRAILS',
  'localOnly: true',
  'browserSideOnly: true',
  'redactionBeforeExport: true',
  'explicitOperatorNotes: true',
  'noConnectorWrites: true',
  'noCredentialStorage: true',
  'noTokenFields: true',
  'noCookieCapture: true',
  'noPsaWriteback: true',
  'noItDocsWriteWithoutServerAuthorization: true',
  'runbookRailV2TemplateForMissionType',
  'runbookRailV2Diagnostics',
  'runbookRailV2DiagnosticsSummary'
]) ok(contract.includes(token), `PASS200 contract missing token: ${token}`);

for (const section of ['scope', 'preflight', 'execution', 'validation', 'rollback', 'handoff']) {
  ok(contract.includes(`'${section}'`), `PASS200 contract missing runbook section: ${section}`);
}

for (const token of [
  'MissionRunbookSection',
  'MissionRunbookValidationStep',
  'MissionRunbookRollbackCondition',
  'MissionRunbookBlockedItem',
  'MissionRunbookOperatorTimestamp',
  'sections: MissionRunbookSection[]',
  'validationSteps: MissionRunbookValidationStep[]',
  'rollbackConditions: MissionRunbookRollbackCondition[]',
  'blockedItems: MissionRunbookBlockedItem[]',
  'operatorTimestamps: MissionRunbookOperatorTimestamp[]',
  'exportProfile: MissionEvidenceExportProfile',
  'updatedAt: string'
]) ok(types.includes(token), `PASS200 mission type missing token: ${token}`);

for (const token of [
  'runbookRailV2TemplateForMissionType',
  'createRunbookSections',
  'createRunbookValidationSteps',
  'createRunbookRollbackConditions',
  'createRunbookBlockedItems',
  'createRunbookOperatorTimestamps',
  'missionRunbookV2DiagnosticsLabel',
  'missionRunbookV2GuardrailSummary',
  'exportProfile: \'sanitized-handoff\'',
  'runbook.updatedAt'
]) ok(model.includes(token), `PASS200 mission model missing token: ${token}`);

for (const token of [
  'validateRunbookSection',
  'validateRunbookValidationStep',
  'validateRunbookRollbackCondition',
  'validateRunbookBlockedItem',
  'validateRunbookOperatorTimestamp',
  'MAX_MISSION_RUNBOOK_SECTIONS',
  'MAX_MISSION_RUNBOOK_VALIDATION_STEPS',
  'MAX_MISSION_RUNBOOK_ROLLBACK_CONDITIONS',
  'MAX_MISSION_RUNBOOK_BLOCKED_ITEMS',
  'MAX_MISSION_RUNBOOK_OPERATOR_TIMESTAMPS',
  'sections,',
  'validationSteps,',
  'rollbackConditions,',
  'blockedItems,',
  'operatorTimestamps,'
]) ok(validators.includes(token), `PASS200 validator missing token: ${token}`);

for (const token of [
  'Runbook Rail v2',
  'runbookRailV2DiagnosticsSummary',
  'RUNBOOK_RAIL_V2_GUARDRAILS',
  '### Sections',
  '### Validation steps',
  '### Rollback conditions',
  '### Blocked items',
  '### Operator timestamps'
]) ok(evidencePack.includes(token), `PASS200 evidence export missing token: ${token}`);

for (const token of [
  'mission-runbook-v2-diagnostics',
  'mission-runbook-sections',
  'mission-runbook-validation-list',
  'mission-runbook-rollback-list',
  'mission-runbook-blocked-list',
  'mission-runbook-timestamp-list',
  'data-pass200-runbook-rail-v2'
]) ok(html.includes(token), `PASS200 HTML missing token: ${token}`);

for (const token of [
  'PASS200_RUNBOOK_RAIL_V2_PASS',
  'RUNBOOK_RAIL_V2_GUARDRAILS',
  'runbookRailV2Diagnostics',
  'runbookRailV2DiagnosticsSummary',
  'runbookRailV2StateLabel',
  'missionRunbookV2DiagnosticsLabel',
  'missionRunbookV2GuardrailSummary',
  'missionRunbookV2Diagnostics',
  'missionRunbookSections',
  'missionRunbookValidationList',
  'missionRunbookRollbackList',
  'missionRunbookBlockedList',
  'missionRunbookTimestampList',
  'document.body.dataset.pass200RunbookRailV2',
  'document.body.dataset.pass200RunbookRailV2Guardrails',
  'document.body.dataset.pass200RunbookRailV2Diagnostics',
  'data-cycle-runbook-section',
  'data-cycle-runbook-validation',
  'data-toggle-runbook-rollback',
  'data-add-runbook-blocker',
  'data-cycle-runbook-blocker',
  'data-stamp-runbook-timestamp',
  'cycleMissionRunbookSection',
  'cycleMissionRunbookValidationStep',
  'toggleMissionRunbookRollbackCondition',
  'addMissionRunbookBlockedItem',
  'cycleMissionRunbookBlockedItem',
  'stampMissionRunbookTimestamp'
]) ok(app.includes(token), `PASS200 renderer missing token: ${token}`);

for (const token of [
  'mission-runbook-v2-diagnostics',
  'mission-runbook-v2-row',
  'mission-runbook-v2-heading',
  'PASS200'
]) ok(css.includes(token), `PASS200 CSS missing token: ${token}`);

for (const token of [
  'PASS200',
  'Runbook Rail v2',
  'checklist sections',
  'notes',
  'rollback conditions',
  'validation steps',
  'blocked items',
  'operator timestamps',
  'export-ready structure',
  'No direct PSA API calls',
  'No provider secrets',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS200 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS200: 25'), 'PASS200 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS200 docs must not contain TODO markers.');

for (const unsafe of ['psa_api_key', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY', 'Set-Cookie:', 'Authorization: Bearer']) {
  ok(!contract.toLowerCase().includes(unsafe.toLowerCase()), `PASS200 contract must not contain secret literal: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS200 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:runbook|ticket|psa|provider)/i.test(app + contract), 'PASS200 must not add unsafe direct shell.openExternal for runbooks.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS200][FAIL] Runbook Rail v2 verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS200][OK] Runbook Rail v2 verified.');
