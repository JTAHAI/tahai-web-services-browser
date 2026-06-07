#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const app = read('src/renderer/app.ts');
const lifecycle = read('src/renderer/renderer-shell-lifecycle.ts');
const contract = read('src/shared/renderer-modularization-contract.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS161, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-161-renderer-modularization'] === 'node scripts/verify-pass-161-renderer-modularization.mjs', 'package missing PASS161 verifier script');

const pass160Idx = blockers.indexOf('verify:pass-160-enterprise-support-bundle');
const pass161Idx = blockers.indexOf('verify:pass-161-renderer-modularization');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass160Idx >= 0, 'release blockers missing PASS160');
need(pass161Idx > pass160Idx, 'PASS161 must run after PASS160');
need(finalBuildIdx > pass161Idx, 'PASS161 must run before final build');
need(blockers.includes('verify:pass-152-enterprise-evidence-binder'), 'release blockers must preserve PASS152 no-false-GA gate');

for (const file of [
  'src/renderer/renderer-shell-lifecycle.ts',
  'src/shared/renderer-modularization-contract.ts',
  'scripts/verify-pass-161-renderer-modularization.mjs',
  'docs/renderer-modularization-pass161.md',
  'PASS_161_RENDERER_MODULARIZATION_SUMMARY.md'
]) need(exists(file), `missing PASS161 file: ${file}`);

includesAll('src/shared/renderer-modularization-contract.ts', [
  'RENDERER_MODULARIZATION_PASS',
  'PASS161',
  'RENDERER_MODULARIZATION_CONTRACT_ID',
  'enterprise-renderer-modularization-v1',
  'RENDERER_MODULARIZATION_SCHEMA_VERSION = 1',
  'RendererModuleBoundary',
  'PASS161_RENDERER_MODULE_BOUNDARIES',
  'renderer-shell-lifecycle',
  'src/renderer/renderer-shell-lifecycle.ts',
  'mission-model',
  'responsive-toolbar',
  'site-view-mission-rail',
  'rendererModularizationSummary'
]);

includesAll('src/renderer/renderer-shell-lifecycle.ts', [
  'PASS161_RENDERER_LIFECYCLE_MODULE',
  'renderer-shell-lifecycle-pass161',
  'showBootDiagnostic',
  'markRendererShellReady',
  'fallbackBrowserConfig',
  'loadBrowserConfigWithRuntimeFallback',
  'pass161RendererLifecycleModule',
  'RUNTIME_E2E_HARNESS_CONTRACT_ID',
  'Preload/config bridge timed out',
  'Filesystem paths hidden.',
  'TAHAI Web Services Browser',
  'enterpriseSupportBundlePass'
]);

includesAll('src/renderer/app.ts', [
  "from './renderer-shell-lifecycle'",
  'loadBrowserConfigWithRuntimeFallback().then',
  'fallbackBrowserConfig()',
  'showBootDiagnostic(`Preload/config bridge failed; using fallback config.',
  'markRendererShellReady();',
  'window.addEventListener(\'error\'',
  'window.addEventListener(\'unhandledrejection\''
]);

includesAll('docs/renderer-modularization-pass161.md', [
  'PASS161',
  'Renderer Modularization',
  'renderer-shell-lifecycle.ts',
  'boot diagnostic',
  'fallback browser configuration',
  'No direct PSA API calls',
  'npm run verify:pass-161-renderer-modularization'
]);

includesAll('PASS_161_RENDERER_MODULARIZATION_SUMMARY.md', [
  'PASS161',
  'Renderer Modularization',
  'verify:pass-161-renderer-modularization',
  'Remaining enterprise GA passes: 1'
]);

need(!/function\s+fallbackBrowserConfig\s*\(/.test(app), 'fallbackBrowserConfig must be extracted out of app.ts');
need(!/function\s+loadBrowserConfigWithRuntimeFallback\s*\(/.test(app), 'loadBrowserConfigWithRuntimeFallback must be extracted out of app.ts');
need(!/function\s+showBootDiagnostic\s*\(/.test(app), 'showBootDiagnostic must be extracted out of app.ts');
need(!/function\s+markRendererShellReady\s*\(/.test(app), 'markRendererShellReady must be extracted out of app.ts');
need(!/ipcRenderer|require\(|node:fs|from 'fs'|from 'node:fs'/.test(lifecycle), 'renderer lifecycle module must not import raw IPC or filesystem primitives');
need(!/fetch\([^)]*psa/i.test(app + lifecycle + contract), 'PASS161 must not add browser-side PSA fetches');
need(!/client_secret|refresh_token|access_token|BEGIN PRIVATE KEY|Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i.test(lifecycle + contract), 'PASS161 must not introduce secret-bearing material');

for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/sbom/tahai-browser-sbom.json',
  'artifacts/provenance/tahai-browser-release-provenance.json',
  'artifacts/support/TAHAI-enterprise-support-bundle.md'
]) need(!exists(generated), `generated output must not be committed: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS161][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS161][OK] Renderer Modularization verified.');
