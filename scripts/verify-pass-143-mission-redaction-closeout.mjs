#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => { console.error(`PASS143_MISSION_REDACTION_CLOSEOUT=FAIL ${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const need = (condition, message) => { if (!condition) fail(message); };

const requiredFiles = [
  'src/shared/mission-redaction-contract.ts',
  'src/shared/redaction.ts',
  'src/shared/evidence-safety.ts',
  'src/shared/evidence-pack.ts',
  'src/shared/mission-validators.ts',
  'src/main/mission-store.ts',
  'docs/mission-redaction-closeout-pass143.md',
  'PASS_143_MISSION_REDACTION_CLOSEOUT_SUMMARY.md'
];
for (const rel of requiredFiles) need(exists(rel), `missing required PASS143 file: ${rel}`);

const pkg = JSON.parse(read('package.json'));
need(pkg.version === '1.8.30', 'PASS143 must not bump version');
need(pkg.scripts?.['verify:pass-143-mission-redaction-closeout'] === 'node scripts/verify-pass-143-mission-redaction-closeout.mjs', 'package.json missing PASS143 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-143-mission-redaction-closeout'), 'release blockers must include PASS143 verifier');
need(getReleaseBlockersContract(pkg).indexOf('verify:pass-142-electron-security-final-audit') < getReleaseBlockersContract(pkg).indexOf('verify:pass-143-mission-redaction-closeout'), 'PASS143 should run after PASS142');

const contract = read('src/shared/mission-redaction-contract.ts');
for (const token of [
  "TAHAI_MISSION_REDACTION_PASS = 'PASS143'",
  'MISSION_REDACTION_STORAGE_POLICY',
  'missionJsonIsUntrusted: true',
  'rejectSecretBearingKeys: true',
  'redactTextBeforePersistence: true',
  'exportRedactedMarkdownOnly: true',
  'MISSION_REDACTION_SECRET_KEY_TOKENS',
  'MISSION_REDACTION_CLASSES',
  'MISSION_REDACTION_BLOCKED_PROTOCOLS',
  'missionRedactionPolicySummary'
]) need(contract.includes(token), `mission redaction contract missing ${token}`);
for (const token of ['authorization','cookie','token','client_secret','api_key','password','privateKey','session']) {
  need(contract.includes(`'${token}'`) || contract.includes(`"${token}"`), `contract missing secret key token ${token}`);
}
for (const token of ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:']) need(contract.includes(token), `contract missing blocked protocol ${token}`);

const redaction = read('src/shared/redaction.ts');
for (const token of [
  'REDACTION_ENGINE_PASS',
  'REDACTION_RULES',
  'Authorization header',
  'Cookie header',
  'Bearer token',
  'GitHub token',
  'OpenAI-style API key',
  'Slack token',
  'Google API key',
  'AWS access key',
  'AWS secret access key assignment',
  'Secret assignment',
  'Sensitive URL query value',
  'JWT-looking string',
  'Private key block',
  'Email address',
  'IPv4 address',
  'IPv6 address',
  'Twelve-digit cloud account ID',
  'UUID identifier',
  'redactForMissionStorage',
  'redactForMissionExport',
  'hasHighRiskRedaction',
  'findingCount'
]) need(redaction.includes(token), `redaction engine missing ${token}`);
need(/AKIA\|ASIA/.test(redaction), 'redaction must cover AWS long-lived and temporary access-key prefixes');
need(/access_token\|id_token\|refresh_token\|client_secret/.test(redaction), 'redaction must cover sensitive URL query tokens');

const validators = read('src/shared/mission-validators.ts');
for (const token of [
  'MISSION_REDACTION_BLOCKED_PROTOCOLS',
  'MISSION_REDACTION_SECRET_KEY_TOKENS',
  'MISSION_REDACTION_STORAGE_POLICY',
  'redactForMissionStorage',
  'cleanMissionDisplayText',
  'cleanEvidenceText',
  'parsed.username = \'\';',
  'parsed.password = \'\';',
  'parsed.searchParams.set(key, \'[REDACTED]\')',
  'hasForbiddenKey(input)',
  'Mission contains a forbidden secret-bearing field',
  'cleanMissionDisplayText(input.name, 96)',
  'cleanMissionDisplayText(input.title, 160)',
  'cleanEvidenceText(input.operatorNote, 1200)',
  'metadata[safeKey] = cleanEvidenceText(value, 300)'
]) need(validators.includes(token), `mission validator missing ${token}`);

const safety = read('src/shared/evidence-safety.ts');
for (const token of [
  'EVIDENCE_REDACTION_CLOSEOUT_PASS',
  'SHAREABLE_MISSION_EXPORT_PROFILES',
  'MISSION_REDACTION_EXPORT_PROFILES',
  'redactForMissionExport',
  'finalScan.redacted.trim()',
  'findings: scan.findings.length ? scan.findings : finalScan.findings',
  'parsed.username = \'\';',
  'parsed.password = \'\';',
  'MISSION_REDACTION_STORAGE_POLICY.stripUrlFragments'
]) need(safety.includes(token), `evidence safety missing ${token}`);

const pack = read('src/shared/evidence-pack.ts');
for (const token of [
  'MISSION_EVIDENCE_REDACTION_CLOSEOUT_PASS',
  'missionRedactionPolicySummary',
  'PASS143 redaction policy',
  'findings: RedactionFinding[]',
  'findings: scan.findings.length ? scan.findings : finalScan.findings',
  'sanitizeEvidenceMarkdown(markdown, profile)',
  'redactedMarkdown: scan.markdown'
]) need(pack.includes(token), `evidence pack missing ${token}`);

const store = read('src/main/mission-store.ts');
for (const token of [
  'buildMissionEvidencePack(result.mission, { profile: \'sanitized-handoff\' })',
  'packet.redactedMarkdown',
  'findings: packet.findings.length ? packet.findings : exportScan.findings',
  'clipboard.writeText(result.redactedMarkdown)',
  "fs.writeFileSync(saveResult.filePath, result.redactedMarkdown, 'utf8')",
  'Save Redacted Packet'
]) need(store.includes(token), `mission store missing ${token}`);
need(!/fs\.writeFileSync\(saveResult\.filePath, result\.markdown/.test(store), 'saveMissionExport must never write raw markdown');
need(!/clipboard\.writeText\(result\.markdown/.test(store), 'copyMissionExport must never copy raw markdown');
need(!/scanAndRedact\(packet\.markdown\)/.test(store), 'main mission export must not use raw packet markdown as the copy/save source');

const docs = `${read('docs/mission-redaction-closeout-pass143.md')}\n${read('PASS_143_MISSION_REDACTION_CLOSEOUT_SUMMARY.md')}`;
for (const token of ['PASS143', 'Mission files are untrusted', 'secret-bearing keys', 'redacted Markdown only', 'Authorization header', 'Cookie header', 'Bearer token', 'Private key block', 'IT Docs', 'PSA']) {
  need(docs.includes(token), `PASS143 docs missing ${token}`);
}

const sourceJoined = ['src/shared/mission-redaction-contract.ts','src/shared/redaction.ts','src/shared/evidence-safety.ts','src/shared/evidence-pack.ts','src/shared/mission-validators.ts','src/main/mission-store.ts']
  .map(read).join('\n');
for (const forbidden of ['psa:direct-fetch', 'secret:get', 'cookie:get-all', 'auth:get-token', 'read-file-any', 'write-file-any', 'save-any-path', 'load-any-path']) {
  need(!sourceJoined.includes(forbidden), `forbidden channel token present in PASS143 source: ${forbidden}`);
}

console.log('PASS143_MISSION_REDACTION_CLOSEOUT=PASS');
process.exit(0);
