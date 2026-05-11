#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);

const normalizeTarget = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return [];
  if (token === 'all' || token === 'release' || token === 'linux') return ['AppImage', 'deb', 'rpm'];
  if (token === 'appimage' || token === 'app-image') return ['AppImage'];
  if (token === 'deb' || token === 'debian') return ['deb'];
  if (token === 'rpm' || token === 'fedora') return ['rpm'];
  fail(`unknown Linux handoff target: ${value}`);
  return [];
};

const requested = process.argv.slice(2);
const targetList = [];
for (const value of requested.length ? requested : ['all']) {
  for (const target of normalizeTarget(value)) {
    if (!targetList.includes(target)) targetList.push(target);
  }
}
if (!targetList.length) fail('no Linux handoff targets selected');

const targetKind = {
  AppImage: {
    canonicalName: `TAHAI-Web-Services-Browser-${pkg.version}-x64.AppImage`,
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.AppImage$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x86_64\\.AppImage$`),
      /\.AppImage$/,
    ],
  },
  deb: {
    canonicalName: `TAHAI-Web-Services-Browser-${pkg.version}-x64.deb`,
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.deb$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-amd64\\.deb$`),
      /\.deb$/,
    ],
  },
  rpm: {
    canonicalName: `TAHAI-Web-Services-Browser-${pkg.version}-x64.rpm`,
    patterns: [
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x64\\.rpm$`),
      new RegExp(`TAHAI-Web-Services-Browser-${pkg.version}-x86_64\\.rpm$`),
      /\.rpm$/,
    ],
  },
};

const sourceReleaseDir = path.join(root, 'release');
const handoffRoot = process.env.TAHAI_LINUX_SOURCE_ROOT
  ? path.join(process.env.TAHAI_LINUX_SOURCE_ROOT, 'release', 'linux')
  : path.join(root, 'release', 'linux');

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  const visit = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (child === handoffRoot) continue;
        visit(child);
      } else if (entry.isFile()) {
        output.push(child);
      }
    }
  };
  visit(dir);
  return output;
};

const releaseFiles = listFiles(sourceReleaseDir);
const selected = [];
for (const target of targetList) {
  const spec = targetKind[target];
  const match = releaseFiles
    .filter((file) => spec.patterns.some((regex) => regex.test(path.basename(file))))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  if (!match) {
    fail(`missing built Linux ${target} artifact in release output`);
    continue;
  }
  const size = fs.statSync(match).size;
  if (size < 10 * 1024 * 1024) fail(`Linux ${target} artifact is suspiciously small: ${path.relative(root, match)} (${size} bytes)`);
  selected.push({ target, source: match, file: spec.canonicalName, bytes: size });
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_HANDOFF_WRITE_ERROR=${error}`);
  process.exit(1);
}

fs.rmSync(handoffRoot, { recursive: true, force: true });
fs.mkdirSync(handoffRoot, { recursive: true });

const artifacts = [];
const shaLines = [];
for (const item of selected) {
  const dest = path.join(handoffRoot, item.file);
  fs.copyFileSync(item.source, dest);
  const data = fs.readFileSync(dest);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  shaLines.push(`${sha256}  ${item.file}`);
  artifacts.push({
    target: item.target,
    kind: item.target,
    file: item.file,
    bytes: data.length,
    sha256,
    sourceArtifact: path.relative(root, item.source).replaceAll('\\\\', '/'),
  });
}

const targetMode = artifacts.length === 3 ? 'all' : artifacts[0]?.target || 'unknown';
const manifest = {
  schemaVersion: 2,
  pass: 'PASS139',
  supersedesPass: 'PASS126',
  product: 'TAHAI Web Services Browser',
  version: pkg.version,
  targetMode,
  requestedTargets: targetList,
  builtAt: new Date().toISOString(),
  sourceRoot: process.env.TAHAI_LINUX_SOURCE_ROOT || root,
  nativeBuildDir: root,
  artifacts,
  downstreamConsumers: ['TAHAI OS/SENTINEL RPM handoff'],
};

fs.writeFileSync(path.join(handoffRoot, 'TAHAI-Linux-installers-SHA256SUMS.txt'), `${shaLines.join('\n')}\n`);
fs.writeFileSync(path.join(handoffRoot, 'TAHAI-Linux-installers-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  path.join(handoffRoot, 'TAHAI-Linux-installers-manifest.txt'),
  [
    'TAHAI Linux installer handoff',
    'pass=PASS139',
    'supersedesPass=PASS126',
    `product=TAHAI Web Services Browser`,
    `version=${pkg.version}`,
    `targetMode=${targetMode}`,
    `requestedTargets=${targetList.join(',')}`,
    `builtAt=${manifest.builtAt}`,
    `sourceRoot=${manifest.sourceRoot}`,
    `nativeBuildDir=${manifest.nativeBuildDir}`,
    ...artifacts.map((item) => `artifact=${item.target}:${item.file}:${item.bytes}:${item.sha256}`),
    'sha256Sums=TAHAI-Linux-installers-SHA256SUMS.txt',
    'jsonManifest=TAHAI-Linux-installers-manifest.json',
    'consumer=TAHAI OS/SENTINEL RPM handoff',
    '',
  ].join('\n'),
);

for (const item of artifacts) {
  console.log(`TAHAI_LINUX_HANDOFF_WRITTEN=${item.target}:${item.file}:${item.bytes}:${item.sha256}`);
}
console.log(`TAHAI_LINUX_HANDOFF_WRITE=OK dir=${handoffRoot} targetMode=${targetMode}`);
