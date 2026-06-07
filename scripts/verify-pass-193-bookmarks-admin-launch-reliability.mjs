#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function fail(message) { console.error(`[PASS193][FAIL] ${message}`); process.exit(1); }
function need(condition, message) { if (!condition) fail(message); }

const pkg = JSON.parse(read('package.json'));
const app = read('src/renderer/app.ts');
const bookmarks = read('src/renderer/chromium-bookmarks.ts');
const contract = read('src/shared/bookmark-admin-launch-reliability-contract.ts');
const adminProfiles = read('src/shared/admin-console-profiles-contract.ts');
const docs = read('docs/pass-193-bookmarks-admin-launch-reliability.md');
const summary = read('PASS_193_BOOKMARKS_ADMIN_LAUNCH_RELIABILITY_SUMMARY.md');

need(pkg.version === '1.8.30', 'version-must-not-change-without-explicit-approval');
need(pkg.scripts?.['verify:pass-193-bookmarks-admin-launch-reliability'] === 'node scripts/verify-pass-193-bookmarks-admin-launch-reliability.mjs', 'package-script-missing');
need(getReleaseBlockersContract(pkg).includes('verify:pass-193-bookmarks-admin-launch-reliability'), 'release-blockers-missing-pass193');
need(getReleaseBlockersContract(pkg).indexOf('verify:pass-193-bookmarks-admin-launch-reliability') > getReleaseBlockersContract(pkg).indexOf('verify:pass-192-tab-strip-titlebar-drag-final-ux'), 'pass193-must-run-after-pass192');

for (const token of [
  'PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION',
  'Pass193LaunchSurface',
  'Pass193LaunchTargetKind',
  'PASS193_BOOKMARK_ADMIN_RELIABILITY_CASES',
  'PASS193_BOOKMARK_MISSION_EVENT_NAME',
  'PASS193_REQUIRED_BOOKMARK_DEFAULT_FOLDERS',
  'PASS193_REQUIRED_ADMIN_PROFILE_PROVIDERS',
  'pass193BookmarkAdminLaunchSummary',
  'bookmark-folder-mission-sanitizes-event-detail',
  'admin-console-profile-ids-resolve-before-launch',
  'launch-recipe-ids-are-unique-and-not-dead'
]) need(contract.includes(token), `contract-missing-token:${token}`);

for (const token of [
  'PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION',
  'PASS193_BOOKMARK_ADMIN_RELIABILITY_CASES',
  'PASS193_BOOKMARK_MISSION_EVENT_NAME',
  'pass193RecipeLaunchRegistry',
  'pass193FindLaunchRecipe',
  'pass193MarkLaunchAttempt',
  'pass193HandleMissingRecipe',
  'pass193SanitizeBookmarkMissionDetail',
  'pass193InitializeBookmarkAdminLaunchReliability',
  "window.addEventListener(PASS193_BOOKMARK_MISSION_EVENT_NAME",
  "openLaunchRecipe(recipe.id, 'command-palette')",
  "startMissionFromRecipe(recipe.id, 'command-palette')",
  "openLaunchRecipe(button.dataset.recipeId, 'ops-hub')",
  "startMissionFromRecipe(button.dataset.startMissionRecipeId, 'mission-control')",
  "data-pass193-launch-surface=\"ops-hub\"",
  "data-pass193-launch-surface=\"mission-control\""
]) need(app.includes(token), `app-missing-token:${token}`);

need(!/async function openLaunchRecipe\(recipeId: string[\s\S]{0,220}premiumLaunchRecipes\.find\(\(candidate\) => candidate\.id === recipeId\)/.test(app), 'open-launch-recipe-still-directly-finds-without-pass193-lookup');
need(!/async function startMissionFromRecipe\(recipeId: string[\s\S]{0,220}premiumLaunchRecipes\.find\(\(candidate\) => candidate\.id === recipeId\)/.test(app), 'start-mission-recipe-still-directly-finds-without-pass193-lookup');
need(/function pass193SanitizeBookmarkMissionDetail[\s\S]*pass90RecipeUrlCandidate[\s\S]*scanAndRedact/.test(app), 'bookmark-mission-detail-is-not-revalidated-and-redacted');

for (const token of [
  'PASS193_BOOKMARK_MISSION_EVENT_NAME',
  'PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION',
  'pass193MarkBookmarkLaunch',
  'pass193DispatchBookmarkMission',
  "new CustomEvent(PASS193_BOOKMARK_MISSION_EVENT_NAME",
  "navigateTo(url: string, newTab: boolean, surface:",
  "data-pass193-launch-surface=\"bookmark-folder-view\"",
  "data-pass193-launch-kind=\"bookmark-folder-mission\"",
  "button.dataset.pass193LaunchSurface = 'bookmark-bar'",
  "mission.dataset.pass193LaunchKind = 'bookmark-folder-mission'",
  "parseSafeBookmarkUrl(node.url)",
  "missionManifestMarkdown(manifest)"
]) need(bookmarks.includes(token), `bookmarks-missing-token:${token}`);

need(!bookmarks.includes("new CustomEvent('tahai-browser:start-mission-from-bookmark-folder'"), 'bookmark-mission-event-regressed-to-raw-string-event');
need(!bookmarks.includes('`# Bookmark Mission Manifest: ${node.title}'), 'single-bookmark-mission-manifest-regressed-to-unsanitized-template');

for (const provider of ['microsoft', 'azure', 'google', 'aws', 'cloudflare', 'github', 'vercel', 'itdocs', 'psa']) {
  need(adminProfiles.toLowerCase().includes(provider), `admin-profile-provider-missing:${provider}`);
}

need(docs.includes('PASS193') && docs.includes('bookmarks') && docs.includes('Admin Console Profiles'), 'docs-missing-pass193-bookmark-admin-summary');
need(summary.includes('PASS193') && summary.includes('release-blocker'), 'summary-missing-pass193-release-blocker-note');

console.log('[PASS193][OK] Bookmarks and Admin Launch Reliability verified.');
