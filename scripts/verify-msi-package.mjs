import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd());
const releaseDir = path.join(appRoot, 'release');
const packageJsonPath = path.join(appRoot, 'package.json');

function fail(message) {
  console.error(`TAHAI_BROWSER_MSI_PACKAGE=FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) fail(`missing ${packageJsonPath}`);
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const msiName = `TAHAI-Web-Services-Browser-Setup-${pkg.version}-x64.msi`;
const msiPath = path.join(releaseDir, msiName);
const shaPath = `${msiPath}.sha256.txt`;

if (!fs.existsSync(msiPath)) fail(`missing ${msiPath}`);
if (!fs.existsSync(shaPath)) fail(`missing ${shaPath}`);

const msiSize = fs.statSync(msiPath).size;
if (msiSize < 1024 * 1024) fail(`msi is unexpectedly small: ${msiSize} bytes`);

const shaText = fs.readFileSync(shaPath, 'utf8').trim();
if (!/^[a-f0-9]{64}\s+TAHAI-Web-Services-Browser-Setup-.*-x64\.msi$/i.test(shaText)) {
  fail('sha256 sidecar format is invalid');
}

console.log(`TAHAI_BROWSER_MSI_PACKAGE=OK msi=${msiPath} bytes=${msiSize}`);
console.log(`TAHAI_BROWSER_MSI_SHA256=OK sha=${shaPath}`);
