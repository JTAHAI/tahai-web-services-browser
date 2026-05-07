import { readFileSync } from 'node:fs';

function fail(message) {
  console.error(`Pass 15 command toolbar RC repair verifier failed: ${message}`);
  process.exit(1);
}

const css = readFileSync('src/renderer/styles/responsive-toolbar.css', 'utf8');
const app = readFileSync('src/renderer/app.ts', 'utf8');

if (!css.includes('PASS 15 Command Toolbar RC repair')) fail('missing-pass-15-css-marker');
if (!css.includes('position: fixed !important')) fail('tool-menu-panel-not-fixed');
if (!css.includes('overflow: visible !important')) fail('toolbar-not-kept-visible');
if (!css.includes('overflow-y: hidden !important')) fail('vertical-overflow-not-hidden');
if (!css.includes('max-height: 94px')) fail('command-rail-height-not-bounded');
if (!app.includes('← Main Toolbar')) fail('missing-main-toolbar-return-button');
if (!app.includes('Esc returns to Main Toolbar')) fail('missing-esc-return-copy');

console.log('Pass 15 command toolbar RC repair verifier OK');
