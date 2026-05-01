#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const errors = [];

if (!fs.existsSync(releaseDir)) {
  errors.push('release directory does not exist');
} else {
  const files = fs.readdirSync(releaseDir, { recursive: true })
    .map((file) => String(file).replaceAll('\\', '/'))
    .filter((file) => fs.statSync(path.join(releaseDir, file)).isFile());

  const expected = [
    { label: 'AppImage', regex: new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.AppImage$`) },
    { label: 'deb', regex: new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.deb$`) },
    { label: 'rpm', regex: new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.rpm$`) },
  ];

  for (const target of expected) {
    const match = files.find((file) => target.regex.test(file));
    if (!match) {
      errors.push(`missing Linux ${target.label} artifact for ${pkg.version}`);
      continue;
    }
    const size = fs.statSync(path.join(releaseDir, match)).size;
    if (size < 10 * 1024 * 1024) errors.push(`Linux ${target.label} artifact is suspiciously small: ${match} (${size} bytes)`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_INSTALLERS_ERROR=${error}`);
  process.exit(1);
}

console.log(`TAHAI_LINUX_INSTALLERS=OK version=${pkg.version}`);
