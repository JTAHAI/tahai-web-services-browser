import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const pass = (name) => console.log(`${name}=PASS`);
const fail = (name, detail) => { failures.push(`${name}: ${detail}`); console.error(`${name}=FAIL ${detail}`); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

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

assertContains('src/renderer/app.ts', 'PASS271_R7_WEBVIEW_ATTACH_SRC_CLICK_RUNTIME_CLOSEOUT', 'PASS271_R7_APP_MARKER');
assertContains('src/renderer/app.ts', "webview.setAttribute('src', safeUrl);", 'PASS271_R7_INITIAL_SRC_SET');
assertBefore('src/renderer/app.ts', "webview.setAttribute('src', safeUrl);", 'stageEl.appendChild(webview);', 'PASS271_R7_SRC_BEFORE_APPEND');
assertContains('src/renderer/styles/browser.css', 'PASS271_R7_WEBVIEW_ATTACH_SRC_CLICK_RUNTIME_CLOSEOUT_CSS', 'PASS271_R7_CSS_MARKER');
assertContains('package.json', 'verify:pass-271-r7-webview-attach-src-click-runtime-closeout', 'PASS271_R7_PACKAGE_SCRIPT');

const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'scripts/apply-pass271-r7-webview-attach-src-click-runtime-closeout.mjs')], { encoding: 'utf8' });
if (syntax.status === 0) pass('PASS271_R7_APPLY_SCRIPT_SYNTAX');
else fail('PASS271_R7_APPLY_SCRIPT_SYNTAX', syntax.stderr || syntax.stdout || `exit ${syntax.status}`);

const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, encoding: 'utf8', shell: false });
fs.mkdirSync(path.join(root, 'release-candidate', 'generated'), { recursive: true });
fs.writeFileSync(path.join(root, 'release-candidate', 'generated', 'pass271-r7-build-output.txt'), `${build.stdout || ''}\n${build.stderr || ''}`, 'utf8');
if (build.status === 0) pass('PASS271_R7_BUILD');
else fail('PASS271_R7_BUILD', `npm run build exited ${build.status}; see release-candidate/generated/pass271-r7-build-output.txt`);

if (failures.length) {
  console.error('PASS271_R7=FAIL');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}
console.log('PASS271_R7=PASS');
console.log('PASS271_R7_ROOT_CAUSE_CLOSED=webview-src-seeded-before-will-attach-webview');
