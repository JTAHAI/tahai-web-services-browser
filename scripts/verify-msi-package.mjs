import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd());
const packageJsonPath = path.join(appRoot, 'package.json');
const handoffDir = path.join(appRoot, 'release', 'windows');
const manifestPath = path.join(handoffDir, 'TAHAI-Windows-installers-manifest.json');
const shaPath = path.join(handoffDir, 'TAHAI-Windows-installers-SHA256SUMS.txt');

function fail(message) {
  console.error(`TAHAI_BROWSER_MSI_PACKAGE=FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) fail(`missing ${packageJsonPath}`);
if (!fs.existsSync(manifestPath)) fail(`missing PASS138 Windows handoff manifest: ${manifestPath}`);
if (!fs.existsSync(shaPath)) fail(`missing PASS138 Windows checksum file: ${shaPath}`);

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`invalid PASS138 Windows handoff manifest JSON: ${error.message}`);
}

if (manifest.pass !== 'PASS138') fail(`expected PASS138 handoff manifest, found ${manifest.pass}`);
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} does not match package ${pkg.version}`);

const msiArtifact = (manifest.artifacts || []).find((artifact) => artifact.target === 'msi');
if (!msiArtifact) fail('PASS138 handoff manifest does not include target === \'msi\'');

const expectedName = `TAHAI-Web-Services-Browser-${pkg.version}-x64.msi`;
if (msiArtifact.file !== expectedName) fail(`MSI handoff file must be ${expectedName}, found ${msiArtifact.file}`);
if (!/^[a-f0-9]{64}$/i.test(String(msiArtifact.sha256 || ''))) fail('MSI artifact checksum is invalid');

const msiPath = path.join(handoffDir, msiArtifact.file);
if (!fs.existsSync(msiPath)) fail(`missing copied MSI handoff artifact: ${msiPath}`);

const msiSize = fs.statSync(msiPath).size;
if (msiSize < 10 * 1024 * 1024) fail(`msi is unexpectedly small: ${msiSize} bytes`);

const shaText = fs.readFileSync(shaPath, 'utf8');
if (!shaText.includes(`${msiArtifact.sha256}  ${msiArtifact.file}`)) fail('PASS138 SHA256SUMS missing MSI checksum line');

console.log(`TAHAI_BROWSER_MSI_PACKAGE=OK msi=${msiPath} bytes=${msiSize}`);
console.log(`TAHAI_BROWSER_MSI_SHA256=OK sha=${shaPath}`);
