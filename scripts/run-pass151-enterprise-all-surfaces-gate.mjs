#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const outDirArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outDir = outDirArg ? outDirArg.slice('--out-dir='.length) : 'artifacts/enterprise-all-surfaces';
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const readMaybe = (p) => exists(p) ? fs.readFileSync(rel(p), 'utf8') : null;
const sha256 = (text) => crypto.createHash('sha256').update(text || '').digest('hex');

const requiredEvidence = [
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
];
const packageHandoffs = [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
];
const sourceGates = [
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-139-linux-package-handoff-closeout',
  'verify:pass-140-download-install-checksum-ux',
  'verify:pass-141-version-about-update-channel-truth',
  'verify:pass-142-electron-security-final-audit',
  'verify:pass-143-mission-redaction-closeout',
  'verify:pass-144-public-repo-supply-chain',
  'verify:pass-145-privacy-support-known-issues',
  'verify:pass-146-windows-installed-smoke',
  'verify:pass-147-linux-installed-smoke',
  'verify:pass-148-cross-size-responsive-regression',
  'verify:pass-149-rc1-freeze',
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
];

const pkg = JSON.parse(fs.readFileSync(rel('package.json'), 'utf8'));
const blockerScript = String(pkg.scripts?.['verify:release-blockers'] || '');
const sourceGateStatus = sourceGates.map((script) => ({ script, present: blockerScript.includes(script) }));
const packageHandoffStatus = packageHandoffs.map((file) => ({ file, present: exists(file), sha256: readMaybe(file) ? sha256(readMaybe(file)) : null }));
const evidenceStatus = requiredEvidence.map((file) => {
  const content = readMaybe(file);
  let parsed = null;
  if (content) {
    try { parsed = JSON.parse(content); } catch { parsed = { parseError: true }; }
  }
  return { file, present: Boolean(content), sha256: content ? sha256(content) : null, summary: parsed?.summary || parsed?.status || parsed?.result || null };
});
const missingSourceGates = sourceGateStatus.filter((x) => !x.present).map((x) => x.script);
const missingPackageHandoffs = packageHandoffStatus.filter((x) => !x.present).map((x) => x.file);
const missingEvidence = evidenceStatus.filter((x) => !x.present).map((x) => x.file);

const report = {
  schemaVersion: 1,
  pass: 'PASS151',
  status: strict && (missingSourceGates.length || missingPackageHandoffs.length || missingEvidence.length) ? 'BLOCKED' : 'SOURCE_GATE_READY',
  generatedAt: new Date().toISOString(),
  version: pkg.version,
  strict,
  sourceGateStatus,
  packageHandoffStatus,
  evidenceStatus,
  missingSourceGates,
  missingPackageHandoffs,
  missingEvidence,
  releaseDecision: missingPackageHandoffs.length || missingEvidence.length
    ? 'Do not call this an enterprise release until the missing package handoffs and manual installed-app evidence are captured on the target platforms.'
    : 'Enterprise all-surfaces release evidence is present for source, package handoff, and installed-app manual smoke lanes.',
};

fs.mkdirSync(rel(outDir), { recursive: true });
const jsonPath = path.join(outDir, 'PASS151-enterprise-all-surfaces-evidence.json');
const mdPath = path.join(outDir, 'PASS151-enterprise-all-surfaces-evidence.md');
fs.writeFileSync(rel(jsonPath), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(rel(mdPath), `# PASS151 Enterprise All-Surfaces Evidence\n\nStatus: **${report.status}**\n\nVersion: \`${report.version}\`\n\nStrict: \`${strict}\`\n\n## Missing package handoffs\n\n${missingPackageHandoffs.length ? missingPackageHandoffs.map((x) => `- ${x}`).join('\n') : '- None'}\n\n## Missing manual evidence\n\n${missingEvidence.length ? missingEvidence.map((x) => `- ${x}`).join('\n') : '- None'}\n\n## Release decision\n\n${report.releaseDecision}\n`);
console.log(`PASS151_ENTERPRISE_ALL_SURFACES_EVIDENCE=${report.status}`);
console.log(`PASS151_EVIDENCE_JSON=${jsonPath}`);
console.log(`PASS151_EVIDENCE_MARKDOWN=${mdPath}`);
if (report.status === 'BLOCKED') process.exit(2);
