import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const p = file(rel);
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function write(rel, content) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), content, 'utf8');
}

function upsertPackageScript() {
  const rel = 'package.json';
  const pkg = JSON.parse(read(rel));
  pkg.scripts ||= {};
  pkg.scripts['verify:pass-204-operator-command-center-v2'] = 'node scripts/verify-pass-204-operator-command-center-v2.mjs';

  const blocker = pkg.scripts['verify:release-blockers'];
  if (typeof blocker === 'string' && !blocker.includes('verify:pass-204-operator-command-center-v2')) {
    const next = 'npm run verify:pass-204-operator-command-center-v2';
    pkg.scripts['verify:release-blockers'] = blocker.includes('&& npm run build')
      ? blocker.replace('&& npm run build', `&& ${next} && npm run build`)
      : `${blocker} && ${next}`;
  }

  write(rel, JSON.stringify(pkg, null, 2) + '\n');
}

function upsertRendererApp() {
  const rel = 'src/renderer/app.ts';
  let body = read(rel);

  if (!body.includes("./operator-command-center-v2")) {
    if (body.includes("import { installMissionEvidenceRedactionV2Controls } from './mission-evidence-redaction-v2';")) {
      body = body.replace(
        "import { installMissionEvidenceRedactionV2Controls } from './mission-evidence-redaction-v2';",
        "import { installMissionEvidenceRedactionV2Controls } from './mission-evidence-redaction-v2';\nimport { installOperatorCommandCenterV2 } from './operator-command-center-v2';"
      );
    } else {
      body = body.replace(
        "import { MISSION_RECIPE_LIBRARY, missionRecipeLibrarySummary, missionRecipeLibraryToLaunchRecipe } from '../shared/mission-recipes-contract';",
        "import { MISSION_RECIPE_LIBRARY, missionRecipeLibrarySummary, missionRecipeLibraryToLaunchRecipe } from '../shared/mission-recipes-contract';\nimport { installOperatorCommandCenterV2 } from './operator-command-center-v2';"
      );
    }
  }

  if (!body.includes('installOperatorCommandCenterV2(() => currentMission)')) {
    if (body.includes('const pass203EvidenceRedactionUxV2 = installMissionEvidenceRedactionV2Controls(() => currentMission);')) {
      body = body.replace(
        'const pass203EvidenceRedactionUxV2 = installMissionEvidenceRedactionV2Controls(() => currentMission);',
        'const pass203EvidenceRedactionUxV2 = installMissionEvidenceRedactionV2Controls(() => currentMission);\ninstallOperatorCommandCenterV2(() => currentMission);'
      );
    } else if (body.includes('const pass202EvidencePackV2 = installMissionEvidencePackV2Controls(() => currentMission);')) {
      body = body.replace(
        'const pass202EvidencePackV2 = installMissionEvidencePackV2Controls(() => currentMission);',
        'const pass202EvidencePackV2 = installMissionEvidencePackV2Controls(() => currentMission);\ninstallOperatorCommandCenterV2(() => currentMission);'
      );
    } else {
      body = body.replace(
        'let currentMission: MissionState | undefined;\n',
        'let currentMission: MissionState | undefined;\ninstallOperatorCommandCenterV2(() => currentMission);\n'
      );
    }
  }

  write(rel, body);
}

function upsertIndexHtml() {
  const rel = 'src/renderer/index.html';
  let body = read(rel);

  if (!body.includes('data-pass204-operator-command-center-v2="true"')) {
    if (body.includes('data-pass185-mouse-history-parity="true"')) {
      body = body.replace(
        'data-pass185-mouse-history-parity="true"',
        'data-pass185-mouse-history-parity="true" data-pass204-operator-command-center-v2="true"'
      );
    } else {
      body = body.replace('<body ', '<body data-pass204-operator-command-center-v2="true" ');
    }
  }

  if (!body.includes('id="operator-command-center-v2"')) {
    const panel = '<section id="operator-command-center-v2" class="operator-command-center-v2" aria-label="Operator Command Center v2 scope and command families"><header class="operator-command-center-v2-header"><div><p class="eyebrow">PASS204 · Ctrl+K Power Surface</p><strong>Operator Command Center v2</strong></div><span class="operator-command-target-scope">Command scope loads with the active mission.</span></header></section>';
    if (body.includes('<div id="command-palette-list" class="command-palette-list" role="listbox" aria-label="Command results"></div>')) {
      body = body.replace(
        '<div id="command-palette-list" class="command-palette-list" role="listbox" aria-label="Command results"></div>',
        `${panel}\n      <div id="command-palette-list" class="command-palette-list" role="listbox" aria-label="Command results"></div>`
      );
    } else {
      body = body.replace('</section>\n  </dialog>\n\n  <dialog id="shortcut-dialog"', `${panel}\n    </section>\n  </dialog>\n\n  <dialog id="shortcut-dialog"`);
    }
  }

  write(rel, body);
}

function appendMissionControlCss() {
  const rel = 'src/renderer/styles/mission-control.css';
  let body = read(rel);
  if (body.includes('PASS204 — Operator Command Center v2')) return;

  body += `\n\n/* PASS204 — Operator Command Center v2. */\n.command-palette-dialog[data-pass204-operator-command-center-v2=\"true\"] .command-palette-panel {\n  grid-template-rows: auto auto auto minmax(0, 1fr) auto !important;\n}\n\n.operator-command-center-v2 {\n  display: grid !important;\n  gap: 10px !important;\n  margin: 0 0 12px !important;\n  padding: 12px !important;\n  border: 1px solid rgba(119,219,255,.22) !important;\n  border-radius: 18px !important;\n  background:\n    radial-gradient(circle at 0% 0%, rgba(119,219,255,.10), transparent 38%),\n    linear-gradient(180deg, rgba(5, 19, 24, .92), rgba(2, 8, 13, .86)) !important;\n  box-shadow: inset 0 0 0 1px rgba(255,255,255,.032), 0 16px 38px rgba(0,0,0,.20) !important;\n}\n\n.operator-command-center-v2-header {\n  display: grid !important;\n  grid-template-columns: minmax(0, .42fr) minmax(0, 1fr) !important;\n  gap: 12px !important;\n  align-items: center !important;\n}\n\n.operator-command-center-v2-header .eyebrow {\n  margin: 0 0 3px !important;\n  color: var(--mission-green, #8fffd2) !important;\n  font-size: .62rem !important;\n  letter-spacing: .12em !important;\n  text-transform: uppercase !important;\n}\n\n.operator-command-center-v2-header strong {\n  color: #fff !important;\n  font-size: .86rem !important;\n}\n\n.operator-command-target-scope {\n  min-width: 0 !important;\n  justify-self: end !important;\n  padding: 6px 9px !important;\n  border: 1px solid rgba(109,255,183,.20) !important;\n  border-radius: 999px !important;\n  color: #dff9ff !important;\n  background: rgba(2,8,13,.72) !important;\n  font-size: .70rem !important;\n  line-height: 1.25 !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n  white-space: nowrap !important;\n}\n\n.operator-command-quick-filters {\n  display: flex !important;\n  flex-wrap: wrap !important;\n  gap: 7px !important;\n}\n\n.operator-command-quick-filter {\n  min-height: 30px !important;\n  padding: 5px 9px !important;\n  border: 1px solid rgba(119,219,255,.22) !important;\n  border-radius: 999px !important;\n  color: #eafff5 !important;\n  background: rgba(3, 13, 23, .82) !important;\n  font-size: .68rem !important;\n  font-weight: 800 !important;\n  cursor: pointer !important;\n}\n\n.operator-command-quick-filter:hover,\n.operator-command-quick-filter:focus-visible {\n  border-color: rgba(109,255,183,.58) !important;\n  outline: none !important;\n  box-shadow: 0 0 0 3px rgba(109,255,183,.12) !important;\n}\n\n.operator-command-family-grid {\n  display: grid !important;\n  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n  gap: 8px !important;\n}\n\n.operator-command-family-card {\n  min-width: 0 !important;\n  min-height: 74px !important;\n  display: grid !important;\n  gap: 7px !important;\n  align-content: start !important;\n  text-align: left !important;\n  padding: 10px !important;\n  border: 1px solid rgba(119,219,255,.18) !important;\n  border-radius: 15px !important;\n  background: rgba(3, 12, 17, .76) !important;\n  color: #fff !important;\n  cursor: pointer !important;\n}\n\n.operator-command-family-card[data-command-status=\"needs-mission\"],\n.operator-command-family-card[data-command-status=\"needs-evidence\"],\n.operator-command-family-card[data-command-status=\"reference-only\"] {\n  border-color: rgba(255,210,122,.24) !important;\n}\n\n.operator-command-family-card:hover,\n.operator-command-family-card:focus-visible {\n  border-color: rgba(109,255,183,.52) !important;\n  outline: none !important;\n  box-shadow: 0 0 0 3px rgba(109,255,183,.10) !important;\n}\n\n.operator-command-family-top {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  gap: 8px !important;\n}\n\n.operator-command-family-top strong {\n  color: #fff !important;\n  font-size: .78rem !important;\n  letter-spacing: .06em !important;\n  text-transform: uppercase !important;\n}\n\n.operator-command-family-top em {\n  padding: 3px 6px !important;\n  border: 1px solid rgba(119,219,255,.18) !important;\n  border-radius: 999px !important;\n  color: var(--mission-green, #8fffd2) !important;\n  background: rgba(2,8,13,.72) !important;\n  font-size: .60rem !important;\n  font-style: normal !important;\n  font-weight: 900 !important;\n  white-space: nowrap !important;\n}\n\n.operator-command-family-detail,\n.operator-command-guardrail {\n  color: #d1e2ee !important;\n  font-size: .69rem !important;\n  line-height: 1.35 !important;\n}\n\n.operator-command-guardrail {\n  margin: 0 !important;\n}\n\n@media (max-width: 1120px) {\n  .operator-command-center-v2-header { grid-template-columns: 1fr !important; }\n  .operator-command-target-scope { justify-self: stretch !important; white-space: normal !important; }\n  .operator-command-family-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }\n}\n\n@media (max-width: 760px) {\n  .operator-command-family-grid { grid-template-columns: 1fr !important; }\n}\n`;

  write(rel, body);
}

function main() {
  upsertPackageScript();
  upsertRendererApp();
  upsertIndexHtml();
  appendMissionControlCss();
  console.log('[PASS204][OK] Operator Command Center v2 patch applied.');
}

main();
