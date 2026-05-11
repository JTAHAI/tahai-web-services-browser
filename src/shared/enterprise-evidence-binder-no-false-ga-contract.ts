export const ENTERPRISE_EVIDENCE_BINDER_PASS = 'PASS152' as const;
export const ENTERPRISE_EVIDENCE_BINDER_STATUS = 'enterprise-evidence-binder-no-false-ga' as const;
export const ENTERPRISE_EVIDENCE_BINDER_VERSION = '1.8.30' as const;

export const ENTERPRISE_EVIDENCE_BINDER_REQUIRED_SOURCE_GATES = Object.freeze([
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
  'verify:pass-152-enterprise-evidence-binder'
] as const);

export const ENTERPRISE_EVIDENCE_BINDER_REQUIRED_INSTALLED_EVIDENCE = Object.freeze([
  'Windows installed-app smoke evidence',
  'Linux installed-package smoke evidence',
  'cross-size responsive regression evidence',
  'titlebar drag-region manual smoke evidence',
  'package checksum and handoff manifests'
] as const);

export const ENTERPRISE_EVIDENCE_BINDER_FALSE_GA_CLAIMS = Object.freeze([
  'enterprise GA approved',
  'production GA approved',
  'fully enterprise released',
  'signed enterprise GA package available'
] as const);

export function enterpriseEvidenceBinderSummary(): string[] {
  return [
    `pass=${ENTERPRISE_EVIDENCE_BINDER_PASS}`,
    `status=${ENTERPRISE_EVIDENCE_BINDER_STATUS}`,
    `version=${ENTERPRISE_EVIDENCE_BINDER_VERSION}`,
    'rule=no enterprise GA claim without installed package and manual evidence',
    `requiredEvidence=${ENTERPRISE_EVIDENCE_BINDER_REQUIRED_INSTALLED_EVIDENCE.join('; ')}`
  ];
}
