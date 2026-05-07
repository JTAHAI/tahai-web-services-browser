import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildScript = packageJson.scripts?.build || '';
const bundlerPath = path.join(root, 'scripts', 'bundle-renderer-cjs.mjs');
const mainPath = path.join(root, 'src', 'main', 'main.ts');
const appPath = path.join(root, 'src', 'renderer', 'app.ts');

function fail(message) {
  console.error(`PASS51_RENDERER_BOOT_BUNDLE_FAIL=${message}`);
  process.exit(1);
}

if (!buildScript.includes('node scripts/bundle-renderer-cjs.mjs')) fail('build script must run renderer CJS bundler after tsc');
if (!fs.existsSync(bundlerPath)) fail('renderer CJS bundler is missing');
const bundler = fs.readFileSync(bundlerPath, 'utf8');
for (const needle of ['nodeIntegration=false', 'BUNDLED_RENDERER_APP=1', 'Renderer bundle refused non-local require', 'renderer/app']) {
  if (!bundler.includes(needle)) fail(`bundler missing guard marker: ${needle}`);
}
const main = fs.readFileSync(mainPath, 'utf8');
if (!/nodeIntegration:\s*false/.test(main)) fail('main process must keep nodeIntegration false');
if (!/contextIsolation:\s*true/.test(main)) fail('main process must keep contextIsolation true');
const app = fs.readFileSync(appPath, 'utf8');
if (!app.includes('markRendererShellReady();')) fail('renderer shell ready marker missing');
if (!app.includes("from './mission-model'")) fail('renderer still needs bundled local mission-model import');
console.log('PASS51_RENDERER_BOOT_BUNDLE_OK=1');

process.exit(0);
