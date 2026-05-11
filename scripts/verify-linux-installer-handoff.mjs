#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const handoffDir = path.join(root, 'release', 'linux');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

const normalizeTarget = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return [];
  if (token === 'all' || token === 'release' || token === 'linux') return ['AppImage', 'deb', 'rpm'];
  if (token === 'appimage' || token === 'app-image') return ['AppImage'];
  if (token === 'deb' || token === 'debian') return ['deb'];
  if (token === 'rpm' || token === 'fedora') return ['rpm'];
  errors.push(`unknown Linux handoff target: ${value}`);
  return [];
};

const requestedTargets = [];
for (const arg of process.argv.slice(2)) {
  for (const target of normalizeTarget(arg)) {
    if (!requestedTargets.includes(target)) requestedTargets.push(target);
  }
}
const targets = requestedTargets.length ? requestedTargets : ['AppImage', 'deb', 'rpm'];
const expectedByTarget = {
  AppImage: `TAHAI-Web-Services-Browser-${pkg.version}-x64.AppImage`,
  deb: `TAHAI-Web-Services-Browser-${pkg.version}-x64.deb`,
  rpm: `TAHAI-Web-Services-Browser-${pkg.version}-x64.rpm`,
};

need(fs.existsSync(handoffDir), `Linux handoff directory missing: ${path.relative(root, handoffDir)}`);
const shaFile = path.join(handoffDir, 'TAHAI-Linux-installers-SHA256SUMS.txt');
const jsonFile = path.join(handoffDir, 'TAHAI-Linux-installers-manifest.json');
const txtFile = path.join(handoffDir, 'TAHAI-Linux-installers-manifest.txt');
need(fs.existsSync(shaFile), 'SHA256SUMS handoff file missing');
need(fs.existsSync(jsonFile), 'JSON handoff manifest missing');
need(fs.existsSync(txtFile), 'text handoff manifest missing');

let shaEntries = new Map();
if (fs.existsSync(shaFile)) {
  const lines = fs.readFileSync(shaFile, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) {
      errors.push(`invalid checksum line: ${line}`);
      continue;
    }
    shaEntries.set(match[2], match[1]);
  }
}

let manifest = null;
if (fs.existsSync(jsonFile)) {
  try {
    manifest = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  } catch (error) {
    errors.push(`JSON handoff manifest cannot parse: ${error.message}`);
  }
}

if (manifest) {
  need(manifest.schemaVersion === 2, 'JSON manifest schemaVersion must be 2');
  need(manifest.pass === 'PASS139', 'JSON manifest pass marker must be PASS139');
  need(manifest.supersedesPass === 'PASS126', 'JSON manifest supersedesPass marker must be PASS126');
  need(manifest.version === pkg.version, `JSON manifest version mismatch: ${manifest.version}`);
  need(['all', 'AppImage', 'deb', 'rpm'].includes(manifest.targetMode), `JSON manifest targetMode invalid: ${manifest.targetMode}`);
  need(Array.isArray(manifest.requestedTargets), 'JSON manifest requestedTargets must be an array');
  need(Array.isArray(manifest.artifacts), 'JSON manifest artifacts must be an array');
}

const selectedFileNames = new Set(targets.map((target) => expectedByTarget[target]));
const packageFiles = fs.existsSync(handoffDir)
  ? fs.readdirSync(handoffDir).filter((name) => /\.(AppImage|deb|rpm)$/.test(name)).sort()
  : [];
for (const file of packageFiles) {
  need(selectedFileNames.has(file), `handoff contains stale or unrelated artifact for selected target set: ${file}`);
}

for (const target of targets) {
  const file = expectedByTarget[target];
  const abs = path.join(handoffDir, file);
  need(fs.existsSync(abs), `missing handoff artifact: ${file}`);
  if (!fs.existsSync(abs)) continue;

  const size = fs.statSync(abs).size;
  need(size >= 10 * 1024 * 1024, `handoff artifact suspiciously small: ${file} (${size} bytes)`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  need(shaEntries.get(file) === sha, `SHA256 mismatch or missing entry for ${file}`);

  if (manifest?.artifacts) {
    const entry = manifest.artifacts.find((item) => item.file === file);
    need(Boolean(entry), `JSON manifest missing artifact entry: ${file}`);
    if (entry) {
      need(entry.target === target || entry.kind === target, `JSON manifest target mismatch for ${file}`);
      need(entry.bytes === size, `JSON manifest byte count mismatch for ${file}`);
      need(entry.sha256 === sha, `JSON manifest sha256 mismatch for ${file}`);
    }
  }

  console.log(`TAHAI_LINUX_HANDOFF_FOUND=${target}:${file}:${size}:${sha}`);
}

if (manifest?.artifacts) {
  need(manifest.artifacts.length === targets.length, `JSON manifest artifact count should match selected targets: ${manifest.artifacts.length} != ${targets.length}`);
}

if (fs.existsSync(txtFile)) {
  const txt = fs.readFileSync(txtFile, 'utf8');
  for (const token of [
    'pass=PASS139',
    'supersedesPass=PASS126',
    'sha256Sums=TAHAI-Linux-installers-SHA256SUMS.txt',
    'jsonManifest=TAHAI-Linux-installers-manifest.json',
  ]) need(txt.includes(token), `text handoff manifest missing ${token}`);
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_HANDOFF_ERROR=${error}`);
  process.exit(1);
}
console.log(`TAHAI_LINUX_HANDOFF=OK version=${pkg.version} targets=${targets.join(',')}`);
