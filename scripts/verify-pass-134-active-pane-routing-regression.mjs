#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const appPath = path.join(root, 'src', 'renderer', 'app.ts');
const pkgPath = path.join(root, 'package.json');
const summaryPath = path.join(root, 'PASS_134_ACTIVE_PANE_ROUTING_REGRESSION_SUMMARY.md');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function requireIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) failures.push(`missing_${label}`);
}
function requireNotIncludes(haystack, needle, label) {
  if (haystack.includes(needle)) failures.push(`forbidden_${label}`);
}
function requireMatch(haystack, regex, label) {
  if (!regex.test(haystack)) failures.push(`missing_${label}`);
}

if (!fs.existsSync(appPath)) failures.push('missing_src_renderer_app_ts');
if (!fs.existsSync(summaryPath)) failures.push('missing_pass134_summary');

const app = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

requireIncludes(app, 'PASS134 brutal active-pane routing regression closeout', 'pass134_source_marker');
requireIncludes(app, 'type Pass134RouteIntent', 'pass134_route_intent_type');
requireIncludes(app, 'function activeNavigationTarget(intent: Pass134RouteIntent =', 'pass134_route_resolver');
requireIncludes(app, 'function pass134VisibleActivePane', 'pass134_visible_active_pane_repair');
requireIncludes(app, 'function navigate(url: string, intent: Pass134RouteIntent =', 'pass134_navigate_intent');
requireIncludes(app, 'function goBackTarget(intent: Pass134RouteIntent =', 'pass134_back_intent');
requireIncludes(app, 'function goForwardTarget(intent: Pass134RouteIntent =', 'pass134_forward_intent');
requireIncludes(app, 'function reloadTarget(intent: Pass134RouteIntent =', 'pass134_reload_intent');
requireIncludes(app, 'function printTarget(intent: Pass134RouteIntent =', 'pass134_print_target');
requireIncludes(app, 'function toggleTargetDevTools(intent: Pass134RouteIntent =', 'pass134_devtools_target');
requireIncludes(app, 'pass88RepairActivePane(`pass134-${reason}`)', 'pass134_repairs_before_routing');
requireIncludes(app, 'document.body.dataset.pass134LastRouteIntent', 'pass134_route_telemetry_intent');
requireIncludes(app, 'document.body.dataset.pass134LastRouteMode', 'pass134_route_telemetry_mode');
requireIncludes(app, 'document.body.dataset.pass134LastNoop', 'pass134_noop_telemetry');
requireIncludes(app, "navigate(addressInput.value, 'address')", 'address_submit_uses_intent');

requireIncludes(app, "backButton.addEventListener('click', () => goBackTarget('toolbar'))", 'toolbar_back_routes_active_target');
requireIncludes(app, "forwardButton.addEventListener('click', () => goForwardTarget('toolbar'))", 'toolbar_forward_routes_active_target');
requireIncludes(app, "reloadButton.addEventListener('click', () => reloadTarget('toolbar'))", 'toolbar_reload_routes_active_target');
requireIncludes(app, "homeButton.addEventListener('click', () => navigate(settings.homeUrl || config.homeUrl, 'home'))", 'toolbar_home_routes_active_target');
requireIncludes(app, "launchpadButton.addEventListener('click', () => navigate(config.newTabUrl, 'launchpad'))", 'toolbar_launchpad_routes_active_target');
requireIncludes(app, "onboardingButton.addEventListener('click', () => navigate(config.onboardingUrl, 'guide'))", 'toolbar_guide_routes_active_target');

requireIncludes(app, "if (command === 'back') goBackTarget('menu')", 'menu_back_routes_active_target');
requireIncludes(app, "if (command === 'forward') goForwardTarget('menu')", 'menu_forward_routes_active_target');
requireIncludes(app, "if (command === 'print') printTarget('print')", 'menu_print_routes_active_target');
requireIncludes(app, "if (command === 'reload') reloadTarget('reload')", 'menu_reload_routes_active_target');
requireIncludes(app, "if (command === 'home') navigate(settings.homeUrl || config.homeUrl, 'home')", 'menu_home_routes_active_target');
requireIncludes(app, "if (command === 'launchpad') navigate(config.newTabUrl, 'launchpad')", 'menu_launchpad_routes_active_target');
requireIncludes(app, "if (command === 'guide') navigate(config.onboardingUrl, 'guide')", 'menu_guide_routes_active_target');
requireIncludes(app, "if (command === 'about') navigate(config.aboutUrl, 'about')", 'menu_about_routes_active_target');

requireIncludes(app, "reloadTarget('shortcut')", 'shortcut_reload_routes_active_target');
requireIncludes(app, "goBackTarget('shortcut')", 'shortcut_back_routes_active_target');
requireIncludes(app, "goForwardTarget('shortcut')", 'shortcut_forward_routes_active_target');
requireIncludes(app, "goBackTarget('mouse')", 'mouse_back_routes_active_target');
requireIncludes(app, "goForwardTarget('mouse')", 'mouse_forward_routes_active_target');
requireIncludes(app, "toggleTargetDevTools('devtools')", 'devtools_routes_active_target');

requireNotIncludes(app, "active()?.webview.reload()", 'raw_active_reload');
requireNotIncludes(app, "active()?.webview.print()", 'raw_active_print');
requireNotIncludes(app, "backButton.addEventListener('click', goBackTarget)", 'raw_back_listener');
requireNotIncludes(app, "forwardButton.addEventListener('click', goForwardTarget)", 'raw_forward_listener');
requireNotIncludes(app, "reloadButton.addEventListener('click', reloadTarget)", 'raw_reload_listener');

requireMatch(app, /const pass88RequiredCommandIds = \[[\s\S]*'active-pane-routing-failsafe'[\s\S]*'copy-active-pane-routing-report'/, 'pass88_command_ledger_preserved');
requireMatch(app, /if \(event\.altKey && event\.key === 'ArrowLeft'\) \{ event\.preventDefault\(\); goBackTarget\('shortcut'\); \}/, 'alt_left_active_route');
requireMatch(app, /if \(event\.altKey && event\.key === 'ArrowRight'\) \{ event\.preventDefault\(\); goForwardTarget\('shortcut'\); \}/, 'alt_right_active_route');

if (pkg.scripts?.['verify:pass-134-active-pane-routing-regression'] !== 'node scripts/verify-pass-134-active-pane-routing-regression.mjs') {
  failures.push('missing_package_script_verify_pass134');
}
if (!pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-134-active-pane-routing-regression')) {
  failures.push('release_blockers_missing_pass134');
}
if (pkg.version !== '1.8.30') failures.push(`unexpected_version_${pkg.version}`);

if (failures.length) {
  console.error('PASS134 active-pane routing regression verification FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('PASS134 active-pane routing regression verification OK');
console.log('PASS134_ACTIVE_PANE_ROUTING_REGRESSION=PASS');
