#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_DEVOPS_MISSION_RECIPES_VERIFY_FAIL=${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
for (const rel of ['src/renderer/app.ts','src/renderer/styles/browser.css','docs/devops-mission-recipes-pass-02.md']) if (!exists(rel)) fail(`missing ${rel}`);
const app = read('src/renderer/app.ts');
for (const token of [
  "missionPhase?: 'devops' | 'it' | 'general'",
  'missionPrimaryAction?: string',
  'missionStopCondition?: string',
  'missionRunbookSteps?: string[]',
  'missionEvidencePrompts?: string[]',
  'createMissionRunbookFromRecipe',
  'recipePhaseLabel',
  'recipeEvidenceNote',
  'DevOps Mission Recipe',
  'Ctrl+Alt+D',
  "startMissionFromRecipe('deploy-cockpit')"
]) if (!app.includes(token)) fail(`app missing token: ${token}`);
for (const id of ['deploy-cockpit','github-actions-monitor','dns-migration-cockpit','cloudflare-change','aws-release-cockpit','vercel-firebase-release','incident-war-room','developer-debug-cockpit']) {
  if (!app.includes(`id: '${id}'`)) fail(`missing DevOps recipe ${id}`);
}
const devopsCount = (app.match(/missionPhase: 'devops'/g) || []).length;
if (devopsCount < 8) fail(`expected at least 8 DevOps mission recipes, found ${devopsCount}`);
const css = read('src/renderer/styles/browser.css');
for (const token of ['PASS 02 DevOps Mission Recipes', '.mission-recipe-card.devops', '.mission-recipe-card.it', '.mission-recipe-card.general']) if (!css.includes(token)) fail(`css missing token: ${token}`);
const pkg = JSON.parse(read('package.json').replace(/^\uFEFF/, ''));
if (pkg.scripts?.['verify:devops-mission-recipes'] !== 'node scripts/verify-devops-mission-recipes.mjs') fail('package.json missing verify:devops-mission-recipes script');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:devops-mission-recipes')) fail('verify:release-blockers does not include verify:devops-mission-recipes');
console.log('TAHAI_BROWSER_DEVOPS_MISSION_RECIPES_VERIFY=OK');
process.exit(0);
