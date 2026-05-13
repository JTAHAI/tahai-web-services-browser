export const PASS196_MISSION_CONTROL_IA_PASS = 'PASS196';
export const PASS196_MISSION_CONTROL_IA_VERSION = 1;
export const PASS196_MISSION_CONTROL_IA_CONTRACT_ID = 'mission-control-ia-rebuild-v1';

export const PASS196_MISSION_COMMAND_DECK_CARDS = [
  'identity',
  'active-pane',
  'layout',
  'runbook',
  'evidence',
  'timeline',
  'export'
] as const;

export type Pass196MissionCommandDeckCard = typeof PASS196_MISSION_COMMAND_DECK_CARDS[number];

export const PASS196_MISSION_CONTROL_IA_REQUIREMENTS = [
  'Mission Control exposes mission identity and type without requiring the operator to infer state from lower panels.',
  'The active Mission pane is visible as the navigation target before the operator touches back, forward, reload, address, or keyboard commands.',
  'Layout, Runbook Rail, Evidence Pack, Timeline, Tools/recipes, saved local missions, and export preview remain top-level sections.',
  'The command deck remains local-only and renders from sanitized local Mission state; it does not introduce IT Docs or PSA writeback.',
  'Small-window and compact Mission Control paths keep the IA readable instead of hiding the flagship surface.'
] as const;

export function pass196MissionControlIaSummary(): string {
  return `${PASS196_MISSION_CONTROL_IA_PASS} ${PASS196_MISSION_CONTROL_IA_CONTRACT_ID}: ${PASS196_MISSION_COMMAND_DECK_CARDS.length} command-deck cards keep Mission Control identity, active pane, layout, runbook, evidence, timeline, and export truth visible.`;
}
