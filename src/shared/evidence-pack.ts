import type { MissionEvidenceExportProfile, MissionState } from './mission-types';
import { evidenceMarkdownCell, sanitizeEvidenceMarkdown, sanitizeEvidenceUrl } from './evidence-safety';
import { scanAndRedact } from './redaction';

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

export function buildMissionEvidencePack(mission: MissionState, options: MissionEvidencePackOptions = {}): MissionEvidencePack {
  const profile = options.profile || 'sanitized-handoff';
  const includeTimeline = options.includeTimeline !== false;
  const includeRunbook = options.includeRunbook !== false;
  const includeEvidence = options.includeEvidence !== false;
  const profileRules = PROFILE_RULES[profile] || PROFILE_RULES['sanitized-handoff'];
  const label = PROFILE_LABELS[profile] || PROFILE_LABELS['sanitized-handoff'];
  const tabs = mission.tabs.map((tab) => ({ role: tab.role, title: tab.title, url: safeUrl(tab.url, profile), pane: tab.paneId }));
  const evidence = includeEvidence ? mission.evidence.map((entry, index) => ({ ref: `EV-${String(index + 1).padStart(2, '0')}`, kind: entry.kind, title: entry.title, url: safeUrl(entry.url, profile), note: entry.operatorNote })) : [];
  const timeline = includeTimeline ? mission.timeline.map((entry) => ({ time: entry.createdAt, kind: entry.kind, title: entry.title, detail: entry.detail })) : [];
  const runbookRows = includeRunbook ? mission.runbook.steps.map((step, index) => ({ step: String(index + 1), state: step.state, label: step.label, evidence: step.evidenceNote })) : [];
  const markdown = `# ${md(label)} — ${md(mission.name)}\n\n` +
`> Browser-side local evidence packet. This export is generated from explicit Mission Control state only: mission tabs, runbook steps, local notes, pinned evidence entries, and mission timeline metadata. It does not collect cookies, browser storage values, credentials, provider tokens, OAuth refresh tokens, request bodies, response bodies, local files, or form values. IT Docs and PSA writeback remain server-authorized contracts outside this open-source browser repo.\n\n` +
`## Export profile\n\n| Field | Value |\n| --- | --- |\n| Profile | ${md(label)} |\n| Mission ID | ${md(mission.missionId)} |\n| Mission type | ${md(mission.missionType)} |\n| Mission mode | ${md(mission.mode)} |\n| Updated | ${md(mission.updatedAt)} |\n| IT Docs link | ${md(safeUrl(mission.links.itDocs?.deepLink || '', profile) || 'none', profile)} |\n| PSA link | ${md(safeUrl(mission.links.psa?.ticketDeepLink || '', profile) || 'none', profile)} |\n\n` +
`### Profile rules\n\n${bullet(profileRules)}\n\n` +
`## Review checklist\n\n- [ ] Redaction preview reviewed\n- [ ] No cookies, authorization headers, tokens, passwords, private keys, or copied cloud secrets included\n- [ ] IT Docs org/project/runbook authorization confirmed before sync\n- [ ] PSA writeback routed only through IT Docs server-side connector when available\n\n` +
`## Mission tabs\n\n| Role | Title | URL | Pane |\n| --- | --- | --- | --- |\n${rows(tabs, ['role', 'title', 'url', 'pane'])}\n\n` +
(includeRunbook ? `## Runbook\n\nObjective: ${md(mission.runbook.objective || '')}\n\nRollback: ${md(mission.runbook.rollback || '')}\n\n| Step | State | Label | Evidence note |\n| ---: | --- | --- | --- |\n${rows(runbookRows, ['step', 'state', 'label', 'evidence'])}\n\n` : '') +
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
    findingCount: Math.max(scan.findingCount, finalScan.findings.length),
    highRiskCount: Math.max(scan.highRiskCount, finalScan.highRiskCount)
  };
}
