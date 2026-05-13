#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/^\uFEFF/, '');
const exists = (path) => existsSync(join(root, path));
const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/mission-evidence-redaction-ux-v2-contract.ts');
const redaction = read('src/shared/redaction.ts');
const evidencePack = read('src/shared/evidence-pack.ts');
const missionStore = read('src/main/mission-store.ts');
const types = read('src/shared/mission-types.ts');
const html = read('src/renderer/index.html');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css') + read('src/renderer/styles/browser.css');
const doc = read('docs/pass-203-evidence-redaction-ux-v2.md');
const summary = read('PASS_203_EVIDENCE_REDACTION_UX_V2_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS203 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-203-evidence-redaction-ux-v2'] === 'node scripts/verify-pass-203-evidence-redaction-ux-v2.mjs', 'package.json exposes PASS203 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-203-evidence-redaction-ux-v2'), 'release-blockers chain includes PASS203 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-203-evidence-redaction-ux-v2') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-202-evidence-pack-v2'), 'PASS203 must run after PASS202.');

for (const file of [
  'src/shared/mission-evidence-redaction-ux-v2-contract.ts',
  'scripts/verify-pass-203-evidence-redaction-ux-v2.mjs',
  'docs/pass-203-evidence-redaction-ux-v2.md',
  'PASS_203_EVIDENCE_REDACTION_UX_V2_SUMMARY.md'
]) ok(exists(file), `missing PASS203 file: ${file}`);

for (const token of [
  'PASS203_EVIDENCE_REDACTION_UX_V2_PASS',
  'MISSION_EVIDENCE_REDACTION_UX_V2_CONTRACT_ID',
  'mission-evidence-redaction-ux-v2',
  'MISSION_EVIDENCE_REDACTION_UX_V2_SCHEMA_VERSION = 2',
  'MISSION_EVIDENCE_REDACTION_UX_V2_BLOCKED_CLASSES',
  'MISSION_EVIDENCE_REDACTION_UX_V2_WARN_CLASSES',
  'Private key block',
  'Authorization header',
  'Cookie header',
  'Bearer token',
  'GitHub token',
  'OpenAI-style API key',
  'AWS access key',
  'blocked-from-unredacted-export',
  'redact-by-default',
  'warn-and-redact',
  'MissionEvidenceRedactionUxV2Review',
  'missionEvidenceRedactionUxV2Review',
  'missionEvidenceRedactionUxV2ProfileMode',
  'missionEvidenceRedactionUxV2GuardrailSummary',
  'missionEvidenceRedactionUxV2Explanation',
  'noScaryUnexplainedFailures: true',
  'noRawSecretEcho: true',
  'redactedPacketStillAllowed: true',
  'safeStatus'
]) ok(contract.includes(token), `PASS203 contract missing token: ${token}`);

for (const token of [
  'REDACTION_RULES',
  'scanAndRedact',
  'private-key-block',
  'jwt-looking-string',
  'sensitive-url-query-value'
]) ok(redaction.includes(token), `redaction engine baseline missing token: ${token}`);

for (const token of [
  'PASS203_EVIDENCE_REDACTION_UX_V2_PASS',
  'missionEvidenceRedactionUxV2Review',
  'missionEvidenceRedactionUxV2GuardrailSummary',
  'redactionReview',
  'redactionRows',
  'PASS203 Evidence Redaction UX v2',
  'Default action',
  'Export action',
  'blocked-from-unredacted-export'
]) ok(evidencePack.includes(token), `PASS203 evidence packet export missing token: ${token}`);

ok(missionStore.includes('redactionReview: packet.redactionReview'), 'main export result must surface PASS203 redaction review.');
ok(types.includes('redactionReview?: unknown'), 'MissionExportResult must preserve redaction review without exposing a privileged type dependency.');

for (const token of [
  'mission-redaction-preview',
  'data-pass203-evidence-redaction-ux-v2',
  'Redaction UX v2',
  'blocked from unredacted export',
  'Export profile',
  'Internal Markdown',
  'Sanitized Handoff'
]) ok(html.includes(token), `PASS203 HTML missing token: ${token}`);

for (const token of [
  'PASS203_EVIDENCE_REDACTION_UX_V2_PASS',
  'missionEvidenceRedactionUxV2Review',
  'missionEvidenceRedactionUxV2GuardrailSummary',
  'missionRedactionPreview',
  'missionEvidenceRedactionSubject',
  'missionEvidenceRedactionReview',
  'redactionFindingCount',
  'redactionBlockedClassCount',
  'redactionDefaultAction',
  'document.body.dataset.pass203EvidenceRedactionUxV2',
  'document.body.dataset.pass203EvidenceRedactionUxV2Guardrails',
  'document.body.dataset.pass203EvidenceRedactionUxV2Status',
  'document.body.dataset.pass203LastRedactionStatus',
  'data-pass203-redaction-action'
]) ok(app.includes(token), `PASS203 renderer missing token: ${token}`);

for (const token of [
  'PASS203 Evidence Redaction UX v2',
  'mission-redaction-ux-v2-preview',
  'data-pass203-blocked-class-count',
  'data-pass203-redaction-action="blocked-from-unredacted-export"',
  'data-pass203-redaction-action="redact-before-copy-save"'
]) ok(css.includes(token), `PASS203 CSS missing token: ${token}`);

for (const token of [
  'PASS203',
  'Evidence Redaction UX v2',
  'plain-language',
  'blocked from unredacted export',
  'No IT Docs backend implementation',
  'No PSA connector implementation',
  'Version remains `1.8.30`'
]) ok(doc.includes(token) || summary.includes(token), `PASS203 docs missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS203: 22'), 'PASS203 summary must record remaining pass count.');
ok(next.includes('PASS204 — Operator Command Center v2'), 'NEXT_CHAT_STARTER must advance to PASS204.');
ok(!doc.includes('TODO') && !summary.includes('TODO') && !next.includes('TODO'), 'PASS203 docs must not contain TODO markers.');

for (const unsafe of ['BEGIN RSA PRIVATE KEY-----FAKE', 'xoxb-1234567890', 'ghp_1234567890', 'sk-1234567890']) {
  ok(!contract.includes(unsafe) && !doc.includes(unsafe) && !summary.includes(unsafe), `PASS203 materials must not contain fake secret literals: ${unsafe}`);
}
ok(!/fetch\([^)]*psa/i.test(app + contract), 'PASS203 must not add browser-side PSA fetches.');
ok(!/shell\.openExternal\([^)]*(?:evidence|ticket|psa|provider)/i.test(app + contract), 'PASS203 must not add unsafe direct shell.openExternal for evidence paths.');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) ok(!exists(file), `generated output must not be committed: ${file}`);

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS203][FAIL] Evidence Redaction UX v2 verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS203][OK] Evidence Redaction UX v2 verified.');
