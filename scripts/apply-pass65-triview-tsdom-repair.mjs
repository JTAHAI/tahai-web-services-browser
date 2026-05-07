#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRel = 'src/renderer/app.ts';
const pkgRel = 'package.json';
const pass64ApplyRel = 'scripts/apply-pass64-triview-repair-hardening.mjs';
const verifyRel = 'scripts/verify-pass-65-triview-tsdom-repair.mjs';
const marker = 'PASS 65 Tri-view DOM typing repair';

function fail(message) {
  console.error(`PASS65_APPLY_FAIL=${message}`);
  process.exit(1);
}

function full(relPath) {
  return path.join(root, relPath);
}

function exists(relPath) {
  return fs.existsSync(full(relPath));
}

function read(relPath) {
  const filePath = full(relPath);
  if (!fs.existsSync(filePath)) fail(`missing ${relPath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function write(relPath, text) {
  fs.writeFileSync(full(relPath), text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}

function writeIfChanged(relPath, next) {
  const before = exists(relPath) ? read(relPath) : '';
  if (before !== next) write(relPath, next);
  return before !== next;
}

function repairDomHandleTyping(source) {
  let next = source;

  // PASS65: the PASS64 drag-handle code creates a <button>, but one local build typed the
  // existing query as HTMLElement. HTMLElement has no `.type` property in TS DOM libs.
  // Keep the code safe for every local TS version by using setAttribute and narrowing the query.
  next = next.replace(
    /querySelector<HTMLElement>\((['"]):scope > \.mission-pane-drag-handle\1\)/g,
    'querySelector<HTMLButtonElement>($1:scope > .mission-pane-drag-handle$1)',
  );
  next = next.replace(
    /\bhandle\.type\s*=\s*(['"])button\1\s*;/g,
    "handle.setAttribute('type', 'button');",
  );

  return next;
}

let app = repairDomHandleTyping(read(appRel));
if (!app.includes(marker)) {
  app = app.replace(
    /\/\/ PASS 64 Tri-view repair and pane drag hardening: self-contained repair for PASS63 anchor drift, event-type drift, and handle-only pane drag reorder\./,
    `// PASS 64 Tri-view repair and pane drag hardening: self-contained repair for PASS63 anchor drift, event-type drift, and handle-only pane drag reorder.\n// ${marker}: button drag handles use TS-safe setAttribute/type narrowing so npm run build passes under strict DOM typings.`,
  );
  if (!app.includes(marker)) {
    app += `\n// ${marker}: button drag handles use TS-safe setAttribute/type narrowing.\n`;
  }
}
write(appRel, app);

// Patch the PASS64 apply script too, so re-running PASS64 cannot reintroduce the local TS error.
if (exists(pass64ApplyRel)) {
  let pass64 = repairDomHandleTyping(read(pass64ApplyRel));
  if (!pass64.includes(marker)) {
    pass64 = pass64.replace(
      /const pass64Marker = 'PASS 64 Tri-view repair and pane drag hardening';/,
      `const pass64Marker = 'PASS 64 Tri-view repair and pane drag hardening';\nconst pass65Marker = '${marker}';`,
    );
    pass64 = pass64.replace(
      /\/\/ \$\{pass64Marker\}: self-contained repair for PASS63 anchor drift, event-type drift, and handle-only pane drag reorder\./,
      `// \${pass64Marker}: self-contained repair for PASS63 anchor drift, event-type drift, and handle-only pane drag reorder.\n// \${pass65Marker}: button drag handles use TS-safe setAttribute/type narrowing.`,
    );
  }
  write(pass64ApplyRel, pass64);
}

// Make the verifier available through npm after this first node-based apply.
if (exists(pkgRel)) {
  const pkg = JSON.parse(read(pkgRel));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['pass65:apply'] = `node scripts/apply-pass65-triview-tsdom-repair.mjs`;
  pkg.scripts['verify:pass-65-triview-tsdom-repair'] = `node ${verifyRel}`;

  const blockers = String(pkg.scripts['verify:release-blockers'] || '');
  if (blockers && !blockers.includes('verify:pass-65-triview-tsdom-repair')) {
    const commands = blockers.split(/\s&&\s/).map((item) => item.trim()).filter(Boolean);
    const verifyCommand = 'npm run verify:pass-65-triview-tsdom-repair';
    if (!commands.includes(verifyCommand)) {
      const buildIndex = commands.findIndex((command) => /(^|\s)npm run build($|\s)/.test(command));
      if (buildIndex >= 0) commands.splice(buildIndex, 0, verifyCommand);
      else commands.push(verifyCommand);
    }
    pkg.scripts['verify:release-blockers'] = commands.join(' && ');
  }
  write(pkgRel, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log('PASS65_APPLY_OK=Tri View drag-handle DOM typing repaired and PASS64 reapply guard patched');
