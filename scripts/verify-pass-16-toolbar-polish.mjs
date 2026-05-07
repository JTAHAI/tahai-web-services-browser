import { readFileSync } from 'node:fs';

function fail(message) {
  console.error(`Pass 16 toolbar polish verifier failed: ${message}`);
  process.exit(1);
}

const app = readFileSync('src/renderer/app.ts', 'utf8');
const css = readFileSync('src/renderer/styles/responsive-toolbar.css', 'utf8');

if (!app.includes('COMMAND_TOOLBAR_LAST_LANE_KEY')) fail('missing-last-lane-persistence');
if (!app.includes('data-command-toolbar-scroll')) fail('missing-chevron-scroll-controls');
if (!app.includes('PageDown') || !app.includes('PageUp')) fail('missing-page-scroll-keyboard-support');
if (!app.includes('Home') || !app.includes('End')) fail('missing-home-end-keyboard-support');
if (!app.includes('openLastToolMenu')) fail('missing-last-lane-reopen-command');
if (!app.includes('Esc returns to Main Toolbar')) fail('missing-esc-return-copy');
if (!css.includes('PASS 16 Toolbar Polish')) fail('missing-toolbar-polish-css-marker');
if (!css.includes('.command-toolbar-chevron')) fail('missing-chevron-css');
if (!css.includes('overflow-y: hidden !important')) fail('vertical-overflow-not-preserved');
if (!css.includes('focus-visible')) fail('missing-keyboard-focus-affordance');

console.log('Pass 16 toolbar polish verifier OK');
