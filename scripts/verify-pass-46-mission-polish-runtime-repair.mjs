import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/renderer/styles/mission-control.css',
  'src/renderer/index.html',
  'src/renderer/app.ts',
  'src/main/main.ts',
  'package.json'
];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`PASS46_MISSION_POLISH_RUNTIME_REPAIR_FAIL=${message}`);
  process.exit(1);
};

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}

const indexHtml = read('src/renderer/index.html');
const appTs = read('src/renderer/app.ts');
const mainTs = read('src/main/main.ts');
const css = read('src/renderer/styles/mission-control.css');
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

if (!versionAtLeast(pkg.version, '1.8.22')) fail('package version expected at least 1.8.22');
if (!indexHtml.includes('./styles/mission-control.css')) fail('mission-control.css is not loaded by renderer HTML');
if (!indexHtml.includes('mission-ops-strip')) fail('Mission guardrail strip missing');
if (!appTs.includes('loadBrowserConfigWithRuntimeFallback')) fail('renderer config bridge timeout/fallback missing');
if (!appTs.includes('markRendererShellReady();')) fail('early renderer readiness marker missing');
if (!mainTs.includes("Boolean(document.querySelector('.app-shell'))")) fail('main heartbeat still depends only on late tahaiShellReady marker');
if (!mainTs.includes('12000')) fail('renderer heartbeat timeout was not widened to 12 seconds');
for (const token of ['grid-template-areas', 'mission-ops-strip', 'mission-export-section', 'Launch cockpit']) {
  if (!css.includes(token)) fail(`mission-control.css missing ${token}`);
}
if (/\.mission-export-section\s*\{\s*display:\s*none/i.test(css)) fail('new mission CSS hides export section');

console.log('PASS46_MISSION_POLISH_RUNTIME_REPAIR_OK=1');
