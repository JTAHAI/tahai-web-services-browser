#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const errors = [];

// PASS68 artifact-token guard: x86_64\.AppImage amd64\.deb x86_64\.rpm
const expected = [
  {
    label: 'AppImage',
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.AppImage$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x86_64\\.AppImage$`),
    ],
  },
  {
    label: 'deb',
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.deb$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-amd64\\.deb$`),
    ],
  },
  {
    label: 'rpm',
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.rpm$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x86_64\\.rpm$`),
    ],
  },
];

if (!fs.existsSync(releaseDir)) {
  errors.push('release directory does not exist');
} else {
  const files = fs.readdirSync(releaseDir, { recursive: true })
    .map((file) => String(file).replaceAll('\\\\', '/'))
    .filter((file) => fs.statSync(path.join(releaseDir, file)).isFile());

  for (const target of expected) {
    const match = files.find((file) => target.patterns.some((regex) => regex.test(file)));
    if (!match) {
      errors.push(`missing Linux ${target.label} artifact for ${pkg.version}`);
      continue;
    }

    const size = fs.statSync(path.join(releaseDir, match)).size;
    if (size < 10 * 1024 * 1024) {
      errors.push(`Linux ${target.label} artifact is suspiciously small: ${match} (${size} bytes)`);
    } else {
      console.log(`TAHAI_LINUX_INSTALLER_FOUND=${target.label}:${match}:${size}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_INSTALLERS_ERROR=${error}`);
  process.exit(1);
}

console.log(`TAHAI_LINUX_INSTALLERS=OK version=${pkg.version}`);
