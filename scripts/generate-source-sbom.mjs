#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex >= 0 ? args[outputIndex + 1] : 'artifacts/sbom/tahai-browser-sbom.json';
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = Object.entries(lock.packages || {})
  .filter(([name]) => name && name.startsWith('node_modules/'))
  .map(([name, meta]) => ({
    name: name.replace(/^node_modules\//, ''),
    version: meta.version || null,
    license: meta.license || null,
    resolved: meta.resolved || null
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const sbom = {
  product: pkg.productName,
  packageName: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  sourceOnly: true,
  packageCount: packages.length,
  packages
};
fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(sbom, null, 2) + '\n');
console.log(`TAHAI_SOURCE_SBOM=OK output=${output} packages=${packages.length}`);
