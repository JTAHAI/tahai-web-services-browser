#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS92 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}
const invariants=includes('src/shared/mission-state-invariants.ts',['MissionStateInvariantIssue','missionVisiblePaneIdsForLayout','normalizeMissionInvariantPaneId','missionLayoutForPaneId','missionStateInvariantIssues','repairMissionLayoutInvariants','repairMissionStateInvariants','active-pane-hidden','duplicate-pane-assignment','duplicate-tab-assignment','pane-tab-mismatch','pane-role-mismatch','layout-pane-canonicalization-needed','canonicalPanesFromTabs']);
need(/case 'focus': return \[active\]/.test(invariants),'focus layout must scope visible pane to active pane only');
need(/case 'quad': return \['pane-1', 'pane-2', 'pane-3', 'pane-4'\]/.test(invariants),'quad layout visible pane map missing');
const validators=includes('src/shared/mission-validators.ts',["import { repairMissionLayoutInvariants } from './mission-state-invariants'",'!Array.isArray(input.panes)','input.panes.length !== panes.length','seenPanes','seenTabs','repairMissionLayoutInvariants({ type: input.type, activePaneId: input.activePaneId, panes }, tabs)',"issue.severity === 'block'",'cleanEvidenceText(record.objective, 500)','cleanEvidenceText(record.rollback, 500)','cleanEvidenceText(input.evidenceNote, 500)','cleanEvidenceText(note, 4000)']);
need(!/uniquePanes\.set/.test(validators),'validators must not silently dedupe duplicate pane assignments');
need(/if \(seenPanes\.has\(pane\.paneId\) \|\| seenTabs\.has\(pane\.tabId\)\) return undefined;/.test(validators),'validators must fail closed on duplicate pane/tab assignments');
const model=includes('src/renderer/mission-model.ts',["from '../shared/mission-state-invariants'",'return missionVisiblePaneIdsForLayout(layout, activePaneId);','repairMissionStateInvariants(mission);']);
need(!/const usedTabIds = new Set<string>\(\);\n  const panes/.test(model),'renderer mission sync must not keep old local pane canonicalizer');
includes('src/renderer/app.ts',["import { missionStateInvariantIssues } from '../shared/mission-state-invariants'",'pass92InvariantIssues','pass92-mission-invariant-warning','Mission state guard requires save/restore repair']);
includes('src/renderer/styles/browser.css',['mission state invariant safety','body.pass92-mission-invariant-warning #mission-status','invariant guard active']);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-92-mission-state-invariant-guard']==='node scripts/verify-pass-92-mission-state-invariant-guard.mjs','package.json missing PASS92 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-92-mission-state-invariant-guard'),'release blockers missing PASS92 verifier');
console.log('PASS92 mission state invariant guard verification passed.');
