// PASS315 — Linux Package Enterprise Closeout
// Browser-side enterprise reliability contract.
// Generated as source overlay only; no installers, secrets, runtime profiles, certs, or Store credentials.

export const PASS315_LINUX_PACKAGE_ENTERPRISE_CLOSEOUT_PASS = true as const;

export const pass315BrandAccent = {
  token: 'navLinkBrowser',
  value: 'rgba(96, 255, 218, 0.92)',
} as const;

export const pass315Scope = {
  pass: 'PASS315',
  title: 'Linux Package Enterprise Closeout',
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
    "AppImage",
    "RPM",
    "DEB",
    "desktop file",
    "icon",
    "metadata",
    "launch",
    "uninstall/remove docs",
    "checksum docs",
    "no unsupported signing claim"
],
} as const;

export function assertPass315ReleaseTruth() {
  return {
    pass: 'PASS315',
    storePosture: 'not-submitted-not-approved',
    signedReleaseClaim: false,
    gaReleaseClaim: false,
    browserSideOnly: true,
    brandAccent: pass315BrandAccent,
  } as const;
}
