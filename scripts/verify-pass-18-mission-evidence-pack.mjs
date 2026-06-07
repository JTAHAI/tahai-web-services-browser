import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const model = fs.readFileSync('src/renderer/mission-model.ts', 'utf8');
const html = fs.readFileSync('src/renderer/index.html', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const types = fs.readFileSync('src/shared/mission-types.ts', 'utf8');
const validators = fs.readFileSync('src/shared/mission-validators.ts', 'utf8');
const store = fs.readFileSync('src/main/mission-store.ts', 'utf8');
const evidencePack = fs.readFileSync('src/shared/evidence-pack.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function fail(message) { console.error(`PASS18_MISSION_EVIDENCE_PACK_FAIL=${message}`); process.exit(1); }
const rendererEvidenceSource = `${app}
${model}`;
for (const token of ['function ensureMissionEvidence','function addMissionEvidenceEntry','function pinLatestToolOutputToMission','function pinActivePageToMission','function copyMissionEvidenceEntry','function removeMissionEvidenceEntry',"'evidence-added'",'Mission Evidence']) {
  if (!rendererEvidenceSource.includes(token)) fail(`missing-renderer-token:${token}`);
}
for (const token of ['mission-evidence-list', 'mission-pin-latest-evidence', 'mission-pin-active-page']) if (!html.includes(token)) fail(`missing-html-token:${token}`);
for (const token of ['MissionEvidenceEntry', 'MissionEvidenceKind', 'evidence: MissionEvidenceEntry[]']) if (!types.includes(token)) fail(`missing-type-token:${token}`);
for (const token of ['validateEvidenceEntry', 'MAX_MISSION_EVIDENCE', "'tool-output'", "'evidence-added'"]) if (!validators.includes(token)) fail(`missing-validator-token:${token}`);
for (const token of ["buildMissionEvidencePack(mission, { profile: 'sanitized-handoff' }).redactedMarkdown"]) if (!store.includes(token)) fail(`missing-store-token:${token}`);
for (const token of ['## Evidence index', 'const evidence = includeEvidence', 'rows(evidence']) if (!evidencePack.includes(token)) fail(`missing-evidence-pack-token:${token}`);
for (const token of ['PASS 18 Mission Evidence Pack v2 styles', '.mission-evidence-actions']) if (!css.includes(token)) fail(`missing-css-token:${token}`);
if (pkg.scripts?.['verify:pass-18-mission-evidence-pack'] !== 'node scripts/verify-pass-18-mission-evidence-pack.mjs') fail('missing-package-script');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-18-mission-evidence-pack')) fail('release-blockers-not-wired');
console.log('PASS18_MISSION_EVIDENCE_PACK_OK=1');
