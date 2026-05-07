#!/usr/bin/env node
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function fail(message) {
  console.error(`PASS91 verification failed: ${message}`);
  process.exit(1);
}

function requireIncludes(path, needles) {
  const text = read(path);
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${path} missing ${needle}`);
  }
  return text;
}

const redaction = requireIncludes('src/shared/redaction.ts', [
  'Sensitive URL query value',
  'OpenAI-style API key',
  'Slack token',
  'Google API key',
  'AWS secret access key assignment',
  'Secret assignment',
  'Cookie header',
  'Authorization header'
]);

if (!/access_token\|id_token\|refresh_token\|client_secret/.test(redaction)) fail('redaction rules must cover sensitive URL query tokens');

const safety = requireIncludes('src/shared/evidence-safety.ts', [
  'sanitizeEvidenceUrl',
  'sanitizeEvidenceMarkdown',
  'evidenceMarkdownCell',
  'SENSITIVE_QUERY_KEYS',
  'REDACT_QUERY_KEYS_FOR_SANITIZED',
  "parsed.username = '';",
  "parsed.password = '';",
  "parsed.hash = '';"
]);

if (!/profile !== 'internal'/.test(safety)) fail('evidence safety must preserve an explicit internal-vs-sanitized profile distinction');

const pack = requireIncludes('src/shared/evidence-pack.ts', [
  "from './evidence-safety'",
  'safeUrl(tab.url, profile)',
  'safeUrl(entry.url, profile)',
  'sanitizeEvidenceMarkdown(markdown, profile)',
  'redactedMarkdown: scan.markdown'
]);

const validators = requireIncludes('src/shared/mission-validators.ts', [
  "import { scanAndRedact } from './redaction'",
  'SENSITIVE_URL_PARAM_RE',
  "parsed.hash = '';",
  "parsed.searchParams.set(key, '[REDACTED]')",
  'cleanEvidenceText(input.operatorNote, 1200)',
  'metadata[safeKey] = cleanEvidenceText(value, 300)'
]);

const app = requireIncludes('src/renderer/app.ts', [
  "from '../shared/evidence-safety'",
  'function evidenceSafeUrl',
  'function evidenceSafeMarkdown',
  "evidenceSafeMarkdown(markdown, 'change-bundle')",
  "evidenceSafeMarkdown(markdown, 'operational-handoff')",
  "evidenceSafeMarkdown(candidate.markdown, 'sanitized-handoff')",
  'Copied redacted bundle',
  'Copied redacted handoff',
  'Redaction safety'
]);

for (const unsafeSnippet of [
  'copyDevOpsCapture(markdown);\n  showBundleResult',
  'copyDevOpsCapture(markdown);\n  showHandoffResult',
  'saveDevOpsCapture(markdown, latestChangeBundle',
  'saveDevOpsCapture(markdown, latestOperationalHandoff'
]) {
  if (app.includes(unsafeSnippet)) fail(`renderer copy/save still uses raw export markdown: ${unsafeSnippet}`);
}

requireIncludes('src/renderer/index.html', [
  'aria-describedby="bundle-note"',
  'aria-describedby="handoff-note"',
  'aria-describedby="ops-guard-note"',
  'sanitizes URLs, titles, notes, pinned evidence bodies, and copy/save output before handoff'
]);

requireIncludes('src/renderer/styles/browser.css', [
  'PASS91 evidence/export handoff safety',
  '.bundle-dialog .ops-body',
  '.handoff-dialog .ops-body',
  '.guard-dialog .ops-body',
  'overscroll-behavior:contain',
  '.handoff-tabs [aria-pressed="true"]::after'
]);

const store = requireIncludes('src/main/mission-store.ts', [
  'packet.redactedMarkdown',
  'clipboard.writeText(result.redactedMarkdown)',
  "fs.writeFileSync(saveResult.filePath, result.redactedMarkdown, 'utf8')"
]);
if (/scanAndRedact\(packet\.markdown\)/.test(store)) fail('main mission export must not rescan raw packet markdown as the copy/save source');

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts['verify:pass-91-evidence-export-redaction-handoff'] !== 'node scripts/verify-pass-91-evidence-export-redaction-handoff.mjs') fail('package.json missing PASS91 verifier script');
if (!pkg.scripts['verify:release-blockers']?.includes('verify:pass-91-evidence-export-redaction-handoff')) fail('release blockers missing PASS91 verifier');

console.log('PASS91 evidence/export redaction handoff verification passed.');
