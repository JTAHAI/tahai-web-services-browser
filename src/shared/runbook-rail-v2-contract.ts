import type { MissionRunbook, MissionRunbookStepState, MissionType } from './mission-types';

export const PASS200_RUNBOOK_RAIL_V2_PASS = 'PASS200 — Runbook Rail v2';
export const RUNBOOK_RAIL_V2_CONTRACT_ID = 'runbook-rail-v2';
export const RUNBOOK_RAIL_V2_SCHEMA_VERSION = 2;

export const RUNBOOK_RAIL_V2_SECTION_IDS = [
  'scope',
  'preflight',
  'execution',
  'validation',
  'rollback',
  'handoff'
] as const;

export type RunbookRailV2SectionId = typeof RUNBOOK_RAIL_V2_SECTION_IDS[number];

export type RunbookRailV2SectionContract = {
  sectionId: RunbookRailV2SectionId;
  label: string;
  intent: string;
  required: boolean;
  evidencePrompt: string;
  exportHeading: string;
};

export type RunbookRailV2Template = {
  missionType: MissionType | 'default';
  objectivePrompt: string;
  stopConditionPrompt: string;
  sections: RunbookRailV2SectionContract[];
  validationSteps: string[];
  rollbackConditions: string[];
  blockedItems: string[];
  operatorTimestampLabels: string[];
};

export type RunbookRailV2Guardrails = {
  localOnly: boolean;
  browserSideOnly: boolean;
  redactionBeforeExport: boolean;
  explicitOperatorNotes: boolean;
  noConnectorWrites: boolean;
  noCredentialStorage: boolean;
  noTokenFields: boolean;
  noCookieCapture: boolean;
  noPsaWriteback: boolean;
  noItDocsWriteWithoutServerAuthorization: boolean;
};

export type RunbookRailV2Diagnostics = {
  sectionCount: number;
  checklistCount: number;
  validationStepCount: number;
  rollbackConditionCount: number;
  blockedItemCount: number;
  operatorTimestampCount: number;
  doneCount: number;
  blockedCount: number;
  exportReady: boolean;
  diagnosticsLabel: string;
};

export const RUNBOOK_RAIL_V2_GUARDRAILS: RunbookRailV2Guardrails = {
  localOnly: true,
  browserSideOnly: true,
  redactionBeforeExport: true,
  explicitOperatorNotes: true,
  noConnectorWrites: true,
  noCredentialStorage: true,
  noTokenFields: true,
  noCookieCapture: true,
  noPsaWriteback: true,
  noItDocsWriteWithoutServerAuthorization: true
};

const BASE_SECTIONS: RunbookRailV2SectionContract[] = [
  {
    sectionId: 'scope',
    label: 'Scope',
    intent: 'Confirm the mission owner, target surface, permitted scope, and close criteria before work begins.',
    required: true,
    evidencePrompt: 'Capture the approved request, mission target, owner, and expected outcome without credentials or private customer data.',
    exportHeading: 'Scope and close criteria'
  },
  {
    sectionId: 'preflight',
    label: 'Preflight',
    intent: 'Capture starting state, access readiness, dependencies, maintenance window, and known risks.',
    required: true,
    evidencePrompt: 'Pin baseline URLs, safe screenshots, diagnostics, and provider status before changing anything.',
    exportHeading: 'Preflight baseline'
  },
  {
    sectionId: 'execution',
    label: 'Execution',
    intent: 'Perform bounded operator steps with one visible owner and no silent automation.',
    required: true,
    evidencePrompt: 'Record what changed, who performed it, and which pane/provider surface was used.',
    exportHeading: 'Execution notes'
  },
  {
    sectionId: 'validation',
    label: 'Validation',
    intent: 'Prove that the expected outcome works from the relevant live target, logs, headers, DNS, or admin portal.',
    required: true,
    evidencePrompt: 'Pin smoke checks, status, headers/TLS/DNS summaries, logs, or live-target proof.',
    exportHeading: 'Validation proof'
  },
  {
    sectionId: 'rollback',
    label: 'Rollback',
    intent: 'Keep stop conditions and rollback path visible while the mission is active.',
    required: true,
    evidencePrompt: 'Record rollback trigger, rollback owner, last known-good state, and decision point.',
    exportHeading: 'Rollback and stop conditions'
  },
  {
    sectionId: 'handoff',
    label: 'Handoff',
    intent: 'Create a sanitized closeout trail for IT Docs, PSA ticket notes, internal review, or vendor support.',
    required: true,
    evidencePrompt: 'Export a sanitized handoff with remaining blockers, next owner, and redaction review.',
    exportHeading: 'Handoff and next owner'
  }
];

const TEMPLATE_OVERRIDES: Partial<Record<MissionType, Partial<RunbookRailV2Template>>> = {
  deployment: {
    objectivePrompt: 'Release a bounded change, prove production/staging health, and leave a change record.',
    stopConditionPrompt: 'Stop or roll back if CI/CD fails, health checks fail, owner approval is unclear, or production behavior diverges.',
    validationSteps: ['CI/CD run is green or failed step is documented', 'Live target smoke check passes', 'Logs and provider status show no new critical errors', 'Rollback decision recorded'],
    rollbackConditions: ['Health check fails after release', 'Error rate or visible behavior worsens', 'Wrong branch/commit/environment discovered', 'Approval/maintenance window is unclear']
  },
  incident: {
    objectivePrompt: 'Stabilize service, document impact, and preserve an incident-ready timeline.',
    stopConditionPrompt: 'Escalate if impact expands, mitigation ownership is unclear, evidence includes secrets, or customer-facing updates are overdue.',
    validationSteps: ['Impact and severity captured', 'Mitigation owner assigned', 'Recovery signal validated', 'Next update time recorded'],
    rollbackConditions: ['Mitigation worsens impact', 'Root cause unknown and risk remains high', 'Provider status or dependency signal contradicts assumption']
  },
  migration: {
    objectivePrompt: 'Move a bounded system, DNS, identity, provider, or documentation surface with before/after proof.',
    stopConditionPrompt: 'Stop or roll back if target state cannot be validated, DNS/TLS/auth fails, or source backup/export is missing.',
    validationSteps: ['Source and target state captured', 'Target path works after change', 'DNS/TLS/auth behavior validated where applicable', 'Before/after evidence pinned'],
    rollbackConditions: ['Target service unreachable', 'Authentication/identity path breaks', 'DNS or TLS validation fails', 'Backup/export reference unavailable']
  },
  admin: {
    objectivePrompt: 'Complete an authorized admin change with minimal blast radius and clear validation.',
    stopConditionPrompt: 'Stop if admin scope, affected users, rollback owner, or approval is unclear.',
    validationSteps: ['Authorized scope confirmed', 'Affected service/user behavior validated', 'Admin portal final state captured', 'Closeout owner recorded'],
    rollbackConditions: ['Unauthorized or unexpected scope detected', 'Affected user/service behavior fails', 'Policy conflict appears']
  },
  support: {
    objectivePrompt: 'Collect enough safe context to resolve or hand off a support case without leaking secrets.',
    stopConditionPrompt: 'Stop if logs/screenshots contain credentials, private keys, cookies, tokens, or unsupported customer data.',
    validationSteps: ['Repro or symptom captured', 'Safe diagnostics collected', 'Requested outcome documented', 'Next owner/action recorded'],
    rollbackConditions: ['Evidence contains secret-like material', 'Support scope expands beyond authorization', 'Vendor handoff lacks safe reproduction steps']
  },
  documentation: {
    objectivePrompt: 'Turn current operational knowledge into a safe, reviewable runbook or handoff article.',
    stopConditionPrompt: 'Stop if source material includes secrets, private customer data, copied credentials, or unverified claims.',
    validationSteps: ['Source references captured', 'Sensitive terms reviewed', 'Owner/reviewer identified', 'Publish/stage path recorded'],
    rollbackConditions: ['Unverified procedure would be published', 'Secret-bearing screenshot or token appears', 'Owner/reviewer is missing']
  },
  audit: {
    objectivePrompt: 'Capture a reviewable, non-secret evidence trail for a bounded audit surface.',
    stopConditionPrompt: 'Stop if evidence scope is unclear, private data appears, or requested proof exceeds authorization.',
    validationSteps: ['Audit scope captured', 'Evidence list complete', 'Sensitive values redacted', 'Gaps/blockers recorded'],
    rollbackConditions: ['Audit request exceeds approved scope', 'Evidence contains secrets', 'Object access cannot be verified']
  },
  'security-review': {
    objectivePrompt: 'Review a bounded security/admin surface without collecting credentials or secrets.',
    stopConditionPrompt: 'Stop if private keys, tokens, cookies, copied secrets, or unauthorized systems appear.',
    validationSteps: ['Scope and authorization captured', 'Risk findings summarized', 'Sensitive evidence redacted', 'Remediation owner recorded'],
    rollbackConditions: ['Unauthorized surface discovered', 'Secret-like evidence appears', 'Change request becomes incident response']
  },
  development: {
    objectivePrompt: 'Investigate, fix, or validate a development workflow with traceable evidence.',
    stopConditionPrompt: 'Stop if the change target, repository, branch, test state, or rollback path is unclear.',
    validationSteps: ['Source context captured', 'Expected behavior defined', 'Fix/workaround validated', 'Next action recorded'],
    rollbackConditions: ['Wrong branch/repo/environment discovered', 'Validation fails', 'Release blocker remains unresolved']
  }
};

const DEFAULT_TEMPLATE: RunbookRailV2Template = {
  missionType: 'default',
  objectivePrompt: 'Define the operational outcome, prove it safely, and leave a sanitized handoff trail.',
  stopConditionPrompt: 'Stop, roll back, or escalate if validation fails, permissions are unclear, or secret-bearing material appears.',
  sections: BASE_SECTIONS,
  validationSteps: ['Starting state captured', 'Work step completed or blocker recorded', 'Expected result validated', 'Evidence/export reviewed for redaction'],
  rollbackConditions: ['Permissions or scope are unclear', 'Validation fails', 'Secret-bearing material appears', 'Operator cannot identify rollback owner'],
  blockedItems: ['No active blocker recorded'],
  operatorTimestampLabels: ['Started', 'Change applied', 'Validation complete', 'Handoff exported']
};

export function runbookRailV2TemplateForMissionType(type: MissionType): RunbookRailV2Template {
  const override = TEMPLATE_OVERRIDES[type] || {};
  return {
    ...DEFAULT_TEMPLATE,
    ...override,
    missionType: type,
    sections: BASE_SECTIONS.map((section) => ({ ...section })),
    validationSteps: override.validationSteps ? [...override.validationSteps] : [...DEFAULT_TEMPLATE.validationSteps],
    rollbackConditions: override.rollbackConditions ? [...override.rollbackConditions] : [...DEFAULT_TEMPLATE.rollbackConditions],
    blockedItems: override.blockedItems ? [...override.blockedItems] : [...DEFAULT_TEMPLATE.blockedItems],
    operatorTimestampLabels: override.operatorTimestampLabels ? [...override.operatorTimestampLabels] : [...DEFAULT_TEMPLATE.operatorTimestampLabels]
  };
}

export function runbookRailV2ExportHeadings(): string[] {
  return BASE_SECTIONS.map((section) => section.exportHeading);
}

export function runbookRailV2StateLabel(state: MissionRunbookStepState): string {
  if (state === 'todo') return 'Todo';
  if (state === 'doing') return 'Doing';
  if (state === 'done') return 'Done';
  return 'Blocked';
}

export function runbookRailV2Diagnostics(runbook?: MissionRunbook): RunbookRailV2Diagnostics {
  const steps = runbook?.steps || [];
  const validationSteps = runbook?.validationSteps || [];
  const rollbackConditions = runbook?.rollbackConditions || [];
  const blockedItems = runbook?.blockedItems || [];
  const operatorTimestamps = runbook?.operatorTimestamps || [];
  const doneCount = steps.filter((step) => step.state === 'done').length + validationSteps.filter((step) => step.state === 'done').length;
  const blockedCount = steps.filter((step) => step.state === 'blocked').length + validationSteps.filter((step) => step.state === 'blocked').length + blockedItems.filter((item) => item.status !== 'resolved').length;
  const sectionCount = runbook?.sections?.length || BASE_SECTIONS.length;
  const exportReady = Boolean(runbook && steps.length > 0 && validationSteps.length > 0 && blockedCount === 0);
  return {
    sectionCount,
    checklistCount: steps.length,
    validationStepCount: validationSteps.length,
    rollbackConditionCount: rollbackConditions.length,
    blockedItemCount: blockedItems.length,
    operatorTimestampCount: operatorTimestamps.length,
    doneCount,
    blockedCount,
    exportReady,
    diagnosticsLabel: `${sectionCount} sections · ${steps.length} checklist · ${validationSteps.length} validation · ${rollbackConditions.length} rollback · ${blockedCount} blocker(s)`
  };
}

export function runbookRailV2DiagnosticsSummary(runbook?: MissionRunbook): string {
  const diagnostics = runbookRailV2Diagnostics(runbook);
  return `${RUNBOOK_RAIL_V2_CONTRACT_ID}: ${diagnostics.diagnosticsLabel} · export ${diagnostics.exportReady ? 'ready' : 'needs review'} · local-only=${RUNBOOK_RAIL_V2_GUARDRAILS.localOnly}`;
}
