#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`[PASS167][FAIL] ${message}`);
  process.exitCode = 1;
};
const need = (condition, message) => { if (!condition) fail(message); };

const app = read('src/renderer/app.ts');
const responsive = read('src/renderer/responsive-toolbar.ts');
const siteView = read('src/renderer/site-view-mission-rail.ts');
const html = read('src/renderer/index.html');
const pkg = JSON.parse(read('package.json'));

need(pkg.scripts?.['verify:pass-167-overlay-source-safe-close'] === 'node scripts/verify-pass-167-overlay-source-safe-close.mjs', 'package.json missing PASS167 verifier script');
need(html.includes('data-pass167-overlay-source-safe-close="true"'), 'renderer HTML missing PASS167 body marker');
need(responsive.includes('PASS167 source-safe overlay close') && responsive.includes("document.body.dataset.pass167OverlaySourceSafeClose = 'true'"), 'responsive toolbar missing PASS167 source-safe marker');
need(siteView.includes("document.body.dataset.pass167OverlaySourceSafeClose = 'true'"), 'Site View rail missing PASS167 source-safe marker');
need(app.includes("document.body.dataset.pass167OverlaySourceSafeClose = 'true'"), 'app overlay guards missing PASS167 mounted marker');
need(app.includes('const activeSource = pass118ActiveChromeOverlaySource();'), 'PASS167 active overlay source snapshot missing');
need(app.includes('const shouldClearActiveOverlay = !source || !activeSource || source === activeSource;'), 'PASS167 source-match clear guard missing');
need(app.includes("document.body.dataset.pass167LastOverlayClearMode = shouldClearActiveOverlay ? 'active-source-cleared' : 'non-active-source-preserved';"), 'PASS167 clear-mode telemetry missing');
need(app.includes('if (shouldClearActiveOverlay) {\n    delete document.body.dataset.pass116ActiveOverlay;'), 'PASS167 must only delete active overlay inside source-safe guard');
need(!app.includes('if (source) document.body.dataset.pass118LastDismissedOverlay = source;\n  delete document.body.dataset.pass116ActiveOverlay;'), 'stale unconditional active-overlay delete still present');
need(app.includes('for (const source of openSources) if (source !== keep) pass118AnnounceChromeOverlayClose'), 'cycle guard must still close non-kept overlays');
need(app.includes("pass116MarkActiveChromeOverlay(keep, 'cycle-keep')") || app.includes('document.body.dataset.pass116ActiveOverlay = keep;'), 'cycle guard must restore kept active overlay after collapsing multiple overlays');

if (process.exitCode) process.exit(process.exitCode);
console.log('[PASS167][OK] Overlay source-safe close guard verified.');
