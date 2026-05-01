import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function fail(message) {
  console.error(`PASS52_RENDERER_BOOT_WATCHDOG_FAIL=${message}`);
  process.exit(1);
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

if (!exists('src/renderer/boot.ts')) fail('src/renderer/boot.ts missing');
const boot = read('src/renderer/boot.ts');
for (const token of [
  'tahaiBootPreflight',
  'tahai-renderer-app-script',
  'tahai-renderer-ready',
  'app.js did not execute',
  'Renderer script error',
  'Renderer promise rejection'
]) {
  if (!boot.includes(token)) fail(`boot preflight missing token: ${token}`);
}
if (/import\s+|require\(/.test(boot)) fail('boot preflight must stay standalone with no imports or requires');

const html = read('src/renderer/index.html');
const bootIndex = html.indexOf('<script src="./boot.js"></script>');
const appIndex = html.indexOf('<script src="./app.js"></script>');
if (bootIndex < 0 || appIndex < 0 || bootIndex > appIndex) fail('boot.js must load before app.js');

const app = read('src/renderer/app.ts');
for (const token of [
  "window.dispatchEvent(new CustomEvent('tahai-renderer-app-script'))",
  "window.dispatchEvent(new CustomEvent('tahai-renderer-ready'))",
  "document.documentElement.dataset.tahaiShellReady = '1'"
]) {
  if (!app.includes(token)) fail(`renderer app missing lifecycle marker: ${token}`);
}

const main = read('src/main/main.ts');
if (!main.includes("document.documentElement.dataset.tahaiShellReady === '1'")) fail('main heartbeat must require strict shell ready marker');
if (main.includes("Boolean(document.querySelector('.app-shell'))")) fail('main heartbeat must not accept static app shell HTML as ready');
if (!main.includes('strict ready marker')) fail('main fallback diagnostic should name strict ready marker');

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
if (!pkg.scripts?.['verify:pass-52-renderer-boot-watchdog']) fail('package verifier script missing');

console.log('PASS52_RENDERER_BOOT_WATCHDOG_OK=1');

process.exit(0);
