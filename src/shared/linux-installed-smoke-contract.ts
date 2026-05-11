import { TAHAI_PRODUCT_NAME, TAHAI_RELEASE_VERSION } from './release-truth';

export const LINUX_INSTALLED_SMOKE_PASS = 'PASS147' as const;
export const LINUX_INSTALLED_SMOKE_VERSION = TAHAI_RELEASE_VERSION;
export const LINUX_INSTALLED_SMOKE_PRODUCT = TAHAI_PRODUCT_NAME;
export const LINUX_INSTALLED_SMOKE_OUTPUT_DIR = 'artifacts/linux-installed-smoke' as const;

export type LinuxPackageType = 'rpm' | 'deb' | 'appimage' | 'unknown';

export type LinuxSmokeChecklistId =
  | 'linux-package-checksum-verified'
  | 'linux-package-installs-cleanly'
  | 'installed-command-resolves'
  | 'package-manager-truth'
  | 'desktop-entry-and-icon-truth'
  | 'installed-app-launches'
  | 'about-version-truth'
  | 'normal-navigation'
  | 'guide-kb-opens'
  | 'mission-control-entry'
  | 'split-triview-quad-entry'
  | 'small-window-reflow'
  | 'active-pane-routing'
  | 'evidence-export-redaction'
  | 'devtools-available'
  | 'no-console-crash-noise'
  | 'remove-clean-path-understood';

export type LinuxSmokeChecklistItem = {
  id: LinuxSmokeChecklistId;
  label: string;
  evidenceRequired: string;
  passCondition: string;
};

export const LINUX_INSTALLED_SMOKE_PACKAGE_TYPES: readonly LinuxPackageType[] = ['rpm', 'deb', 'appimage', 'unknown'] as const;

export const LINUX_INSTALLED_SMOKE_CHECKLIST: readonly LinuxSmokeChecklistItem[] = [
  {
    id: 'linux-package-checksum-verified',
    label: 'Verify Linux package checksum before install or launch',
    evidenceRequired: 'Record package path, SHA256, package type, and matching release/linux manifest when available.',
    passCondition: 'Operator confirms SHA256 matches TAHAI-Linux-installers-SHA256SUMS.txt before install or AppImage launch.',
  },
  {
    id: 'linux-package-installs-cleanly',
    label: 'Linux package install or AppImage permission step completes cleanly',
    evidenceRequired: 'Record distro, package type, install command used outside the runner, and package manager result.',
    passCondition: 'RPM, DEB, or AppImage setup completes without dependency, permission, or desktop-entry errors.',
  },
  {
    id: 'installed-command-resolves',
    label: 'Installed executable or AppImage resolves deterministically',
    evidenceRequired: 'Runner records the resolved executable/AppImage path, file size, SHA256, and file command summary.',
    passCondition: 'TAHAI Web Services Browser resolves from an installed path or explicit AppImage path without using source/dev output.',
  },
  {
    id: 'package-manager-truth',
    label: 'Package manager truth is captured for RPM/DEB installs',
    evidenceRequired: 'Runner records rpm/dpkg query output when the host supports it.',
    passCondition: 'Installed package metadata identifies TAHAI Web Services Browser and v1.8.30, or AppImage is marked as package-manager not applicable.',
  },
  {
    id: 'desktop-entry-and-icon-truth',
    label: 'Desktop entry and icon surfaces are visible',
    evidenceRequired: 'Record .desktop files and icon paths discovered by the runner or by manual launcher inspection.',
    passCondition: 'Linux launcher surfaces use TAHAI naming and do not fall back to generic Electron branding.',
  },
  {
    id: 'installed-app-launches',
    label: 'Installed Linux app launches from installed package/AppImage path',
    evidenceRequired: 'Optional runner launch proof plus manual screenshot/note from the installed app.',
    passCondition: 'Installed app opens without falling back to a dev build, crashing, or requiring unsupported flags beyond documented distro needs.',
  },
  {
    id: 'about-version-truth',
    label: 'About/version/update-channel truth is visible',
    evidenceRequired: 'Screenshot or note showing v1.8.30, public-rc, manual-release, and unsigned preview truth.',
    passCondition: 'About page and release truth do not claim silent auto-update, signing, or GA status prematurely.',
  },
  {
    id: 'normal-navigation',
    label: 'Normal browser navigation works',
    evidenceRequired: 'Record page loaded, back, forward, reload, address-bar navigation, and keyboard shortcut outcome.',
    passCondition: 'Normal mode remains clean and navigation does not regress.',
  },
  {
    id: 'guide-kb-opens',
    label: 'Guide/KB opens from available chrome path',
    evidenceRequired: 'Record whether Guide appears in primary nav or More Tools at smaller widths.',
    passCondition: 'Guide/KB remains discoverable at normal and constrained window sizes.',
  },
  {
    id: 'mission-control-entry',
    label: 'Mission Control opens at installed-app sizes',
    evidenceRequired: 'Record window size, entry method, and whether Mission Control appears without overlay collision.',
    passCondition: 'Mission Control opens cleanly and does not require an oversized window to be usable.',
  },
  {
    id: 'split-triview-quad-entry',
    label: '2-Up, Tri-view, and Quad entry/recovery work',
    evidenceRequired: 'Record entry method for each view, recovery action, and visible active pane.',
    passCondition: 'Operator can enter and recover from 2-Up, Tri-view, and Quad without hidden or overlapping panes.',
  },
  {
    id: 'small-window-reflow',
    label: 'Small-window responsive reflow remains usable',
    evidenceRequired: 'Record at least one constrained-window run and whether chrome/tools remain reachable.',
    passCondition: 'No critical command surface is cut off or permanently unreachable at smaller Linux window sizes.',
  },
  {
    id: 'active-pane-routing',
    label: 'Active-pane routing remains deterministic',
    evidenceRequired: 'Record which pane was active and results for address bar, reload, back, forward, and Ctrl+Alt pane focus.',
    passCondition: 'Navigation targets the active pane/tab only and safely no-ops when history is unavailable.',
  },
  {
    id: 'evidence-export-redaction',
    label: 'Evidence export redaction remains enforced',
    evidenceRequired: 'Record sanitized export result and confirm secret-like sample text is redacted before handoff.',
    passCondition: 'Mission/evidence export warns and redacts before writing operator handoff output.',
  },
  {
    id: 'devtools-available',
    label: 'Chromium DevTools remains available',
    evidenceRequired: 'Record F12 or menu path result.',
    passCondition: 'Installed Linux app preserves DevTools for builder/operator diagnostics.',
  },
  {
    id: 'no-console-crash-noise',
    label: 'No obvious crash loops or unhandled errors during smoke',
    evidenceRequired: 'Record console/log observation without including secrets or customer data.',
    passCondition: 'No repeated unhandled promise rejection, renderer crash, missing library loop, or sandbox crash loop is observed.',
  },
  {
    id: 'remove-clean-path-understood',
    label: 'Linux remove/uninstall path is understood before GA',
    evidenceRequired: 'Record rpm/dnf, dpkg/apt, or AppImage removal path used for the selected package type.',
    passCondition: 'Operator can identify removal path; destructive cleanup is explicit and not silently performed by the runner.',
  },
] as const;

export const LINUX_INSTALLED_SMOKE_REQUIRED_DOC_TOKENS = [
  'PASS147',
  'Linux installed package smoke checklist',
  'evidence runner',
  'installed Linux app',
  'RPM',
  'DEB',
  'AppImage',
  'v1.8.30',
  'manual-release',
  'unsigned preview',
  'Guide/KB',
  'Mission Control',
  '2-Up',
  'Tri-view',
  'Quad',
  'active-pane routing',
  'Evidence export redaction',
  'Do not include secrets',
] as const;
