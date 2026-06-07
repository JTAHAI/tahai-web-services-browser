#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);
const normalizeManifestPath = (value) => String(value || '').replaceAll('\\', '/');

const normalizeTarget = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return [];
  if (token === 'all' || token === 'release' || token === 'windows' || token === 'win') return ['nsis', 'msi'];
  if (token === 'nsis' || token === 'exe' || token === 'installer') return ['nsis'];
  if (token === 'msi') return ['msi'];
  fail(`unknown Windows handoff target: ${value}`);
  return [];
};

const requested = process.argv.slice(2);
const targetList = [];
for (const value of requested.length ? requested : ['all']) {
  for (const target of normalizeTarget(value)) {
    if (!targetList.includes(target)) targetList.push(target);
  }
}
if (!targetList.length) fail('no Windows handoff targets selected');

const handoffRoot = path.join(root, 'release', 'windows');
const shaPath = path.join(handoffRoot, 'TAHAI-Windows-installers-SHA256SUMS.txt');
const jsonPath = path.join(handoffRoot, 'TAHAI-Windows-installers-manifest.json');
const txtPath = path.join(handoffRoot, 'TAHAI-Windows-installers-manifest.txt');

if (!fs.existsSync(handoffRoot)) fail('missing release/windows handoff directory');
if (!fs.existsSync(shaPath)) fail('missing Windows SHA256SUMS handoff file');
if (!fs.existsSync(jsonPath)) fail('missing Windows JSON handoff manifest');
if (!fs.existsSync(txtPath)) fail('missing Windows human-readable handoff manifest');

let manifest = null;
if (fs.existsSync(jsonPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (error) {
    fail(`Windows manifest JSON is invalid: ${error.message}`);
  }
}

if (manifest) {
  if (manifest.pass !== 'PASS138') fail(`manifest pass must be PASS138, found ${manifest.pass}`);
  if (manifest.product !== 'TAHAI Web Services Browser') fail(`manifest product mismatch: ${manifest.product}`);
  if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} does not match package ${pkg.version}`);
  if (!Array.isArray(manifest.artifacts)) fail('manifest artifacts must be an array');

  const byTarget = new Map((manifest.artifacts || []).map((item) => [item.target, item]));
  const shaText = fs.existsSync(shaPath) ? fs.readFileSync(shaPath, 'utf8') : '';
  const txtText = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
  for (const target of targetList) {
    const ext = target === 'msi' ? 'msi' : 'exe';
    const expectedFile = `TAHAI-Web-Services-Browser-${pkg.version}-x64.${ext}`;
    const artifact = byTarget.get(target);
    if (!artifact) {
      fail(`manifest missing Windows ${target} artifact`);
      continue;
    }
    if (artifact.file !== expectedFile) fail(`Windows ${target} file must be canonical ${expectedFile}, found ${artifact.file}`);
    const sourceArtifact = normalizeManifestPath(artifact.sourceArtifact);
    if (target === 'nsis' && sourceArtifact !== `release/${expectedFile}`) {
      fail(`Windows nsis sourceArtifact must be the top-level installer release/${expectedFile}, found ${artifact.sourceArtifact || 'missing'}`);
    }
    if (target === 'msi' && sourceArtifact !== `release/${expectedFile}`) {
      fail(`Windows msi sourceArtifact must be the top-level installer release/${expectedFile}, found ${artifact.sourceArtifact || 'missing'}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(String(artifact.sha256 || ''))) fail(`Windows ${target} sha256 is invalid`);
    const artifactPath = path.join(handoffRoot, expectedFile);
    if (!fs.existsSync(artifactPath)) fail(`missing copied Windows ${target} handoff artifact: ${expectedFile}`);
    else if (fs.statSync(artifactPath).size < 10 * 1024 * 1024) fail(`Windows ${target} handoff artifact is suspiciously small: ${expectedFile}`);
    if (!shaText.includes(`${artifact.sha256}  ${expectedFile}`)) fail(`SHA256SUMS missing Windows ${target} checksum line`);
    if (!txtText.includes(`artifact=${target}:${expectedFile}:`)) fail(`text manifest missing Windows ${target} artifact line`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`[WINDOWS_HANDOFF][FAIL] ${error}`);
  process.exit(1);
}

console.log(`[WINDOWS_HANDOFF][OK] Windows installer handoff verified for ${targetList.join(',')}.`);
