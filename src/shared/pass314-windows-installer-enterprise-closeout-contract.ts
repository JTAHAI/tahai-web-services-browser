// PASS314 — Windows Installer Enterprise Closeout
// Browser-side enterprise reliability contract.
// Generated as source overlay only; no installers, secrets, runtime profiles, certs, or Store credentials.

export const PASS314_WINDOWS_INSTALLER_ENTERPRISE_CLOSEOUT_PASS = true as const;

export const pass314BrandAccent = {
  token: 'navLinkBrowser',
  value: 'rgba(96, 255, 218, 0.92)',
} as const;

export const pass314Scope = {
  pass: 'PASS314',
  title: 'Windows Installer Enterprise Closeout',
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
    "MSI/NSIS install",
    "upgrade",
    "uninstall",
    "shortcuts",
    "icons",
    "Start menu",
    "taskbar",
    "version truth",
    "user data retention",
    "no Electron branding leak",
    "installed smoke evidence template"
],
} as const;

export function assertPass314ReleaseTruth() {
  return {
    pass: 'PASS314',
    storePosture: 'not-submitted-not-approved',
    signedReleaseClaim: false,
    gaReleaseClaim: false,
    browserSideOnly: true,
    brandAccent: pass314BrandAccent,
  } as const;
}
