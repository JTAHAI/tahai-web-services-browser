import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

function fail(message) {
  console.error(`PASS53_RENDERER_ASSET_PREFLIGHT_FAIL=${message}`);
  process.exit(1);
}

if (!exists('src/main/main.ts')) fail('src/main/main.ts missing');
if (!exists('src/renderer/boot.ts')) fail('src/renderer/boot.ts missing');
if (!exists('scripts/copy-static.mjs')) fail('scripts/copy-static.mjs missing');

const main = read('src/main/main.ts');
for (const token of [
  'type RendererAssetPreflight',
  'function rendererAssetPreflight',
  "distPath('renderer', 'boot.js')",
  "distPath('renderer', 'app.js')",
  "distPath('renderer', 'styles', 'browser.css')",
  "path.join(__dirname, '..', 'preload', 'preload.js')",
  'renderer asset preflight failed; missing generated runtime files',
  'preload-error',
  "window.webContents.on('dom-ready'",
  'strict ready marker'
]) {
  if (!main.includes(token)) fail(`main runtime asset preflight missing token: ${token}`);
}

const html = read('src/renderer/index.html');
const bootIndex = html.indexOf('<script src="./boot.js"></script>');
const appIndex = html.indexOf('<script src="./app.js"></script>');
if (bootIndex < 0 || appIndex < 0 || bootIndex > appIndex) fail('renderer html must load boot.js before app.js');

const boot = read('src/renderer/boot.ts');
if (!boot.includes('app.js did not execute')) fail('boot watchdog must still report app.js execution failures');
if (!boot.includes('tahai-renderer-ready')) fail('boot watchdog must still listen for ready event');
if (/import\s+|require\(/.test(boot)) fail('boot watchdog must stay standalone with no import/require');

const copyStatic = read('scripts/copy-static.mjs');
if (!copyStatic.includes("'renderer/index.html'")) fail('copy-static must still copy renderer index');
if (!copyStatic.includes("'renderer/styles'")) fail('copy-static must still copy renderer styles');

const pkg = JSON.parse(read('package.json'));
function versionAtLeast(actual, minimum) {
  const a = actual.split('.').map((part) => Number.parseInt(part, 10));
  const b = minimum.split('.').map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}
if (!versionAtLeast(pkg.version, '1.8.27')) fail(`package version expected at least 1.8.27, found ${pkg.version}`);
if (pkg.scripts?.['verify:pass-53-renderer-asset-preflight'] !== 'node scripts/verify-pass-53-renderer-asset-preflight.mjs') fail('package verifier script missing');
if (!pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-53-renderer-asset-preflight')) fail('release blockers must include pass 53 verifier');

console.log('PASS53_RENDERER_ASSET_PREFLIGHT_OK=1');
process.exit(0);
