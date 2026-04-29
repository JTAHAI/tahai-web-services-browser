import fs from 'node:fs';
function fail(message) { console.error(`PASS20_LINUX_RECIPE_HARDENING_FAIL=${message}`); process.exit(1); }
const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const linuxScript = fs.readFileSync('build-linux-appimage.ps1', 'utf8');
const recipeBlock = app.slice(app.indexOf('const premiumLaunchRecipes'), app.indexOf('const shortcutRows'));
const idMatches = [...recipeBlock.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
const duplicateIds = [...new Set(idMatches.filter((id, index) => idMatches.indexOf(id) !== index))];
if (duplicateIds.length) fail(`duplicate-recipe-id:${duplicateIds.join(',')}`);
for (const token of ["cockpitProvider?: 'aws' | 'azure' | 'm365'", "cockpitProvider: 'azure'", "cockpitProvider: 'm365'", "if (provider === 'm365') return 'M365'", "if (provider === 'azure') return 'Azure'"]) if (!app.includes(token)) fail(`missing-token:${token}`);
for (const token of ['wsl -d FedoraLinux-43 --cd /mnt/c/dev/browser/app', 'npm run verify:release-blockers', 'npm run package:linux:appimage', 'find release dist -type f']) if (!linuxScript.includes(token)) fail(`missing-linux-build-token:${token}`);
if (pkg.scripts?.['verify:pass-20-linux-recipe-hardening'] !== 'node scripts/verify-pass-20-linux-recipe-hardening.mjs') fail('missing-package-script');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-20-linux-recipe-hardening')) fail('release-blockers-not-wired');
console.log('PASS20_LINUX_RECIPE_HARDENING_OK=1');
