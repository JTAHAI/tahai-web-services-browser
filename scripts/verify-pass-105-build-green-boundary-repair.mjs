#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS105 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const runtime=includes('src/main/runtime-security.ts',[
  'function permissionDetailValue(details: unknown, key: string): unknown',
  'function permissionRequestOrigin(webContents: WebContents | null | undefined, details?: unknown): string',
  "permissionDetailValue(details, 'requestingUrl')",
  "permissionDetailValue(details, 'requestingOrigin')",
  "permissionDetailValue(details, 'securityOrigin')",
  "permissionDetailValue(details, 'embeddingOrigin')",
  "permissionDetailValue(details, 'origin')",
  "permissionDetailValue(details, 'url')",
  'ses.setPermissionRequestHandler((webContents, permission, callback, details) =>',
  'ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) =>',
  "details && typeof details === 'object' ? details : {}",
  'return evaluateBrowserPermissionRequest(permission, origin, settings.permissions).ok'
]);
need(!runtime.includes('details?: Record<string, unknown>'), 'Electron permission details must not be narrowed to Record<string, unknown>');
need(!runtime.includes('requestingOrigin?: string'), 'permission check handler must use Electron inferred requestingOrigin signature');
const app=includes('src/renderer/app.ts',[
  'function activeCaptureSourceUrl(value: unknown, fallback: unknown = \'\'): string',
  "const fallbackUrl = String(fallback || config?.homeUrl || '')",
  "sanitizeActiveCaptureUrl(value, fallbackUrl, 'operational-handoff')"
]);
need(!app.includes("sanitizeActiveCaptureUrl(value, fallback || config?.homeUrl || '', 'operational-handoff')"), 'activeCaptureSourceUrl fallback must be coerced to string before sanitizer call');
includes('PASS_105_BUILD_GREEN_BOUNDARY_REPAIR_SUMMARY.md',[
  'PASS105 — Build Green Boundary Repair',
  'Electron permission handler details keep Electron-inferred types',
  'activeCaptureSourceUrl now coerces fallback values to a string'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-105-build-green-boundary-repair']==='node scripts/verify-pass-105-build-green-boundary-repair.mjs','package.json missing PASS105 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-105-build-green-boundary-repair'),'release blockers missing PASS105 verifier');
console.log('PASS105 build green boundary repair verification passed.');
