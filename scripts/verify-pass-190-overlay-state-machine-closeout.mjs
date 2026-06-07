#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS190][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }

const pkg = JSON.parse(read('package.json'));
const app = read('src/renderer/app.ts');
const contract = read('src/shared/overlay-state-machine-contract.ts');
const doc = read('docs/pass-190-overlay-state-machine-closeout.md');
const summary = read('PASS_190_OVERLAY_STATE_MACHINE_CLOSEOUT_SUMMARY.md');

need(pkg.version === '1.8.30', 'version-must-not-change-without-explicit-approval');
need(pkg.scripts?.['verify:pass-190-overlay-state-machine-closeout'] === 'node scripts/verify-pass-190-overlay-state-machine-closeout.mjs', 'package-script-missing');
need(getReleaseBlockersContract(pkg).includes('verify:pass-190-overlay-state-machine-closeout'), 'release-blockers-missing-pass190');
need(getReleaseBlockersContract(pkg).indexOf('verify:pass-190-overlay-state-machine-closeout') > getReleaseBlockersContract(pkg).indexOf('verify:pass-189-settings-screen-public-copy'), 'pass190-must-run-after-pass189');

for (const token of [
  'PASS190_OVERLAY_STATE_MACHINE_VERSION',
  'Pass190OverlayOwner',
  'Pass190OverlayTransitionState',
  'PASS190_OVERLAY_OWNERS',
  'exactly-one-active-owner',
  'owned-open-closes-rival-overlays',
  'escape-closes-active-owner',
  'overlay-viewport-audit-runs-after-owner-change'
]) need(contract.includes(token), `contract-missing-token: ${token}`);

for (const owner of [
  'more-tools',
  'command-toolbar',
  'ops-hub',
  'site-view',
  'mission-control',
  'settings',
  'command-palette',
  'profile-dialog',
  'shortcut-dialog'
]) {
  need(contract.includes(`'${owner}'`), `contract-owner-missing: ${owner}`);
  need(app.includes(`'${owner}'`), `app-owner-missing: ${owner}`);
}

for (const token of [
  'PASS190_OVERLAY_STATE_MACHINE_VERSION',
  'PASS190_OVERLAY_OWNERS',
  'pass190OverlayOwnerFrom',
  'pass190RecordOverlayTransition',
  'pass190CloseRivalOverlays',
  'pass190OpenOwnedOverlay',
  'document.body.dataset.pass190OverlayStateMachine',
  'document.body.dataset.pass190OverlayOwner',
  'document.body.dataset.pass190OverlayState',
  'document.body.dataset.pass190OverlayReason',
  "closeSettingsDialog(restoreFocus)",
  "closeCommandPaletteDialog(restoreFocus)",
  "closeProfileManager(restoreFocus)",
  "closeKeyboardShortcuts(restoreFocus)",
  "source !== 'settings'",
  "source !== 'command-palette'",
  "source !== 'profile-dialog'",
  "source !== 'shortcut-dialog'",
  "if (source === 'settings') return Boolean(settingsDialog && settingsDialog.open)",
  "if (source === 'command-palette') return Boolean(commandPaletteDialog && commandPaletteDialog.open)",
  "if (source === 'profile-dialog') return Boolean(profileDialog && profileDialog.open)",
  "if (source === 'shortcut-dialog') return Boolean(shortcutDialog && shortcutDialog.open)",
  "pass190CloseRivalOverlays('settings')",
  "pass190CloseRivalOverlays('command-palette')",
  "pass190CloseRivalOverlays('profile-dialog')",
  "pass190CloseRivalOverlays('shortcut-dialog')",
  "pass190CloseRivalOverlays('mission-control')",
  "pass190OpenOwnedOverlay('settings'",
  "pass190OpenOwnedOverlay('command-palette'",
  "pass190OpenOwnedOverlay('profile-dialog'",
  "pass190OpenOwnedOverlay('shortcut-dialog'",
  "const sources: Pass116ChromeOverlaySource[] = [...PASS190_OVERLAY_OWNERS]"
]) need(app.includes(token), `app-missing-token: ${token}`);

need(/function pass122KnownOverlayPanels\(\): Array<HTMLElement \| null> \{[\s\S]*settingsDialog[\s\S]*commandPaletteDialog[\s\S]*profileDialog[\s\S]*shortcutDialog/.test(app), 'known-overlay-panels-not-expanded');
need(/function pass116InstallChromeOverlayArbitration\(\): void \{[\s\S]*closeMissionControl\(false\)[\s\S]*closeSettingsDialog\(false\)[\s\S]*closeCommandPaletteDialog\(false\)[\s\S]*closeProfileManager\(false\)[\s\S]*closeKeyboardShortcuts\(false\)/.test(app), 'arbitration-does-not-close-rival-dialogs');
need(/document\.addEventListener\('keydown',[\s\S]*pass118AnnounceChromeOverlayClose\('escape', source, true\)/.test(app), 'escape-active-owner-close-missing');
need(doc.includes('single-owned state machine'), 'doc-purpose-missing');
need(summary.includes('PASS190'), 'summary-missing-pass190');

console.log('[PASS190][OK] Overlay state machine closeout verified.');
