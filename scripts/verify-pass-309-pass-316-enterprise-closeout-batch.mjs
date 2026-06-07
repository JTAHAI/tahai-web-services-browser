import { spawnSync } from 'node:child_process';
const scripts = [
  'scripts/verify-pass-309-crash-session-durability.mjs',
  'scripts/verify-pass-310-enterprise-support-bundle-v3.mjs',
  'scripts/verify-pass-311-performance-memory-soak.mjs',
  'scripts/verify-pass-312-sbom-vex-dependency-evidence.mjs',
  'scripts/verify-pass-313-signing-provenance-checksum-gate.mjs',
  'scripts/verify-pass-314-windows-installer-enterprise-closeout.mjs',
  'scripts/verify-pass-315-linux-package-enterprise-closeout.mjs',
  'scripts/verify-pass-316-enterprise-rc-ga-decision-gate.mjs',
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('PASS309_PASS316_ENTERPRISE_CLOSEOUT_BATCH=PASS');
