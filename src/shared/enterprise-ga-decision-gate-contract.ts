import { ENTERPRISE_EVIDENCE_BINDER_REQUIRED_INSTALLED_EVIDENCE } from './enterprise-evidence-binder-no-false-ga-contract';
import { TAHAI_RELEASE_VERSION } from './release-truth';

export const ENTERPRISE_GA_DECISION_GATE_PASS = 'PASS162' as const;
export const ENTERPRISE_GA_DECISION_GATE_CONTRACT_ID = 'enterprise-ga-decision-gate-v1' as const;
export const ENTERPRISE_GA_DECISION_GATE_SCHEMA_VERSION = 1 as const;
export const ENTERPRISE_GA_DECISION_GATE_VERSION = TAHAI_RELEASE_VERSION;
export const ENTERPRISE_GA_DECISION_GATE_STATUS = 'blocked-pending-external-evidence' as const;

export const ENTERPRISE_GA_REQUIRED_SOURCE_GATES = Object.freeze([
  'verify:pass-159-enterprise-signing-provenance-sbom',
  'verify:pass-162-enterprise-ga-decision-gate',
  'verify:pass-247-windows-store-msix-readiness',
  'verify:pass-248-msix-local-blocker-repair',
  'verify:pass-249-msix-winappcli-npm-invocation-repair',
  'verify:pass-250-store-submission-evidence-identity-prep',
  'verify:pass-337-cursor-root-cause-closeout',
  'verify:pass-338-cursor-runtime-root-cause-closeout',
  'verify:pass-339-normal-browsing-input-paint-closeout',
  'verify:pass-340-chrome-input-hittest-closeout',
  'verify:pass-341-normal-browser-and-feature-clickability-closeout',
  'test:runtime-e2e',
] as const);

export const ENTERPRISE_GA_REQUIRED_DECISION_DOMAINS = Object.freeze([
  'source-and-build-gates',
  'windows-package-install-smoke',
  'linux-package-install-smoke',
  'manual-cross-size-qa-attestation',
  'enterprise-policy-management',
  'electron-webview-ipc-security',
  'mission-evidence-redaction',
  'runtime-e2e-harness',
  'signing-provenance-sbom',
  'support-bundle-redaction',
] as const);

export const ENTERPRISE_GA_REQUIRED_EXTERNAL_EVIDENCE = Object.freeze([
  ...ENTERPRISE_EVIDENCE_BINDER_REQUIRED_INSTALLED_EVIDENCE,
  'runtime E2E harness run evidence from packaged app',
  'enterprise admin policy lock/unlock manual evidence',
  'signed package or explicit unsigned-preview approval record',
  'SBOM and provenance artifact checksum record',
  'support bundle redaction review evidence',
  'manual GA decision signoff record',
] as const);

export const ENTERPRISE_GA_BLOCKED_CLAIMS = Object.freeze([
  'enterprise GA approved',
  'production GA approved',
  'ready for unrestricted enterprise deployment',
  'all installed-app evidence complete',
  'signed enterprise package available',
] as const);

export type EnterpriseGaDecisionStatus = 'blocked-pending-external-evidence' | 'approved-after-manual-attestation';

export type EnterpriseGaDecisionGate = {
  pass: typeof ENTERPRISE_GA_DECISION_GATE_PASS;
  contractId: typeof ENTERPRISE_GA_DECISION_GATE_CONTRACT_ID;
  schemaVersion: typeof ENTERPRISE_GA_DECISION_GATE_SCHEMA_VERSION;
  version: typeof ENTERPRISE_GA_DECISION_GATE_VERSION;
  status: EnterpriseGaDecisionStatus;
  requiredSourceGates: readonly string[];
  requiredDecisionDomains: readonly string[];
  requiredExternalEvidence: readonly string[];
  falseGaClaimsBlocked: readonly string[];
};

export function enterpriseGaDecisionGate(): EnterpriseGaDecisionGate {
  return {
    pass: ENTERPRISE_GA_DECISION_GATE_PASS,
    contractId: ENTERPRISE_GA_DECISION_GATE_CONTRACT_ID,
    schemaVersion: ENTERPRISE_GA_DECISION_GATE_SCHEMA_VERSION,
    version: ENTERPRISE_GA_DECISION_GATE_VERSION,
    status: ENTERPRISE_GA_DECISION_GATE_STATUS,
    requiredSourceGates: ENTERPRISE_GA_REQUIRED_SOURCE_GATES,
    requiredDecisionDomains: ENTERPRISE_GA_REQUIRED_DECISION_DOMAINS,
    requiredExternalEvidence: ENTERPRISE_GA_REQUIRED_EXTERNAL_EVIDENCE,
    falseGaClaimsBlocked: ENTERPRISE_GA_BLOCKED_CLAIMS,
  };
}

export function enterpriseGaDecisionSummary(): string[] {
  const gate = enterpriseGaDecisionGate();
  return [
    `pass=${gate.pass}`,
    `contract=${gate.contractId}`,
    `version=${gate.version}`,
    `status=${gate.status}`,
    `decisionDomains=${gate.requiredDecisionDomains.join('; ')}`,
    `externalEvidenceRequired=${gate.requiredExternalEvidence.join('; ')}`,
    'rule=no enterprise GA claim without package, install, security, policy, provenance, evidence, support-bundle, and manual attestation proof',
  ];
}
