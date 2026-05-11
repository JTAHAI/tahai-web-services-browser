import { TAHAI_PRODUCT_NAME, TAHAI_RELEASE_VERSION } from './release-truth';

export const WINDOWS_INSTALLED_SMOKE_PASS = 'PASS146' as const;
export const WINDOWS_INSTALLED_SMOKE_VERSION = TAHAI_RELEASE_VERSION;
export const WINDOWS_INSTALLED_SMOKE_PRODUCT = TAHAI_PRODUCT_NAME;
export const WINDOWS_INSTALLED_SMOKE_OUTPUT_DIR = 'artifacts/windows-installed-smoke' as const;

export type WindowsSmokeChecklistId =
  | 'installer-checksum-verified'
  | 'installer-completes-cleanly'
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
  | 'uninstall-clean-path';

export type WindowsSmokeChecklistItem = {
  id: WindowsSmokeChecklistId;
  label: string;
  evidenceRequired: string;
  passCondition: string;
};

export const WINDOWS_INSTALLED_SMOKE_CHECKLIST: readonly WindowsSmokeChecklistItem[] = [
  {
    id: 'installer-checksum-verified',
    label: 'Verify installer checksum before install',
    evidenceRequired: 'Record installer path, SHA256, installer type, and matching release/windows manifest when available.',
    passCondition: 'Operator confirms SHA256 matches the published checksum before running the installer.',
  },
  {
    id: 'installer-completes-cleanly',
    label: 'Install or upgrade completes cleanly',
    evidenceRequired: 'Record installer type, Windows version, install scope, and whether shortcuts were created.',
    passCondition: 'NSIS or MSI install/upgrade completes without error dialogs or broken shortcuts.',
  },
  {
    id: 'installed-app-launches',
    label: 'Installed app launches from installed path',
    evidenceRequired: 'Runner records the resolved executable path, file version fields, and optional process launch proof.',
    passCondition: 'TAHAI Web Services Browser opens from the installed executable without falling back to a dev build.',
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
    passCondition: 'No critical command surface is cut off or permanently unreachable at smaller window sizes.',
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
    passCondition: 'Installed app preserves DevTools for builder/operator diagnostics.',
  },
  {
    id: 'no-console-crash-noise',
    label: 'No obvious crash loops or unhandled errors during smoke',
    evidenceRequired: 'Record console/log observation without including secrets or customer data.',
    passCondition: 'No repeated unhandled promise rejection, renderer crash, or missing critical resource loop is observed.',
  },
  {
    id: 'uninstall-clean-path',
    label: 'Uninstall path is understood before GA',
    evidenceRequired: 'Record Add/Remove Programs presence and whether uninstall was tested in the selected scope.',
    passCondition: 'Operator can identify uninstall path; destructive cleanup is explicit and not silently performed by the runner.',
  },
] as const;

export const WINDOWS_INSTALLED_SMOKE_REQUIRED_DOC_TOKENS = [
  'PASS146',
  'Windows manual smoke checklist',
  'evidence runner',
  'installed app',
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
