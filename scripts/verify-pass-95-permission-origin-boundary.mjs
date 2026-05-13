#!/usr/bin/env node
import fs from 'node:fs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS95 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/permission-boundary.ts',[
  'PASS95_ORIGIN_AWARE_PERMISSION_BOUNDARY',
  'evaluateBrowserPermissionRequest',
  'isSecureBrowserPermissionOrigin',
  'browserPermissionBoundaryReason',
  "['camera', 'media']",
  "['microphone', 'media']",
  "['clipboard-read', 'clipboard-read']",
  'Unknown browser permission denied by PASS95 boundary.',
  'origin is not HTTPS or localhost',
  'settings.allowMedia === true',
  'settings.allowClipboardRead === true',
  'settings.allowGeolocation === true',
  'settings.allowNotifications === true'
]);
need(/parsed\.protocol === 'https:'/.test(boundary),'permission boundary must allow HTTPS origins');
need(/parsed\.protocol === 'http:' && localhost\(parsed\.hostname\)/.test(boundary),'permission boundary must allow only localhost HTTP');
need(!/parsed\.protocol === 'http:'\) return true/.test(boundary),'permission boundary must not broadly allow HTTP origins');
const runtime=includes('src/main/runtime-security.ts',[
  "import { evaluateBrowserPermissionRequest } from '../shared/permission-boundary'",
  'function permissionDetailValue(details: unknown, key: string): unknown',
  'function permissionRequestOrigin',
  "permissionDetailValue(details, 'requestingUrl')",
  "permissionDetailValue(details, 'requestingOrigin')",
  "permissionDetailValue(details, 'securityOrigin')",
  "permissionDetailValue(details, 'embeddingOrigin')",
  'return evaluateBrowserPermissionRequest(permission, origin, settings.permissions).ok',
  'ses.setPermissionRequestHandler((webContents, permission, callback, details) =>',
  'const origin = permissionRequestOrigin(webContents, details)',
  'callback(allowedPermission(permission, origin))',
  'ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) =>',
  'return allowedPermission(permission, origin)'
]);
need(!/const allowed = new Set<string>\(\)/.test(runtime),'runtime permission handling must not use global Set allowlist without origin context');
need(!/callback\(allowedPermission\(permission\)\)/.test(runtime),'permission request handler must not approve based on permission name only');
need(!/setPermissionCheckHandler\(\(_webContents, permission\) => allowedPermission\(permission\)\)/.test(runtime),'permission check handler must not approve based on permission name only');
includes('src/renderer/index.html',['data-pass95-permission-boundary="true"','Permission prompts remain locked down','HTTPS or localhost']);
includes('src/renderer/styles/browser.css',['PASS95 origin-aware permission boundary','.permission-boundary-note','Permission safety']);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-95-permission-origin-boundary']==='node scripts/verify-pass-95-permission-origin-boundary.mjs','package.json missing PASS95 verifier script');
need(pkg.scripts['verify:release-blockers']?.includes('verify:pass-95-permission-origin-boundary'),'release blockers missing PASS95 verifier');
console.log('PASS95 permission origin boundary verification passed.');
