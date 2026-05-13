#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const bookmarks = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const rail = fs.readFileSync('src/renderer/site-view-mission-rail.ts', 'utf8');
const docs = fs.readFileSync('docs/pass240-peripheral-webview-lifecycle-closeout.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function fail(message) {
  console.error(`[PASS240][FAIL] ${message}`);
  process.exit(1);
}
function need(condition, message) { if (!condition) fail(message); }
function has(text, needle) { return text.includes(needle); }

need(has(app, "'isDevToolsOpened' | 'openDevTools' | 'closeDevTools'"), 'DevTools commands must be part of lifecycle command union');
need(has(app, "pass238CanInvokeWebviewCommand(tab.webview, 'openDevTools'"), 'DevTools open must be lifecycle-gated');
need(has(app, "pass238CanInvokeWebviewCommand(tab.webview, 'isDevToolsOpened'"), 'DevTools state must be lifecycle-gated');
need(has(app, "pass238CanInvokeWebviewCommand(tab.webview, 'closeDevTools'"), 'DevTools close must be lifecycle-gated');

need(has(bookmarks, 'function pass240IsWebviewApiReady'), 'bookmarks must define PASS240 readiness guard');
need(has(bookmarks, 'if (pass240IsWebviewApiReady(activeWebview))'), 'bookmark active URL/title API calls must be readiness-gated');
need(!has(bookmarks, 'const apiUrl = activeWebview?.getURL?.();'), 'bookmark raw getURL optional call remains');
need(!has(bookmarks, 'const apiTitle = activeWebview?.getTitle?.();'), 'bookmark raw getTitle optional call remains');

need(has(rail, 'function pass240IsWebviewApiReady'), 'site-view rail must define PASS240 readiness guard');
need(has(rail, 'if (pass240IsWebviewApiReady(webview)) {\n        const apiUrl'), 'site-view getURL must be readiness-gated');
need(has(rail, 'if (pass240IsWebviewApiReady(webview)) {\n        const apiTitle'), 'site-view getTitle must be readiness-gated');
need(has(rail, "pass240IsWebviewApiReady(snapshot.webview) && typeof snapshot.webview?.reload === 'function'"), 'site-view reload must be readiness-gated');
need(has(rail, 'if (!pass240IsWebviewApiReady(webview)) return;\n    if (railPrivacyMode'), 'site-view capture scheduling must be readiness-gated');
need(has(rail, 'if (!pass240IsWebviewApiReady(webview)) return;\n          const image = await webview.capturePage!();'), 'site-view delayed capture must recheck readiness');
need(!has(rail, 'snapshot.webview?.reload?.();'), 'site-view raw reload optional call remains');

need(has(docs, 'PASS240'), 'PASS240 docs missing');
need(pkg.scripts['verify:pass-240-peripheral-webview-lifecycle-closeout'] === 'node scripts/verify-pass-240-peripheral-webview-lifecycle-closeout.mjs', 'package verifier script missing');
need(pkg.scripts['verify:release-blockers'].includes('npm run verify:pass-240-peripheral-webview-lifecycle-closeout'), 'release blockers missing PASS240 verifier');

console.log('[PASS240][OK] Peripheral WebView lifecycle closeout verified.');
