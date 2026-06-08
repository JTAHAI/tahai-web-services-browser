import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd());
const releaseDir = path.join(appRoot, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const exePath = path.join(unpackedDir, 'TAHAI Web Services Browser.exe');
const rootPkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const zipPath = path.join(releaseDir, `TAHAI-Web-Services-Browser-${rootPkg.version}-win-unpacked-test.zip`);
const handoffDir = path.join(releaseDir, 'windows');
const handoffManifestPath = path.join(handoffDir, 'TAHAI-Windows-installers-manifest.json');
const handoffShaPath = path.join(handoffDir, 'TAHAI-Windows-installers-SHA256SUMS.txt');

function fail(message) {
  console.error(`TAHAI_BROWSER_WIN_PACKAGE=FAILED: ${message}`);
  process.exit(1);
}

function requireFile(file, label = file) {
  if (!fs.existsSync(file)) fail(`missing ${label}`);
  return fs.statSync(file);
}

if (!fs.existsSync(unpackedDir)) fail(`missing ${unpackedDir}`);
requireFile(exePath);

const requiredRuntimeFiles = [
  'resources/browser/new-tab/index.html',
  'resources/browser/about/index.html',
  'chrome_100_percent.pak',
  'icudtl.dat',
  'd3dcompiler_47.dll',
];

for (const rel of requiredRuntimeFiles) {
  requireFile(path.join(unpackedDir, rel), `runtime file: ${rel}`);
}

const unpackedPackagePath = path.join(unpackedDir, 'resources', 'app', 'package.json');
const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
let runtimeLayout = 'unknown';

if (fs.existsSync(unpackedPackagePath)) {
  runtimeLayout = 'unpacked-app';
  const pkg = JSON.parse(fs.readFileSync(unpackedPackagePath, 'utf8'));
  if (pkg.productName !== 'TAHAI Web Services Browser') fail('packaged productName mismatch');
  if (pkg.main !== 'dist/main/main.js') fail('packaged main entry mismatch');
  if (pkg.version !== rootPkg.version) fail(`packaged version ${pkg.version} does not match root package ${rootPkg.version}`);
  requireFile(path.join(unpackedDir, 'resources/app/dist/main/main.js'), 'unpacked main process entry');
  requireFile(path.join(unpackedDir, 'resources/app/dist/renderer/index.html'), 'unpacked renderer entry');
} else if (fs.existsSync(asarPath)) {
  runtimeLayout = 'asar';
  const asarSize = fs.statSync(asarPath).size;
  if (asarSize < 1024 * 1024) fail(`app.asar is unexpectedly small: ${asarSize} bytes`);
} else {
  fail('missing Electron runtime payload: expected resources/app/package.json or resources/app.asar');
}

let handoffTargets = [];
if (fs.existsSync(handoffManifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(handoffManifestPath, 'utf8'));
  const shaText = fs.existsSync(handoffShaPath) ? fs.readFileSync(handoffShaPath, 'utf8') : '';
  if (manifest.pass !== 'PASS138') fail(`Windows handoff manifest pass must be PASS138, found ${manifest.pass}`);
  if (manifest.version !== rootPkg.version) fail(`Windows handoff manifest version ${manifest.version} does not match package ${rootPkg.version}`);
  if (!Array.isArray(manifest.artifacts)) fail('Windows handoff manifest artifacts must be an array');
  handoffTargets = manifest.artifacts.map((artifact) => artifact.target).filter(Boolean);

  for (const target of ['nsis', 'msi']) {
    const ext = target === 'msi' ? 'msi' : 'exe';
    const expectedFile = `TAHAI-Web-Services-Browser-${rootPkg.version}-x64.${ext}`;
    const artifact = manifest.artifacts.find((item) => item.target === target);
    if (!artifact) fail(`Windows handoff manifest missing ${target} artifact`);
    if (artifact.file !== expectedFile) fail(`Windows ${target} file must be ${expectedFile}, found ${artifact.file}`);
    if (!/^[a-f0-9]{64}$/i.test(String(artifact.sha256 || ''))) fail(`Windows ${target} checksum is invalid`);
    const artifactPath = path.join(handoffDir, expectedFile);
    const artifactSize = requireFile(artifactPath, `Windows ${target} handoff artifact`);
    if (artifactSize.size < 10 * 1024 * 1024) fail(`Windows ${target} handoff artifact is suspiciously small: ${expectedFile}`);
    if (!shaText.includes(`${artifact.sha256}  ${expectedFile}`)) fail(`SHA256SUMS missing Windows ${target} checksum line`);
  }
} else if (fs.existsSync(zipPath)) {
  const zipSize = fs.statSync(zipPath).size;
  if (zipSize < 1024 * 1024) fail(`zip is unexpectedly small: ${zipSize} bytes`);
  handoffTargets = ['win-unpacked-test-zip'];
} else {
  fail('missing Windows handoff manifest or unpacked test zip');
}

console.log(`TAHAI_BROWSER_WIN_PACKAGE=OK layout=${runtimeLayout} handoff=${handoffTargets.join(',')} version=${rootPkg.version}`);
