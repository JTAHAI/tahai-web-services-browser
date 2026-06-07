#!/usr/bin/env node
/* PASS271-R1 — fail-closed TypeScript/build blocker verifier */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pass = 'PASS271_R1';
const staticOnly = process.argv.includes('--static-only');
const rendererPath = path.join(root, 'src', 'renderer', 'app.ts');
const packagePath = path.join(root, 'package.json');
const applyPath = path.join(root, 'scripts', 'apply-pass271-r1-typescript-build-blocker-closeout.mjs');
const verifyPath = path.join(root, 'scripts', 'verify-pass271-r1-typescript-build-blocker-closeout.mjs');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function fail(message) {
  console.error(`${pass}=FAIL`);
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function runNpmScript(scriptName) {
  if (process.platform === 'win32') {
    return runProcess('cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`]);
  }
  return runProcess('npm', ['run', scriptName]);
}

function checkScriptSyntax(file) {
  if (!fs.existsSync(file)) fail(`Missing script: ${path.relative(root, file)}`);
  const code = runProcess(process.execPath, ['--check', file]);
  assert(code === 0, `Syntax check failed: ${path.relative(root, file)}`);
}

assert(fs.existsSync(rendererPath), 'Missing src/renderer/app.ts');
assert(fs.existsSync(packagePath), 'Missing package.json');

const renderer = readText(rendererPath);
const pkg = JSON.parse(readText(packagePath));
const scripts = pkg.scripts || {};

const checks = [
  ['no-stale-config-docsUrl', !renderer.includes('config?.docsUrl')],
  ['no-stale-MissionTab-type', !/\bMissionTab\b/.test(renderer)],
  ['no-invalid-updated-timeline-kind', !renderer.includes("appendMissionTimelineEvent(currentMission, 'updated',")],
  ['pass256-mount-normalized', !renderer.includes("pass256ScheduleTransition(currentMission?.layout?.type || 'single', 'mount');") && renderer.includes("pass256ScheduleTransition(pass256NormalizeLayoutRequest(currentMission?.layout?.type || 'single'), 'mount');")],
  ['pass258-url-typed', renderer.includes('function pass258ParseUrl(url: unknown): URL | null')],
  ['pass258-window-hook-cast', renderer.includes('__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__?: Pass258RuntimeReport') && !renderer.includes('window.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__ =')],
  ['pass259-escape-typed', renderer.includes('function pass259Escape(value: unknown): string')],
  ['pass259-window-hook-cast', renderer.includes('__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__?: Pass259MissionControlUxReport') && !renderer.includes('window.__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__ =')],
  ['package-verify-script-present', scripts['verify:pass-271-r1-typescript-build-blocker-closeout'] === 'node scripts/verify-pass271-r1-typescript-build-blocker-closeout.mjs']
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
assert(!failed.length, `Static PASS271-R1 checks failed: ${failed.join(', ')}`);

checkScriptSyntax(applyPath);
checkScriptSyntax(verifyPath);

if (!staticOnly) {
  assert(Boolean(scripts.build), 'package.json has no build script to prove TypeScript compile closure');
  const buildCode = runNpmScript('build');
  assert(buildCode === 0, '`npm run build` failed after PASS271-R1 repair');
}

console.log(`${pass}=PASS`);
console.log(`${pass}_STATIC_CHECKS=${checks.length}`);
console.log(`${pass}_BUILD=${staticOnly ? 'SKIPPED_STATIC_ONLY' : 'PASS'}`);
console.log(`${pass}_VERSION=2.0.14`);
