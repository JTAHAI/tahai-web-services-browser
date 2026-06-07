import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function pass(name) { console.log(`${name}=PASS`); }
function fail(name, detail) { failures.push(`${name}: ${detail}`); console.error(`${name}=FAIL ${detail}`); }
function assertContains(rel, needle, name) {
  const text = read(rel);
  if (text.includes(needle)) pass(name);
  else fail(name, `${rel} missing ${needle}`);
}
function assertBefore(rel, before, after, name) {
  const text = read(rel);
  const i = text.indexOf(before);
  const j = text.indexOf(after);
  if (i >= 0 && j >= 0 && i < j) pass(name);
  else fail(name, `${before} must appear before ${after}`);
}

assertContains('src/renderer/app.ts', 'PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE', 'PASS271_R8_APP_MARKER');
assertContains('src/renderer/app.ts', "webview.setAttribute('src', safeUrl);", 'PASS271_R8_INITIAL_SRC_SET');
assertBefore('src/renderer/app.ts', "webview.setAttribute('src', safeUrl);", 'stageEl.appendChild(webview);', 'PASS271_R8_SRC_BEFORE_APPEND');
assertContains('src/renderer/app.ts', "webview.dataset.pass239InitialSrcDeferred = 'false';", 'PASS271_R8_DEFERRED_FLAG_FALSE');
assertContains('src/renderer/styles/browser.css', 'PASS271_R8_WEBVIEW_ATTACH_SRC_HARD_CLOSE_CSS', 'PASS271_R8_CSS_MARKER');
assertContains('src/main/main.ts', 'blocked webview attach:', 'PASS271_R8_MAIN_ATTACH_LOG_PRESENT');
assertContains('package.json', 'verify:pass-271-r8-r7-script-repair-webview-src-hard-close', 'PASS271_R8_PACKAGE_SCRIPT');
assertContains('scripts/apply-pass271-r7-webview-attach-src-click-runtime-closeout.mjs', 'PASS271_R7_SUPERSEDED_BY_PASS271_R8', 'PASS271_R8_R7_WRAPPER');

for (const script of [
  'scripts/apply-pass271-r8-r7-script-repair-webview-src-hard-close.mjs',
  'scripts/verify-pass271-r8-r7-script-repair-webview-src-hard-close.mjs',
  'scripts/apply-pass271-r7-webview-attach-src-click-runtime-closeout.mjs'
]) {
  const syntax = spawnSync(process.execPath, ['--check', path.join(root, script)], { encoding: 'utf8', shell: false });
  if (syntax.status === 0) pass(`PASS271_R8_SYNTAX_${path.basename(script).replace(/[^A-Za-z0-9]+/g, '_')}`);
  else fail(`PASS271_R8_SYNTAX_${script}`, syntax.stderr || syntax.stdout || `exit ${syntax.status}`);
}

const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, encoding: 'utf8', shell: false });
fs.mkdirSync(path.join(root, 'release-candidate', 'generated'), { recursive: true });
fs.writeFileSync(path.join(root, 'release-candidate', 'generated', 'pass271-r8-build-output.txt'), `${build.stdout || ''}\n${build.stderr || ''}`, 'utf8');
if (build.status === 0) pass('PASS271_R8_BUILD');
else fail('PASS271_R8_BUILD', `npm run build exited ${build.status}; see release-candidate/generated/pass271-r8-build-output.txt`);

if (failures.length) {
  console.error('PASS271_R8=FAIL');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}
console.log('PASS271_R8=PASS');
console.log('PASS271_R8_R7_SCRIPT_FAILURE_CLOSED=TRUE');
console.log('PASS271_R8_WEBVIEW_SRC_ATTACH_CLOSED=TRUE');
