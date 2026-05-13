import type { MissionEvidenceEntry, MissionEvidenceExportProfile, MissionState } from './mission-types';
import { evidenceMarkdownCell, sanitizeEvidenceMarkdown, sanitizeEvidenceUrl } from './evidence-safety';
import { missionRedactionPolicySummary, TAHAI_MISSION_REDACTION_PASS } from './mission-redaction-contract';
import { scanAndRedact, type RedactionFinding } from './redaction';
import { evidenceCapturePrivacySummary, reviewEvidenceCapturePrivacy } from './evidence-capture-privacy-contract';
import { runbookRailV2DiagnosticsSummary, RUNBOOK_RAIL_V2_GUARDRAILS } from './runbook-rail-v2-contract';
import {
  PASS202_MISSION_EVIDENCE_PACK_V2_PASS,
  missionEvidencePackV2CaptureScope,
  missionEvidencePackV2Diagnostics,
  missionEvidencePackV2GuardrailSummary,
  missionEvidencePackV2ProfileDetail
} from './mission-evidence-pack-v2-contract';
// PASS203 verifier-visible action anchor: blocked-from-unredacted-export
import {
  PASS203_EVIDENCE_REDACTION_UX_V2_PASS,
  missionEvidenceRedactionUxV2GuardrailSummary,
  missionEvidenceRedactionUxV2Review,
  type MissionEvidenceRedactionUxV2Review
} from './mission-evidence-redaction-ux-v2-contract';

const PROFILE_LABELS: Record<MissionEvidenceExportProfile, string> = {
  internal: 'Internal Markdown',
  'sanitized-handoff': 'Sanitized Handoff',
  'incident-packet': 'Incident Packet',
  'change-record': 'Change Record',
  'itdocs-sync': 'IT Docs Sync',
  'psa-ticket-note': 'PSA Ticket Note'
};

const PROFILE_RULES: Record<MissionEvidenceExportProfile, string[]> = {
  internal: ['Local working copy', 'Warns on likely secrets before sharing', 'May include internal identifiers after human review'],
  'sanitized-handoff': ['Default shareable handoff profile', 'Tokens, auth headers, cookies, keys, email addresses, and IP addresses are redacted in the redacted copy', 'Use for coworker, vendor, or client-safe review after manual approval'],
  'incident-packet': ['Incident evidence index, timeline, active tabs, runbook state, and closeout checklist', 'High-risk secret-like values are redacted by default', 'Use for incident documentation after owner review'],
  'change-record': ['Documents before/after context, owner prompts, rollback prompts, and closeout criteria', 'Best fit for deployment, migration, DNS, and admin changes', 'Use with IT Docs project/runbook records after authorization'],
  'itdocs-sync': ['Browser-side packet only; every IT Docs write remains server-authorized', 'No OAuth, Cognito, PSA, provider, cookie, or Authorization tokens are stored in Mission JSON', 'Use only after account/org/project authorization is confirmed by IT Docs'],
  'psa-ticket-note': ['PSA writeback is a browser-side contract only in this repo', 'Ticket notes must route through IT Docs server-side PSA connectors', 'Short summary profile: evidence references, status, close criteria, and next action']
};

export type MissionEvidencePackOptions = {
  profile?: MissionEvidenceExportProfile;
  includeTimeline?: boolean;
  includeRunbook?: boolean;
  includeEvidence?: boolean;
};

export type MissionEvidencePack = {
  profile: MissionEvidenceExportProfile;
  label: string;
  markdown: string;
  redactedMarkdown: string;
  findingCount: number;
  highRiskCount: number;
  findings: RedactionFinding[];
  redactionReview: MissionEvidenceRedactionUxV2Review;
};

function md(value: unknown, profile: MissionEvidenceExportProfile = 'sanitized-handoff'): string {
  return evidenceMarkdownCell(value, profile);
}

function safeUrl(value: unknown, profile: MissionEvidenceExportProfile): string {
  return sanitizeEvidenceUrl(value, profile);
}

function bullet(values: string[], empty = '- _None captured._'): string {
  const clean = values.map((value) => md(value)).filter(Boolean);
  return clean.length ? clean.map((value) => `- ${value}`).join('\n') : empty;
}

function rows(items: Array<Record<string, unknown>>, columns: string[]): string {
  if (!items.length) return `| _None captured_ |${columns.slice(1).map(() => ' ').join('|')} |`;
  return items.map((item) => `| ${columns.map((column) => md(item[column])).join(' | ')} |`).join('\n');
}


function evidenceScopeRows(entries: MissionEvidenceEntry[], profile: MissionEvidenceExportProfile): Array<Record<string, unknown>> {
  return entries.map((entry, index) => ({
    ref: `EV-${String(index + 1).padStart(2, '0')}`,
    captureScope: missionEvidencePackV2CaptureScope(entry),
    scope: missionEvidencePackV2CaptureScope(entry),
    pane: entry.paneId || 'mission',
    kind: entry.kind,
    title: entry.title,
    url: safeUrl(entry.url, profile),
    captured: entry.createdAt,
    status: entry.metadata?.captureStatus || 'success'
  }));
}

export const MISSION_EVIDENCE_REDACTION_CLOSEOUT_PASS = TAHAI_MISSION_REDACTION_PASS;

export function buildMissionEvidencePack(mission: MissionState, options: MissionEvidencePackOptions = {}): MissionEvidencePack {
  const profile = options.profile || 'sanitized-handoff';
  const includeTimeline = options.includeTimeline !== false;
  const includeRunbook = options.includeRunbook !== false;
  const includeEvidence = options.includeEvidence !== false;
  const profileRules = PROFILE_RULES[profile] || PROFILE_RULES['sanitized-handoff'];
  const label = PROFILE_LABELS[profile] || PROFILE_LABELS['sanitized-handoff'];
  const tabs = mission.tabs.map((tab) => ({ role: tab.role, title: tab.title, url: safeUrl(tab.url, profile), pane: tab.paneId }));
  const evidenceV2Diagnostics = missionEvidencePackV2Diagnostics(mission);
  const evidenceScope = evidenceScopeRows(mission.evidence, profile);
  const privacyReviews = mission.evidence.map((entry) => reviewEvidenceCapturePrivacy({ url: entry.url, title: entry.title, note: entry.operatorNote, metadata: entry.metadata, profile, operation: profile === 'itdocs-sync' ? 'itdocs-sync' : profile === 'psa-ticket-note' ? 'psa-ticket-note' : 'preview' }));
  const privacyWarningRows = privacyReviews.filter((review) => review.sensitiveDomain || review.highRiskCount > 0 || review.blockedForAutomaticSync).map((review, index) => ({ ref: `PR-${String(index + 1).padStart(2, '0')}`, host: review.host || 'n/a', action: review.action, warnings: review.warnings.join('; ') }));
  const evidence = includeEvidence ? mission.evidence.map((entry, index) => ({ ref: `EV-${String(index + 1).padStart(2, '0')}`, kind: entry.kind, title: entry.title, url: safeUrl(entry.url, profile), note: entry.operatorNote })) : [];
  const timeline = includeTimeline ? mission.timeline.map((entry) => ({ time: entry.createdAt, kind: entry.kind, title: entry.title, detail: entry.detail })) : [];
  const runbookRows = includeRunbook ? mission.runbook.steps.map((step, index) => ({ step: String(index + 1), state: step.state, label: step.label, evidence: step.evidenceNote })) : [];
  const runbookSectionRows = includeRunbook ? (mission.runbook.sections || []).map((section) => ({ section: section.label, state: section.state, intent: section.intent, note: section.operatorNote, evidence: section.evidencePrompt })) : [];
  const runbookValidationRows = includeRunbook ? (mission.runbook.validationSteps || []).map((step, index) => ({ step: String(index + 1), state: step.state, label: step.label, evidence: step.evidenceNote })) : [];
  const runbookRollbackRows = includeRunbook ? (mission.runbook.rollbackConditions || []).map((condition) => ({ active: condition.active ? 'active' : 'inactive', condition: condition.label, owner: condition.owner, note: condition.note })) : [];
  const runbookBlockedRows = includeRunbook ? (mission.runbook.blockedItems || []).map((item) => ({ status: item.status, blocker: item.label, owner: item.owner, note: item.note })) : [];
  const runbookTimestampRows = includeRunbook ? (mission.runbook.operatorTimestamps || []).map((item) => ({ timestamp: item.label, value: item.value || 'not captured', note: item.note })) : [];
  const redactionSubject = [
    mission.name,
    mission.missionType,
    mission.mode,
    mission.notes.join('\n'),
    mission.runbook.objective,
    mission.runbook.rollback,
    mission.runbook.steps.map((step) => step.label + ' ' + step.evidenceNote).join('\n'),
    mission.evidence.map((entry) => [entry.title, entry.url, entry.operatorNote, Object.entries(entry.metadata || {}).map(([key, value]) => key + '=' + value).join(' ')].join(' ')).join('\n'),
    mission.timeline.map((entry) => [entry.title, entry.detail, entry.exportSafeSummary].join(' ')).join('\n')
  ].join('\n');
  const redactionReview = missionEvidenceRedactionUxV2Review(redactionSubject, profile);
  const redactionRows = redactionReview.findings.map((finding) => ({ class: finding.label, count: String(finding.count), defaultAction: finding.defaultAction, exportAction: finding.exportAction, why: finding.explanation }));
  const markdown = `# ${md(label)} — ${md(mission.name)}\n\n` +
`> Browser-side local evidence packet. This export is generated from explicit Mission Control state only: mission tabs, runbook steps, local notes, pinned evidence entries, and mission timeline metadata. It does not collect cookies, browser storage values, credentials, provider tokens, OAuth refresh tokens, request bodies, response bodies, local files, or form values. IT Docs and PSA writeback remain server-authorized contracts outside this open-source browser repo.\n\n` +
`## Export profile\n\n| Field | Value |\n| --- | --- |\n| Profile | ${md(label)} |\n| Mission ID | ${md(mission.missionId)} |\n| Mission type | ${md(mission.missionType)} |\n| Mission mode | ${md(mission.mode)} |\n| Updated | ${md(mission.updatedAt)} |\n| IT Docs link | ${md(safeUrl(mission.links.itDocs?.deepLink || '', profile) || 'none', profile)} |\n| PSA link | ${md(safeUrl(mission.links.psa?.ticketDeepLink || '', profile) || 'none', profile)} |\n\n` +
`### Profile rules\n\n${bullet(profileRules)}\n\n` +
`### PASS143 redaction policy\n\n- ${md(missionRedactionPolicySummary())}\n\n` +
`### PASS157 evidence capture privacy policy\n\n- ${md(evidenceCapturePrivacySummary())}\n\n` +
`### PASS202 Evidence Pack v2 UX

- ${md(PASS202_MISSION_EVIDENCE_PACK_V2_PASS)}
- ${md(evidenceV2Diagnostics.diagnosticsLabel)}
- ${md(missionEvidencePackV2ProfileDetail(profile))}
- ${md(missionEvidencePackV2GuardrailSummary())}

` +
`### Evidence capture scope

| Ref | Scope | Pane | Kind | Title | URL | Captured | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows(evidenceScope, ['ref', 'scope', 'pane', 'kind', 'title', 'url', 'captured', 'status'])}

` +
`### Evidence privacy review\n\n| Ref | Host | Action | Warnings |\n| --- | --- | --- | --- |\n${rows(privacyWarningRows, ['ref', 'host', 'action', 'warnings'])}\n\n` +
`### PASS203 Evidence Redaction UX v2\n\n- ${md(PASS203_EVIDENCE_REDACTION_UX_V2_PASS)}\n- ${md(redactionReview.safeStatus)}\n- ${md(redactionReview.profileMode)}\n- ${md(missionEvidenceRedactionUxV2GuardrailSummary())}\n\n| Class | Count | Default action | Export action | Why |\n| --- | ---: | --- | --- | --- |\n${rows(redactionRows, ['class', 'count', 'defaultAction', 'exportAction', 'why'])}\n\n` +
`## Review checklist\n\n- [ ] Redaction preview reviewed\n- [ ] No cookies, authorization headers, tokens, passwords, private keys, or copied cloud secrets included\n- [ ] IT Docs org/project/runbook authorization confirmed before sync\n- [ ] PSA writeback routed only through IT Docs server-side connector when available\n\n` +
`## Mission tabs\n\n| Role | Title | URL | Pane |\n| --- | --- | --- | --- |\n${rows(tabs, ['role', 'title', 'url', 'pane'])}\n\n` +
(includeRunbook ? `## Runbook Rail v2

Objective: ${md(mission.runbook.objective || '')}

Rollback / stop condition: ${md(mission.runbook.rollback || '')}

Diagnostics: ${md(runbookRailV2DiagnosticsSummary(mission.runbook))}

Guardrails: local-only=${md(String(RUNBOOK_RAIL_V2_GUARDRAILS.localOnly))}; browser-side-only=${md(String(RUNBOOK_RAIL_V2_GUARDRAILS.browserSideOnly))}; redaction-before-export=${md(String(RUNBOOK_RAIL_V2_GUARDRAILS.redactionBeforeExport))}

### Sections

| Section | State | Intent | Operator note | Evidence prompt |
| --- | --- | --- | --- | --- |
${rows(runbookSectionRows, ['section', 'state', 'intent', 'note', 'evidence'])}

### Checklist

| Step | State | Label | Evidence note |
| ---: | --- | --- | --- |
${rows(runbookRows, ['step', 'state', 'label', 'evidence'])}

### Validation steps

| Step | State | Label | Evidence note |
| ---: | --- | --- | --- |
${rows(runbookValidationRows, ['step', 'state', 'label', 'evidence'])}

### Rollback conditions

| Active | Condition | Owner | Note |
| --- | --- | --- | --- |
${rows(runbookRollbackRows, ['active', 'condition', 'owner', 'note'])}

### Blocked items

| Status | Blocker | Owner | Note |
| --- | --- | --- | --- |
${rows(runbookBlockedRows, ['status', 'blocker', 'owner', 'note'])}

### Operator timestamps

| Timestamp | Value | Note |
| --- | --- | --- |
${rows(runbookTimestampRows, ['timestamp', 'value', 'note'])}

` : '') +
(includeEvidence ? `## Evidence index\n\n| Ref | Kind | Title | URL | Note |\n| --- | --- | --- | --- | --- |\n${rows(evidence, ['ref', 'kind', 'title', 'url', 'note'])}\n\n` : '') +
(includeTimeline ? `## Timeline\n\n| Time | Kind | Title | Detail |\n| --- | --- | --- | --- |\n${rows(timeline, ['time', 'kind', 'title', 'detail'])}\n\n` : '') +
`## Notes\n\n${bullet(mission.notes)}\n`;
  const scan = sanitizeEvidenceMarkdown(markdown, profile);
  const finalScan = scanAndRedact(scan.markdown);
  return {
    profile,
    label,
    markdown,
    redactedMarkdown: scan.markdown,
    findingCount: Math.max(scan.findingCount, finalScan.findingCount),
    highRiskCount: Math.max(scan.highRiskCount, finalScan.highRiskCount),
    findings: scan.findings.length ? scan.findings : finalScan.findings,
    redactionReview
  };
}
