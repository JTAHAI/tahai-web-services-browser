#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  'src/renderer/app.ts',
  'scripts/apply-pass59-mission-pane-close-polish.mjs',
];

function fail(message) {
  console.error(`PASS62_APPLY_FAIL=${message}`);
  process.exit(1);
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) fail(`missing ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
}

function write(relPath, text) {
  fs.writeFileSync(path.join(root, relPath), text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}

let changedFiles = 0;
let replacements = 0;

for (const relPath of targets) {
  if (!fs.existsSync(path.join(root, relPath))) {
    if (relPath === 'src/renderer/app.ts') fail('src/renderer/app.ts is required for the TypeScript timeline event fix');
    continue;
  }
  const before = read(relPath);
  const after = before
    .replaceAll("'layout-set'", "'layout-set'")
    .replaceAll('"layout-set"', '"layout-set"');
  if (after !== before) {
    const singleCount = (before.match(/'layout-set'/g) || []).length;
    const doubleCount = (before.match(/"layout-set"/g) || []).length;
    replacements += singleCount + doubleCount;
    changedFiles += 1;
    write(relPath, after);
  }
}

const app = read('src/renderer/app.ts');
if (app.includes("'layout-set'") || app.includes('"layout-set"')) {
  fail('src/renderer/app.ts still contains layout-changed after patch');
}
if (!app.includes("'layout-set'") && !app.includes('"layout-set"')) {
  fail('src/renderer/app.ts does not contain layout-set after patch');
}
if (app.includes('PASS 59 Mission pane close polish') && !app.includes('refactorMissionLayoutAfterPaneClose')) {
  fail('PASS 59 pane close helper appears incomplete after PASS 62 patch');
}

console.log(`PASS62_APPLY_OK=layout event type repaired changedFiles=${changedFiles} replacements=${replacements}`);
