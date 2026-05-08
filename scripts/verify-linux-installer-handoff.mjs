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
  if (!token) return null;
  if (token === 'appimage' || token === 'app-image') return 'AppImage';
  if (token === 'deb' || token === 'debian') return 'deb';
  if (token === 'rpm' || token === 'fedora') return 'rpm';
  errors.push(`unknown Linux handoff target: ${value}`);
  return null;
};

const requestedTargets = process.argv.slice(2).map(normalizeTarget).filter(Boolean);
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
  need(manifest.schemaVersion === 1, 'JSON manifest schemaVersion must be 1');
  need(manifest.pass === 'PASS126', 'JSON manifest pass marker must be PASS126');
  need(manifest.version === pkg.version, `JSON manifest version mismatch: ${manifest.version}`);
  need(Array.isArray(manifest.artifacts), 'JSON manifest artifacts must be an array');
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
      need(entry.bytes === size, `JSON manifest byte count mismatch for ${file}`);
      need(entry.sha256 === sha, `JSON manifest sha256 mismatch for ${file}`);
    }
  }

  console.log(`TAHAI_LINUX_HANDOFF_FOUND=${target}:${file}:${size}:${sha}`);
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_HANDOFF_ERROR=${error}`);
  process.exit(1);
}
console.log(`TAHAI_LINUX_HANDOFF=OK version=${pkg.version} targets=${targets.join(',')}`);
