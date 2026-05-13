export const PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_PASS = 'PASS195';
export const PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_VERSION = 2;

export type FirstRunOperatorMilestoneId =
  | 'normal-browsing'
  | 'mission-control'
  | 'admin-profiles'
  | 'runbook-rail'
  | 'evidence-export'
  | 'safe-settings'
  | 'troubleshooting';

export type FirstRunOperatorMilestone = {
  id: FirstRunOperatorMilestoneId;
  label: string;
  anchor: string;
  outcome: string;
};

export const FIRST_RUN_OPERATOR_MILESTONES: readonly FirstRunOperatorMilestone[] = [
  {
    id: 'normal-browsing',
    label: 'Normal browsing',
    anchor: 'getting-started',
    outcome: 'Confirm tabs, address bar, Home, Launchpad, Guide, profiles, and toolbar controls behave like a browser first.'
  },
  {
    id: 'mission-control',
    label: 'Mission Control',
    anchor: 'mission-control',
    outcome: 'Open Mission Control and understand why Mission Tabs, layouts, active pane routing, and focus state exist.'
  },
  {
    id: 'admin-profiles',
    label: 'Admin Console Profiles',
    anchor: 'devops-tools',
    outcome: 'Find DevOps and IT launch surfaces for cloud consoles, identity admin, provider portals, and safe local tools.'
  },
  {
    id: 'runbook-rail',
    label: 'Runbook Rail',
    anchor: 'runbook-rail',
    outcome: 'Use checklist, notes, validation, blocked-item, and rollback context without turning local notes into secrets storage.'
  },
  {
    id: 'evidence-export',
    label: 'Evidence and export',
    anchor: 'evidence-export',
    outcome: 'Capture handoff context and preview/redact before sharing evidence outside the local browser.'
  },
  {
    id: 'safe-settings',
    label: 'Settings and safety',
    anchor: 'settings-security',
    outcome: 'Review runtime settings, permissions, profile data behavior, downloads, and local-only storage boundaries.'
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting states',
    anchor: 'troubleshooting-states',
    outcome: 'Recognize blocked, disabled, offline, empty, and warning states without guessing what the browser did.'
  }
] as const;

export const FIRST_RUN_OPERATOR_WALKTHROUGH_PRIVACY_SUMMARY = 'Local-only guide. No telemetry, no remote KB calls, no cookies, no browser storage, and no IT Docs or PSA backend dependency.';
export const FIRST_RUN_OPERATOR_WALKTHROUGH_START_ANCHOR = 'operator-first-ten-minutes';
export const FIRST_RUN_OPERATOR_WALKTHROUGH_QUERY = 'walkthrough=operator-v2';

export function firstRunOperatorWalkthroughState() {
  return {
    pass: PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_PASS,
    version: PASS195_FIRST_RUN_OPERATOR_WALKTHROUGH_VERSION,
    startAnchor: FIRST_RUN_OPERATOR_WALKTHROUGH_START_ANCHOR,
    query: FIRST_RUN_OPERATOR_WALKTHROUGH_QUERY,
    privacySummary: FIRST_RUN_OPERATOR_WALKTHROUGH_PRIVACY_SUMMARY,
    milestones: FIRST_RUN_OPERATOR_MILESTONES.map((milestone) => ({ ...milestone }))
  };
}
