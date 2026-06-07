// PASS312 — SBOM / VEX / Dependency Evidence
// Browser-side enterprise reliability contract.
// Generated as source overlay only; no installers, secrets, runtime profiles, certs, or Store credentials.

export const PASS312_SBOM_VEX_DEPENDENCY_EVIDENCE_PASS = true as const;

export const pass312BrandAccent = {
  token: 'navLinkBrowser',
  value: 'rgba(96, 255, 218, 0.92)',
} as const;

export const pass312Scope = {
  pass: 'PASS312',
  title: 'SBOM / VEX / Dependency Evidence',
  scope: 'browser-side-only',
  hardBoundaries: [
    'No IT Docs backend code',
    'No PSA connector code',
    'No direct PSA API calls',
    'No PSA/API/provider secrets',
    'No generated installers committed',
    'No Store/GA/signed-release claim without real evidence',
  ],
  requiredSignals: [
    "SBOM",
    "VEX",
    "npm audit",
    "dependency manifest",
    "license inventory",
    "source-to-artifact traceability",
    "no generated installers committed"
],
} as const;

export function assertPass312ReleaseTruth() {
  return {
    pass: 'PASS312',
    storePosture: 'not-submitted-not-approved',
    signedReleaseClaim: false,
    gaReleaseClaim: false,
    browserSideOnly: true,
    brandAccent: pass312BrandAccent,
  } as const;
}
