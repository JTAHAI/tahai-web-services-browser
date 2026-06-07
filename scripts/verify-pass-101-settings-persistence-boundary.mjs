#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS101 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const boundary=includes('src/shared/settings-boundary.ts',[
  'PASS101_SETTINGS_PERSISTENCE_BOUNDARY',
  'MAX_SETTINGS_FILE_BYTES = 64 * 1024',
  'MAX_SETTINGS_HOME_URL_CHARS = 2048',
  'MAX_SETTINGS_DIRECTORY_CHARS = 512',
  'CONTROL_AND_BIDI',
  'sanitizeSettingsHomeUrl',
  'evaluateBrowserNavigationUrl',
  "parsed.protocol === 'https:' || isLocalHttp(parsed)",
  'rendererSafeDownloadSettings',
  "defaultDirectory: ''",
  'shouldRejectSettingsFileSize'
]);
need(boundary.includes("const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);"),'settings boundary must limit HTTP home pages to localhost only');
const settings=includes('src/main/settings.ts',[
  "from '../shared/settings-boundary'",
  'sanitizeSettingsHomeUrl(raw.homeUrl, DEFAULT_BROWSER_SETTINGS.homeUrl)',
  'sanitizeSettingsDirectoryValue(rawDownloads.defaultDirectory)',
  'shouldRejectSettingsFileSize(stat.size)',
  'function persistBrowserSettings',
  'cleaned.downloads.defaultDirectory = current.downloads.defaultDirectory',
  'export function settingsForRenderer',
  'rendererSafeDownloadSettings(settings.downloads)'
]);
need(!/new URL\(value\.trim\(\)\)[\s\S]*parsed\.protocol === 'https:' \|\| parsed\.protocol === 'http:'/.test(settings),'settings must not use old broad HTTP URL sanitizer');
const main=includes('src/main/main.ts',[
  'settingsForRenderer',
  'const rendererSettings = settingsForRenderer(settings);',
  'settings: rendererSettings',
  "return settingsForRenderer(readBrowserSettings())",
  "return settingsForRenderer(writeBrowserSettings(next))",
  "return settingsForRenderer(resetBrowserSettings())"
]);
need(!/get-settings'.*return readBrowserSettings\(\)/.test(main),'get-settings must not return raw persisted settings');
need(!/update-settings'.*return writeBrowserSettings\(next\)/.test(main),'update-settings must not return raw persisted settings');
includes('src/renderer/index.html',[
  'data-pass101-settings-boundary="true"',
  'Home pages must be HTTPS or localhost HTTP',
  'the Settings screen never exposes local download paths'
]);
includes('src/renderer/styles/browser.css',[
  'PASS101 settings persistence boundary',
  'Settings safety',
  'data-pass101-settings-boundary="true"'
]);
includes('PASS_101_SETTINGS_PERSISTENCE_BOUNDARY_SUMMARY.md',[
  'PASS101 — Settings Persistence Boundary',
  'renderer-submitted settings cannot set local download paths',
  'HTTPS or localhost HTTP'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-101-settings-persistence-boundary']==='node scripts/verify-pass-101-settings-persistence-boundary.mjs','package.json missing PASS101 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-101-settings-persistence-boundary'),'release blockers missing PASS101 verifier');
console.log('PASS101 settings persistence boundary verification passed.');
