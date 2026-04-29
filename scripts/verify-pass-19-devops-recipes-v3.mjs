import fs from 'node:fs';
const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function fail(message) { console.error(`PASS19_DEVOPS_RECIPES_V3_FAIL=${message}`); process.exit(1); }
for (const token of [
  "id: 'aws-release-cockpit'",
  "id: 'cloudflare-pages-dns-cockpit'",
  "id: 'github-release-cockpit'",
  "id: 'vercel-production-cockpit'",
  "id: 'azure-release-cockpit'",
  "id: 'm365-change-cockpit'",
  "Ctrl+Alt+U",
  "Ctrl+Alt+5",
  "startMissionFromRecipe('azure-release-cockpit')",
  "startMissionFromRecipe('m365-change-cockpit')",
  "Pin Blueprint:",
  "recipeBlueprintMarkdown"
]) if (!app.includes(token)) fail(`missing-token:${token}`);
const devopsCount = (app.match(/missionPhase: 'devops'/g) || []).length;
if (devopsCount < 12) fail(`expected-at-least-12-devops-recipes-found-${devopsCount}`);
for (const provider of ['aws','cloudflare','github','vercel']) {
  if (!app.includes(`cockpitProvider: '${provider}'`)) fail(`missing-provider:${provider}`);
}
if (pkg.scripts?.['verify:pass-19-devops-recipes-v3'] !== 'node scripts/verify-pass-19-devops-recipes-v3.mjs') fail('missing-package-script');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-19-devops-recipes-v3')) fail('release-blockers-not-wired');
console.log('PASS19_DEVOPS_RECIPES_V3_OK=1');
