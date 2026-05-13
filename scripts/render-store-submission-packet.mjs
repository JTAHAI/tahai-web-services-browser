#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config', 'store-listing-submission-packet.example.json');
const pkgPath = path.join(root, 'package.json');
const outArg = process.argv.find((arg) => arg.startsWith('--output='));
const output = outArg ? outArg.slice('--output='.length) : null;
function fail(message) { console.error(`[PASS247][FAIL] ${message}`); process.exit(1); }
if (!fs.existsSync(configPath)) fail('Missing config/store-listing-submission-packet.example.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (config.version !== pkg.version) fail(`listing version ${config.version} does not match package version ${pkg.version}`);
const lines = [];
lines.push(`# Microsoft Store listing packet — ${config.productName} ${config.version}`);
lines.push('');
lines.push('Submission status: **blocked until installed smoke, Partner Center identity, package evidence, and live privacy/support links are verified.**');
lines.push('');
lines.push(`Short description: ${config.shortDescription}`);
lines.push('');
lines.push('## Store description draft');
for (const para of config.storeDescription) lines.push('', para);
lines.push('', '## Required links', '', `- Website: ${config.websiteUrl}`, `- Privacy: ${config.privacyUrl}`, `- Support: ${config.supportUrl}`, `- Source: ${config.openSourceUrl}`);
lines.push('', '## Screenshots required');
for (const item of config.screenshotsRequired) lines.push(`- ${item}`);
lines.push('', '## Rating notes', '', config.ageRatingNotes);
lines.push('', '## Release truth', '', '- Store submission is not approved by source checks alone.', '- Direct MSI/EXE/MSIX downloads remain unsigned-preview unless a trusted signing path is separately completed.', '- No Partner Center credentials, Store association files, certificates, MSIX/MSIXUPLOAD packages, or generated Store artifacts belong in source.');
const text = lines.join('\n') + '\n';
if (output) {
  const full = path.resolve(root, output);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text, 'utf8');
  console.log(`[PASS247][OK] Rendered Store submission packet: ${path.relative(root, full)}`);
} else {
  console.log(text);
}
