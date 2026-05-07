import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const errors = [];
const need = (ok, label) => { if (!ok) errors.push(label); };

need(pkg.scripts?.['verify:pass-77-mission-view-command-dock'] === 'node scripts/verify-pass-77-mission-view-command-dock.mjs', 'package-script-missing');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-77-mission-view-command-dock'), 'release-blockers-not-wired');
need(app.includes('pass77-mission-pane-command-dock'), 'command-dock-class-missing');
need(app.includes('pass77RefreshMissionPaneCommandDock'), 'command-dock-renderer-missing');
need(app.includes('data-pass77-swap'), 'dock-swap-controls-missing');
need(app.includes('data-pass77-rotate'), 'dock-rotate-controls-missing');
need(app.includes('data-pass77-repaint'), 'dock-repaint-control-missing');
need(app.includes('pass77RotateMissionPanes'), 'dock-rotate-function-missing');
need(app.includes('pass77ForceMissionPaneViewportFit'), 'viewport-fit-function-missing');
need(app.includes("webview.setAttribute('autosize', 'off')"), 'autosize-off-fit-missing');
need(app.includes("webview.removeAttribute('minwidth')"), 'minwidth-fit-clear-missing');
need(app.includes("webview.removeAttribute('maxheight')"), 'maxheight-fit-clear-missing');
need(app.includes('pass77FitWebviewGuestViewport(guest, width, height)'), 'harden-surface-fit-hook-missing');
need(css.includes('.pass77-mission-pane-command-dock'), 'dock-css-missing');
need(css.includes('native webviews cannot swallow pane actions'), 'dock-css-intent-missing');
need(css.includes('pass76-mission-view-direct-controls > webview.browser-view'), 'webview-fit-css-missing');

if (errors.length) {
  console.error('PASS77_MISSION_VIEW_COMMAND_DOCK_FAIL=' + errors.join(','));
  process.exit(1);
}
console.log('PASS77_MISSION_VIEW_COMMAND_DOCK=OK');
