export const PASS204_OPERATOR_COMMAND_CENTER_V2_PASS = 'PASS204 — Operator Command Center v2';
export const OPERATOR_COMMAND_CENTER_V2_CONTRACT_ID = 'operator-command-center-v2';
export const OPERATOR_COMMAND_CENTER_V2_SCHEMA_VERSION = 2;

export const OPERATOR_COMMAND_CENTER_V2_REQUIRED_FAMILIES = [
  'mission',
  'layout',
  'profile',
  'evidence',
  'opstool',
  'kb',
  'export'
] as const;

export type OperatorCommandCenterV2Family = typeof OPERATOR_COMMAND_CENTER_V2_REQUIRED_FAMILIES[number] | 'browser' | 'workspace' | 'developer' | 'settings';

export const OPERATOR_COMMAND_CENTER_V2_REQUIRED_SCOPES = [
  'browser-shell',
  'current-mission',
  'active-pane',
  'all-panes',
  'new-mission',
  'admin-profile',
  'runbook-rail',
  'evidence-pack',
  'export-packet',
  'knowledge-base',
  'opstools-pack'
] as const;

export type OperatorCommandCenterV2TargetScope = typeof OPERATOR_COMMAND_CENTER_V2_REQUIRED_SCOPES[number] | 'active-tab' | 'workspace' | 'all-surfaces' | 'profile-store';

export type OperatorCommandCenterV2Command = {
  id: string;
  family: OperatorCommandCenterV2Family;
  targetScope: OperatorCommandCenterV2TargetScope;
  disabledReason?: string;
  exportSafe: boolean;
  destructive: boolean;
};

export const OPERATOR_COMMAND_CENTER_V2_REQUIRED_COMMAND_IDS = [
  'mission-control',
  'mission-add-tab',
  'mission-quad',
  'mission-focus-pane',
  'pass204-open-kb',
  'pass204-admin-console-profiles',
  'pass204-capture-active-pane',
  'pass204-capture-all-panes',
  'pass204-copy-mission-export',
  'pass204-save-mission-export',
  'devops-menu',
  'it-menu',
  'capture',
  'ops-check'
] as const;

export const OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY = {
  noMission: 'Create or restore a local mission first.',
  noActiveTab: 'Open or focus a browser tab before running this command.',
  noMissionPane: 'Switch to a Mission View with a visible active pane first.',
  noEvidence: 'Capture evidence or run a tool before exporting this packet.',
  noProfile: 'No admin profile is available for this command.',
  localOnly: 'Browser-side contract only; IT Docs/PSA writeback is disabled until server authorization exists.'
} as const;

export function operatorCommandCenterV2DisabledReason(input: {
  hasMission: boolean;
  hasActiveTab: boolean;
  hasActivePane: boolean;
  hasEvidence: boolean;
}, targetScope: OperatorCommandCenterV2TargetScope): string {
  if ((targetScope === 'current-mission' || targetScope === 'runbook-rail' || targetScope === 'export-packet') && !input.hasMission) return OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noMission;
  if ((targetScope === 'active-tab') && !input.hasActiveTab) return OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noActiveTab;
  if ((targetScope === 'active-pane') && (!input.hasMission || !input.hasActivePane)) return input.hasMission ? OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noMissionPane : OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noMission;
  if ((targetScope === 'all-panes') && !input.hasMission) return OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noMission;
  if ((targetScope === 'evidence-pack' || targetScope === 'export-packet') && input.hasMission && !input.hasEvidence) return OPERATOR_COMMAND_CENTER_V2_DISABLED_REASON_COPY.noEvidence;
  return '';
}

export function operatorCommandCenterV2CommandScope(command: OperatorCommandCenterV2Command): string {
  const disabled = command.disabledReason ? ` · Disabled: ${command.disabledReason}` : '';
  return `${command.family} · ${command.targetScope} · export-safe=${command.exportSafe} · destructive=${command.destructive}${disabled}`;
}

export function operatorCommandCenterV2Summary(commands: OperatorCommandCenterV2Command[]): string {
  const familySet = new Set(commands.map((command) => command.family));
  const scopeSet = new Set(commands.map((command) => command.targetScope));
  const disabledCount = commands.filter((command) => command.disabledReason).length;
  const missingFamilies = OPERATOR_COMMAND_CENTER_V2_REQUIRED_FAMILIES.filter((family) => !familySet.has(family));
  const missingScopes = OPERATOR_COMMAND_CENTER_V2_REQUIRED_SCOPES.filter((scope) => !scopeSet.has(scope));
  return `families=${familySet.size}/${OPERATOR_COMMAND_CENTER_V2_REQUIRED_FAMILIES.length} · scopes=${scopeSet.size}/${OPERATOR_COMMAND_CENTER_V2_REQUIRED_SCOPES.length} · disabled=${disabledCount} · missingFamilies=${missingFamilies.join(',') || 'none'} · missingScopes=${missingScopes.join(',') || 'none'}`;
}

export const OPERATOR_COMMAND_CENTER_V2_GUARDRAILS = {
  ctrlKPowerSurface: true,
  targetScopeVisible: true,
  disabledReasonsVisible: true,
  missionLayoutProfileEvidenceOpsToolsKbExportCoverage: true,
  redactionAwareExportCommands: true,
  noDestructiveCommandWithoutConfirmation: true,
  noConnectorWrites: true,
  smallWindowContained: true
} as const;
