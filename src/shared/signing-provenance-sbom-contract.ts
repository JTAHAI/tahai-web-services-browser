export const SIGNING_PROVENANCE_SBOM_PASS = 'PASS159' as const;
export const SIGNING_PROVENANCE_SBOM_CONTRACT_ID = 'enterprise-signing-provenance-sbom-v1' as const;
export const SIGNING_PROVENANCE_SBOM_SCHEMA_VERSION = 1 as const;

export type ReleaseArtifactKind = 'windows-exe' | 'windows-msi' | 'linux-appimage' | 'linux-deb' | 'linux-rpm' | 'source-zip' | 'sbom' | 'provenance-manifest';
export type ReleaseSignatureState = 'unsigned-preview' | 'signed' | 'not-applicable';
export type ReleaseProvenanceState = 'source-only-plan' | 'generated-after-packaging' | 'verified-for-public-release';

export interface SigningProvenanceArtifactRequirement {
  readonly kind: ReleaseArtifactKind;
  readonly path: string;
  readonly requiredSha256: true;
  readonly requiredSignatureState: ReleaseSignatureState;
  readonly publishBesideArtifact: boolean;
}

export interface SigningProvenanceSbomContract {
  readonly pass: typeof SIGNING_PROVENANCE_SBOM_PASS;
  readonly contractId: typeof SIGNING_PROVENANCE_SBOM_CONTRACT_ID;
  readonly schemaVersion: typeof SIGNING_PROVENANCE_SBOM_SCHEMA_VERSION;
  readonly sourceOnlyVerifier: true;
  readonly storesSecrets: false;
  readonly commitsGeneratedArtifacts: false;
  readonly directPsaApiAllowed: false;
  readonly noFalseSigningClaim: true;
  readonly requiresPublicCommitOrTag: true;
  readonly requiresLockfileHash: true;
  readonly requiresSbom: true;
  readonly requiresSha256Sums: true;
  readonly requiresArtifactManifests: true;
  readonly requiresProvenanceManifest: true;
  readonly requiresInstallerSmokeEvidenceBeforeEnterpriseGA: true;
  readonly requiredCommands: readonly string[];
  readonly requiredArtifacts: readonly SigningProvenanceArtifactRequirement[];
}

export const SIGNING_PROVENANCE_ARTIFACT_REQUIREMENTS: readonly SigningProvenanceArtifactRequirement[] = [
  {
    kind: 'windows-exe',
    path: 'release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe',
    requiredSha256: true,
    requiredSignatureState: 'unsigned-preview',
    publishBesideArtifact: true
  },
  {
    kind: 'windows-msi',
    path: 'release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi',
    requiredSha256: true,
    requiredSignatureState: 'unsigned-preview',
    publishBesideArtifact: true
  },
  {
    kind: 'linux-appimage',
    path: 'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
    requiredSha256: true,
    requiredSignatureState: 'not-applicable',
    publishBesideArtifact: true
  },
  {
    kind: 'linux-deb',
    path: 'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb',
    requiredSha256: true,
    requiredSignatureState: 'not-applicable',
    publishBesideArtifact: true
  },
  {
    kind: 'linux-rpm',
    path: 'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
    requiredSha256: true,
    requiredSignatureState: 'not-applicable',
    publishBesideArtifact: true
  },
  {
    kind: 'sbom',
    path: 'artifacts/sbom/tahai-browser-sbom.json',
    requiredSha256: true,
    requiredSignatureState: 'not-applicable',
    publishBesideArtifact: true
  },
  {
    kind: 'provenance-manifest',
    path: 'artifacts/provenance/tahai-browser-release-provenance.json',
    requiredSha256: true,
    requiredSignatureState: 'not-applicable',
    publishBesideArtifact: true
  }
] as const;

export const SIGNING_PROVENANCE_SBOM_CONTRACT: SigningProvenanceSbomContract = {
  pass: SIGNING_PROVENANCE_SBOM_PASS,
  contractId: SIGNING_PROVENANCE_SBOM_CONTRACT_ID,
  schemaVersion: SIGNING_PROVENANCE_SBOM_SCHEMA_VERSION,
  sourceOnlyVerifier: true,
  storesSecrets: false,
  commitsGeneratedArtifacts: false,
  directPsaApiAllowed: false,
  noFalseSigningClaim: true,
  requiresPublicCommitOrTag: true,
  requiresLockfileHash: true,
  requiresSbom: true,
  requiresSha256Sums: true,
  requiresArtifactManifests: true,
  requiresProvenanceManifest: true,
  requiresInstallerSmokeEvidenceBeforeEnterpriseGA: true,
  requiredCommands: [
    'npm run verify:release-blockers',
    'npm run generate:sbom',
    'npm run release:provenance:plan',
    'npm run verify:pass-159-enterprise-signing-provenance-sbom',
    'npm run package:win:release',
    'npm run package:linux',
    'npm run release:public:manifest'
  ],
  requiredArtifacts: SIGNING_PROVENANCE_ARTIFACT_REQUIREMENTS
};

export function signingProvenanceSbomSummary() {
  return {
    pass: SIGNING_PROVENANCE_SBOM_CONTRACT.pass,
    contractId: SIGNING_PROVENANCE_SBOM_CONTRACT.contractId,
    schemaVersion: SIGNING_PROVENANCE_SBOM_CONTRACT.schemaVersion,
    artifactCount: SIGNING_PROVENANCE_SBOM_CONTRACT.requiredArtifacts.length,
    sourceOnlyVerifier: SIGNING_PROVENANCE_SBOM_CONTRACT.sourceOnlyVerifier,
    noFalseSigningClaim: SIGNING_PROVENANCE_SBOM_CONTRACT.noFalseSigningClaim,
    requiresInstallerSmokeEvidenceBeforeEnterpriseGA: SIGNING_PROVENANCE_SBOM_CONTRACT.requiresInstallerSmokeEvidenceBeforeEnterpriseGA
  };
}
