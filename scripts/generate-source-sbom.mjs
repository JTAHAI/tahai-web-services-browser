#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : 'artifacts/sbom/tahai-browser-sbom.json';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel));
const hashFile = (rel) => crypto.createHash('sha256').update(read(rel)).digest('hex');
const pkg = JSON.parse(read('package.json').toString('utf8'));
const lock = JSON.parse(read('package-lock.json').toString('utf8'));
const packages = Object.entries(lock.packages || {})
  .filter(([name]) => name && name.startsWith('node_modules/'))
  .map(([name, meta]) => ({
    name: name.replace(/^node_modules\//, ''),
    version: meta.version || null,
    license: meta.license || null,
    resolved: meta.resolved || null,
    integrityPresent: typeof meta.integrity === 'string' && meta.integrity.length > 0,
    dev: Boolean(meta.dev),
    optional: Boolean(meta.optional)
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const integrityCount = packages.filter((p) => p.integrityPresent).length;
const sbom = {
  schemaVersion: 2,
  pass: 'PASS159',
  contractId: 'enterprise-signing-provenance-sbom-v1',
  product: pkg.productName,
  packageName: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  sourceOnly: true,
  generatedArtifact: true,
  commitGeneratedArtifacts: false,
  packageLockSha256: hashFile('package-lock.json'),
  packageJsonSha256: hashFile('package.json'),
  npmIntegrity: {
    packageCount: packages.length,
    integrityCount,
    missingIntegrityCount: packages.length - integrityCount
  },
  releaseTraceability: {
    mustMatchPublicCommitOrTag: true,
    mustBePublishedBesideArtifacts: true,
    noFalseSigningClaim: true,
    generatedFromLockfile: 'package-lock.json'
  },
  packageCount: packages.length,
  packages
};
fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(sbom, null, 2) + '\n');
console.log(`TAHAI_SOURCE_SBOM=OK pass=PASS159 output=${output} packages=${packages.length} packageLockSha256=${sbom.packageLockSha256}`);
