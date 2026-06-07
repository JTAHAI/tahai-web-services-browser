export const RUNTIME_E2E_HARNESS_PASS = 'PASS158' as const;
export const RUNTIME_E2E_HARNESS_CONTRACT_ID = 'runtime-e2e-harness-v1' as const;
export const RUNTIME_E2E_HARNESS_SCHEMA_VERSION = 1 as const;

export type RuntimeE2eScenarioId =
  | 'launch-shell'
  | 'titlebar-drag'
  | 'tab-create-close'
  | 'launchpad-guide-home-address'
  | 'mission-control-open'
  | 'mission-layouts-split-tri-quad-focus'
  | 'active-pane-routing'
  | 'popup-denied'
  | 'kb-guide-more-tools'
  | 'shell-overlays-open-close'
  | 'evidence-export-preview';

export type RuntimeE2eScenario = {
  id: RuntimeE2eScenarioId;
  label: string;
  purpose: string;
  selectors: readonly string[];
  assertions: readonly string[];
  destructive: false;
};

export type RuntimeE2eHarnessContract = {
  schemaVersion: typeof RUNTIME_E2E_HARNESS_SCHEMA_VERSION;
  pass: typeof RUNTIME_E2E_HARNESS_PASS;
  contractId: typeof RUNTIME_E2E_HARNESS_CONTRACT_ID;
  sourceOnlyVerifier: true;
  runtimeHarnessAvailable: true;
  requiresElectronRuntimeForLiveExecution: true;
  usesSyntheticLocalMissionOnly: true;
  storesSecrets: false;
  opensNetworkByDefault: false;
  directPsaApiAllowed: false;
  scenarios: readonly RuntimeE2eScenario[];
};

export const RUNTIME_E2E_SCENARIOS: readonly RuntimeE2eScenario[] = [
  {
    id: 'launch-shell',
    label: 'Launch shell and renderer heartbeat',
    purpose: 'Prove the Electron shell reaches the strict renderer-ready marker and exposes expected app chrome.',
    selectors: ['html[data-tahai-shell-ready="1"]', '#webview-stage', '[data-testid="runtime-webview"]'],
    assertions: ['renderer-ready-marker', 'stage-mounted', 'initial-webview-mounted', 'active-webview-stage-viewport-fit', 'guest-window-height-fills-stage-budget', 'guest-document-bottom-fills-viewport'],
    destructive: false
  },
  {
    id: 'titlebar-drag',
    label: 'Titlebar drag and interactive no-drag controls',
    purpose: 'Preserve PASS150 titlebar drag behavior while keeping tabs and controls clickable.',
    selectors: ['[data-testid="runtime-titlebar-drag-region"]', '[data-testid="runtime-tabs"]', '[data-testid="runtime-new-tab"]'],
    assertions: ['topbar-drag-region', 'tab-strip-drag-track', 'new-tab-no-drag-control'],
    destructive: false
  },
  {
    id: 'tab-create-close',
    label: 'Create and close browser tabs',
    purpose: 'Exercise normal browser tab creation without breaking close buttons or active tab state.',
    selectors: ['[data-testid="runtime-new-tab"]', '[data-testid="runtime-browser-tab"]', '[data-testid="runtime-tab-close"]'],
    assertions: ['new-tab-increases-count', 'tab-close-remains-clickable', 'active-tab-survives'],
    destructive: false
  },
  {
    id: 'launchpad-guide-home-address',
    label: 'Launchpad, Guide, Home, and address routing',
    purpose: 'Verify the primary browser shell routes the active tab through Launchpad, Guide/KB, direct address entry, and Home.',
    selectors: ['#launchpad', '#onboarding', '#home', '#address-form', '#address'],
    assertions: ['launchpad-navigates-active-tab', 'guide-navigates-active-tab', 'address-submit-navigates-active-tab', 'home-navigates-active-tab'],
    destructive: false
  },
  {
    id: 'mission-control-open',
    label: 'Mission Control opens cleanly',
    purpose: 'Verify the flagship Mission Control surface opens from normal chrome and can create a local mission.',
    selectors: ['[data-testid="runtime-mission-control"]', '#mission-dialog', '#mission-create', '#mission-add-active-tab'],
    assertions: ['mission-dialog-open', 'local-mission-created', 'active-tab-added'],
    destructive: false
  },
  {
    id: 'mission-layouts-split-tri-quad-focus',
    label: 'Mission layouts: 2-Up, Tri-view, Quad, Focus',
    purpose: 'Exercise Mission View entry and recovery controls across the layouts that historically regressed.',
    selectors: ['[data-mission-layout="split-horizontal"]', '[data-mission-layout="triple-top"]', '[data-mission-layout="quad"]', '[data-mission-layout="focus"]'],
    assertions: ['split-layout-active', 'triview-entry-active', 'quad-layout-active', 'focus-layout-active'],
    destructive: false
  },
  {
    id: 'active-pane-routing',
    label: 'Active-pane routing remains source-visible',
    purpose: 'Confirm mission pane controls and active-pane markers exist for address/back/forward/reload routing tests.',
    selectors: ['[data-send-active-pane="pane-1"]', '[data-send-active-pane="pane-2"]', '.mission-pane-head', '.mission-active-pane'],
    assertions: ['pane-send-controls-present', 'pane-focus-controls-present', 'active-pane-marker-present'],
    destructive: false
  },
  {
    id: 'popup-denied',
    label: 'Popup/new-window denial boundary',
    purpose: 'Prove PASS153 popup denial remains represented in live webview/runtime state.',
    selectors: ['[data-pass153-popup-boundary="main-process-owned"]'],
    assertions: ['webview-popup-boundary-marker', 'window-open-denied-by-main-process'],
    destructive: false
  },
  {
    id: 'kb-guide-more-tools',
    label: 'Guide, KB, and More Tools surface',
    purpose: 'Keep small-window Guide/KB/More Tools entry points testable from the runtime harness.',
    selectors: ['[data-testid="runtime-guide-kb"]', '#toolbar-overflow-menu, [data-tool-menu="devops"], [data-tool-menu="it"]', '#devops-tools-panel', '#it-tools-panel'],
    assertions: ['guide-entry-clickable', 'tool-overflow-or-lanes-present', 'devops-tools-present', 'it-tools-present'],
    destructive: false
  },
  {
    id: 'shell-overlays-open-close',
    label: 'Shell overlays open and close cleanly',
    purpose: 'Smoke test DevOps, IT, Ops Panel, Settings, Profiles, and Command Palette overlay ownership so closing them restores shell clickability.',
    selectors: ['#devops-tools', '#it-tools', '#ops-hub-toggle', '#settings', '#profile-switcher', '#command-palette-dialog'],
    assertions: ['devops-open-close', 'it-open-close', 'ops-hub-open-close', 'settings-open-close', 'profile-open-close', 'command-palette-open-close'],
    destructive: false
  },
  {
    id: 'evidence-export-preview',
    label: 'Evidence export preview and redaction boundary',
    purpose: 'Create local mission evidence and confirm export preview surfaces stay redaction-controlled.',
    selectors: ['#mission-pin-active-page', '#mission-export-preview', '#mission-copy-export', '[data-export-redaction-boundary="redaction-required-before-copy-save"]'],
    assertions: ['pin-active-page-evidence', 'export-preview-populated', 'redaction-boundary-present'],
    destructive: false
  }
] as const;

export const RUNTIME_E2E_HARNESS_CONTRACT: RuntimeE2eHarnessContract = {
  schemaVersion: RUNTIME_E2E_HARNESS_SCHEMA_VERSION,
  pass: RUNTIME_E2E_HARNESS_PASS,
  contractId: RUNTIME_E2E_HARNESS_CONTRACT_ID,
  sourceOnlyVerifier: true,
  runtimeHarnessAvailable: true,
  requiresElectronRuntimeForLiveExecution: true,
  usesSyntheticLocalMissionOnly: true,
  storesSecrets: false,
  opensNetworkByDefault: false,
  directPsaApiAllowed: false,
  scenarios: RUNTIME_E2E_SCENARIOS
};

export function runtimeE2eScenarioIds(): RuntimeE2eScenarioId[] {
  return RUNTIME_E2E_SCENARIOS.map((scenario) => scenario.id);
}

export function getRuntimeE2eScenario(id: RuntimeE2eScenarioId): RuntimeE2eScenario | undefined {
  return RUNTIME_E2E_SCENARIOS.find((scenario) => scenario.id === id);
}

export function runtimeE2eHarnessSummary(): string {
  return `${RUNTIME_E2E_HARNESS_PASS} ${RUNTIME_E2E_HARNESS_CONTRACT_ID}: ${RUNTIME_E2E_SCENARIOS.length} Electron runtime scenarios for launch, tabs, launchpad/guide/home/address routing, titlebar drag, popups, shell overlays, Mission Control, active-pane routing, and evidence export.`;
}
