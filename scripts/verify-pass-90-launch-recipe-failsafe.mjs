#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function need(condition, message) {
  if (!condition) {
    console.error(`FAIL PASS90: ${message}`);
    process.exit(1);
  }
}
function includes(rel, needle) {
  need(read(rel).includes(needle), `${rel} missing ${needle}`);
}
function count(source, needle) {
  return source.split(needle).length - 1;
}

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  'PASS90 Launch Recipe Failsafe',
  'type Pass90LaunchPlan',
  'pass90RecipeUrlCandidate',
  'pass90BuildRecipeLaunchPlan',
  'pass90MarkRecipeCards',
  'pass90ValidateCanonicalRecipes',
  'pass90EnsureCommandAndShortcutTruth',
  'pass90RunLaunchRecipeFailsafe',
  'pass90CopyLaunchRecipeFailsafeReport',
  'pass90BlockRecipeLaunch',
  'pass90ScheduleLaunchRecipeFailsafe',
  'pass90MountLaunchRecipeFailsafe',
  'document.body.dataset.pass90LastBlockedRecipe',
  'document.body.dataset.pass90SafeRecipeCount',
  'Ctrl+Alt+Shift+Y',
  'launch-recipe-failsafe',
  'copy-launch-recipe-failsafe-report'
]) includes('src/renderer/app.ts', token);

for (const token of [
  'const plan = pass90BuildRecipeLaunchPlan(recipe, \'tabs\');',
  'const plan = pass90BuildRecipeLaunchPlan(recipe, \'mission\');',
  'const launchPlan = pass90BuildRecipeLaunchPlan(recipe, \'tabs\');',
  'const launchPlan = pass90BuildRecipeLaunchPlan(recipe, \'mission\');',
  'for (const url of launchPlan.urls) createTab(url);',
  'launchPlan.urls.slice(0, 4).forEach',
  'const candidate = pass90RecipeUrlCandidate(url);',
  "pass90ScheduleLaunchRecipeFailsafe('bookmark-mission-started')",
  "pass90ScheduleLaunchRecipeFailsafe('bookmark-mission-blocked')",
  'data-pass90-recipe-launch',
  'data-pass90-safe-url-count',
  'aria-disabled="true" disabled'
]) includes('src/renderer/app.ts', token);

for (const command of [
  'mission-pane-restore-failsafe',
  'copy-mission-pane-restore-report',
  'launch-recipe-failsafe',
  'copy-launch-recipe-failsafe-report'
]) {
  const matches = (app.match(new RegExp(`id: '${command}'`, 'g')) || []).length;
  need(matches === 1, `command ${command} must exist exactly once in Command Center, found ${matches}`);
}

for (const shortcut of ['Ctrl+Alt+Shift+G', 'Ctrl+Alt+Shift+Y']) {
  need(app.includes(`shortcut: '${shortcut}'`) || app.includes(`'${shortcut}', 'Run`), `Command/shortcut table missing ${shortcut}`);
}

need(count(app, "window.tahaiBrowser.copyDevOpsCapture(pass90LastLaunchRecipeFailsafeReport)") === 1, 'PASS90 report copy must use existing safe clipboard bridge exactly once');
need(!/fetch\(['\"]https?:\/\/[^'\"]*(psa|connectwise|autotask|halo|syncro|zendesk|freshservice)/i.test(app), 'browser source must not add direct PSA/vendor API fetches');

for (const token of [
  'PASS90 launch recipe failsafe',
  'body.pass90-launch-recipe-warning #statusbar',
  'body.pass90-launch-recipe-ok #statusbar',
  '.mission-recipe-card[data-pass90-recipe-launch="safe-plan"]:focus-visible',
  '.mission-recipe-card[data-pass90-recipe-launch="blocked-plan"]',
  '.mission-recipe-card[data-pass90-safe-url-count="0"]'
]) need(css.includes(token), `CSS missing ${token}`);

const script = String(pkg.scripts?.['verify:pass-90-launch-recipe-failsafe'] || '');
need(script.includes('verify-pass-90-launch-recipe-failsafe.mjs'), 'package script missing PASS90 verifier');
need(getReleaseBlockersContract(pkg).includes('verify:pass-90-launch-recipe-failsafe'), 'verify:release-blockers missing PASS90 verifier');

console.log('PASS90 launch recipe failsafe verified');
