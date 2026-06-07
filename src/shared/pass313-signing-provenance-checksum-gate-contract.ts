// PASS313 — Signing / Provenance / Checksum Gate
// Browser-side enterprise reliability contract.
// Generated as source overlay only; no installers, secrets, runtime profiles, certs, or Store credentials.

export const PASS313_SIGNING_PROVENANCE_CHECKSUM_GATE_PASS = true as const;

export const pass313BrandAccent = {
  token: 'navLinkBrowser',
  value: 'rgba(96, 255, 218, 0.92)',
} as const;

export const pass313Scope = {
  pass: 'PASS313',
  title: 'Signing / Provenance / Checksum Gate',
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
    "release manifest",
    "source commit",
    "package hashes",
    "signing status",
    "unsigned-preview disclosure",
    "future SignPath packet",
    "no signed-release claim"
],
} as const;

export function assertPass313ReleaseTruth() {
  return {
    pass: 'PASS313',
    storePosture: 'not-submitted-not-approved',
    signedReleaseClaim: false,
    gaReleaseClaim: false,
    browserSideOnly: true,
    brandAccent: pass313BrandAccent,
  } as const;
}
