export const ENTERPRISE_ALL_SURFACES_GATE_PASS = 'PASS151';
export const ENTERPRISE_ALL_SURFACES_GATE_STATUS = 'enterprise-all-surfaces-release-grade';
export const ENTERPRISE_ALL_SURFACES_RELEASE_VERSION = '1.8.30';
export const ENTERPRISE_ALL_SURFACES_BASE_RELEASE_PASS = 'PASS150';
export const ENTERPRISE_ALL_SURFACES_RELEASE_CHANNEL = 'public-rc';

export const ENTERPRISE_ALL_SURFACES_REQUIRED_SOURCE_GATES = [
  'verify:public-repo',
  'verify:mission-tabs-security',
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-139-linux-package-handoff-closeout',
  'verify:pass-140-download-install-checksum-ux',
  'verify:pass-141-version-about-update-channel-truth',
  'verify:pass-142-electron-security-final-audit',
  'verify:pass-143-mission-redaction-closeout',
  'verify:pass-144-public-repo-supply-chain',
  'verify:pass-145-privacy-support-known-issues',
  'verify:pass-146-windows-installed-smoke',
  'verify:pass-147-linux-installed-smoke',
  'verify:pass-148-cross-size-responsive-regression',
  'verify:pass-149-rc1-freeze',
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
] as const;

export const ENTERPRISE_ALL_SURFACES_REQUIRED_MANUAL_EVIDENCE_RUNNERS = [
  'evidence:windows-installed-smoke',
  'evidence:linux-installed-smoke',
  'evidence:cross-size-regression',
  'evidence:enterprise-all-surfaces',
] as const;

export const ENTERPRISE_ALL_SURFACES_REQUIRED_PACKAGE_HANDOFFS = [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
] as const;

export const ENTERPRISE_ALL_SURFACES_REQUIRED_MANUAL_EVIDENCE = [
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
] as const;

export const ENTERPRISE_ALL_SURFACES_CRITICAL_SURFACES = [
  'normal-browser-shell',
  'tabs-titlebar-chrome-and-full-empty-titlebar-drag-region',
  'native-caption-controls',
  'address-navigation-back-forward-reload-active-pane-routing',
  'mission-control-one-up-two-up-triview-quad-focus',
  'guide-kb-more-tools-overflow-and-small-window-entry',
  'runbook-rail-and-command-center',
  'evidence-pack-redaction-export-and-mission-file-boundary',
  'electron-ipc-webview-external-open-security-boundaries',
  'windows-nsis-msi-installer-handoff-and-checksums',
  'linux-rpm-deb-appimage-handoff-and-checksums',
  'download-install-docs-and-checksum-ux',
  'about-version-update-channel-release-truth',
  'privacy-support-known-issues-truth',
  'public-repo-supply-chain-and-generated-artifact-hygiene',
  'windows-installed-app-smoke-evidence',
  'linux-installed-package-smoke-evidence',
  'cross-size-responsive-manual-regression-evidence',
] as const;

export const ENTERPRISE_ALL_SURFACES_RELEASE_BLOCKERS = [
  'missing-source-gate',
  'missing-pass138-windows-installer-closeout',
  'missing-package-handoff-manifest-after-packaging',
  'missing-checksum-file-after-packaging',
  'missing-installed-windows-smoke-evidence',
  'missing-installed-linux-smoke-evidence',
  'missing-cross-size-responsive-evidence',
  'titlebar-drag-region-regression',
  'mission-control-small-window-regression',
  'active-pane-routing-regression',
  'secret-redaction-regression',
  'electron-security-regression',
  'privacy-or-known-issues-overpromise',
  'generated-artifact-in-source',
  'silent-auto-update-or-telemetry-added',
  'direct-psa-api-or-itdocs-backend-scope-creep',
] as const;

export const ENTERPRISE_ALL_SURFACES_FORBIDDEN_SOURCE_OUTPUTS = [
  'node_modules/',
  'dist/',
  'release/',
  'artifacts/',
  '.pass-runs/',
  'generated installers',
  'generated package manifests',
  'runtime browser profiles',
  'local Mission data',
  'local Evidence data',
] as const;
