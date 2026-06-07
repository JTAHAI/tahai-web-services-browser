import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/responsive-toolbar.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function fail(message) { console.error(`PASS14_COMMAND_TOOLBAR_VERIFY_FAIL=${message}`); process.exit(1); }
if (!app.includes('function commandToolbarLabel')) fail('missing-command-toolbar-label');
if (!app.includes('ensureToolMenuBackButton')) fail('missing-main-toolbar-return-button');
if (!app.includes('← Main Toolbar')) fail('missing-main-toolbar-button-copy');
if (!app.includes('Esc returns to Main Toolbar')) fail('missing-esc-status-copy');
if (!app.includes('document.body.dataset.commandToolbar')) fail('missing-command-toolbar-body-state');
if (!css.includes('overflow-y: hidden !important')) fail('missing-vertical-scrollbar-ban');
if (!css.includes('.tool-menu-back')) fail('missing-main-toolbar-button-style');
if (!css.includes('scrollbar-width: none')) fail('missing-hidden-native-scrollbar-style');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-14-command-toolbar')) fail('release-blockers-missing-pass14');
console.log('Pass 14 command toolbar verifier OK');
