import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd());
const releaseDir = path.join(appRoot, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const exePath = path.join(unpackedDir, 'TAHAI Web Services Browser.exe');
const zipPath = path.join(releaseDir, 'TAHAI-Web-Services-Browser-win-unpacked-test.zip');

function fail(message) {
  console.error(`TAHAI_BROWSER_WIN_PACKAGE=FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(unpackedDir)) fail(`missing ${unpackedDir}`);
if (!fs.existsSync(exePath)) fail(`missing ${exePath}`);
if (!fs.existsSync(zipPath)) fail(`missing ${zipPath}`);

const zipSize = fs.statSync(zipPath).size;
if (zipSize < 1024 * 1024) fail(`zip is unexpectedly small: ${zipSize} bytes`);

const requiredUnpackedFiles = [
  'resources/app/package.json',
  'resources/app/dist/main/main.js',
  'resources/app/dist/renderer/index.html',
  'resources/browser/new-tab/index.html',
  'chrome_100_percent.pak',
  'icudtl.dat',
  'd3dcompiler_47.dll'
];

for (const rel of requiredUnpackedFiles) {
  const full = path.join(unpackedDir, rel);
  if (!fs.existsSync(full)) fail(`missing unpacked runtime file: ${rel}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(unpackedDir, 'resources/app/package.json'), 'utf8'));
if (pkg.productName !== 'TAHAI Web Services Browser') fail('packaged productName mismatch');
if (pkg.main !== 'dist/main/main.js') fail('packaged main entry mismatch');

console.log(`TAHAI_BROWSER_WIN_PACKAGE=OK zip=${zipPath} bytes=${zipSize}`);
