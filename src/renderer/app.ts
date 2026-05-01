import type { ItDocsMissionCapabilities } from '../shared/itdocs-contract';
import { localOnlyPsaReferenceContractState, psaReferenceMarkdown } from '../shared/psa-reference-contract';
import { scanAndRedact } from '../shared/redaction';
import type {
  MissionEvidenceEntry,
  MissionEvidenceKind,
  MissionLayout,
  MissionLayoutType,
  MissionRunbookStepState,
  MissionState,
  MissionTabRef,
  MissionTimelineEvent,
  MissionType,
  MissionTabRole
} from '../shared/mission-types';
import {
  appendMissionTimelineEvent,
  cloneMissionForDuplicate as cloneMissionForDuplicateModel,
  createEmptyMission,
  createMissionRunbook,
  createMissionRunbookFromRecipe,
  defaultRunbookStepLabels,
  ensureMissionEvidence,
  ensureMissionRunbook,
  missionDefaultRole,
  missionEvidenceKindLabel,
  missionExportMarkdown as buildMissionExportMarkdown,
  missionLayoutLabel,
  missionLayouts,
  missionPaneIds,
  missionRoleLabel,
  missionRunbookStepStates,
  missionTabRoles,
  missionTypes,
  missionUuid,
  normalizeMissionName,
  recipeBlueprintMarkdown,
  recipeEvidenceNote,
  recipePhaseLabel,
  recipeProviderLabel,
  syncMissionLayoutPanesForMission,
  visibleMissionPaneIds
} from './mission-model';

type BrowserConfig = Awaited<ReturnType<typeof window.tahaiBrowser.getConfig>>;
type BrowserSettings = Awaited<ReturnType<typeof window.tahaiBrowser.getSettings>>;

type ConsoleEntry = {
  level: string;
  message: string;
  sourceId: string;
  line: number;
  capturedAt: string;
};

type TabState = {
  id: string;
  title: string;
  url: string;
  button: HTMLButtonElement;
  webview: Electron.WebviewTag;
  consoleMessages: ConsoleEntry[];
  missionPaneId?: string;
};

type PageCapture = {
  title: string;
  url: string;
  origin: string;
  userAgent: string;
  language: string;
  viewport: string;
  metaDescription: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  counts: { forms: number; inputs: number; buttons: number; anchors: number; images: number; scripts: number; stylesheets: number };
  timing: { domContentLoadedMs: number; loadMs: number; responseMs: number; transferKb: number };
};

type CaptureState = {
  markdown: string;
  sourceUrl: string;
};

type DevAuditResource = {
  name: string;
  initiatorType: string;
  durationMs: number;
  transferKb: number;
  sizeKb: number;
};

type DevAuditPage = {
  title: string;
  url: string;
  origin: string;
  userAgent: string;
  viewport: string;
  language: string;
  doctype: string;
  charset: string;
  metaViewport: string;
  metaDescription: string;
  robots: string;
  cspMeta: string;
  counts: {
    scripts: number;
    externalScripts: number;
    inlineScripts: number;
    moduleScripts: number;
    stylesheets: number;
    inlineStyles: number;
    images: number;
    imagesMissingAlt: number;
    buttons: number;
    buttonsWithoutText: number;
    inputs: number;
    inputsMissingLabels: number;
    anchors: number;
    anchorsWithoutText: number;
    forms: number;
    customElements: number;
  };
  timing: {
    domContentLoadedMs: number;
    loadMs: number;
    responseMs: number;
    firstPaintMs: number;
    firstContentfulPaintMs: number;
    transferKb: number;
    encodedBodyKb: number;
    decodedBodyKb: number;
  };
  resources: DevAuditResource[];
  storageCounts: { localStorageKeys: number; sessionStorageKeys: number; cookiesAccessible: boolean };
};

type OpsCheckStatus = 'pass' | 'warn' | 'fail' | 'info';
type OpsUrlDiagnostics = Awaited<ReturnType<typeof window.tahaiBrowser.runUrlDiagnostics>>;
type ItServiceCardDiagnostics = Awaited<ReturnType<typeof window.tahaiBrowser.runItServiceCardDiagnostics>>;
type BrowserProfileState = Awaited<ReturnType<typeof window.tahaiBrowser.listProfiles>>;
type BrowserProfileRecord = BrowserProfileState['profiles'][number];
type BrowserProfileKind = BrowserProfileRecord['kind'];

type EndpointPermissionSnapshot = {
  name: string;
  state: string;
};

type EndpointSnapshot = {
  title: string;
  url: string;
  origin: string;
  host: string;
  protocol: string;
  userAgent: string;
  platform: string;
  languages: string[];
  timezone: string;
  timezoneOffsetMinutes: number;
  viewport: string;
  screen: string;
  colorScheme: string;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
  online: boolean;
  cookieEnabled: boolean;
  doNotTrack: string;
  storage: {
    localStorageAvailable: boolean;
    sessionStorageAvailable: boolean;
    indexedDbAvailable: boolean;
    cacheStorageAvailable: boolean;
    serviceWorkerAvailable: boolean;
  };
  permissions: EndpointPermissionSnapshot[];
};

type RouteMapFormSnapshot = {
  method: string;
  action: string;
  sameOrigin: boolean;
  controlCount: number;
  submitCount: number;
  passwordCount: number;
  fileCount: number;
  fieldTypes: string[];
};

type RouteMapResourceOrigin = {
  origin: string;
  count: number;
  types: string[];
};

type RouteMapApiSample = {
  path: string;
  origin: string;
  type: string;
};

type RouteMapPage = {
  title: string;
  url: string;
  origin: string;
  pathname: string;
  canonical: string;
  baseHref: string;
  robots: string;
  frameworkHints: string[];
  routeCandidates: string[];
  internalLinks: string[];
  externalOrigins: string[];
  forms: RouteMapFormSnapshot[];
  resourceOrigins: RouteMapResourceOrigin[];
  apiSamples: RouteMapApiSample[];
  counts: {
    anchors: number;
    internalAnchors: number;
    externalAnchors: number;
    navLinks: number;
    forms: number;
    scripts: number;
    moduleScripts: number;
    resources: number;
    apiResources: number;
  };
};

type OpsCheckState = {
  markdown: string;
  sourceUrl: string;
  diagnostics: OpsUrlDiagnostics;
};

type DeployReadinessState = {
  markdown: string;
  sourceUrl: string;
  diagnostics: OpsUrlDiagnostics;
  page?: PageCapture;
  consoleMessages: ConsoleEntry[];
};

type ItServiceCardState = {
  markdown: string;
  sourceUrl: string;
  diagnostics: ItServiceCardDiagnostics;
};

type EndpointState = {
  markdown: string;
  sourceUrl: string;
  snapshot: EndpointSnapshot;
  ops?: OpsUrlDiagnostics;
};

type SupportTriageState = {
  markdown: string;
  sourceUrl: string;
  endpoint: EndpointSnapshot;
  ops?: OpsUrlDiagnostics;
  page?: PageCapture;
  consoleMessages: ConsoleEntry[];
};

type RouteMapState = {
  markdown: string;
  sourceUrl: string;
  map: RouteMapPage;
};

type DevAuditState = {
  markdown: string;
  sourceUrl: string;
  page: DevAuditPage;
  consoleMessages: ConsoleEntry[];
};

type ChangeBundleState = {
  markdown: string;
  sourceUrl: string;
  evidenceCount: number;
  workspaceCount: number;
};

type OperationalHandoffTarget = 'it-docs' | 'psa';

type OperationalHandoffState = {
  markdown: string;
  sourceUrl: string;
  target: OperationalHandoffTarget;
  evidenceCount: number;
  workspaceCount: number;
  tabCount: number;
};

type OpsGuardSeverity = 'pass' | 'warn' | 'fail' | 'info';

type OpsGuardFinding = {
  label: string;
  severity: OpsGuardSeverity;
  matches: number;
  detail: string;
};

type OpsGuardState = {
  markdown: string;
  redactedMarkdown: string;
  sourceLabel: string;
  findingCount: number;
  highRiskCount: number;
  warningCount: number;
};

type EvidenceTimelineItem = {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
  markdown: string;
  profileName: string;
  createdAt: string;
};

type WorkspaceSnapshot = {
  id: string;
  name: string;
  profileId: string;
  profileName: string;
  activeUrl: string;
  urls: string[];
  createdAt: string;
};

type LaunchRecipe = {
  id: string;
  label: string;
  group: string;
  profileKind?: BrowserProfileKind;
  profileName: string;
  urls: string[];
  comingSoon?: boolean;
  note: string;
  missionType?: MissionType;
  missionLayout?: MissionLayoutType;
  missionRoles?: MissionTabRole[];
  missionPhase?: 'devops' | 'it' | 'general';
  missionPrimaryAction?: string;
  missionStopCondition?: string;
  missionRunbookSteps?: string[];
  missionEvidencePrompts?: string[];
  cockpitProvider?: 'aws' | 'azure' | 'm365' | 'cloudflare' | 'github' | 'vercel' | 'firebase' | 'incident' | 'generic';
  operatorShortcut?: string;
};

type CommandPalettePhase = 'mission' | 'devops' | 'it' | 'evidence' | 'browser' | 'all';

function commandPalettePhaseFromRecipePhase(phase: 'devops' | 'it' | 'general' | undefined, fallback: CommandPalettePhase): CommandPalettePhase {
  if (phase === 'devops' || phase === 'it') return phase;
  return fallback;
}


type CommandPaletteAction = {
  id: string;
  title: string;
  detail: string;
  group: string;
  shortcut?: string;
  target?: string;
  phase?: CommandPalettePhase;
  run: () => void | Promise<void>;
};

window.dispatchEvent(new CustomEvent('tahai-renderer-app-script'));

function showBootDiagnostic(detail: string): void {
  const panel = document.getElementById('boot-diagnostic');
  const detailEl = document.getElementById('boot-diagnostic-detail');
  if (detailEl) detailEl.textContent = detail;
  if (panel) panel.removeAttribute('hidden');
}

function markRendererShellReady(): void {
  document.documentElement.dataset.tahaiShellReady = '1';
  window.dispatchEvent(new CustomEvent('tahai-renderer-ready'));
  const panel = document.getElementById('boot-diagnostic');
  if (panel) panel.setAttribute('hidden', 'true');
}

function fallbackBrowserConfig(): BrowserConfig {
  const fallbackSettings: BrowserSettings = {
    homeUrl: 'https://tahaiportal.com',
    startup: 'home',
    searchProvider: 'google',
    permissions: { allowClipboardRead: false, allowMedia: true, allowGeolocation: false, allowNotifications: false },
    downloads: { askEveryTime: true, defaultDirectory: '' },
    ui: { showStatusBar: true, openExternalLinksInNewTab: true },
    privacy: { sendDoNotTrack: true, blockThirdPartyCookies: true, reduceCrossSiteReferrers: true, clearProfileDataOnExit: false },
  };
  return {
    productName: 'TAHAI Web Services Browser',
    bundleName: 'TAHAI—SENTINEL Browser',
    homeUrl: 'https://tahaiportal.com',
    itDocsUrl: 'https://docs.tahaiportal.com',
    startupUrl: 'https://tahaiportal.com',
    newTabUrl: 'about:blank',
    settingsUrl: 'about:blank',
    aboutUrl: 'about:blank',
    errorPageUrl: 'about:blank',
    onboardingUrl: 'about:blank',
    bookmarksUrl: '',
    version: '0.0.0',
    releaseChannel: 'fallback',
    firstLaunch: { product: 'TAHAI Web Services Browser', defaultHome: 'https://tahaiportal.com', initializedAt: '', sourceGuardrails: [] },
    userDataPath: '',
    settingsPath: '',
    settings: fallbackSettings,
    profiles: {
      activeProfileId: 'default',
      activeProfile: { id: 'default', name: 'Default', kind: 'local', color: '#77dbff', partition: 'persist:tahai-profile-default', createdAt: '', updatedAt: '', lastUsedAt: '', isDefault: true },
      profiles: [{ id: 'default', name: 'Default', kind: 'local', color: '#77dbff', partition: 'persist:tahai-profile-default', createdAt: '', updatedAt: '', lastUsedAt: '', isDefault: true }],
      path: ''
    }
  };
}

function loadBrowserConfigWithRuntimeFallback(timeoutMs = 4500): Promise<BrowserConfig> {
  const bridge = window.tahaiBrowser;
  if (!bridge || typeof bridge.getConfig !== 'function') {
    return Promise.reject(new Error('Preload bridge did not expose tahaiBrowser.getConfig.'));
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Preload/config bridge timed out after ${timeoutMs}ms.`)), timeoutMs);
    bridge.getConfig().then((loaded) => {
      window.clearTimeout(timeout);
      resolve(loaded);
    }).catch((error) => {
      window.clearTimeout(timeout);
      reject(error);
    });
  });
}

window.addEventListener('error', (event) => {
  showBootDiagnostic(`Renderer error: ${event.message || 'unknown error'}`);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'unknown rejection');
  showBootDiagnostic(`Renderer promise rejection: ${reason}`);
});

// Report shell HTML readiness as soon as the first-party renderer script is executing.
// Full browser configuration still has its own guarded fallback below. This prevents a
// functional but slow/blocked preload bridge from replacing the app with a false black-screen diagnostic.
markRendererShellReady();

const tabsEl = document.getElementById('tabs') as HTMLElement;
const stageEl = document.getElementById('webview-stage') as HTMLElement;
const addressForm = document.getElementById('address-form') as HTMLFormElement;
const addressInput = document.getElementById('address') as HTMLInputElement;
const backButton = document.getElementById('back') as HTMLButtonElement;
const forwardButton = document.getElementById('forward') as HTMLButtonElement;
const reloadButton = document.getElementById('reload') as HTMLButtonElement;
const homeButton = document.getElementById('home') as HTMLButtonElement;
const launchpadButton = document.getElementById('launchpad') as HTMLButtonElement;
const onboardingButton = document.getElementById('onboarding') as HTMLButtonElement;
const profileSwitcherButton = document.getElementById('profile-switcher') as HTMLButtonElement;
const opsHubToggleButton = document.getElementById('ops-hub-toggle') as HTMLButtonElement;
const missionControlButton = document.getElementById('mission-control-toggle') as HTMLButtonElement;
const opsHub = document.getElementById('ops-hub') as HTMLElement;
const closeOpsHubButton = document.getElementById('close-ops-hub') as HTMLButtonElement;
const opsHubProfile = document.getElementById('ops-hub-profile') as HTMLElement;
const opsHubUrl = document.getElementById('ops-hub-url') as HTMLElement;
const opsHubRecipes = document.getElementById('ops-hub-recipes') as HTMLElement;
const opsHubWorkspaces = document.getElementById('ops-hub-workspaces') as HTMLElement;
const opsHubEvidence = document.getElementById('ops-hub-evidence') as HTMLElement;
const missionDialog = document.getElementById('mission-dialog') as HTMLDialogElement;
const closeMissionButton = document.getElementById('close-mission') as HTMLButtonElement;
const missionForm = document.getElementById('mission-form') as HTMLFormElement;
const missionNameInput = document.getElementById('mission-name') as HTMLInputElement;
const missionTypeSelect = document.getElementById('mission-type') as HTMLSelectElement;
const missionStatus = document.getElementById('mission-status') as HTMLElement;
const missionList = document.getElementById('mission-list') as HTMLElement;
const missionRecipes = document.getElementById('mission-recipes') as HTMLElement;
const missionTabsList = document.getElementById('mission-tabs-list') as HTMLElement;
const missionTimeline = document.getElementById('mission-timeline') as HTMLElement;
const missionEvidenceList = document.getElementById('mission-evidence-list') as HTMLElement;
const missionPinLatestEvidenceButton = document.getElementById('mission-pin-latest-evidence') as HTMLButtonElement;
const missionPinActivePageButton = document.getElementById('mission-pin-active-page') as HTMLButtonElement;
const missionRunbookObjective = document.getElementById('mission-runbook-objective') as HTMLInputElement;
const missionRunbookRollback = document.getElementById('mission-runbook-rollback') as HTMLTextAreaElement;
const missionRunbookStepInput = document.getElementById('mission-runbook-step-input') as HTMLInputElement;
const missionRunbookAddStepButton = document.getElementById('mission-runbook-add-step') as HTMLButtonElement;
const missionRunbookList = document.getElementById('mission-runbook-list') as HTMLElement;
const missionNoteInput = document.getElementById('mission-note-input') as HTMLTextAreaElement;
const missionAddNoteButton = document.getElementById('mission-add-note') as HTMLButtonElement;
const missionNotesList = document.getElementById('mission-notes-list') as HTMLElement;
const missionCreateButton = document.getElementById('mission-create') as HTMLButtonElement;
const missionAddActiveTabButton = document.getElementById('mission-add-active-tab') as HTMLButtonElement;
const missionMakeQuadButton = document.getElementById('mission-make-quad') as HTMLButtonElement;
const missionSaveButton = document.getElementById('mission-save') as HTMLButtonElement;
const missionLayoutsEl = document.getElementById('mission-layouts') as HTMLElement;
const missionExportPreview = document.getElementById('mission-export-preview') as HTMLTextAreaElement;
const missionCopyExportButton = document.getElementById('mission-copy-export') as HTMLButtonElement;
const missionSaveExportButton = document.getElementById('mission-save-export') as HTMLButtonElement;
type TextInputOptions = {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
};

function requestTextInput(options: TextInputOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'text-input-dialog';
    dialog.setAttribute('aria-label', options.title);
    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'text-input-panel';
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = options.title;
    const subtitle = document.createElement('p');
    subtitle.textContent = options.label || 'Enter a value to continue.';
    header.append(title, subtitle);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = options.defaultValue || '';
    input.placeholder = options.placeholder || '';
    input.maxLength = options.maxLength || 180;
    input.autocomplete = 'off';
    input.spellcheck = false;
    const actions = document.createElement('div');
    actions.className = 'text-input-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ghost';
    cancel.textContent = options.cancelLabel || 'Cancel';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = options.confirmLabel || 'Continue';
    actions.append(cancel, submit);
    form.append(header, input, actions);
    dialog.append(form);
    document.body.appendChild(dialog);
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
      dialog.close();
      dialog.remove();
    };
    cancel.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => { if (!settled) finish(null); });
    form.addEventListener('submit', (event) => { event.preventDefault(); finish(input.value.trim()); });
    dialog.showModal();
    requestAnimationFrame(() => { input.focus(); input.select(); });
  });
}

const commandPaletteDialog = document.getElementById('command-palette-dialog') as HTMLDialogElement;
const commandPaletteInput = document.getElementById('command-palette-input') as HTMLInputElement;
const commandPaletteList = document.getElementById('command-palette-list') as HTMLElement;
const closeCommandPaletteButton = document.getElementById('close-command-palette') as HTMLButtonElement;
const shortcutDialog = document.getElementById('shortcut-dialog') as HTMLDialogElement;
const shortcutList = document.getElementById('shortcut-list') as HTMLElement;
const closeShortcutsButton = document.getElementById('close-shortcuts') as HTMLButtonElement;
const profileDot = document.getElementById('profile-dot') as HTMLElement;
const profileName = document.getElementById('profile-name') as HTMLElement;
const devopsToolsButton = document.getElementById('devops-tools') as HTMLButtonElement;
const itToolsButton = document.getElementById('it-tools') as HTMLButtonElement;
const devopsToolsPanel = document.getElementById('devops-tools-panel') as HTMLElement;
const itToolsPanel = document.getElementById('it-tools-panel') as HTMLElement;
const settingsButton = document.getElementById('settings') as HTMLButtonElement;
const captureButton = document.getElementById('capture') as HTMLButtonElement;
const opsCheckButton = document.getElementById('ops-check') as HTMLButtonElement;
const deployButton = document.getElementById('deploy') as HTMLButtonElement;
const itCardButton = document.getElementById('it-card') as HTMLButtonElement;
const endpointButton = document.getElementById('endpoint') as HTMLButtonElement;
const triageButton = document.getElementById('triage') as HTMLButtonElement;
const secretBoundaryButton = document.getElementById('secret-boundary') as HTMLButtonElement;
const routeMapButton = document.getElementById('route-map') as HTMLButtonElement;
const devAuditButton = document.getElementById('dev-audit') as HTMLButtonElement;
const opsGuardButton = document.getElementById('ops-guard') as HTMLButtonElement;
const devtoolsButton = document.getElementById('devtools') as HTMLButtonElement;
const aboutButton = document.getElementById('about') as HTMLButtonElement;
const newTabButton = document.getElementById('new-tab') as HTMLButtonElement;
const statusBar = document.getElementById('statusbar') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const securityText = document.getElementById('security-text') as HTMLElement;
const settingsDialog = document.getElementById('settings-dialog') as HTMLDialogElement;
const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
const settingHomeUrl = document.getElementById('setting-home-url') as HTMLInputElement;
const settingStartup = document.getElementById('setting-startup') as HTMLSelectElement;
const settingSearch = document.getElementById('setting-search') as HTMLSelectElement;
const settingMedia = document.getElementById('setting-media') as HTMLInputElement;
const settingClipboard = document.getElementById('setting-clipboard') as HTMLInputElement;
const settingGeolocation = document.getElementById('setting-geolocation') as HTMLInputElement;
const settingNotifications = document.getElementById('setting-notifications') as HTMLInputElement;
const settingDoNotTrack = document.getElementById('setting-dnt') as HTMLInputElement;
const settingThirdPartyCookies = document.getElementById('setting-third-party-cookies') as HTMLInputElement;
const settingReduceReferrers = document.getElementById('setting-referrer') as HTMLInputElement;
const settingClearOnExit = document.getElementById('setting-clear-on-exit') as HTMLInputElement;
const settingDownloads = document.getElementById('setting-downloads') as HTMLInputElement;
const settingStatusBar = document.getElementById('setting-statusbar') as HTMLInputElement;
const settingsResult = document.getElementById('settings-result') as HTMLElement;
const closeSettingsButton = document.getElementById('close-settings') as HTMLButtonElement;
const resetSettingsButton = document.getElementById('reset-settings') as HTMLButtonElement;
const clearDataButton = document.getElementById('clear-data') as HTMLButtonElement;
const clearAllDataButton = document.getElementById('clear-all-data') as HTMLButtonElement;
const openProfileButton = document.getElementById('open-profile') as HTMLButtonElement;
const profileDialog = document.getElementById('profile-dialog') as HTMLDialogElement;
const profileStatus = document.getElementById('profile-status') as HTMLElement;
const profileList = document.getElementById('profile-list') as HTMLElement;
const profileForm = document.getElementById('profile-form') as HTMLFormElement;
const profileId = document.getElementById('profile-id') as HTMLInputElement;
const profileLabel = document.getElementById('profile-label') as HTMLInputElement;
const profileKind = document.getElementById('profile-kind') as HTMLSelectElement;
const profileColor = document.getElementById('profile-color') as HTMLInputElement;
const profileResult = document.getElementById('profile-result') as HTMLElement;
const closeProfileButton = document.getElementById('close-profile') as HTMLButtonElement;
const newLocalProfileButton = document.getElementById('new-local-profile') as HTMLButtonElement;
const newGoogleProfileButton = document.getElementById('new-google-profile') as HTMLButtonElement;
const newMicrosoftProfileButton = document.getElementById('new-microsoft-profile') as HTMLButtonElement;
const clearSelectedProfileDataButton = document.getElementById('clear-selected-profile-data') as HTMLButtonElement;
const openActiveProfileDataButton = document.getElementById('open-active-profile-data') as HTMLButtonElement;
const deleteProfileButton = document.getElementById('delete-profile') as HTMLButtonElement;
const switchProfileButton = document.getElementById('switch-profile') as HTMLButtonElement;
const captureDialog = document.getElementById('capture-dialog') as HTMLDialogElement;
const captureMarkdown = document.getElementById('capture-markdown') as HTMLTextAreaElement;
const captureResult = document.getElementById('capture-result') as HTMLElement;
const closeCaptureButton = document.getElementById('close-capture') as HTMLButtonElement;
const copyCaptureButton = document.getElementById('copy-capture') as HTMLButtonElement;
const saveCaptureButton = document.getElementById('save-capture') as HTMLButtonElement;
const opsDialog = document.getElementById('ops-dialog') as HTMLDialogElement;
const opsSummary = document.getElementById('ops-summary') as HTMLElement;
const opsMarkdown = document.getElementById('ops-markdown') as HTMLTextAreaElement;
const opsResult = document.getElementById('ops-result') as HTMLElement;
const closeOpsButton = document.getElementById('close-ops') as HTMLButtonElement;
const copyOpsButton = document.getElementById('copy-ops') as HTMLButtonElement;
const saveOpsButton = document.getElementById('save-ops') as HTMLButtonElement;
const deployDialog = document.getElementById('deploy-dialog') as HTMLDialogElement;
const deploySummary = document.getElementById('deploy-summary') as HTMLElement;
const deployMarkdown = document.getElementById('deploy-markdown') as HTMLTextAreaElement;
const deployResult = document.getElementById('deploy-result') as HTMLElement;
const closeDeployButton = document.getElementById('close-deploy') as HTMLButtonElement;
const copyDeployButton = document.getElementById('copy-deploy') as HTMLButtonElement;
const saveDeployButton = document.getElementById('save-deploy') as HTMLButtonElement;
const itCardDialog = document.getElementById('it-card-dialog') as HTMLDialogElement;
const itCardSummary = document.getElementById('it-card-summary') as HTMLElement;
const itCardMarkdown = document.getElementById('it-card-markdown') as HTMLTextAreaElement;
const itCardResult = document.getElementById('it-card-result') as HTMLElement;
const closeItCardButton = document.getElementById('close-it-card') as HTMLButtonElement;
const copyItCardButton = document.getElementById('copy-it-card') as HTMLButtonElement;
const saveItCardButton = document.getElementById('save-it-card') as HTMLButtonElement;
const endpointDialog = document.getElementById('endpoint-dialog') as HTMLDialogElement;
const endpointSummary = document.getElementById('endpoint-summary') as HTMLElement;
const endpointMarkdown = document.getElementById('endpoint-markdown') as HTMLTextAreaElement;
const endpointResult = document.getElementById('endpoint-result') as HTMLElement;
const closeEndpointButton = document.getElementById('close-endpoint') as HTMLButtonElement;
const copyEndpointButton = document.getElementById('copy-endpoint') as HTMLButtonElement;
const saveEndpointButton = document.getElementById('save-endpoint') as HTMLButtonElement;
const triageDialog = document.getElementById('triage-dialog') as HTMLDialogElement;
const triageSummary = document.getElementById('triage-summary') as HTMLElement;
const triageMarkdown = document.getElementById('triage-markdown') as HTMLTextAreaElement;
const triageResult = document.getElementById('triage-result') as HTMLElement;
const closeTriageButton = document.getElementById('close-triage') as HTMLButtonElement;

const copyTriageButton = document.getElementById('copy-triage') as HTMLButtonElement;
const saveTriageButton = document.getElementById('save-triage') as HTMLButtonElement;
const routeMapDialog = document.getElementById('route-map-dialog') as HTMLDialogElement;
const routeMapSummary = document.getElementById('route-map-summary') as HTMLElement;
const routeMapMarkdown = document.getElementById('route-map-markdown') as HTMLTextAreaElement;
const routeMapResult = document.getElementById('route-map-result') as HTMLElement;
const closeRouteMapButton = document.getElementById('close-route-map') as HTMLButtonElement;
const copyRouteMapButton = document.getElementById('copy-route-map') as HTMLButtonElement;
const saveRouteMapButton = document.getElementById('save-route-map') as HTMLButtonElement;
const devAuditDialog = document.getElementById('dev-audit-dialog') as HTMLDialogElement;
const devAuditSummary = document.getElementById('dev-audit-summary') as HTMLElement;
const devAuditMarkdown = document.getElementById('dev-audit-markdown') as HTMLTextAreaElement;
const devAuditResult = document.getElementById('dev-audit-result') as HTMLElement;
const closeDevAuditButton = document.getElementById('close-dev-audit') as HTMLButtonElement;
const copyDevAuditButton = document.getElementById('copy-dev-audit') as HTMLButtonElement;
const saveDevAuditButton = document.getElementById('save-dev-audit') as HTMLButtonElement;
const bundleDialog = document.getElementById('bundle-dialog') as HTMLDialogElement;
const bundleSummary = document.getElementById('bundle-summary') as HTMLElement;
const bundleMarkdown = document.getElementById('bundle-markdown') as HTMLTextAreaElement;
const bundleResult = document.getElementById('bundle-result') as HTMLElement;
const closeBundleButton = document.getElementById('close-bundle') as HTMLButtonElement;
const copyBundleButton = document.getElementById('copy-bundle') as HTMLButtonElement;
const saveBundleButton = document.getElementById('save-bundle') as HTMLButtonElement;
const handoffDialog = document.getElementById('handoff-dialog') as HTMLDialogElement;
const handoffSummary = document.getElementById('handoff-summary') as HTMLElement;
const handoffMarkdown = document.getElementById('handoff-markdown') as HTMLTextAreaElement;
const handoffResult = document.getElementById('handoff-result') as HTMLElement;
const closeHandoffButton = document.getElementById('close-handoff') as HTMLButtonElement;
const copyHandoffButton = document.getElementById('copy-handoff') as HTMLButtonElement;
const saveHandoffButton = document.getElementById('save-handoff') as HTMLButtonElement;
const openItDocsFromHandoffButton = document.getElementById('open-it-docs-from-handoff') as HTMLButtonElement;
const openPsaFromHandoffButton = document.getElementById('open-psa-from-handoff') as HTMLButtonElement;
const handoffTargetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-handoff-target]'));
const itDocsCapabilitySummary = document.getElementById('itdocs-capability-summary') as HTMLElement;
const refreshItDocsCapabilitiesButton = document.getElementById('refresh-itdocs-capabilities') as HTMLButtonElement;
const copyItDocsCapabilitiesButton = document.getElementById('copy-itdocs-capabilities') as HTMLButtonElement;
const copyPsaReferenceContractButton = document.getElementById('copy-psa-reference-contract') as HTMLButtonElement;
const psaReferenceSummary = document.getElementById('psa-reference-summary') as HTMLElement;
const opsGuardDialog = document.getElementById('ops-guard-dialog') as HTMLDialogElement;
const opsGuardSummary = document.getElementById('ops-guard-summary') as HTMLElement;
const opsGuardMarkdown = document.getElementById('ops-guard-markdown') as HTMLTextAreaElement;
const opsGuardRedacted = document.getElementById('ops-guard-redacted') as HTMLTextAreaElement;
const opsGuardResult = document.getElementById('ops-guard-result') as HTMLElement;
const closeOpsGuardButton = document.getElementById('close-ops-guard') as HTMLButtonElement;
const copyOpsGuardButton = document.getElementById('copy-ops-guard') as HTMLButtonElement;
const copyOpsGuardRedactedButton = document.getElementById('copy-ops-guard-redacted') as HTMLButtonElement;
const saveOpsGuardButton = document.getElementById('save-ops-guard') as HTMLButtonElement;

let config: BrowserConfig;
let settings: BrowserSettings;
let activeTabId = '';
let latestCapture: CaptureState | undefined;
let latestOpsCheck: OpsCheckState | undefined;
let latestDeployReadiness: DeployReadinessState | undefined;
let latestItCard: ItServiceCardState | undefined;
let latestEndpoint: EndpointState | undefined;
let latestTriage: SupportTriageState | undefined;
let latestRouteMap: RouteMapState | undefined;
let latestDevAudit: DevAuditState | undefined;
let latestChangeBundle: ChangeBundleState | undefined;
let latestOperationalHandoff: OperationalHandoffState | undefined;
let latestItDocsCapabilities: ItDocsMissionCapabilities | undefined;
let browserProfileState: BrowserProfileState | undefined;
let editingProfileId = '';
let commandPaletteActions: CommandPaletteAction[] = [];
let commandPaletteIndex = 0;
let currentMission: MissionState | undefined;
let missionStore: MissionState[] = [];
let missionPaneDropZones: HTMLElement | undefined;
let missionPaneHeads: HTMLElement | undefined;
const missionRuntimeTabs = new Map<string, string>();
let missionTabsListDragTabId = '';
let lastMissionLayoutBeforeFocus: MissionLayoutType = 'quad';
const evidenceStorageKey = 'tahai-browser:evidence-timeline:v1';
const workspaceStorageKey = 'tahai-browser:workspace-snapshots:v1';
const tabs = new Map<string, TabState>();

function id(): string {
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trustedLocalUrls(): string[] {
  return [config.newTabUrl, config.settingsUrl, config.aboutUrl, config.errorPageUrl, config.onboardingUrl];
}

function isTrustedLocalUrl(url: string): boolean {
  return trustedLocalUrls().some((local) => url === local || url.startsWith(`${local}?`));
}

function isUnsafeLocalUrl(url: string): boolean {
  return /^file:\/\//i.test(url) && !isTrustedLocalUrl(url);
}

function searchUrl(value: string): string {
  const q = encodeURIComponent(value);
  if (settings?.searchProvider === 'duckduckgo') return `https://duckduckgo.com/?q=${q}`;
  if (settings?.searchProvider === 'bing') return `https://www.bing.com/search?q=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

function normalizeTarget(raw: string): string {
  const value = raw.trim();
  if (!value) return config.newTabUrl;
  if (/^file:\/\//i.test(value)) return isTrustedLocalUrl(value) ? value : config.newTabUrl;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value) || /^localhost(:\d+)?/i.test(value)) return `https://${value}`;
  return searchUrl(value);
}

function titleFromUrl(url: string): string {
  if (url === config.newTabUrl || url.startsWith(`${config.newTabUrl}?`)) return 'TAHAI Launchpad';
  if (url === config.settingsUrl || url.startsWith(`${config.settingsUrl}?`)) return 'Settings';
  if (url === config.aboutUrl || url.startsWith(`${config.aboutUrl}?`)) return 'About';
  if (url === config.onboardingUrl || url.startsWith(`${config.onboardingUrl}?`)) return 'First-run guide';
  if (url === config.errorPageUrl || url.startsWith(`${config.errorPageUrl}?`)) return 'Load issue';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'New tab'; }
}

function securityLabel(url: string): string {
  if (url.startsWith('https://')) return 'Secure transport: HTTPS';
  if (url.startsWith('http://')) return 'Warning: HTTP transport';
  return 'Local TAHAI page';
}

function setStatus(message: string, detail?: string): void {
  statusText.textContent = message;
  if (detail) securityText.textContent = detail;
}

function applyUiSettings(): void {
  statusBar.hidden = settings?.ui?.showStatusBar === false;
}

function setActive(tabId: string): void {
  activeTabId = tabId;
  if (currentMission && currentMission.layout.type !== 'single') {
    const paneEntry = Array.from(missionRuntimeTabs.entries()).find(([, runtimeTabId]) => runtimeTabId === tabId);
    const missionTab = paneEntry ? currentMission.tabs.find((candidate) => candidate.tabId === paneEntry[0]) : undefined;
    if (missionTab && missionVisiblePaneIds(currentMission.layout.type).includes(missionTab.paneId)) currentMission.layout.activePaneId = missionTab.paneId;
  }
  for (const tab of tabs.values()) {
    const isActive = tab.id === tabId;
    tab.button.classList.toggle('active', isActive);
    tab.webview.classList.toggle('active', isActive);
  }
  const active = tabs.get(tabId);
  if (active) {
    addressInput.value = active.url;
    setStatus(active.title, securityLabel(active.url));
  }
  renderMissionLayout();
  if (typeof config !== 'undefined') renderOpsHub();
}

function updateTab(tab: TabState, patch: Partial<Pick<TabState, 'title' | 'url'>>): void {
  Object.assign(tab, patch);
  const title = tab.button.querySelector('.tab-title');
  if (title) title.textContent = tab.title;
  if (tab.id === activeTabId) {
    addressInput.value = tab.url;
    setStatus(tab.title, securityLabel(tab.url));
  }
  updateMissionTabRuntimeFromBrowser(tab);
  if (typeof config !== 'undefined') renderOpsHub();
}

function closeTab(tabId: string): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.button.remove();
  tab.webview.remove();
  for (const [missionTabId, runtimeTabId] of missionRuntimeTabs.entries()) {
    if (runtimeTabId === tabId) missionRuntimeTabs.delete(missionTabId);
  }
  tabs.delete(tabId);
  if (activeTabId === tabId) {
    const next = Array.from(tabs.keys()).at(-1);
    if (next) setActive(next);
    else createTab(config.homeUrl);
  }
  renderMissionControl();
  renderMissionLayout();
}

function errorUrl(targetUrl: string, reason: string): string {
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedReason = encodeURIComponent(reason);
  return `${config.errorPageUrl}?url=${encodedUrl}&reason=${encodedReason}`;
}

function createTab(url: string): string {
  const safeUrl = normalizeTarget(url);
  const tabId = id();
  const button = document.createElement('button');
  button.className = 'tab';
  button.type = 'button';
  button.draggable = true;
  button.dataset.browserTabId = tabId;
  button.title = 'Drag this tab onto a Mission pane, or right-click for pane assignment.';
  button.innerHTML = `<span class="tab-title"></span><button class="tab-close" type="button" title="Close tab">×</button>`;
  tabsEl.appendChild(button);

  const webview = document.createElement('webview') as Electron.WebviewTag;
  webview.className = 'browser-view';
  webview.src = safeUrl;
  webview.setAttribute('allowpopups', 'false');
  webview.setAttribute('partition', browserProfileState?.activeProfile?.partition || 'persist:tahai-profile-default');
  webview.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=yes,devTools=yes');
  stageEl.appendChild(webview);

  const tab: TabState = { id: tabId, title: titleFromUrl(safeUrl), url: safeUrl, button, webview, consoleMessages: [] };
  tabs.set(tabId, tab);
  updateTab(tab, { title: tab.title, url: safeUrl });

  button.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('tab-close')) closeTab(tabId);
    else setActive(tabId);
  });
  button.addEventListener('dragstart', (event) => startMissionTabDrag(tabId, event));
  button.addEventListener('dragend', () => endMissionTabDrag());
  button.addEventListener('contextmenu', (event) => openTabPaneQuickAssign(tabId, event));

  webview.addEventListener('page-title-updated', (event: any) => updateTab(tab, { title: event.title || titleFromUrl(tab.url) }));
  webview.addEventListener('did-start-loading', () => setStatus(`Loading ${titleFromUrl(tab.url)}`, securityLabel(tab.url)));
  webview.addEventListener('did-stop-loading', () => setStatus(tab.title, securityLabel(tab.url)));
  webview.addEventListener('did-navigate', (event: any) => updateTab(tab, { url: event.url, title: titleFromUrl(event.url) }));
  webview.addEventListener('did-navigate-in-page', (event: any) => updateTab(tab, { url: event.url, title: titleFromUrl(event.url) }));
  webview.addEventListener('will-navigate', (event: any) => {
    if (typeof event.url === 'string' && isUnsafeLocalUrl(event.url)) {
      event.preventDefault();
      tab.webview.loadURL(config.newTabUrl);
      updateTab(tab, { title: 'TAHAI Launchpad', url: config.newTabUrl });
    }
  });
  webview.addEventListener('console-message', (event: any) => recordConsoleMessage(tab, event));
  webview.addEventListener('focus', () => setActive(tabId));
  webview.addEventListener('did-fail-load', (event: any) => {
    if (event.errorCode === -3) return;
    const failedUrl = event.validatedURL || tab.url;
    const localError = errorUrl(failedUrl, event.errorDescription || 'The page failed to load.');
    updateTab(tab, { title: 'Load issue', url: localError });
    tab.webview.loadURL(localError);
  });
  webview.addEventListener('new-window', (event: any) => {
    event.preventDefault();
    if (typeof event.url === 'string' && /^https?:\/\//i.test(event.url)) createTab(event.url);
  });

  setActive(tabId);
  return tabId;
}

function active(): TabState | undefined { return tabs.get(activeTabId); }

// PASS 43 Mission Views hardening: central pane visibility, HUD labels, drag/drop, and active-pane routing.
function missionVisiblePaneIds(layout: MissionLayoutType): string[] {
  return visibleMissionPaneIds(layout, currentMission?.layout.activePaneId || 'pane-1');
}

function normalizeMissionPaneId(paneId: string | undefined): string {
  return missionPaneIds.includes(paneId as typeof missionPaneIds[number]) ? String(paneId) : 'pane-1';
}

function layoutForPaneCount(count: number): MissionLayoutType {
  if (count >= 4) return 'quad';
  if (count === 3) return 'triple';
  if (count === 2) return 'split-horizontal';
  return 'single';
}

function paneCountForLayout(layout: MissionLayoutType): number {
  return missionVisiblePaneIds(layout).length;
}

function visibleLayoutForPane(paneId: string, requested: MissionLayoutType | undefined): MissionLayoutType {
  const paneIndex = missionPaneIds.indexOf(normalizeMissionPaneId(paneId) as typeof missionPaneIds[number]);
  const minimumLayout = layoutForPaneCount(paneIndex + 1);
  if (!requested || requested === 'single' || requested === 'focus' || paneCountForLayout(requested) < paneIndex + 1) return minimumLayout;
  return requested;
}

function missionPaneTab(paneId: string): MissionTabRef | undefined {
  return currentMission?.tabs.find((candidate) => candidate.paneId === paneId);
}

function missionPaneRuntimeTab(paneId: string): TabState | undefined {
  const missionTab = missionPaneTab(paneId);
  const runtimeTabId = missionTab ? missionRuntimeTabs.get(missionTab.tabId) : undefined;
  return runtimeTabId ? tabs.get(runtimeTabId) : undefined;
}

function missionPaneLabel(paneId: string): string {
  return paneId.replace('pane-', 'Pane ');
}

function renderMissionPaneHeads(layout: MissionLayoutType, enabled: boolean): void {
  if (!stageEl) return;
  if (!missionPaneHeads) {
    missionPaneHeads = document.createElement('div');
    missionPaneHeads.className = 'mission-pane-heads';
    missionPaneHeads.setAttribute('aria-label', 'Mission pane focus controls');
    missionPaneHeads.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-focus-mission-pane]');
      if (!button?.dataset.focusMissionPane) return;
      event.preventDefault();
      setMissionActivePane(button.dataset.focusMissionPane);
    });
    stageEl.appendChild(missionPaneHeads);
  }
  if (!enabled || !currentMission) {
    missionPaneHeads.hidden = true;
    missionPaneHeads.innerHTML = '';
    return;
  }
  const visiblePanes = missionVisiblePaneIds(layout);
  missionPaneHeads.hidden = false;
  missionPaneHeads.dataset.layout = layout;
  const activePane = normalizeMissionPaneId(currentMission.layout.activePaneId);
  missionPaneHeads.innerHTML = visiblePanes.map((paneId) => {
    const missionTab = missionPaneTab(paneId);
    const runtimeTab = missionPaneRuntimeTab(paneId);
    const title = runtimeTab?.title || missionTab?.title || 'Empty pane';
    const role = missionTab ? missionRoleLabel(missionTab.role) : 'Drop or send a tab';
    const activeClass = paneId === activePane ? ' active' : '';
    return '<div class="mission-pane-head-cell" data-pane-id="' + escapeHtml(paneId) + '">' +
      '<button type="button" class="mission-pane-head' + activeClass + '" data-focus-mission-pane="' + escapeHtml(paneId) + '" title="Focus ' + escapeHtml(missionPaneLabel(paneId)) + '">' +
      '<strong>' + escapeHtml(missionPaneLabel(paneId)) + '</strong>' +
      '<span>' + escapeHtml(role + ' · ' + title) + '</span>' +
      '</button>' +
      '</div>';
  }).join('');
}

function renderMissionPaneDropZones(layout: MissionLayoutType, enabled: boolean): void {
  if (!stageEl) return;
  if (!missionPaneDropZones) {
    missionPaneDropZones = document.createElement('div');
    missionPaneDropZones.className = 'mission-pane-drop-zones';
    missionPaneDropZones.setAttribute('aria-label', 'Mission pane drop targets');
    missionPaneDropZones.ondragover = (event) => {
      const zone = (event.target as HTMLElement).closest<HTMLElement>('[data-pane-id]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.add('drag-over');
    };
    missionPaneDropZones.ondragleave = (event) => {
      (event.target as HTMLElement).closest<HTMLElement>('[data-pane-id]')?.classList.remove('drag-over');
    };
    missionPaneDropZones.ondrop = (event) => {
      const zone = (event.target as HTMLElement).closest<HTMLElement>('[data-pane-id]');
      if (!zone) return;
      event.preventDefault();
      zone.classList.remove('drag-over');
      const paneId = normalizeMissionPaneId(zone.dataset.paneId);
      const browserTabId = event.dataTransfer?.getData('application/x-tahai-browser-tab-id') || '';
      const missionTabId = event.dataTransfer?.getData('application/x-tahai-mission-tab-id') || '';
      if (browserTabId && tabs.has(browserTabId)) {
        upsertBrowserTabIntoMissionPane(browserTabId, paneId, { activateLayout: true });
        return;
      }
      if (missionTabId) moveMissionTabToPane(missionTabId, paneId);
    };
    stageEl.appendChild(missionPaneDropZones);
  }
  if (!enabled || !currentMission) {
    missionPaneDropZones.hidden = true;
    missionPaneDropZones.innerHTML = '';
    return;
  }
  const visiblePanes = missionVisiblePaneIds(layout);
  missionPaneDropZones.hidden = false;
  missionPaneDropZones.dataset.layout = layout;
  const activePane = normalizeMissionPaneId(currentMission.layout.activePaneId);
  missionPaneDropZones.innerHTML = visiblePanes.map((paneId) => {
    const tab = missionPaneTab(paneId);
    return '<div class="mission-pane-drop-zone' + (paneId === activePane ? ' active-pane' : '') + '" data-pane-id="' + escapeHtml(paneId) + '">' +
      '<strong>' + escapeHtml(missionPaneLabel(paneId)) + '</strong>' +
      '<span>' + escapeHtml(tab ? missionRoleLabel(tab.role) + ' · ' + tab.title : 'Drop a tab here or use Ctrl+Alt+' + paneId.slice(-1)) + '</span>' +
      '</div>';
  }).join('');
}

function startMissionTabDrag(tabId: string, event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-tahai-browser-tab-id', tabId);
  const tab = tabs.get(tabId);
  if (tab) event.dataTransfer.setData('text/plain', tab.url);
  document.body.classList.add('mission-tab-dragging');
}

function endMissionTabDrag(): void {
  document.body.classList.remove('mission-tab-dragging');
  missionPaneDropZones?.querySelectorAll('.drag-over').forEach((element) => element.classList.remove('drag-over'));
}

function upsertBrowserTabIntoMissionPane(tabId: string, paneIdInput: string, options: { activateLayout?: boolean } = {}): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  const mission = ensureCurrentMission();
  const paneId = normalizeMissionPaneId(paneIdInput);
  let missionTab = mission.tabs.find((candidate) => missionRuntimeTabs.get(candidate.tabId) === tabId || candidate.url === tab.url);
  if (!missionTab) {
    missionTab = { tabId: missionUuid(), role: missionDefaultRole(tab.url), url: tab.url, title: tab.title, pinned: false, paneId };
    mission.tabs.push(missionTab);
    missionRuntimeTabs.set(missionTab.tabId, tabId);
    missionTimelineEvent('tab-added', tab.title, missionTab.role + ' · ' + tab.url);
  } else {
    missionRuntimeTabs.set(missionTab.tabId, tabId);
    missionTab.url = tab.url;
    missionTab.title = tab.title;
    missionTab.paneId = paneId;
    missionTimelineEvent('layout-set', 'Pane assignment changed', tab.title + ' → ' + missionPaneLabel(paneId));
  }
  tab.missionPaneId = paneId;
  mission.layout.activePaneId = paneId;
  if (options.activateLayout) mission.layout.type = visibleLayoutForPane(paneId, mission.layout.type);
  syncMissionLayoutPanes();
  renderMissionControl();
  renderMissionLayout();
}

function makeQuadFromOpenTabs(): void {
  const openTabs = Array.from(tabs.values()).slice(0, 4);
  if (!openTabs.length) {
    setStatus('No open tabs for Quad View', 'Open tabs first, then build a Mission View.');
    return;
  }
  const mission = ensureCurrentMission();
  mission.layout.type = openTabs.length >= 4 ? 'quad' : layoutForPaneCount(openTabs.length);
  mission.layout.activePaneId = 'pane-1';
  openTabs.forEach((tab, index) => upsertBrowserTabIntoMissionPane(tab.id, missionPaneIds[index] || 'pane-1', { activateLayout: false }));
  mission.layout.type = openTabs.length >= 4 ? 'quad' : layoutForPaneCount(openTabs.length);
  syncMissionLayoutPanes();
  missionTimelineEvent('layout-set', 'Mission View seeded from open tabs', `${openTabs.length} open tab(s) assigned to panes.`);
  renderMissionControl();
  renderMissionLayout();
  setStatus('Mission View ready', missionLayoutLabel(mission.layout.type));
}

function openTabPaneQuickAssign(tabId: string, event: MouseEvent): void {
  event.preventDefault();
  const tab = tabs.get(tabId);
  if (!tab) return;
  const mission = ensureCurrentMission();
  const existing = mission.tabs.find((candidate) => missionRuntimeTabs.get(candidate.tabId) === tabId || candidate.url === tab.url);
  const currentIndex = existing ? missionPaneIds.indexOf(existing.paneId as typeof missionPaneIds[number]) : -1;
  const nextPane = missionPaneIds[(currentIndex + 1) % missionPaneIds.length] || 'pane-1';
  upsertBrowserTabIntoMissionPane(tabId, nextPane, { activateLayout: true });
  setStatus('Mission pane assigned', `${tab.title} → ${missionPaneLabel(nextPane)}`);
}

// PASS 17 Mission Control layout routing: toolbar/navigation commands target the active Mission pane.
function activeMissionPaneId(): string | undefined {
  if (!currentMission || currentMission.layout.type === 'single') return undefined;
  const visiblePanes = missionVisiblePaneIds(currentMission.layout.type);
  const paneId = currentMission.layout.activePaneId || 'pane-1';
  return visiblePanes.includes(paneId) ? paneId : visiblePanes[0];
}

function tabForMissionPane(paneId: string | undefined): TabState | undefined {
  if (!paneId || !currentMission) return undefined;
  const missionTab = currentMission.tabs.find((candidate) => candidate.paneId === paneId);
  const runtimeTabId = missionTab ? missionRuntimeTabs.get(missionTab.tabId) : undefined;
  return runtimeTabId ? tabs.get(runtimeTabId) : undefined;
}

function activeNavigationTarget(): TabState | undefined {
  return tabForMissionPane(activeMissionPaneId()) || active();
}

function navigateTarget(tab: TabState | undefined, url: string): void {
  if (!tab) return;
  const target = normalizeTarget(url);
  tab.webview.loadURL(target);
  updateTab(tab, { url: target, title: titleFromUrl(target) });
}

function navigate(url: string): void {
  navigateTarget(activeNavigationTarget(), url);
}

function goBackTarget(): void {
  const tab = activeNavigationTarget();
  if (tab?.webview.canGoBack()) tab.webview.goBack();
}

function goForwardTarget(): void {
  const tab = activeNavigationTarget();
  if (tab?.webview.canGoForward()) tab.webview.goForward();
}

function reloadTarget(): void { activeNavigationTarget()?.webview.reload(); }

function swapActiveMissionPane(direction: -1 | 1): void {
  if (!currentMission || currentMission.layout.type === 'single') return;
  const visiblePanes = missionVisiblePaneIds(currentMission.layout.type);
  const activePane = activeMissionPaneId() || visiblePanes[0] || 'pane-1';
  const index = visiblePanes.indexOf(activePane);
  if (index < 0 || visiblePanes.length < 2) return;
  const otherPane = visiblePanes[(index + direction + visiblePanes.length) % visiblePanes.length];
  const activeMissionTab = currentMission.tabs.find((candidate) => candidate.paneId === activePane);
  const otherMissionTab = currentMission.tabs.find((candidate) => candidate.paneId === otherPane);
  if (!activeMissionTab && !otherMissionTab) return;
  if (activeMissionTab) activeMissionTab.paneId = otherPane;
  if (otherMissionTab) otherMissionTab.paneId = activePane;
  currentMission.layout.activePaneId = otherPane;
  syncMissionLayoutPanes();
  missionTimelineEvent('layout-set', 'Pane quick swap', activePane.replace('pane-', 'Pane ') + ' swapped with ' + otherPane.replace('pane-', 'Pane '));
  renderMissionControl();
  renderMissionLayout();
  setStatus('Mission pane swapped', activePane.replace('pane-', 'Pane ') + ' ⇄ ' + otherPane.replace('pane-', 'Pane '));
}

function currentMissionTabForActiveTab(): MissionTabRef | undefined {
  const tab = active();
  if (!tab || !currentMission) return undefined;
  return currentMission.tabs.find((candidate) => missionRuntimeTabs.get(candidate.tabId) === tab.id || candidate.url === tab.url);
}

function addMissionEvidenceEntry(input: { kind: MissionEvidenceKind; title: string; url?: string; operatorNote?: string; metadata?: Record<string, string> }): void {
  const mission = ensureCurrentMission();
  const activeMissionTab = currentMissionTabForActiveTab();
  const now = new Date().toISOString();
  const entry: MissionEvidenceEntry = {
    eventId: missionUuid(),
    kind: input.kind,
    title: input.title.trim().slice(0, 180) || 'Mission evidence',
    url: (input.url || currentActiveUrl() || '').slice(0, 2048),
    sourceTabId: activeMissionTab?.tabId,
    paneId: activeMissionTab?.paneId || mission.layout.activePaneId,
    createdAt: now,
    operatorNote: (input.operatorNote || '').trim().slice(0, 1200),
    metadata: input.metadata || {}
  };
  ensureMissionEvidence(mission).unshift(entry);
  mission.evidence = mission.evidence.slice(0, 80);
  missionTimelineEvent('evidence-added', entry.title, missionEvidenceKindLabel(entry.kind) + (entry.paneId ? ' · ' + entry.paneId : ''));
  renderMissionControl();
}

function pinLatestToolOutputToMission(): void {
  const candidate = latestEvidenceCandidate();
  if (!candidate) {
    setStatus('Nothing to pin to mission', 'Run or open a TAHAI tool output first.');
    return;
  }
  addMissionEvidenceEntry({
    kind: 'tool-output',
    title: candidate.title,
    url: candidate.sourceUrl,
    operatorNote: candidate.markdown.slice(0, 1200),
    metadata: { source: candidate.type, profile: activeProfileLabel() }
  });
  setStatus('Mission evidence pinned', candidate.title);
}

function pinActivePageToMission(): void {
  const tab = active();
  if (!tab) return;
  const missionTab = currentMissionTabForActiveTab();
  addMissionEvidenceEntry({
    kind: 'url',
    title: tab.title || titleFromUrl(tab.url),
    url: tab.url,
    operatorNote: 'Active page pinned as mission evidence.',
    metadata: { profile: activeProfileLabel(), pane: missionTab?.paneId || currentMission?.layout.activePaneId || 'pane-1' }
  });
  setStatus('Active page pinned to mission', tab.title || tab.url);
}

function removeMissionEvidenceEntry(eventId: string): void {
  if (!currentMission) return;
  const removed = ensureMissionEvidence(currentMission).find((entry) => entry.eventId === eventId);
  currentMission.evidence = ensureMissionEvidence(currentMission).filter((entry) => entry.eventId !== eventId);
  if (removed) missionTimelineEvent('evidence-added', 'Mission evidence removed', removed.title);
  renderMissionControl();
  setStatus('Mission evidence removed', removed?.title || '');
}

async function copyMissionEvidenceEntry(eventId: string): Promise<void> {
  if (!currentMission) return;
  const entry = ensureMissionEvidence(currentMission).find((candidate) => candidate.eventId === eventId);
  if (!entry) return;
  const metadata = Object.entries(entry.metadata || {}).map(([key, value]) => `- ${md(key)}: ${md(String(value))}`).join('\n') || '- _No metadata._';
  await window.tahaiBrowser.copyDevOpsCapture(`## ${md(entry.title)}\n\n- Kind: ${md(entry.kind)}\n- URL: ${md(entry.url || 'n/a')}\n- Pane: ${md(entry.paneId || 'n/a')}\n- Captured: ${md(entry.createdAt)}\n\n${md(entry.operatorNote || 'No note.')}\n\n### Metadata\n${metadata}\n`);
  setStatus('Mission evidence copied', entry.title);
}



function updateMissionRunbookFromFields(): void {
  if (!currentMission) return;
  const runbook = ensureMissionRunbook(currentMission);
  runbook.objective = missionRunbookObjective.value.trim().slice(0, 500);
  runbook.rollback = missionRunbookRollback.value.trim().slice(0, 500);
  currentMission.updatedAt = new Date().toISOString();
  missionTimelineEvent('runbook-updated', 'Runbook updated', 'Objective or rollback/stop condition changed locally.');
  renderMissionControl();
}

function addMissionRunbookStep(): void {
  const mission = ensureCurrentMission();
  const label = missionRunbookStepInput.value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 220);
  if (!label) return;
  ensureMissionRunbook(mission).steps.unshift({ stepId: missionUuid(), label, state: 'todo', evidenceNote: '' });
  missionRunbookStepInput.value = '';
  missionTimelineEvent('checklist-added', 'Runbook step added', label);
  renderMissionControl();
  setStatus('Runbook step added', label);
}

function cycleMissionRunbookStep(stepId: string): void {
  if (!currentMission) return;
  const step = ensureMissionRunbook(currentMission).steps.find((candidate) => candidate.stepId === stepId);
  if (!step) return;
  const nextIndex = (missionRunbookStepStates.indexOf(step.state) + 1) % missionRunbookStepStates.length;
  step.state = missionRunbookStepStates[nextIndex] || 'todo';
  currentMission.updatedAt = new Date().toISOString();
  missionTimelineEvent('checklist-updated', step.label, 'Step marked ' + step.state + '.');
  renderMissionControl();
}

function removeMissionRunbookStep(stepId: string): void {
  if (!currentMission) return;
  const runbook = ensureMissionRunbook(currentMission);
  const removed = runbook.steps.find((step) => step.stepId === stepId);
  runbook.steps = runbook.steps.filter((step) => step.stepId !== stepId);
  currentMission.updatedAt = new Date().toISOString();
  if (removed) missionTimelineEvent('checklist-updated', 'Runbook step removed', removed.label);
  renderMissionControl();
}

function addMissionNote(): void {
  const mission = ensureCurrentMission();
  const note = missionNoteInput.value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 4000);
  if (!note) return;
  mission.notes.unshift(note);
  mission.notes = mission.notes.slice(0, 80);
  missionNoteInput.value = '';
  missionTimelineEvent('note', 'Local note added', note.slice(0, 180));
  renderMissionControl();
  setStatus('Mission note added', 'Run Ops Guard before sharing or syncing.');
}

function ensureCurrentMission(): MissionState {
  if (currentMission) return currentMission;
  const missionType = (missionTypes.includes(missionTypeSelect?.value as MissionType) ? missionTypeSelect.value : 'generic') as MissionType;
  currentMission = createEmptyMission({ name: missionNameInput?.value || '', missionType });
  return currentMission;
}

function missionTimelineEvent(kind: MissionTimelineEvent['kind'], title: string, detail: string): void {
  appendMissionTimelineEvent(ensureCurrentMission(), kind, title, detail);
}

function syncMissionLayoutPanes(): void {
  if (!currentMission) return;
  syncMissionLayoutPanesForMission(currentMission);
}

function updateMissionTabRuntimeFromBrowser(tab: TabState): void {
  if (!currentMission) return;
  const missionTab = currentMission.tabs.find((candidate) => missionRuntimeTabs.get(candidate.tabId) === tab.id);
  if (!missionTab) return;
  missionTab.title = tab.title;
  missionTab.url = tab.url;
  currentMission.updatedAt = new Date().toISOString();
  renderMissionControl();
}

function renderMissionLayout(): void {
  if (!stageEl || !tabs.size) return;
  const layout = currentMission?.layout.type || 'single';
  stageEl.dataset.missionLayout = layout;
  const missionModeActive = Boolean(currentMission && layout !== 'single');
  stageEl.classList.toggle('mission-layout', missionModeActive);
  for (const name of missionLayouts) stageEl.classList.toggle('mission-layout-' + name, missionModeActive && layout === name);
  if (!missionModeActive) {
    renderMissionPaneDropZones(layout, false);
    renderMissionPaneHeads(layout, false);
    for (const tab of tabs.values()) {
      tab.webview.classList.toggle('active', tab.id === activeTabId);
      tab.webview.classList.remove('mission-active-pane');
      tab.webview.removeAttribute('data-pane-label');
      tab.webview.style.removeProperty('order');
    }
    return;
  }
  const visiblePanes = missionVisiblePaneIds(layout);
  renderMissionPaneDropZones(layout, true);
  const runtimeByPane = new Map<string, string>();
  for (const missionTab of currentMission?.tabs || []) {
    const runtimeTabId = missionRuntimeTabs.get(missionTab.tabId);
    if (runtimeTabId && visiblePanes.includes(missionTab.paneId) && !runtimeByPane.has(missionTab.paneId)) runtimeByPane.set(missionTab.paneId, runtimeTabId);
  }
  const activePaneId = normalizeMissionPaneId(currentMission?.layout.activePaneId);
  renderMissionPaneHeads(layout, true);
  for (const tab of tabs.values()) {
    const paneId = Array.from(runtimeByPane.entries()).find(([, runtimeTabId]) => runtimeTabId === tab.id)?.[0];
    const visible = Boolean(paneId);
    tab.webview.classList.toggle('active', visible);
    tab.webview.classList.toggle('mission-active-pane', visible && paneId === activePaneId);
    if (paneId) {
      tab.webview.setAttribute('data-pane-label', paneId.replace('pane-', 'Pane '));
      tab.webview.style.order = String(visiblePanes.indexOf(paneId) + 1);
    } else {
      tab.webview.removeAttribute('data-pane-label');
      tab.webview.style.removeProperty('order');
    }
  }
}

function toggleMissionFocusPane(): void {
  const mission = ensureCurrentMission();
  if (mission.layout.type === 'focus') {
    setMissionLayout(lastMissionLayoutBeforeFocus === 'focus' ? 'quad' : lastMissionLayoutBeforeFocus);
    return;
  }
  lastMissionLayoutBeforeFocus = mission.layout.type === 'single' ? 'quad' : mission.layout.type;
  setMissionLayout('focus');
}

function setMissionLayout(layout: MissionLayoutType): void {
  const mission = ensureCurrentMission();
  mission.layout.type = layout;
  syncMissionLayoutPanes();
  missionTimelineEvent('layout-set', missionLayoutLabel(layout), 'Mission Control view changed locally.');
  renderMissionControl();
  renderMissionLayout();
  setStatus('Mission layout set', missionLayoutLabel(layout));
}

function setMissionActivePane(paneId: string): void {
  if (!currentMission || !missionPaneIds.includes(paneId as typeof missionPaneIds[number])) return;
  currentMission.layout.activePaneId = paneId;
  const missionTab = currentMission.tabs.find((candidate) => candidate.paneId === paneId);
  const runtimeTabId = missionTab ? missionRuntimeTabs.get(missionTab.tabId) : undefined;
  if (runtimeTabId && tabs.has(runtimeTabId)) setActive(runtimeTabId);
  renderMissionLayout();
  setStatus('Mission active pane', paneId.replace('pane-', 'Pane '));
}

function missionExportMarkdown(): string {
  const rawMarkdown = buildMissionExportMarkdown(currentMission, md);
  return scanAndRedact(rawMarkdown).redacted;
}

function missionExportStatusDetail(result: Awaited<ReturnType<typeof window.tahaiBrowser.copyMissionExport>>): string {
  const findingCount = result.findings?.reduce((sum, finding) => sum + finding.count, 0) || 0;
  const findingClasses = result.findings?.length || 0;
  return `${findingCount} secret-like value(s) across ${findingClasses} class(es) redacted before copy/save.`;
}

async function copyMissionExportPacket(): Promise<void> {
  if (!currentMission) { setStatus('No mission packet to copy'); return; }
  const result = await window.tahaiBrowser.copyMissionExport(currentMission);
  if (!result.ok) { setStatus('Mission export blocked', result.error || 'Validation failed.'); return; }
  if (result.redactedMarkdown) missionExportPreview.value = result.redactedMarkdown;
  missionTimelineEvent('exported', 'Mission packet copied', missionExportStatusDetail(result));
  renderMissionControl();
  setStatus('Mission packet copied', missionExportStatusDetail(result));
}

async function saveMissionExportPacket(): Promise<void> {
  if (!currentMission) { setStatus('No mission packet to save'); return; }
  const result = await window.tahaiBrowser.saveMissionExport(currentMission);
  if (!result.ok) { setStatus('Mission export not saved', result.error || 'Validation failed or canceled.'); return; }
  if (result.redactedMarkdown) missionExportPreview.value = result.redactedMarkdown;
  missionTimelineEvent('exported', 'Mission packet saved', result.path || missionExportStatusDetail(result));
  renderMissionControl();
  setStatus('Mission packet saved', result.path || missionExportStatusDetail(result));
}

function renderMissionList(): void {
  if (!missionList) return;
  if (!missionStore.length) {
    missionList.innerHTML = '<article class="ops-hub-empty">No local missions saved yet.</article>';
    return;
  }
  missionList.innerHTML = missionStore.map((mission) => '<article class="ops-hub-row split mission-saved-mission-card">' +
    '<button type="button" data-load-mission-id="' + escapeHtml(mission.missionId) + '" title="Preview saved mission without opening tabs"><strong>' + escapeHtml(mission.name) + '</strong><span>' + escapeHtml(mission.missionType + ' · ' + mission.tabs.length + ' tab(s) · ' + new Date(mission.updatedAt).toLocaleString()) + '</span></button>' +
    '<span class="mission-saved-actions">' +
    '<button type="button" class="home-button secondary" data-duplicate-mission-id="' + escapeHtml(mission.missionId) + '" title="Duplicate mission">Copy</button>' +
    '<button type="button" class="home-button secondary mission-restore-button" data-restore-mission-id="' + escapeHtml(mission.missionId) + '" title="Choose how to restore this mission">Restore…</button>' +
    '<button type="button" class="mini-danger" data-delete-mission-id="' + escapeHtml(mission.missionId) + '" title="Delete local mission">×</button>' +
    '</span>' +
    '</article>').join('');
}

function renderMissionControl(): void {
  if (!missionDialog) return;
  const mission = currentMission;
  missionNameInput.value = mission?.name || missionNameInput.value || '';
  missionTypeSelect.value = mission?.missionType || missionTypeSelect.value || 'generic';
  missionStatus.innerHTML = mission
    ? '<strong>' + escapeHtml(mission.name) + '</strong><span>Local Only · ' + escapeHtml(missionLayoutLabel(mission.layout.type)) + ' · ' + mission.tabs.length + ' mission tab(s) · ' + ensureMissionEvidence(mission).length + ' evidence item(s) · drag tab strip items onto panes · saved missions can be duplicated or deleted</span>'
    : '<strong>No active mission</strong><span>Create a local Mission Tab set or restore one from disk.</span>';
  missionTabsList.innerHTML = mission?.tabs.length ? mission.tabs.map((tab) =>
    '<article class="mission-tab-row" draggable="true" data-drag-mission-tab="' + escapeHtml(tab.tabId) + '">' +
    '<button type="button" data-focus-mission-tab="' + escapeHtml(tab.tabId) + '"><strong>' + (tab.pinned ? '★ ' : '') + escapeHtml(tab.title) + '</strong><span>' + escapeHtml(tab.url) + '</span></button>' +
    '<select data-role-mission-tab="' + escapeHtml(tab.tabId) + '">' + missionTabRoles.map((role) => '<option value="' + role + '"' + (role === tab.role ? ' selected' : '') + '>' + missionRoleLabel(role) + '</option>').join('') + '</select>' +
    '<button type="button" class="home-button secondary" data-pane-mission-tab="' + escapeHtml(tab.tabId) + '">' + escapeHtml(tab.paneId) + '</button>' +
    '<button type="button" class="home-button secondary" data-pin-mission-tab="' + escapeHtml(tab.tabId) + '" title="Pin mission tab">' + (tab.pinned ? 'Pinned' : 'Pin') + '</button>' +
    '<button type="button" class="mini-danger" data-remove-mission-tab="' + escapeHtml(tab.tabId) + '" title="Remove from mission">×</button>' +
    '</article>'
  ).join('') : '<article class="ops-hub-empty">Add the active browser tab to start shaping this mission.</article>';
  if (mission) {
    const runbook = ensureMissionRunbook(mission);
    if (document.activeElement !== missionRunbookObjective) missionRunbookObjective.value = runbook.objective || '';
    if (document.activeElement !== missionRunbookRollback) missionRunbookRollback.value = runbook.rollback || '';
    missionRunbookList.innerHTML = runbook.steps.length ? runbook.steps.map((step) => '<article class="mission-runbook-step ' + escapeHtml(step.state) + '">' +
      '<button type="button" class="mission-step-state" data-cycle-runbook-step="' + escapeHtml(step.stepId) + '">' + escapeHtml(step.state) + '</button>' +
      '<span>' + escapeHtml(step.label) + '</span>' +
      '<button type="button" class="mini-danger" data-remove-runbook-step="' + escapeHtml(step.stepId) + '" title="Remove step">×</button>' +
      '</article>').join('') : '<article class="ops-hub-empty">No checklist steps. Add a bounded runbook step.</article>';
    missionNotesList.innerHTML = mission.notes.length ? mission.notes.slice(0, 5).map((note) => '<article class="ops-hub-row"><strong>Local note</strong><span>' + escapeHtml(note) + '</span></article>').join('') : '<article class="ops-hub-empty">No local mission notes yet.</article>';
  } else {
    missionRunbookObjective.value = '';
    missionRunbookRollback.value = '';
    missionRunbookList.innerHTML = '<article class="ops-hub-empty">Create or load a mission to use the runbook rail.</article>';
    missionNotesList.innerHTML = '<article class="ops-hub-empty">No active mission notes.</article>';
  }
  missionEvidenceList.innerHTML = mission && ensureMissionEvidence(mission).length ? ensureMissionEvidence(mission).slice(0, 12).map((entry) => '<article class="ops-hub-row split"><button type="button" data-copy-mission-evidence="' + escapeHtml(entry.eventId) + '"><strong>' + escapeHtml(missionEvidenceKindLabel(entry.kind) + ' · ' + entry.title) + '</strong><span>' + escapeHtml((entry.paneId || 'mission') + ' · ' + new Date(entry.createdAt).toLocaleString() + (entry.url ? ' · ' + entry.url : '')) + '</span></button><button type="button" class="mini-danger" data-remove-mission-evidence="' + escapeHtml(entry.eventId) + '" title="Remove mission evidence">×</button></article>').join('') : '<article class="ops-hub-empty">No mission evidence pinned yet. Pin active page or latest tool output explicitly.</article>';
  missionTimeline.innerHTML = mission?.timeline.length ? mission.timeline.slice(0, 8).map((event) => '<article class="ops-hub-row"><strong>' + escapeHtml(event.title) + '</strong><span>' + escapeHtml(event.kind + ' · ' + new Date(event.createdAt).toLocaleString() + (event.detail ? ' · ' + event.detail : '')) + '</span></article>').join('') : '<article class="ops-hub-empty">Timeline starts after mission actions.</article>';
  missionLayoutsEl.querySelectorAll<HTMLButtonElement>('[data-mission-layout]').forEach((button) => button.classList.toggle('active', button.dataset.missionLayout === (mission?.layout.type || 'single')));
  missionExportPreview.value = missionExportMarkdown();
  renderMissionList();
  renderMissionRecipes();
}

async function refreshMissionStore(): Promise<void> {
  const result = await window.tahaiBrowser.listMissions();
  missionStore = result.ok ? result.missions : [];
  renderMissionControl();
}

async function openMissionControl(): Promise<void> {
  closeToolMenus();
  if (!missionTypeSelect.options.length) {
    missionTypeSelect.innerHTML = missionTypes.map((type) => '<option value="' + type + '">' + type.replace(/-/g, ' ') + '</option>').join('');
  }
  await refreshMissionStore();
  renderMissionControl();
  if (!missionDialog.open) missionDialog.showModal();
}

function createMissionFromForm(): void {
  const missionType = (missionTypes.includes(missionTypeSelect.value as MissionType) ? missionTypeSelect.value : 'generic') as MissionType;
  currentMission = createEmptyMission({
    name: missionNameInput.value,
    missionType,
    createdDetail: 'Local-only browser mission started.'
  });
  missionRuntimeTabs.clear();
  renderMissionControl();
  renderMissionLayout();
  setStatus('Mission created', currentMission.name);
}

function addActiveTabToMission(): void {
  const tab = active();
  if (!tab) return;
  const mission = ensureCurrentMission();
  const existing = mission.tabs.find((candidate) => missionRuntimeTabs.get(candidate.tabId) === tab.id || candidate.url === tab.url);
  if (existing) {
    missionRuntimeTabs.set(existing.tabId, tab.id);
    tab.missionPaneId = existing.paneId;
    setStatus('Tab already in mission', existing.title);
    return;
  }
  const tabId = missionUuid();
  const paneId = missionPaneIds[Math.min(mission.tabs.length, 3)] || 'pane-1';
  const role = missionDefaultRole(tab.url);
  mission.tabs.push({ tabId, role, url: tab.url, title: tab.title, pinned: false, paneId });
  missionRuntimeTabs.set(tabId, tab.id);
  tab.missionPaneId = paneId;
  syncMissionLayoutPanes();
  missionTimelineEvent('tab-added', tab.title, role + ' · ' + tab.url);
  renderMissionControl();
  renderMissionLayout();
  setStatus('Mission tab added', tab.title);
}

async function renameCurrentMission(): Promise<void> {
  const mission = ensureCurrentMission();
  const nextName = await requestTextInput({
    title: 'Rename Mission',
    label: 'Mission name',
    defaultValue: mission.name,
    placeholder: 'Cloudflare DNS Migration',
    confirmLabel: 'Rename',
    maxLength: 96
  });
  if (!nextName) return;
  const previousName = mission.name;
  mission.name = normalizeMissionName(nextName, mission.name);
  missionNameInput.value = mission.name;
  if (mission.name !== previousName) missionTimelineEvent('mission-renamed', 'Mission renamed', previousName + ' → ' + mission.name);
  renderMissionControl();
  setStatus('Mission renamed', mission.name);
}

function removeMissionTab(tabId: string): void {
  if (!currentMission) return;
  const tab = currentMission.tabs.find((candidate) => candidate.tabId === tabId);
  if (!tab) return;
  currentMission.tabs = currentMission.tabs.filter((candidate) => candidate.tabId !== tabId);
  missionRuntimeTabs.delete(tabId);
  syncMissionLayoutPanes();
  missionTimelineEvent('layout-set', 'Mission tab removed', tab.title);
  renderMissionControl();
  renderMissionLayout();
}

function toggleMissionTabPin(tabId: string): void {
  if (!currentMission) return;
  const tab = currentMission.tabs.find((candidate) => candidate.tabId === tabId);
  if (!tab) return;
  tab.pinned = !tab.pinned;
  currentMission.updatedAt = new Date().toISOString();
  renderMissionControl();
  setStatus(tab.pinned ? 'Mission tab pinned' : 'Mission tab unpinned', tab.title);
}

function moveMissionTabToPane(tabId: string, paneId: string): void {
  if (!currentMission || !missionPaneIds.includes(paneId as typeof missionPaneIds[number])) return;
  const tab = currentMission.tabs.find((candidate) => candidate.tabId === tabId);
  if (!tab) return;
  tab.paneId = paneId;
  currentMission.layout.activePaneId = paneId;
  syncMissionLayoutPanes();
  missionTimelineEvent('layout-set', 'Pane assignment changed', tab.title + ' → ' + paneId.replace('pane-', 'Pane '));
  renderMissionControl();
  renderMissionLayout();
}

async function saveCurrentMission(): Promise<void> {
  const mission = ensureCurrentMission();
  const previousName = mission.name;
  mission.name = normalizeMissionName(missionNameInput.value, mission.name);
  if (mission.name !== previousName) missionTimelineEvent('mission-renamed', 'Mission renamed', previousName + ' → ' + mission.name);
  mission.missionType = (missionTypes.includes(missionTypeSelect.value as MissionType) ? missionTypeSelect.value : mission.missionType) as MissionType;
  const runbook = ensureMissionRunbook(mission);
  runbook.objective = missionRunbookObjective.value.trim().slice(0, 500) || runbook.objective;
  runbook.rollback = missionRunbookRollback.value.trim().slice(0, 500) || runbook.rollback;
  syncMissionLayoutPanes();
  missionTimelineEvent('saved', 'Mission saved locally', 'Validated main-process persistence requested.');
  const result = await window.tahaiBrowser.saveMission(mission);
  if (result.ok && result.mission) {
    const savedMission = result.mission;
    currentMission = savedMission;
    await refreshMissionStore();
    renderMissionControl();
    setStatus('Mission saved', result.path || savedMission.name);
  } else {
    setStatus('Mission save blocked', result.error || 'Validation failed.');
  }
}

async function duplicateMissionById(missionId: string): Promise<void> {
  const result = await window.tahaiBrowser.loadMission(missionId);
  if (!result.ok || !result.mission) {
    setStatus('Mission duplicate failed', result.error || 'Mission not available.');
    return;
  }
  const name = await requestTextInput({ title: 'Duplicate Mission', label: 'New mission name', defaultValue: result.mission.name + ' copy', confirmLabel: 'Duplicate', maxLength: 96 });
  if (!name) return;
  const duplicate = cloneMissionForDuplicateModel(result.mission, name);
  const saveResult = await window.tahaiBrowser.saveMission(duplicate);
  if (saveResult.ok && saveResult.mission) {
    currentMission = saveResult.mission;
    missionRuntimeTabs.clear();
    await refreshMissionStore();
    renderMissionLayout();
    setStatus('Mission duplicated', saveResult.mission.name);
  } else {
    setStatus('Mission duplicate blocked', saveResult.error || 'Validation failed.');
  }
}

async function deleteMissionById(missionId: string): Promise<void> {
  const mission = missionStore.find((candidate) => candidate.missionId === missionId);
  const label = mission?.name || 'this mission';
  const confirmation = await requestTextInput({ title: 'Delete saved mission', label: 'Type DELETE to remove ' + label + '. This only deletes the local saved JSON.', placeholder: 'DELETE', confirmLabel: 'Delete', maxLength: 6 });
  if (confirmation !== 'DELETE') return;
  const result = await window.tahaiBrowser.deleteMission(missionId);
  if (result.ok) {
    if (currentMission?.missionId === missionId) { currentMission = undefined; missionRuntimeTabs.clear(); }
    await refreshMissionStore();
    renderMissionLayout();
    setStatus('Mission deleted', label);
  } else {
    setStatus('Mission delete blocked', result.error || 'Unable to delete mission.');
  }
}

type MissionRestoreMode = 'preview' | 'append' | 'replace';

function requestMissionRestoreMode(mission: MissionState): Promise<MissionRestoreMode | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'mission-restore-dialog';
    dialog.setAttribute('aria-label', 'Restore Mission safely');
    const openTabCount = tabs.size;
    dialog.innerHTML =
      '<section class="mission-restore-panel">' +
      '<header><div><p class="eyebrow">Recovery-safe restore</p><h2>Restore Mission</h2></div></header>' +
      '<div class="mission-restore-summary"><strong>' + escapeHtml(mission.name) + '</strong><span>' + escapeHtml(mission.missionType + ' · ' + mission.tabs.length + ' saved tab(s) · ' + openTabCount + ' currently open') + '</span></div>' +
      '<p class="mission-restore-copy">Choose exactly how this local mission should open. The default is non-destructive and keeps your current browsing context intact.</p>' +
      '<div class="mission-restore-options" role="group" aria-label="Mission restore options">' +
      '<button type="button" data-restore-mode="preview"><strong>Preview only</strong><span>Load the mission panel and layout metadata without opening any saved tabs.</span></button>' +
      '<button type="button" data-restore-mode="append" class="recommended"><strong>Open alongside current tabs</strong><span>Safest restore. Adds mission tabs without closing anything already open.</span></button>' +
      '<button type="button" data-restore-mode="replace" class="danger"><strong>Replace current tabs</strong><span>Closes current browser tabs first. Requires a second confirmation.</span></button>' +
      '</div>' +
      '<footer><button type="button" data-restore-cancel class="home-button secondary">Cancel</button></footer>' +
      '</section>';
    document.body.appendChild(dialog);
    let settled = false;
    const finish = (mode: MissionRestoreMode | null) => {
      if (settled) return;
      settled = true;
      resolve(mode);
      dialog.close();
      dialog.remove();
    };
    dialog.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      const mode = button.dataset.restoreMode as MissionRestoreMode | undefined;
      if (mode === 'replace') {
        const ok = window.confirm('Replace current tabs with this saved mission? Current tabs will be closed first.');
        if (!ok) return;
      }
      if (mode === 'preview' || mode === 'append' || mode === 'replace') finish(mode);
      if (button.dataset.restoreCancel !== undefined) finish(null);
    });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => { if (!settled) finish(null); });
    dialog.showModal();
  });
}

async function restoreMissionTabsIntoBrowser(loadedMission: MissionState, mode: MissionRestoreMode): Promise<void> {
  if (mode === 'preview') return;
  if (mode === 'replace') closeAllTabsForProfileSwitch();

  for (const missionTab of loadedMission.tabs) {
    if (mode === 'append') {
      const existingRuntime = Array.from(tabs.values()).find((tab) => tab.url === missionTab.url);
      if (existingRuntime) {
        existingRuntime.missionPaneId = missionTab.paneId;
        missionRuntimeTabs.set(missionTab.tabId, existingRuntime.id);
        continue;
      }
    }
    const runtimeTabId = createTab(missionTab.url);
    const runtimeTab = tabs.get(runtimeTabId);
    if (runtimeTab) runtimeTab.missionPaneId = missionTab.paneId;
    missionRuntimeTabs.set(missionTab.tabId, runtimeTabId);
  }

  const detail = mode === 'append'
    ? 'Mission tabs opened alongside the current browsing context.'
    : 'Mission tabs replaced the current browser window after explicit confirmation.';
  missionTimelineEvent('restored', 'Mission restored', detail);
}

async function loadMissionById(missionId: string, restoreMode: MissionRestoreMode = 'preview'): Promise<void> {
  const result = await window.tahaiBrowser.loadMission(missionId);
  if (!result.ok || !result.mission) {
    setStatus('Mission load failed', result.error || 'Mission not available.');
    return;
  }
  const loadedMission = result.mission;
  currentMission = loadedMission;
  missionRuntimeTabs.clear();
  await restoreMissionTabsIntoBrowser(loadedMission, restoreMode);
  renderMissionControl();
  renderMissionLayout();
  if (restoreMode === 'preview') setStatus('Mission preview loaded', loadedMission.name);
  else setStatus(restoreMode === 'append' ? 'Mission opened alongside current tabs' : 'Mission replaced current tabs', loadedMission.name);
}

async function chooseAndRestoreMissionById(missionId: string): Promise<void> {
  const result = await window.tahaiBrowser.loadMission(missionId);
  if (!result.ok || !result.mission) {
    setStatus('Mission load failed', result.error || 'Mission not available.');
    return;
  }
  const mode = await requestMissionRestoreMode(result.mission);
  if (!mode) return;
  currentMission = result.mission;
  missionRuntimeTabs.clear();
  await restoreMissionTabsIntoBrowser(result.mission, mode);
  renderMissionControl();
  renderMissionLayout();
  openMissionControl();
  setStatus(mode === 'preview' ? 'Mission preview loaded' : mode === 'append' ? 'Mission opened alongside current tabs' : 'Mission replaced current tabs', result.mission.name);
}

type ToolMenuName = 'devops' | 'it';
const COMMAND_TOOLBAR_LAST_LANE_KEY = 'tahai.commandToolbar.lastLane';

function isToolMenuName(value: string | null): value is ToolMenuName {
  return value === 'devops' || value === 'it';
}

function rememberToolLane(name: ToolMenuName): void {
  try { window.localStorage.setItem(COMMAND_TOOLBAR_LAST_LANE_KEY, name); } catch { /* localStorage may be unavailable in hardened sessions. */ }
}

function lastToolLane(): ToolMenuName {
  try {
    const stored = window.localStorage.getItem(COMMAND_TOOLBAR_LAST_LANE_KEY);
    if (isToolMenuName(stored)) return stored;
  } catch { /* localStorage may be unavailable in hardened sessions. */ }
  return 'devops';
}

function toolMenuPair(name: ToolMenuName): { button: HTMLButtonElement; panel: HTMLElement } {
  return name === 'devops'
    ? { button: devopsToolsButton, panel: devopsToolsPanel }
    : { button: itToolsButton, panel: itToolsPanel };
}

function closeToolMenus(except?: ToolMenuName): void {
  let activeLane: ToolMenuName | undefined;
  for (const name of ['devops', 'it'] as ToolMenuName[]) {
    if (name === except) { activeLane = name; continue; }
    const { button, panel } = toolMenuPair(name);
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  if (activeLane) document.body.dataset.commandToolbar = activeLane;
  else delete document.body.dataset.commandToolbar;
}

function commandToolbarLabel(name: ToolMenuName): string {
  return name === 'devops' ? 'DevOps Command Toolbar' : 'IT Tools Command Toolbar';
}

function commandToolbarShortcut(name: ToolMenuName): string {
  return name === 'devops' ? 'Ctrl+Alt+O' : 'Ctrl+Alt+I';
}

function scrollToolMenu(panel: HTMLElement, direction: -1 | 1): void {
  const amount = Math.max(260, Math.floor(panel.clientWidth * 0.72));
  panel.scrollBy({ left: amount * direction, behavior: 'smooth' });
}

function updateToolMenuScrollState(panel: HTMLElement): void {
  const left = panel.querySelector<HTMLButtonElement>('[data-command-toolbar-scroll="left"]');
  const right = panel.querySelector<HTMLButtonElement>('[data-command-toolbar-scroll="right"]');
  if (!left || !right) return;
  const max = Math.max(0, panel.scrollWidth - panel.clientWidth - 2);
  left.disabled = panel.scrollLeft <= 2;
  right.disabled = panel.scrollLeft >= max;
  panel.classList.toggle('has-overflow', max > 2);
}

function ensureToolMenuScrollControls(name: ToolMenuName): void {
  const { panel } = toolMenuPair(name);
  if (!panel.querySelector('[data-command-toolbar-scroll="left"]')) {
    const left = document.createElement('button');
    left.type = 'button';
    left.className = 'command-toolbar-chevron command-toolbar-chevron-left';
    left.dataset.commandToolbarScroll = 'left';
    left.textContent = '‹';
    left.setAttribute('aria-label', `Scroll ${commandToolbarLabel(name)} left`);
    left.title = 'Scroll command lane left';
    left.addEventListener('click', (event) => { event.stopPropagation(); scrollToolMenu(panel, -1); });
    panel.insertBefore(left, panel.firstChild);
  }
  if (!panel.querySelector('[data-command-toolbar-scroll="right"]')) {
    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'command-toolbar-chevron command-toolbar-chevron-right';
    right.dataset.commandToolbarScroll = 'right';
    right.textContent = '›';
    right.setAttribute('aria-label', `Scroll ${commandToolbarLabel(name)} right`);
    right.title = 'Scroll command lane right';
    right.addEventListener('click', (event) => { event.stopPropagation(); scrollToolMenu(panel, 1); });
    panel.appendChild(right);
  }
  if (!panel.dataset.commandToolbarScrollBound) {
    panel.dataset.commandToolbarScrollBound = 'true';
    panel.addEventListener('scroll', () => updateToolMenuScrollState(panel), { passive: true });
    window.addEventListener('resize', () => updateToolMenuScrollState(panel));
  }
}

function ensureToolMenuBackButton(name: ToolMenuName): void {
  const { button, panel } = toolMenuPair(name);
  if (panel.querySelector('[data-command-toolbar-back]')) return;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'home-button secondary tool-menu-back';
  back.dataset.commandToolbarBack = name;
  back.title = 'Return to Main Toolbar (Esc)';
  back.textContent = '← Main Toolbar';
  back.addEventListener('click', () => { closeToolMenus(); button.focus(); setStatus('Main Toolbar active'); });
  const anchor = panel.querySelector('[data-command-toolbar-scroll="left"]')?.nextSibling || panel.firstChild;
  panel.insertBefore(back, anchor);
}

function enrichToolCardTooltips(panel: HTMLElement): void {
  for (const card of Array.from(panel.querySelectorAll<HTMLButtonElement>('.tool-card'))) {
    const title = card.querySelector('strong')?.textContent?.trim() || 'Command';
    const shortcut = card.querySelector('kbd')?.textContent?.trim();
    const detail = card.querySelector('span')?.textContent?.trim();
    const base = card.getAttribute('title') || detail || title;
    card.title = shortcut ? `${title} (${shortcut}) — ${base}` : `${title} — ${base}`;
  }
}

function toolCards(panel: HTMLElement): HTMLButtonElement[] {
  return Array.from(panel.querySelectorAll<HTMLButtonElement>('.tool-card:not([disabled])'));
}

function focusToolCard(name: ToolMenuName, direction: 'first' | 'last' = 'first'): void {
  const panel = toolMenuPair(name).panel;
  const cards = toolCards(panel);
  const target = direction === 'last' ? cards.at(-1) : cards[0];
  window.setTimeout(() => {
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateToolMenuScrollState(panel);
  }, 0);
}

function openToolMenu(name: ToolMenuName, direction: 'first' | 'last' = 'first'): void {
  const { button, panel } = toolMenuPair(name);
  ensureToolMenuScrollControls(name);
  ensureToolMenuBackButton(name);
  enrichToolCardTooltips(panel);
  closeToolMenus(name);
  panel.hidden = false;
  panel.title = `${commandToolbarLabel(name)} · ${commandToolbarShortcut(name)} · Esc returns to Main Toolbar · arrows/Home/End move · PageUp/PageDown scroll.`;
  button.setAttribute('aria-expanded', 'true');
  document.body.dataset.commandToolbar = name;
  rememberToolLane(name);
  setStatus(`${commandToolbarLabel(name)} active · Esc returns to Main Toolbar · arrows move · chevrons scroll.`);
  focusToolCard(name, direction);
  window.setTimeout(() => updateToolMenuScrollState(panel), 0);
}

function openLastToolMenu(): void {
  openToolMenu(lastToolLane());
}

function toggleToolMenu(name: ToolMenuName): void {
  const { button, panel } = toolMenuPair(name);
  const willOpen = panel.hidden;
  if (willOpen) openToolMenu(name);
  else {
    closeToolMenus();
    setStatus('Main Toolbar active');
    button.focus();
  }
}

function moveToolFocus(panel: HTMLElement, delta: number): void {
  const cards = toolCards(panel);
  if (!cards.length) return;
  const currentIndex = cards.findIndex((card) => card === document.activeElement);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + cards.length) % cards.length;
  const target = cards[nextIndex];
  target?.focus();
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  updateToolMenuScrollState(panel);
}

function handleToolMenuKeyboard(name: ToolMenuName, event: KeyboardEvent): void {
  const { button, panel } = toolMenuPair(name);
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    moveToolFocus(panel, 1);
    return;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    moveToolFocus(panel, -1);
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    const target = toolCards(panel)[0];
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateToolMenuScrollState(panel);
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    const target = toolCards(panel).at(-1);
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateToolMenuScrollState(panel);
    return;
  }
  if (event.key === 'PageDown' || event.key === ']') {
    event.preventDefault();
    scrollToolMenu(panel, 1);
    return;
  }
  if (event.key === 'PageUp' || event.key === '[') {
    event.preventDefault();
    scrollToolMenu(panel, -1);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const activeButton = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    if (activeButton?.classList.contains('tool-card')) {
      event.preventDefault();
      activeButton.click();
    }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeToolMenus();
    button.focus();
    setStatus('Main Toolbar active');
  }
}

function handleToolMenuButtonKeyboard(name: ToolMenuName, event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openToolMenu(name);
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    openToolMenu(name, 'last');
  }
}

function runToolFromMenu(action: () => void | Promise<void>): void {
  closeToolMenus();
  void action();
}

const premiumLaunchRecipes: LaunchRecipe[] = [
  {
    id: 'deploy-cockpit',
    cockpitProvider: 'vercel',
    operatorShortcut: 'Ctrl+Alt+D',
    label: 'Deploy Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'Deploy Cockpit',
    urls: ['https://github.com', 'https://vercel.com/dashboard', 'https://www.vercel-status.com', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['logs','primary-console','monitoring','runbook'],
    missionPrimaryAction: 'Ship a controlled deployment with live logs, provider console, status signal, and runbook notes in one Quad View.',
    missionStopCondition: 'Stop or roll back if build logs fail, the provider console shows a degraded state, smoke validation fails, or the rollback owner is unclear.',
    missionRunbookSteps: ['Confirm release scope, owner, and rollback decision maker', 'Capture current production/staging baseline', 'Start deployment and watch CI/CD logs', 'Validate provider health and live target smoke checks', 'Pin evidence and export the change record'],
    missionEvidencePrompts: ['CI/CD run URL', 'Provider deployment URL', 'Smoke-test result', 'Rollback decision'],
    note: 'Quad deployment cockpit: source/build logs, deployment provider, provider status, and IT Docs runbook lane.'
  },
  {
    id: 'github-actions-monitor',
    cockpitProvider: 'github',
    operatorShortcut: 'Ctrl+Alt+J',
    label: 'GitHub Actions Monitor',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'GitHub Actions Monitor',
    urls: ['https://github.com', 'https://githubstatus.com', 'https://docs.github.com/actions', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['logs','monitoring','docs','runbook'],
    missionPrimaryAction: 'Track a GitHub Actions workflow from source to evidence handoff without context switching.',
    missionStopCondition: 'Stop if workflow permissions, protected branches, environment approvals, or artifact retention are unclear.',
    missionRunbookSteps: ['Open target repository and workflow run', 'Confirm branch, commit, and environment', 'Watch logs and failed steps', 'Capture artifact/deployment references', 'Document fix, rerun, rollback, or closeout'],
    missionEvidencePrompts: ['Repository', 'Workflow run', 'Commit SHA', 'Failed step or final success'],
    note: 'GitHub Actions cockpit for workflow logs, GitHub status, docs, and local runbook notes.'
  },
  {
    id: 'dns-migration-cockpit',
    cockpitProvider: 'cloudflare',
    operatorShortcut: 'Ctrl+Alt+C',
    label: 'DNS Migration Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'DNS Migration Cockpit',
    urls: ['https://dash.cloudflare.com', 'https://www.whatsmydns.net', 'https://developers.cloudflare.com/dns/', 'https://docs.tahaiportal.com'],
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','runbook'],
    missionPrimaryAction: 'Run DNS migration with provider console, propagation check, vendor docs, and evidence notes visible at once.',
    missionStopCondition: 'Stop if authoritative nameservers, TTL strategy, rollback records, or ownership are unclear.',
    missionRunbookSteps: ['Capture existing zone and registrar state', 'Confirm TTL and rollback records', 'Apply DNS/provider change', 'Validate propagation, HTTP, and TLS', 'Pin before/after evidence and closeout'],
    missionEvidencePrompts: ['Before DNS state', 'Changed records', 'Propagation check', 'TLS/HTTP validation'],
    note: 'DNS migration cockpit for Cloudflare, propagation, docs, and IT Docs handoff.'
  },
  {
    id: 'cloudflare-change',
    cockpitProvider: 'cloudflare',
    label: 'Cloudflare Change',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'Cloudflare Change',
    urls: ['https://dash.cloudflare.com', 'https://www.cloudflarestatus.com', 'https://developers.cloudflare.com', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','runbook'],
    missionPrimaryAction: 'Control Cloudflare DNS, cache, WAF, redirect, or Pages changes with docs and status in view.',
    missionStopCondition: 'Stop if the change can affect production routing, WAF access, certificates, or cache behavior without rollback notes.',
    missionRunbookSteps: ['Identify target zone/app and change class', 'Capture current settings and expected outcome', 'Apply one bounded change', 'Validate live site, headers, redirects, and status', 'Pin evidence and record rollback path'],
    missionEvidencePrompts: ['Zone/app', 'Before setting', 'After setting', 'Validation result'],
    note: 'Cloudflare operational change cockpit with status, docs, and handoff lane.'
  },
  {
    id: 'aws-release-cockpit',
    cockpitProvider: 'aws',
    operatorShortcut: 'Ctrl+Alt+W',
    label: 'AWS Release Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'AWS Release Cockpit',
    urls: ['https://console.aws.amazon.com', 'https://health.aws.amazon.com/health/status', 'https://status.aws.amazon.com', 'https://docs.aws.amazon.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','monitoring','docs'],
    missionPrimaryAction: 'Run AWS operational changes with console, health dashboard, public status, and docs together.',
    missionStopCondition: 'Stop if region, account, IAM scope, backup/export, or rollback path is unclear.',
    missionRunbookSteps: ['Confirm AWS account, region, service, and IAM scope', 'Capture starting state and backup/export where applicable', 'Apply the bounded release/change', 'Validate service health, logs, and endpoint behavior', 'Pin evidence and close the change record'],
    missionEvidencePrompts: ['AWS account/region display only', 'Service touched', 'Health/log validation', 'Rollback path'],
    note: 'AWS console, AWS Health, public status, and AWS documentation lane.'
  },
  {
    id: 'vercel-firebase-release',
    cockpitProvider: 'vercel',
    operatorShortcut: 'Ctrl+Alt+V',
    label: 'Vercel / Firebase Release',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'Vercel Firebase Release',
    urls: ['https://vercel.com/dashboard', 'https://console.firebase.google.com', 'https://www.vercel-status.com', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','vendor-portal','monitoring','runbook'],
    missionPrimaryAction: 'Manage static/app releases across Vercel or Firebase with status and handoff notes.',
    missionStopCondition: 'Stop if deploy target, project, environment variables, or rollback route is unclear.',
    missionRunbookSteps: ['Confirm target project and environment', 'Capture current deployment/version', 'Deploy or promote the build', 'Validate production URL and provider status', 'Pin evidence and export change handoff'],
    missionEvidencePrompts: ['Project', 'Deployment/version', 'Production URL', 'Validation result'],
    note: 'Release cockpit for Vercel/Firebase deployment surfaces, provider status, and IT Docs handoff.'
  },
  {
    id: 'aws-cloudfront-lambda-cockpit',
    label: 'AWS Lambda / CloudFront Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    cockpitProvider: 'aws',
    profileKind: 'work',
    profileName: 'AWS Lambda CloudFront',
    urls: ['https://console.aws.amazon.com/lambda/home', 'https://console.aws.amazon.com/cloudfront/v4/home', 'https://health.aws.amazon.com/health/status', 'https://docs.aws.amazon.com/lambda/'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','vendor-portal','monitoring','docs'],
    missionPrimaryAction: 'Ship Lambda/API or static-front-end changes with CloudFront, AWS Health, and docs visible together.',
    missionStopCondition: 'Stop if distribution, origin, function version, IAM scope, cache invalidation, or rollback is unclear.',
    missionRunbookSteps: ['Confirm function/distribution/account/region', 'Capture current version, alias, origin, and cache behavior', 'Deploy function or invalidate/promote distribution change', 'Validate endpoint, headers, logs, and cache result', 'Pin before/after evidence and rollback notes'],
    missionEvidencePrompts: ['Function/distribution display', 'Version or invalidation ID', 'Endpoint/header validation', 'Rollback path'],
    note: 'AWS serverless + edge release cockpit for Lambda, CloudFront, AWS Health, and docs.'
  },
  {
    id: 'cloudflare-pages-dns-cockpit',
    label: 'Cloudflare Pages / DNS Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    cockpitProvider: 'cloudflare',
    profileKind: 'work',
    profileName: 'Cloudflare Pages DNS',
    urls: ['https://dash.cloudflare.com', 'https://www.cloudflarestatus.com', 'https://developers.cloudflare.com/pages/', 'https://www.whatsmydns.net'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','monitoring'],
    missionPrimaryAction: 'Manage Cloudflare Pages deploys and DNS routing with provider status, docs, and propagation proof.',
    missionStopCondition: 'Stop if production branch, custom domain, DNS record, TLS mode, or rollback route is unclear.',
    missionRunbookSteps: ['Confirm Pages project, production branch, and custom domain', 'Capture current DNS/TLS/Pages deployment state', 'Deploy or adjust DNS/routing', 'Validate propagation, TLS, redirects, and live URL', 'Pin evidence and export change record'],
    missionEvidencePrompts: ['Pages deployment', 'DNS before/after', 'TLS/redirect validation', 'Rollback route'],
    note: 'Cloudflare Pages plus DNS cockpit with status, docs, and propagation validation.'
  },
  {
    id: 'github-release-cockpit',
    label: 'GitHub Release Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    cockpitProvider: 'github',
    profileKind: 'work',
    profileName: 'GitHub Release Cockpit',
    urls: ['https://github.com', 'https://githubstatus.com', 'https://docs.github.com/en/actions', 'https://docs.github.com/en/repositories/releasing-projects-on-github'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','docs'],
    missionPrimaryAction: 'Prepare a tagged release with actions status, release docs, and evidence notes in one view.',
    missionStopCondition: 'Stop if branch protection, tag target, generated artifacts, license/notice, or release notes are unclear.',
    missionRunbookSteps: ['Confirm repository, branch, version, and tag target', 'Check CI status and release blockers', 'Draft release notes and artifact list', 'Publish or stage release', 'Pin release URL, commit SHA, and validation evidence'],
    missionEvidencePrompts: ['Repository', 'Tag/version', 'Workflow run', 'Release URL or draft state'],
    note: 'GitHub release cockpit for repository, actions, docs, and release evidence.'
  },
  {
    id: 'vercel-production-cockpit',
    label: 'Vercel Production Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    cockpitProvider: 'vercel',
    profileKind: 'work',
    profileName: 'Vercel Production Cockpit',
    urls: ['https://vercel.com/dashboard', 'https://www.vercel-status.com', 'https://vercel.com/docs/deployments', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','runbook'],
    missionPrimaryAction: 'Promote, inspect, or roll back a Vercel deployment with status and handoff notes ready.',
    missionStopCondition: 'Stop if project, environment, production domain, protection setting, or rollback deployment is unclear.',
    missionRunbookSteps: ['Confirm project, branch, environment, and production domain', 'Capture current deployment and protection state', 'Promote/rollback/inspect deployment', 'Validate production URL and provider status', 'Pin deployment URL and closeout notes'],
    missionEvidencePrompts: ['Project', 'Deployment URL', 'Protection/env state', 'Production validation'],
    note: 'Vercel cockpit for production deploy, protection, provider status, and IT Docs handoff.'
  },

  {
    id: 'azure-release-cockpit',
    label: 'Azure Release Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    cockpitProvider: 'azure',
    operatorShortcut: 'Ctrl+Alt+U',
    profileKind: 'microsoft',
    profileName: 'Azure Release Cockpit',
    urls: ['https://portal.azure.com', 'https://status.azure.com', 'https://learn.microsoft.com/azure/', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console','monitoring','docs','runbook'],
    missionPrimaryAction: 'Run Azure App Service, Static Web Apps, Functions, or infrastructure changes with portal, status, docs, and runbook visible.',
    missionStopCondition: 'Stop if subscription, resource group, region, deployment slot, identity scope, or rollback path is unclear.',
    missionRunbookSteps: ['Confirm subscription, resource group, region, and target service', 'Capture current app/deployment/configuration state', 'Apply the bounded Azure release or config change', 'Validate health, logs, endpoint behavior, and status', 'Pin evidence and export the change record'],
    missionEvidencePrompts: ['Subscription/resource group display', 'Target service', 'Deployment/config validation', 'Rollback route'],
    note: 'Azure release cockpit for portal, Azure status, Microsoft Learn, and IT Docs handoff.'
  },
  {
    id: 'm365-change-cockpit',
    label: 'M365 Change Cockpit',
    group: 'IT admin recipes',
    missionPhase: 'it',
    cockpitProvider: 'm365',
    operatorShortcut: 'Ctrl+Alt+5',
    profileKind: 'microsoft',
    profileName: 'M365 Change Cockpit',
    urls: ['https://admin.microsoft.com', 'https://entra.microsoft.com', 'https://security.microsoft.com', 'https://learn.microsoft.com/microsoft-365/'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console','vendor-portal','monitoring','docs'],
    missionPrimaryAction: 'Perform Microsoft 365, Entra, or Defender admin changes with tenant scope, security context, and docs visible.',
    missionStopCondition: 'Stop if tenant, admin authorization, affected users/groups, conditional access impact, or rollback is unclear.',
    missionRunbookSteps: ['Confirm tenant and authorized admin scope', 'Capture starting settings and affected users/groups', 'Apply one bounded M365/Entra/Security change', 'Validate login, policy, mail, or security behavior', 'Pin evidence and document closeout owner'],
    missionEvidencePrompts: ['Tenant display name', 'Affected users/groups', 'Before/after setting', 'Validation result'],
    note: 'M365 admin cockpit for admin center, Entra, Defender/Security, and Microsoft docs.'
  },
  {
    id: 'incident-war-room',
    cockpitProvider: 'incident',
    label: 'Incident War Room',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'Incident War Room',
    urls: ['https://docs.tahaiportal.com', 'https://www.cloudflarestatus.com', 'https://status.aws.amazon.com', 'https://githubstatus.com'],
    missionType: 'incident',
    missionLayout: 'quad',
    missionRoles: ['runbook','monitoring','monitoring','monitoring'],
    missionPrimaryAction: 'Open a clean local incident command surface with runbook, provider status, and evidence timeline.',
    missionStopCondition: 'Escalate if user impact, owner, communications cadence, or mitigation path cannot be stated clearly.',
    missionRunbookSteps: ['Declare impact, severity, and owner', 'Capture symptoms and recent change context', 'Check provider status and dependency signals', 'Record mitigation, validation, and communication updates', 'Export sanitized incident packet'],
    missionEvidencePrompts: ['Impact statement', 'Provider status', 'Mitigation action', 'Recovery validation'],
    note: 'Local-only war room starter with runbook and public status surfaces.'
  },
  {
    id: 'developer-debug-cockpit',
    label: 'Developer Debug Cockpit',
    group: 'DevOps missions',
    missionPhase: 'devops',
    profileKind: 'work',
    profileName: 'Developer Debug Cockpit',
    urls: ['https://github.com', 'https://developer.mozilla.org', 'https://docs.tahaiportal.com', 'https://browser.tahai.net'],
    missionType: 'development',
    missionLayout: 'quad',
    missionRoles: ['logs','docs','runbook','live-target'],
    missionPrimaryAction: 'Debug a live target with source context, docs, runbook notes, and the target page in one Mission.',
    missionStopCondition: 'Stop if reproduction steps, affected route, or rollback/safe test target cannot be identified.',
    missionRunbookSteps: ['Capture repro URL and expected behavior', 'Open source/context and relevant docs', 'Run Dev Audit or Route Map', 'Validate fix or workaround against live target', 'Pin evidence and record next action'],
    missionEvidencePrompts: ['Repro URL', 'Route/API surface', 'Console/timing signal', 'Fix validation'],
    note: 'Developer cockpit for source, docs, local runbook, live target, Dev Audit, and Route Map.'
  },
  {
    id: 'azure-m365',
    label: 'Azure / M365',
    group: 'IT admin recipes',
    missionPhase: 'it',
    profileKind: 'microsoft',
    profileName: 'Azure / M365',
    urls: ['https://admin.microsoft.com', 'https://portal.azure.com', 'https://entra.microsoft.com', 'https://security.microsoft.com'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console','vendor-portal','monitoring','logs'],
    missionPrimaryAction: 'Manage Microsoft 365, Azure, Entra, and Security admin changes with isolated profile context.',
    missionStopCondition: 'Stop if admin authorization, tenant, affected users, or rollback path is unclear.',
    missionRunbookSteps: ['Confirm tenant and authorized scope', 'Capture starting configuration', 'Apply admin change', 'Validate affected user/service behavior', 'Document final state and next owner'],
    missionEvidencePrompts: ['Tenant display name', 'Starting config', 'Changed setting', 'Validation result'],
    note: 'Microsoft 365, Azure, Entra, and Security in a Microsoft-labeled profile.'
  },
  {
    id: 'google-admin',
    label: 'Google Admin',
    group: 'IT admin recipes',
    missionPhase: 'it',
    profileKind: 'google',
    profileName: 'Google Admin',
    urls: ['https://admin.google.com', 'https://console.cloud.google.com', 'https://mail.google.com', 'https://drive.google.com'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console','vendor-portal','docs','runbook'],
    missionPrimaryAction: 'Manage Google Workspace and GCP admin workflows from a Google-labeled profile.',
    missionStopCondition: 'Stop if user/admin authorization, tenant, or rollback path is unclear.',
    missionRunbookSteps: ['Confirm Google tenant and admin scope', 'Capture starting configuration', 'Apply bounded admin change', 'Validate affected account/service behavior', 'Document closeout and owner'],
    missionEvidencePrompts: ['Tenant display name', 'Account/service', 'Changed setting', 'Validation result'],
    note: 'Google Workspace, GCP, Gmail, and Drive in a Google-labeled profile.'
  },
  {
    id: 'documentation-sprint',
    label: 'Documentation Sprint',
    group: 'Documentation recipes',
    missionPhase: 'general',
    profileKind: 'work',
    profileName: 'Documentation Sprint',
    urls: ['https://docs.tahaiportal.com', 'https://github.com', 'https://developer.mozilla.org', 'https://www.markdownguide.org/basic-syntax/'],
    missionType: 'documentation',
    missionLayout: 'triple',
    missionRoles: ['runbook','docs','docs','tool'],
    missionPrimaryAction: 'Write or revise an operational runbook with source references and Markdown guidance.',
    missionStopCondition: 'Stop if the source of truth, owner, or security-sensitive content treatment is unclear.',
    missionRunbookSteps: ['Collect source references', 'Draft/update runbook', 'Review sensitive terms and secrets', 'Publish or stage handoff', 'Log next documentation owner'],
    missionEvidencePrompts: ['Source refs', 'Draft location', 'Review notes', 'Publish target'],
    note: 'Documentation workspace for IT Docs, source references, and technical writing.'
  },
  {
    id: 'client-workspace',
    label: 'Client Workspace',
    group: 'Client work',
    missionPhase: 'it',
    profileKind: 'client',
    profileName: 'Client Workspace',
    urls: ['https://tahaiportal.com', 'https://docs.tahaiportal.com'],
    missionType: 'support',
    missionLayout: 'split-horizontal',
    missionRoles: ['live-target','runbook'],
    missionPrimaryAction: 'Open a client-focused operational lane with local notes and IT Docs handoff.',
    missionStopCondition: 'Stop if customer authorization, requested outcome, or evidence sharing rules are unclear.',
    missionRunbookSteps: ['Confirm support objective and authorized scope', 'Capture active service/page context', 'Run IT Card or Triage Packet', 'Record next action and owner', 'Export sanitized handoff'],
    missionEvidencePrompts: ['Client/service', 'Observed issue', 'Tool output', 'Next action'],
    note: 'Client-focused operational launch lane with TAHAI Portal and IT Docs.'
  },
  {
    id: 'tahai-it-docs',
    label: 'TAHAI IT Docs',
    group: 'TAHAI products',
    missionPhase: 'it',
    profileKind: 'work',
    profileName: 'TAHAI IT Docs',
    urls: ['https://docs.tahaiportal.com', 'https://tahaiportal.com'],
    missionType: 'documentation',
    missionLayout: 'split-horizontal',
    missionRoles: ['runbook','live-target'],
    missionPrimaryAction: 'Open IT Docs and TAHAI Portal for documentation and operational intelligence work.',
    missionStopCondition: 'Stop if account/org authorization or document target is unclear.',
    missionRunbookSteps: ['Open IT Docs', 'Select authorized org/project', 'Capture source context', 'Draft or update operational note', 'Export or save handoff'],
    missionEvidencePrompts: ['Org/project display', 'Document target', 'Evidence note', 'Handoff state'],
    note: 'Documentation and operational intelligence workspace.'
  },
  {
    id: 'tahai-psa',
    label: 'TAHAI PSA',
    group: 'TAHAI products',
    missionPhase: 'it',
    profileKind: 'work',
    profileName: 'TAHAI PSA',
    urls: ['https://tahaiportal.com'],
    comingSoon: true,
    missionType: 'support',
    missionLayout: 'single',
    missionRoles: ['ticket'],
    missionPrimaryAction: 'Reserved PSA lane for future IT Docs-authorized server-side writeback.',
    missionStopCondition: 'No browser-side PSA API calls or secrets. Use IT Docs server-side connector only when available.',
    missionRunbookSteps: ['Open local support context', 'Draft PSA-safe summary', 'Run Ops Guard', 'Wait for authorized IT Docs PSA connector', 'Export local handoff'],
    missionEvidencePrompts: ['Ticket display key', 'Summary', 'Evidence redaction', 'Writeback status'],
    note: 'IT Docs-routed PSA workspace lane; reference-only until server-side connector authorization exists.'
  }
];

const shortcutRows = [
  ['Ctrl+K', 'Open Command Palette'],
  ['Ctrl+Alt+H', 'Open right-side Ops Panel'],
  ['Ctrl+Alt+B', 'Build evidence/change bundle'],
  ['Ctrl+Alt+Y', 'Open IT Docs / PSA Handoff Center'],
  ['Ctrl+Alt+G', 'Run Ops Guard redaction review'],
  ['Ctrl+Alt+O', 'Open DevOps tools menu'],
  ['Ctrl+Alt+D', 'Start DevOps Deploy Cockpit'],
  ['Ctrl+Alt+W', 'Start AWS Release Cockpit'],
  ['Ctrl+Alt+C', 'Start Cloudflare DNS Cockpit'],
  ['Ctrl+Alt+J', 'Start GitHub Actions Cockpit'],
  ['Ctrl+Alt+V', 'Start Vercel / Firebase Cockpit'],
  ['Ctrl+Alt+U', 'Start Azure Release Cockpit'],
  ['Ctrl+Alt+5', 'Start M365 Change Cockpit'],
  ['Ctrl+Alt+I', 'Open IT Tools menu'],
  ['↑ ↓ / Home End', 'Move inside flyouts and command lists'],
  ['Enter / Space', 'Run selected flyout or command item'],
  ['Esc', 'Close flyout, command palette, or panel'],
  ['Ctrl+Shift+E', 'Capture DevOps Evidence'],
  ['Ctrl+Shift+D', 'Run Ops Check'],
  ['Ctrl+Alt+R', 'Create Deploy Readiness report'],
  ['Ctrl+Shift+M', 'Create IT Service Card'],
  ['Ctrl+Alt+E', 'Create Endpoint Snapshot'],
  ['Ctrl+Alt+T', 'Create Support Triage Packet'],
  ['Ctrl+Alt+K', 'Open Secret Boundary / Ops Guard'],
  ['Ctrl+Alt+P', 'Create Route Map'],
  ['Ctrl+Alt+A', 'Run Developer Audit'],
  ['F12 / Ctrl+Shift+I', 'Open Chromium DevTools'],
  ['Ctrl+Shift+P', 'Open Profiles'],
  ['Ctrl+L', 'Focus address bar'],
  ['Ctrl+Alt+N', 'Open Mission Runbook Rail'],
  ['Ctrl+Alt+Q', 'Open Mission Quad View'],
  ['Drag tab → pane', 'Drop a tab strip item onto a Mission pane'],
  ['Alt+← / Alt+→', 'Back / Forward']
];

function readJsonArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, values: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(values.slice(0, 80)));
}

function activeProfileLabel(): string {
  return activeBrowserProfile()?.name || 'Default';
}

function activeProfileIdSafe(): string {
  return activeBrowserProfile()?.id || browserProfileState?.activeProfileId || 'default';
}

function currentWorkspaceUrls(): string[] {
  const urls = Array.from(tabs.values()).map((tab) => tab.url).filter(Boolean);
  return Array.from(new Set(urls)).slice(0, 32);
}

function currentActiveUrl(): string {
  return active()?.url || addressInput.value || config?.homeUrl || 'https://tahaiportal.com';
}

function toggleOpsHub(open = opsHub.hidden): void {
  opsHub.hidden = !open;
  if (open) {
    closeToolMenus();
    renderOpsHub();
    setStatus('TAHAI Ops Panel open', 'Command Palette, workspaces, recipes, and evidence timeline are available.');
  }
}

function renderLaunchRecipes(container: HTMLElement): void {
  container.innerHTML = premiumLaunchRecipes.map((recipe) => {
    const soon = recipe.comingSoon ? '<em>Requires connector</em>' : '';
    const missionBadge = recipe.missionLayout ? ' · ' + missionLayoutLabel(recipe.missionLayout) : '';
    const phaseClass = recipe.missionPhase ? ' ' + recipe.missionPhase : '';
    const detail = recipePhaseLabel(recipe) + ' · ' + recipe.group + missionBadge + ' · ' + (recipe.missionPrimaryAction || recipe.note);
    const shortcut = recipe.operatorShortcut ? ' · ' + recipe.operatorShortcut : '';
    return '<button class="ops-hub-row mission-recipe-card provider-' + escapeHtml(recipe.cockpitProvider || 'generic') + phaseClass + '" type="button" data-recipe-id="' + escapeHtml(recipe.id) + '">' +
      '<strong><span class="ops-hub-recipe-title">' + escapeHtml(recipe.label) + soon + '</span><small class="recipe-chip ops-hub-recipe-meta">' + escapeHtml(recipeProviderLabel(recipe) + shortcut) + '</small></strong>' +
      '<span class="ops-hub-recipe-detail">' + escapeHtml(detail) + '</span>' +
      '</button>';
  }).join('');
}

function renderMissionRecipes(): void {
  if (!missionRecipes) return;
  missionRecipes.innerHTML = premiumLaunchRecipes.map((recipe) => {
    const layout = recipe.missionLayout ? missionLayoutLabel(recipe.missionLayout) : '1-Up Normal';
    const disabled = recipe.comingSoon ? ' aria-disabled="true"' : '';
    const soon = recipe.comingSoon ? '<em>Requires connector</em>' : '';
    const phaseClass = recipe.missionPhase ? ' ' + recipe.missionPhase : '';
    const stepCount = recipe.missionRunbookSteps?.length || defaultRunbookStepLabels(recipe.missionType || 'generic').length;
    const shortcut = recipe.operatorShortcut ? ' · ' + recipe.operatorShortcut : '';
    return '<button class="ops-hub-row mission-recipe-card provider-' + escapeHtml(recipe.cockpitProvider || 'generic') + phaseClass + '" type="button" data-start-mission-recipe-id="' + escapeHtml(recipe.id) + '"' + disabled + '>' +
      '<strong><span class="ops-hub-recipe-title">' + escapeHtml(recipe.label) + soon + '</span><small class="recipe-chip ops-hub-recipe-meta">' + escapeHtml(recipeProviderLabel(recipe) + shortcut) + '</small></strong>' +
      '<span class="ops-hub-recipe-detail">' + escapeHtml(recipePhaseLabel(recipe) + ' · ' + layout + ' · ' + recipe.profileName + ' · ' + stepCount + '-step runbook') + '</span>' +
      '</button>';
  }).join('');
}

function renderWorkspaceSnapshots(): void {
  const snapshots = readJsonArray<WorkspaceSnapshot>(workspaceStorageKey);
  if (!snapshots.length) {
    opsHubWorkspaces.innerHTML = '<article class="ops-hub-empty">No saved workspaces yet. Save the current tabs from the Ops Panel or Command Palette.</article>';
    return;
  }
  opsHubWorkspaces.innerHTML = snapshots.map((snapshot) =>
    '<article class="ops-hub-row split">' +
    '<button type="button" data-workspace-id="' + escapeHtml(snapshot.id) + '"><strong>' + escapeHtml(snapshot.name) + '</strong><span>' + escapeHtml(snapshot.profileName) + ' · ' + snapshot.urls.length + ' tab(s)</span></button>' +
    '<button type="button" class="mini-danger" data-delete-workspace-id="' + escapeHtml(snapshot.id) + '">×</button>' +
    '</article>'
  ).join('');
}

function latestEvidenceCandidate(): { type: string; title: string; sourceUrl: string; markdown: string } | undefined {
  const openDialogCandidates = [
    { open: opsGuardDialog.open, type: 'Ops Guard', title: 'Redaction Review', sourceUrl: currentActiveUrl(), markdown: opsGuardMarkdown.value },
    { open: devAuditDialog.open, type: 'Dev Audit', title: 'Developer Audit', sourceUrl: latestDevAudit?.sourceUrl || currentActiveUrl(), markdown: devAuditMarkdown.value },
    { open: routeMapDialog.open, type: 'Route Map', title: 'Route Map', sourceUrl: latestRouteMap?.sourceUrl || currentActiveUrl(), markdown: routeMapMarkdown.value },
    { open: triageDialog.open, type: 'Support Triage', title: 'Support Triage Packet', sourceUrl: latestTriage?.sourceUrl || currentActiveUrl(), markdown: triageMarkdown.value },
    { open: endpointDialog.open, type: 'Endpoint', title: 'Endpoint Snapshot', sourceUrl: latestEndpoint?.sourceUrl || currentActiveUrl(), markdown: endpointMarkdown.value },
    { open: itCardDialog.open, type: 'IT Card', title: 'IT Service Card', sourceUrl: latestItCard?.sourceUrl || currentActiveUrl(), markdown: itCardMarkdown.value },
    { open: deployDialog.open, type: 'Deploy', title: 'Deploy Readiness', sourceUrl: latestDeployReadiness?.sourceUrl || currentActiveUrl(), markdown: deployMarkdown.value },
    { open: opsDialog.open, type: 'Ops Check', title: 'Ops Check', sourceUrl: latestOpsCheck?.sourceUrl || currentActiveUrl(), markdown: opsMarkdown.value },
    { open: captureDialog.open, type: 'Capture', title: 'DevOps Evidence Capture', sourceUrl: latestCapture?.sourceUrl || currentActiveUrl(), markdown: captureMarkdown.value }
  ];
  const openCandidate = openDialogCandidates.find((candidate) => candidate.open && candidate.markdown.trim());
  if (openCandidate) return { ...openCandidate, markdown: openCandidate.markdown.trim() };
  const latest = latestDevAudit || latestRouteMap || latestTriage || latestEndpoint || latestItCard || latestDeployReadiness || latestOpsCheck || latestCapture;
  if (!latest?.markdown) return undefined;
  return { type: 'Evidence', title: 'Latest tool output', sourceUrl: latest.sourceUrl || currentActiveUrl(), markdown: latest.markdown };
}

function renderEvidenceTimeline(): void {
  const items = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  if (!items.length) {
    opsHubEvidence.innerHTML = '<article class="ops-hub-empty">No pinned evidence yet. Run a tool, then pin the output here for a local case/change bundle.</article>';
    return;
  }
  opsHubEvidence.innerHTML = items.map((item) =>
    '<article class="ops-hub-row split">' +
    '<button type="button" data-copy-evidence-id="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.type) + ' · ' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.profileName) + ' · ' + escapeHtml(new Date(item.createdAt).toLocaleString()) + '</span></button>' +
    '<button type="button" class="mini-danger" data-delete-evidence-id="' + escapeHtml(item.id) + '">×</button>' +
    '</article>'
  ).join('');
}

function renderOpsHub(): void {
  if (!config) return;
  const profile = activeBrowserProfile();
  opsHubProfile.textContent = `Profile: ${profile?.name || 'Default'}${profile ? ' · ' + profileKindLabel(profile.kind) : ''}`;
  opsHubUrl.textContent = currentActiveUrl();
  renderLaunchRecipes(opsHubRecipes);
  renderWorkspaceSnapshots();
  renderEvidenceTimeline();
  renderMissionControl();
}

async function saveWorkspaceSnapshot(): Promise<void> {
  const urls = currentWorkspaceUrls();
  if (!urls.length) {
    setStatus('No tabs to save', 'Open at least one tab before saving a workspace.');
    return;
  }
  const defaultName = `${activeProfileLabel()} workspace ${new Date().toLocaleDateString()}`;
  const name = await requestTextInput({
    title: 'Save workspace snapshot',
    label: 'Name this set of tabs and the active profile context.',
    defaultValue: defaultName,
    maxLength: 120
  });
  if (!name) return;
  const snapshots = readJsonArray<WorkspaceSnapshot>(workspaceStorageKey);
  snapshots.unshift({ id: id(), name, profileId: activeProfileIdSafe(), profileName: activeProfileLabel(), activeUrl: currentActiveUrl(), urls, createdAt: new Date().toISOString() });
  writeJsonArray(workspaceStorageKey, snapshots);
  renderOpsHub();
  setStatus('Workspace saved', `${name} · ${urls.length} tab(s)`);
}

async function restoreWorkspaceSnapshot(snapshotId: string): Promise<void> {
  const snapshot = readJsonArray<WorkspaceSnapshot>(workspaceStorageKey).find((item) => item.id === snapshotId);
  if (!snapshot) return;
  if (browserProfileState?.profiles.some((profile) => profile.id === snapshot.profileId)) {
    browserProfileState = await window.tahaiBrowser.setActiveProfile(snapshot.profileId);
    renderProfileBadge();
  }
  closeAllTabsForProfileSwitch();
  for (const url of snapshot.urls) createTab(url);
  const activeSnapshotTab = Array.from(tabs.values()).find((tab) => tab.url === snapshot.activeUrl);
  if (activeSnapshotTab) setActive(activeSnapshotTab.id);
  renderOpsHub();
  setStatus('Workspace restored', `${snapshot.name} · ${snapshot.urls.length} tab(s)`);
}

function deleteWorkspaceSnapshot(snapshotId: string): void {
  writeJsonArray(workspaceStorageKey, readJsonArray<WorkspaceSnapshot>(workspaceStorageKey).filter((item) => item.id !== snapshotId));
  renderOpsHub();
  setStatus('Workspace deleted');
}

async function pinLatestEvidence(): Promise<void> {
  const candidate = latestEvidenceCandidate();
  if (!candidate) {
    setStatus('Nothing to pin yet', 'Run or open a TAHAI tool output first.');
    return;
  }
  const items = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  items.unshift({ id: id(), type: candidate.type, title: candidate.title, sourceUrl: candidate.sourceUrl, markdown: candidate.markdown, profileName: activeProfileLabel(), createdAt: new Date().toISOString() });
  writeJsonArray(evidenceStorageKey, items);
  renderOpsHub();
  setStatus('Evidence pinned', `${candidate.type} added to the local timeline.`);
}

async function pinRecipeEvidenceBlueprint(recipeId: string): Promise<void> {
  const recipe = premiumLaunchRecipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) return;
  const items = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  items.unshift({ id: id(), type: 'Cockpit Blueprint', title: recipe.label, sourceUrl: recipe.urls[0] || currentActiveUrl(), markdown: recipeBlueprintMarkdown(recipe, md), profileName: recipe.profileName, createdAt: new Date().toISOString() });
  writeJsonArray(evidenceStorageKey, items);
  renderOpsHub();
  setStatus('Cockpit blueprint pinned', `${recipe.label} added to the evidence timeline.`);
}

async function copyEvidenceItem(itemId: string): Promise<void> {
  const item = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey).find((candidate) => candidate.id === itemId);
  if (!item) return;
  await window.tahaiBrowser.copyDevOpsCapture(item.markdown);
  setStatus('Evidence copied', item.title);
}

function deleteEvidenceItem(itemId: string): void {
  writeJsonArray(evidenceStorageKey, readJsonArray<EvidenceTimelineItem>(evidenceStorageKey).filter((item) => item.id !== itemId));
  renderOpsHub();
  setStatus('Evidence removed');
}


function bundleBulletList(values: string[], empty = '- _None captured._'): string {
  const filtered = values.map((value) => compactText(value, '')).filter(Boolean).slice(0, 40);
  return filtered.length ? filtered.map((value) => `- ${md(value)}`).join('\n') : empty;
}

function evidenceAnchor(item: EvidenceTimelineItem, index: number): string {
  const stamp = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'time not recorded';
  return `EV-${String(index + 1).padStart(2, '0')} — ${md(item.type)} — ${md(item.title)} — ${md(stamp)}`;
}

function buildChangeBundleMarkdown(): ChangeBundleState {
  const evidence = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  const workspaces = readJsonArray<WorkspaceSnapshot>(workspaceStorageKey);
  const profile = activeBrowserProfile();
  const activeUrl = currentActiveUrl();
  const generatedAt = new Date().toISOString();
  const sourceUrl = activeUrl || evidence[0]?.sourceUrl || config.homeUrl;
  const tabsNow = currentWorkspaceUrls();
  const latestWorkspace = workspaces[0];
  const evidenceRefs = evidence.map((_item, index) => `EV-${String(index + 1).padStart(2, '0')}`).join(', ') || 'none';
  const evidenceTable = evidence.length
    ? evidence.map((item, index) => `| ${md(evidenceAnchor(item, index))} | ${md(item.profileName)} | ${md(item.sourceUrl)} |`).join('\n')
    : '| _No pinned evidence yet._ |  |  |';
  const workspaceTable = workspaces.length
    ? workspaces.slice(0, 12).map((snapshot) => `| ${md(snapshot.name)} | ${md(snapshot.profileName)} | ${md(snapshot.urls.length)} | ${md(snapshot.activeUrl)} |`).join('\n')
    : '| _No saved workspace snapshots yet._ |  |  |  |';
  const evidenceSections = evidence.length
    ? evidence.map((item, index) => `---\n\n## ${evidenceAnchor(item, index)}\n\n| Field | Value |\n| --- | --- |\n| Source URL | ${md(item.sourceUrl)} |\n| Profile | ${md(item.profileName)} |\n| Pinned at | ${md(item.createdAt)} |\n\n${item.markdown.trim() || '_No markdown body captured._'}\n`).join('\n')
    : '## Evidence attachments\n\n_No pinned evidence yet. Run a tool and choose Pin Evidence from the Ops Panel or Command Palette._\n';
  const markdown = `# TAHAI Evidence / Change Bundle\n\n` +
`> Local-only bundle generated by TAHAI Web Services Browser. Designed for TAHAI IT Docs records today and TAHAI PSA change/support tickets when IT Docs authorizes a server-side PSA connector. This bundle only includes evidence that was explicitly generated or pinned in the browser shell. It does not collect cookies, storage values, credentials, tokens, request bodies, response bodies, clipboard contents, local files, or form values.\n\n` +
`## Bundle control\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Generated at | ${md(generatedAt)} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Active profile | ${md(profile?.name || 'Default')} |\n` +
`| Profile lane | ${md(profile ? profileKindLabel(profile.kind) : 'Local')} |\n` +
`| Active URL | ${md(activeUrl)} |\n` +
`| Current tab count | ${md(tabsNow.length)} |\n` +
`| Pinned evidence count | ${md(evidence.length)} |\n` +
`| Saved workspace count | ${md(workspaces.length)} |\n\n` +
`## Executive summary\n\n` +
`- Bundle name:\n` +
`- Client / organization:\n` +
`- System / service:\n` +
`- Change / incident / request type: change / incident / support / documentation / audit\n` +
`- Owner:\n` +
`- Reviewer / approver:\n` +
`- Status: draft / ready for review / approved / closed\n` +
`- Risk: low / medium / high\n` +
`- User impact:\n\n` +
`## TAHAI IT Docs handoff\n\n` +
`| IT Docs field | Value |\n| --- | --- |\n` +
`| Documentation record type | Service / Asset / Vendor / Location / Network / Project / Runbook |\n` +
`| Suggested title | ${md(evidence[0]?.title || latestWorkspace?.name || profile?.name || 'Evidence bundle')} |\n` +
`| Primary URL | ${md(sourceUrl)} |\n` +
`| Related workspace | ${md(latestWorkspace?.name || 'none')} |\n` +
`| Related profile | ${md(profile?.name || 'Default')} |\n` +
`| Evidence references | ${md(evidenceRefs)} |\n` +
`| Follow-up docs needed | owners, secret-reference location, monitoring, recovery, renewal, support path |\n\n` +
`## TAHAI PSA handoff — IT Docs-routed\n\n` +
`| PSA field | Value |\n| --- | --- |\n` +
`| Ticket / change type | Change / Incident / Service Request / Problem |\n` +
`| Priority | P1 / P2 / P3 / P4 |\n` +
`| Client / site |  |\n` +
`| Assignment queue | DevOps / IT Engineering / Support / Vendor |\n` +
`| SLA target |  |\n` +
`| Approval needed | yes / no |\n` +
`| Implementation window |  |\n` +
`| Close criteria | Evidence reviewed, validation complete, docs updated |\n\n` +
`## Current workspace context\n\n` +
`### Current tabs\n${bundleBulletList(tabsNow)}\n\n` +
`### Saved workspaces\n\n| Workspace | Profile | Tabs | Active URL |\n| --- | --- | ---: | --- |\n${workspaceTable}\n\n` +
`## Evidence index\n\n| Evidence | Profile | Source URL |\n| --- | --- | --- |\n${evidenceTable}\n\n` +
`## Validation checklist\n\n` +
`- [ ] Evidence reviewed by owner\n` +
`- [ ] Scope and affected users confirmed\n` +
`- [ ] Rollback or recovery path documented\n` +
`- [ ] Monitoring / alert path checked\n` +
`- [ ] Secret locations referenced only by IT Docs/server-authorized systems; secrets not pasted into this bundle\n` +
`- [ ] TAHAI IT Docs record created or updated\n` +
`- [ ] TAHAI PSA ticket/change can be created when PSA lane is available\n\n` +
`## Decision log\n\n` +
`| Time | Person | Decision / note |\n| --- | --- | --- |\n` +
`| ${md(generatedAt)} |  | Bundle generated for review. |\n\n` +
`${evidenceSections}\n`;
  return { markdown, sourceUrl, evidenceCount: evidence.length, workspaceCount: workspaces.length };
}

function renderBundleSummary(bundle: ChangeBundleState): void {
  bundleSummary.innerHTML = `
    <article class="ops-card ${bundle.evidenceCount ? 'pass' : 'warn'}">
      <strong>${bundle.evidenceCount ? 'Evidence indexed' : 'No pinned evidence'}</strong>
      <span>${escapeHtml(`${bundle.evidenceCount} pinned output(s)`)}</span>
    </article>
    <article class="ops-card info">
      <strong>Workspaces</strong>
      <span>${escapeHtml(`${bundle.workspaceCount} saved workspace(s)`)}</span>
    </article>
    <article class="ops-card pass">
      <strong>IT Docs handoff</strong>
      <span>Service, project, runbook, and evidence fields included.</span>
    </article>
    <article class="ops-card warn">
      <strong>PSA lane</strong>
      <span>Ticket/change fields staged for IT Docs-routed PSA writeback.</span>
    </article>
  `;
}

function showBundleResult(message: string): void {
  bundleResult.textContent = message;
  window.setTimeout(() => { bundleResult.textContent = ''; }, 3400);
}

function openChangeBundleComposer(): void {
  const bundle = buildChangeBundleMarkdown();
  latestChangeBundle = bundle;
  renderBundleSummary(bundle);
  bundleMarkdown.value = bundle.markdown;
  if (!bundleDialog.open) bundleDialog.showModal();
  bundleMarkdown.focus();
  bundleMarkdown.setSelectionRange(0, 0);
  renderOpsHub();
  setStatus('Evidence / Change Bundle ready', 'Copy or save for TAHAI IT Docs now; PSA handoff fields are staged for IT Docs-routed writeback.');
}


function renderPsaReferenceContract(capabilities: ItDocsMissionCapabilities | undefined): void {
  if (!psaReferenceSummary) return;
  const contract = localOnlyPsaReferenceContractState();
  const providerCount = capabilities?.psaProvidersAvailable?.length || 0;
  const providerText = providerCount ? capabilities!.psaProvidersAvailable.map((provider) => provider.label).join(', ') : 'No IT Docs PSA providers authorized yet';
  psaReferenceSummary.innerHTML = `
    <article class="ops-card info"><strong>PSA reference contract</strong><span>Reference-only display model; no browser-side PSA API calls.</span></article>
    <article class="ops-card warn"><strong>Writeback route</strong><span>Only through IT Docs server-side connector after authorization.</span></article>
    <article class="ops-card ${providerCount ? 'pass' : 'warn'}"><strong>Provider capabilities</strong><span>${escapeHtml(providerText)}</span></article>
    <article class="ops-card pass"><strong>Secret boundary</strong><span>${escapeHtml(contract.disabledReason)}</span></article>
  `;
}

function itDocsCapabilityClass(capabilities: ItDocsMissionCapabilities | undefined): string {
  if (!capabilities) return 'info';
  if (capabilities.signedIn && capabilities.canCreateMissionReference) return 'pass';
  if (capabilities.ok && capabilities.state === 'not-signed-in') return 'warn';
  return capabilities.ok ? 'warn' : 'fail';
}

function renderItDocsCapabilities(capabilities: ItDocsMissionCapabilities | undefined): void {
  if (!itDocsCapabilitySummary) return;
  const display = capabilities || {
    ok: true,
    checkedAt: '',
    origin: config?.itDocsUrl || 'https://docs.tahaiportal.com',
    signedIn: false,
    state: 'not-signed-in',
    activeOrgs: [],
    canCreateMissionReference: false,
    canAppendEvidence: false,
    canAppendRunbookNote: false,
    psaProvidersAvailable: [],
    message: 'IT Docs capabilities have not been checked yet.',
    disabledReason: 'Refresh the IT Docs contract state before attempting writeback.'
  } as ItDocsMissionCapabilities;
  const orgLabel = display.activeOrgs.length ? `${display.activeOrgs.length} authorized org(s)` : 'No authorized orgs';
  const writeCaps = [
    display.canCreateMissionReference ? 'mission ref' : '',
    display.canAppendEvidence ? 'evidence' : '',
    display.canAppendRunbookNote ? 'runbook note' : ''
  ].filter(Boolean).join(', ') || 'local-only';
  itDocsCapabilitySummary.innerHTML = `
    <article class="ops-card ${itDocsCapabilityClass(display)}"><strong>IT Docs contract</strong><span>${escapeHtml(display.message)}</span></article>
    <article class="ops-card ${display.signedIn ? 'pass' : 'warn'}"><strong>Sign-in state</strong><span>${escapeHtml(display.signedIn ? 'Signed in through IT Docs session' : 'Not signed in / local-only')}</span></article>
    <article class="ops-card ${display.activeOrgs.length ? 'pass' : 'warn'}"><strong>Authorized orgs</strong><span>${escapeHtml(orgLabel)}</span></article>
    <article class="ops-card ${writeCaps === 'local-only' ? 'warn' : 'pass'}"><strong>Write capabilities</strong><span>${escapeHtml(writeCaps)}</span></article>
  `;
  renderPsaReferenceContract(display);
  openPsaFromHandoffButton.disabled = !display.psaProvidersAvailable.length;
  openPsaFromHandoffButton.title = display.psaProvidersAvailable.length ? 'Open future PSA reference lane.' : 'PSA controls require IT Docs provider capabilities; no direct browser-side PSA API calls.';
}

async function refreshItDocsCapabilityState(): Promise<ItDocsMissionCapabilities | undefined> {
  try {
    const capabilities = await window.tahaiBrowser.getItDocsCapabilities();
    latestItDocsCapabilities = capabilities;
    renderItDocsCapabilities(capabilities);
    return capabilities;
  } catch (error) {
    const fallback = {
      ok: false,
      checkedAt: new Date().toISOString(),
      origin: config?.itDocsUrl || 'https://docs.tahaiportal.com',
      signedIn: false,
      state: 'offline',
      activeOrgs: [],
      canCreateMissionReference: false,
      canAppendEvidence: false,
      canAppendRunbookNote: false,
      psaProvidersAvailable: [],
      message: 'IT Docs capability check failed. Local-only mission work remains available.',
      disabledReason: error instanceof Error ? error.message : String(error || 'Unknown IT Docs contract error')
    } as ItDocsMissionCapabilities;
    latestItDocsCapabilities = fallback;
    renderItDocsCapabilities(fallback);
    return fallback;
  }
}

function handoffTargetLabel(target: OperationalHandoffTarget): string {
  return target === 'psa' ? 'TAHAI PSA — IT Docs-routed' : 'TAHAI IT Docs';
}

function buildOperationalHandoffMarkdown(target: OperationalHandoffTarget): OperationalHandoffState {
  const evidence = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  const workspaces = readJsonArray<WorkspaceSnapshot>(workspaceStorageKey);
  const profile = activeBrowserProfile();
  const tabsNow = currentWorkspaceUrls();
  const activeUrl = currentActiveUrl();
  const generatedAt = new Date().toISOString();
  const sourceUrl = activeUrl || evidence[0]?.sourceUrl || config.homeUrl;
  const targetLabel = handoffTargetLabel(target);
  const latestWorkspace = workspaces[0];
  const evidenceRefs = evidence.map((_item, index) => `EV-${String(index + 1).padStart(2, '0')}`).join(', ') || 'none';
  const evidenceTable = evidence.length
    ? evidence.map((item, index) => `| EV-${String(index + 1).padStart(2, '0')} | ${md(item.type)} | ${md(item.title)} | ${md(item.sourceUrl)} |`).join('\n')
    : '| _None pinned yet_ |  |  |  |';
  const workspaceTable = workspaces.length
    ? workspaces.slice(0, 12).map((snapshot) => `| ${md(snapshot.name)} | ${md(snapshot.profileName)} | ${md(snapshot.urls.length)} | ${md(snapshot.activeUrl)} |`).join('\n')
    : '| _No saved workspace snapshots yet_ |  |  |  |';
  const psaReferenceContract = psaReferenceMarkdown(null, localOnlyPsaReferenceContractState());
  const psaSection = target === 'psa'
    ? `## TAHAI PSA ticket/change draft — IT Docs-routed

| PSA field | Draft value |
| --- | --- |
| Ticket / change type | Change / Incident / Service Request / Problem |
| Client / site |  |
| Assignment queue | DevOps / IT Engineering / Support / Vendor |
| Priority | P1 / P2 / P3 / P4 |
| SLA target |  |
| Approval needed | yes / no |
| Implementation window |  |
| Close criteria | Evidence reviewed, validation complete, IT Docs updated |

`
    : `## TAHAI PSA readiness note

- PSA lane: IT Docs-routed when authorized server-side connector support exists.
- This handoff is structured so the same evidence can become a PSA ticket/change later.
- Keep ticket-sensitive details in this file and link to the IT Docs record when created.

`;
  const markdown = `# ${targetLabel} Operational Handoff

` +
`> Generated locally by TAHAI Web Services Browser. This handoff uses explicit browser-shell context only: pinned evidence, saved workspace snapshots, active profile metadata, and active tab URLs. It does not collect cookies, storage values, credentials, tokens, request bodies, response bodies, clipboard contents, local files, or form values.

` +
`## Control

| Field | Value |
| --- | --- |
` +
`| Generated at | ${md(generatedAt)} |
` +
`| Target system | ${md(targetLabel)} |
` +
`| IT Docs origin | ${md(latestItDocsCapabilities?.origin || config.itDocsUrl || 'https://docs.tahaiportal.com')} |
` +
`| IT Docs contract state | ${md(latestItDocsCapabilities?.state || 'not-checked')} |
` +
`| IT Docs write capability | ${md(latestItDocsCapabilities?.canCreateMissionReference ? 'server-authorized available' : 'local-only / disabled')} |
` +
`| Browser | ${md(config.productName)} ${md(config.version)} |
` +
`| Active profile | ${md(profile?.name || 'Default')} |
` +
`| Profile lane | ${md(profile ? profileKindLabel(profile.kind) : 'Local')} |
` +
`| Active URL | ${md(activeUrl)} |
` +
`| Current tab count | ${md(tabsNow.length)} |
` +
`| Pinned evidence count | ${md(evidence.length)} |
` +
`| Saved workspace count | ${md(workspaces.length)} |

` +
`## Intake summary

` +
`- Client / organization:
` +
`- Service / system:
` +
`- Owner:
` +
`- Primary URL: ${md(sourceUrl)}
` +
`- Current status: draft / active / pending review / complete
` +
`- Risk / impact: low / medium / high
` +
`- Evidence references: ${md(evidenceRefs)}
` +
`- Related workspace: ${md(latestWorkspace?.name || 'none')}

` +
`## TAHAI IT Docs record draft

| IT Docs field | Draft value |
| --- | --- |
` +
`| Record type | Service / Asset / Vendor / Location / Network / Project / Runbook |
` +
`| Suggested title | ${md(evidence[0]?.title || latestWorkspace?.name || profile?.name || 'Operational handoff')} |
` +
`| Primary URL | ${md(sourceUrl)} |
` +
`| Owner / support queue |  |
` +
`| Monitoring / alert path |  |
` +
`| Recovery / rollback path |  |
` +
`| Secret-location reference | Secret boundary / IT Docs secret reference only; do not paste secrets here |
` +
`| Evidence references | ${md(evidenceRefs)} |

` +
`${psaSection}` +
`${psaReferenceContract}
` +
`## Workspace context

### Current tabs
${bundleBulletList(tabsNow)}

### Saved workspace snapshots

| Workspace | Profile | Tabs | Active URL |
| --- | --- | ---: | --- |
${workspaceTable}

` +
`## Evidence index

| Ref | Type | Title | Source URL |
| --- | --- | --- | --- |
${evidenceTable}

` +
`## Handoff checklist

` +
`- [ ] Confirm owner / service / client fields
` +
`- [ ] Attach screenshots or external artifacts if needed
` +
`- [ ] Link related workspace snapshot or tabs
` +
`- [ ] Confirm no credentials/secrets are pasted into this handoff
` +
`- [ ] Create or update TAHAI IT Docs record
` +
`- [ ] Create TAHAI PSA ticket/change when PSA lane is available

` +
`## Notes

- 
`;
  return { markdown, sourceUrl, target, evidenceCount: evidence.length, workspaceCount: workspaces.length, tabCount: tabsNow.length };
}

function renderHandoffSummary(handoff: OperationalHandoffState): void {
  handoffSummary.innerHTML = `
    <article class="ops-card pass"><strong>${escapeHtml(handoffTargetLabel(handoff.target))}</strong><span>${handoff.target === 'psa' ? 'Ticket/change fields staged.' : 'Record fields staged for IT Docs.'}</span></article>
    <article class="ops-card ${handoff.evidenceCount ? 'pass' : 'warn'}"><strong>Evidence</strong><span>${escapeHtml(`${handoff.evidenceCount} pinned output(s)`)}</span></article>
    <article class="ops-card info"><strong>Workspaces</strong><span>${escapeHtml(`${handoff.workspaceCount} saved workspace(s)`)}</span></article>
    <article class="ops-card info"><strong>Tabs</strong><span>${escapeHtml(`${handoff.tabCount} active tab(s)`)}</span></article>
  `;
}

function showHandoffResult(message: string): void {
  handoffResult.textContent = message;
  window.setTimeout(() => { handoffResult.textContent = ''; }, 3400);
}

function setHandoffTarget(target: OperationalHandoffTarget): void {
  renderItDocsCapabilities(latestItDocsCapabilities);
  latestOperationalHandoff = buildOperationalHandoffMarkdown(target);
  renderHandoffSummary(latestOperationalHandoff);
  handoffMarkdown.value = latestOperationalHandoff.markdown;
  handoffTargetButtons.forEach((button) => {
    const activeTarget = button.dataset.handoffTarget === target;
    button.classList.toggle('active', activeTarget);
    button.setAttribute('aria-pressed', activeTarget ? 'true' : 'false');
  });
}

function openHandoffCenter(target: OperationalHandoffTarget = 'it-docs'): void {
  closeToolMenus();
  setHandoffTarget(target);
  if (!handoffDialog.open) handoffDialog.showModal();
  handoffMarkdown.focus();
  handoffMarkdown.setSelectionRange(0, 0);
  setStatus('TAHAI handoff ready', handoffTargetLabel(target));
  void refreshItDocsCapabilityState().then(() => { if (handoffDialog.open) setHandoffTarget(target); });
}


function guardSourceCandidate(): { label: string; markdown: string; sourceUrl: string } {
  const candidates = [
    { label: 'Handoff Center', markdown: handoffMarkdown.value || latestOperationalHandoff?.markdown || '', sourceUrl: latestOperationalHandoff?.sourceUrl || currentActiveUrl(), active: handoffDialog.open || Boolean(latestOperationalHandoff?.markdown) },
    { label: 'Evidence / Change Bundle', markdown: bundleMarkdown.value || latestChangeBundle?.markdown || '', sourceUrl: latestChangeBundle?.sourceUrl || currentActiveUrl(), active: bundleDialog.open || Boolean(latestChangeBundle?.markdown) },
    { label: 'Developer Audit', markdown: devAuditMarkdown.value || latestDevAudit?.markdown || '', sourceUrl: latestDevAudit?.sourceUrl || currentActiveUrl(), active: devAuditDialog.open || Boolean(latestDevAudit?.markdown) },
    { label: 'Route Map', markdown: routeMapMarkdown.value || latestRouteMap?.markdown || '', sourceUrl: latestRouteMap?.sourceUrl || currentActiveUrl(), active: routeMapDialog.open || Boolean(latestRouteMap?.markdown) },
    { label: 'Support Triage', markdown: triageMarkdown.value || latestTriage?.markdown || '', sourceUrl: latestTriage?.sourceUrl || currentActiveUrl(), active: triageDialog.open || Boolean(latestTriage?.markdown) },
    { label: 'Endpoint Snapshot', markdown: endpointMarkdown.value || latestEndpoint?.markdown || '', sourceUrl: latestEndpoint?.sourceUrl || currentActiveUrl(), active: endpointDialog.open || Boolean(latestEndpoint?.markdown) },
    { label: 'IT Service Card', markdown: itCardMarkdown.value || latestItCard?.markdown || '', sourceUrl: latestItCard?.sourceUrl || currentActiveUrl(), active: itCardDialog.open || Boolean(latestItCard?.markdown) },
    { label: 'Deploy Readiness', markdown: deployMarkdown.value || latestDeployReadiness?.markdown || '', sourceUrl: latestDeployReadiness?.sourceUrl || currentActiveUrl(), active: deployDialog.open || Boolean(latestDeployReadiness?.markdown) },
    { label: 'Ops Check', markdown: opsMarkdown.value || latestOpsCheck?.markdown || '', sourceUrl: latestOpsCheck?.sourceUrl || currentActiveUrl(), active: opsDialog.open || Boolean(latestOpsCheck?.markdown) },
    { label: 'Evidence Capture', markdown: captureMarkdown.value || latestCapture?.markdown || '', sourceUrl: latestCapture?.sourceUrl || currentActiveUrl(), active: captureDialog.open || Boolean(latestCapture?.markdown) }
  ];
  const activeCandidate = candidates.find((candidate) => candidate.active && candidate.markdown.trim());
  if (activeCandidate) return { label: activeCandidate.label, markdown: activeCandidate.markdown.trim(), sourceUrl: activeCandidate.sourceUrl };
  const evidence = readJsonArray<EvidenceTimelineItem>(evidenceStorageKey);
  if (evidence.length) return { label: 'Pinned Evidence Timeline', markdown: evidence.map((item) => `## ${item.type} - ${item.title}

${item.markdown}`).join('\n\n---\n\n'), sourceUrl: evidence[0].sourceUrl || currentActiveUrl() };
  const bundle = buildChangeBundleMarkdown();
  return { label: 'Generated Evidence / Change Bundle', markdown: bundle.markdown, sourceUrl: bundle.sourceUrl };
}

const guardPatterns: Array<{ label: string; severity: OpsGuardSeverity; detail: string; pattern: RegExp }> = [
  { label: 'Private key block', severity: 'fail', detail: 'Private key material should never be pasted into tickets, handoffs, or documentation.', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { label: 'AWS access key id', severity: 'fail', detail: 'AWS access keys must be rotated if exposed outside a server-side secret manager.', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'GitHub token', severity: 'fail', detail: 'GitHub personal/access tokens should be removed and rotated if shared.', pattern: /\bgh[pousr]_[0-9A-Za-z]{30,}\b/g },
  { label: 'OpenAI-style API key', severity: 'fail', detail: 'Provider API keys should stay in a server-side secret manager only.', pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{18,}\b/g },
  { label: 'Google API key', severity: 'fail', detail: 'Google API keys should not appear in external evidence bundles.', pattern: /\bAIza[0-9A-Za-z\-_]{25,}\b/g },
  { label: 'Slack token', severity: 'fail', detail: 'Slack tokens grant workspace access and must be redacted.', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g },
  { label: 'Authorization or bearer value', severity: 'fail', detail: 'Authorization headers and bearer values should be excluded from handoffs.', pattern: /\b(?:authorization|bearer)\s*[:=]\s*["']?[^\s"'`|]{12,}/gi },
  { label: 'Secret assignment', severity: 'warn', detail: 'Lines assigning passwords, client secrets, API keys, or tokens should be reviewed.', pattern: /\b(?:password|passwd|pwd|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\b\s*[:=]\s*["']?[^\s"'`|]{4,}/gi },
  { label: 'Email address', severity: 'info', detail: 'Email addresses may be acceptable for IT Docs, but review before external vendor sharing.', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { label: 'Long opaque value', severity: 'warn', detail: 'Long opaque values are often tokens, session IDs, hashes, or one-time links.', pattern: /\b[A-Za-z0-9_-]{48,}\b/g }
];

function redactWithPattern(markdown: string, pattern: RegExp, label: string): string {
  return markdown.replace(pattern, `[REDACTED: ${label}]`);
}

let latestOpsGuard: any = null;

function buildOpsGuardReview(): OpsGuardState {
  const candidate = guardSourceCandidate();
  let redactedMarkdown = candidate.markdown;
  const findings: OpsGuardFinding[] = [];
  for (const rule of guardPatterns) {
    const matches = candidate.markdown.match(rule.pattern) || [];
    if (!matches.length) continue;
    findings.push({ label: rule.label, severity: rule.severity, matches: matches.length, detail: rule.detail });
    if (rule.severity === 'fail' || rule.severity === 'warn') redactedMarkdown = redactWithPattern(redactedMarkdown, rule.pattern, rule.label);
  }
  const highRiskCount = findings.filter((finding) => finding.severity === 'fail').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warn').length;
  const findingRows = findings.length
    ? findings.map((finding) => `| ${md(finding.severity.toUpperCase())} | ${md(finding.label)} | ${md(finding.matches)} | ${md(finding.detail)} |`).join('\n')
    : '| PASS | No obvious sharing risks detected | 0 | No known secret patterns were found. |';
  const markdown = `# TAHAI Ops Guard Redaction Review\n\n` +
`> Local-only review generated by TAHAI Web Services Browser before content is copied into email, tickets, vendor portals, TAHAI IT Docs, or the future TAHAI PSA lane. Pattern matching is a guardrail, not a guarantee. Review the redacted copy before sharing.\n\n` +
`## Review metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Reviewed at | ${md(new Date().toISOString())} |\n` +
`| Source | ${md(candidate.label)} |\n` +
`| Source URL | ${md(candidate.sourceUrl)} |\n` +
`| Active profile | ${md(activeProfileLabel())} |\n` +
`| Findings | ${md(findings.length)} |\n` +
`| High-risk findings | ${md(highRiskCount)} |\n` +
`| Warning findings | ${md(warningCount)} |\n\n` +
`## Findings\n\n| Severity | Finding | Matches | Guidance |\n| --- | --- | ---: | --- |\n${findingRows}\n\n` +
`## Sharing decision\n\n` +
`${highRiskCount ? '- [ ] Do not share externally until high-risk findings are removed and rotated where needed.\n' : '- [x] No high-risk secret patterns detected by this local review.\n'}` +
`${warningCount ? '- [ ] Review warnings for tokens, opaque IDs, or sensitive assignments.\n' : '- [x] No warning-level secret assignment patterns detected.\n'}` +
`- [ ] Confirm customer/client names are appropriate for the destination.\n` +
`- [ ] Confirm screenshots or attachments are separately reviewed.\n` +
`- [ ] Store authoritative internal version in TAHAI IT Docs.\n` +
`- [ ] Create or link TAHAI PSA ticket/change when IT Docs authorizes a server-side PSA connector.\n\n` +
`## Redacted sharing copy\n\n\`\`\`markdown\n${redactedMarkdown.trim()}\n\`\`\`\n`;
  return { markdown, redactedMarkdown, sourceLabel: candidate.label, findingCount: findings.length, highRiskCount, warningCount };
}

function renderOpsGuardSummary(review: OpsGuardState): void {
  opsGuardSummary.innerHTML = `
    <article class="ops-card ${review.highRiskCount ? 'fail' : review.warningCount ? 'warn' : 'pass'}"><strong>${review.highRiskCount ? 'High-risk review' : review.warningCount ? 'Review warnings' : 'Share-ready draft'}</strong><span>${escapeHtml(`${review.findingCount} finding(s) from ${review.sourceLabel}`)}</span></article>
    <article class="ops-card ${review.highRiskCount ? 'fail' : 'pass'}"><strong>High-risk</strong><span>${escapeHtml(String(review.highRiskCount))}</span></article>
    <article class="ops-card ${review.warningCount ? 'warn' : 'pass'}"><strong>Warnings</strong><span>${escapeHtml(String(review.warningCount))}</span></article>
    <article class="ops-card info"><strong>Output</strong><span>Review report + redacted sharing copy.</span></article>
  `;
}

function showOpsGuardResult(message: string): void {
  opsGuardResult.textContent = message;
  window.setTimeout(() => { opsGuardResult.textContent = ''; }, 3400);
}

function openOpsGuardReview(): void {
  closeToolMenus();
  latestOpsGuard = buildOpsGuardReview();
  renderOpsGuardSummary(latestOpsGuard);
  opsGuardMarkdown.value = latestOpsGuard.markdown;
  opsGuardRedacted.value = latestOpsGuard.redactedMarkdown;
  if (!opsGuardDialog.open) opsGuardDialog.showModal();
  opsGuardMarkdown.focus();
  opsGuardMarkdown.setSelectionRange(0, 0);
  setStatus('Ops Guard review ready', latestOpsGuard.highRiskCount ? 'High-risk findings require review.' : 'Copy redacted output when ready.');
}

async function ensureRecipeProfile(recipe: LaunchRecipe): Promise<void> {
  if (!recipe.profileKind) return;
  if (!browserProfileState) await refreshProfiles();
  let target = browserProfileState?.profiles.find((profile) => profile.kind === recipe.profileKind && profile.name.toLowerCase().includes(recipe.profileName.toLowerCase().slice(0, 6)))
    || browserProfileState?.profiles.find((profile) => profile.kind === recipe.profileKind);
  if (!target) {
    browserProfileState = await window.tahaiBrowser.createProfile({ name: recipe.profileName, kind: recipe.profileKind, color: recipe.profileKind === 'google' ? '#77dbff' : recipe.profileKind === 'microsoft' ? '#b184ff' : recipe.profileKind === 'client' ? '#6dffb7' : '#ffd27a' });
    target = browserProfileState.activeProfile;
  }
  if (target.id !== browserProfileState?.activeProfileId) {
    browserProfileState = await window.tahaiBrowser.setActiveProfile(target.id);
  }
  renderProfileBadge();
}

async function openLaunchRecipe(recipeId: string): Promise<void> {
  const recipe = premiumLaunchRecipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) return;
  await ensureRecipeProfile(recipe);
  closeAllTabsForProfileSwitch();
  for (const url of recipe.urls) createTab(url);
  renderOpsHub();
  setStatus(recipe.comingSoon ? `${recipe.label} requires IT Docs connector support` : `${recipe.label} opened`, recipe.note);
}

async function startMissionFromRecipe(recipeId: string): Promise<void> {
  const recipe = premiumLaunchRecipes.find((candidate) => candidate.id === recipeId);
  if (!recipe) return;
  if (recipe.comingSoon) {
    setStatus(`${recipe.label} requires IT Docs connector support`, recipe.note);
    return;
  }
  await ensureRecipeProfile(recipe);
  closeAllTabsForProfileSwitch();
  const now = new Date().toISOString();
  const mission: MissionState = {
    schemaVersion: 1,
    missionId: missionUuid(),
    name: recipe.label,
    missionType: recipe.missionType || 'generic',
    mode: 'local-only',
    createdAt: now,
    updatedAt: now,
    tabs: [],
    layout: { type: recipe.missionLayout || 'single', activePaneId: 'pane-1', panes: [] },
    notes: [
      `Started from Launch Recipe: ${recipe.label}. ${recipe.note}`,
      recipe.missionPrimaryAction ? `Primary action: ${recipe.missionPrimaryAction}` : '',
      recipeEvidenceNote(recipe)
    ].filter(Boolean),
    runbook: createMissionRunbookFromRecipe(recipe),
    evidence: recipe.missionEvidencePrompts?.map((prompt) => ({ eventId: missionUuid(), kind: 'checklist' as MissionEvidenceKind, title: prompt, url: recipe.urls[0] || '', createdAt: now, operatorNote: 'Recipe evidence prompt. Replace with captured proof before export.', metadata: { source: 'launch-recipe' } })) || [],
    timeline: [{ eventId: missionUuid(), kind: 'created', createdAt: now, title: 'Mission recipe started', detail: recipe.note }],
    links: { itDocs: null, psa: null }
  };
  currentMission = mission;
  missionRuntimeTabs.clear();
  recipe.urls.slice(0, 4).forEach((url, index) => {
    const safeUrl = normalizeTarget(url);
    const runtimeTabId = createTab(safeUrl);
    const paneId = missionPaneIds[index] || 'pane-1';
    const runtimeTab = tabs.get(runtimeTabId);
    if (runtimeTab) runtimeTab.missionPaneId = paneId;
    const missionTabId = missionUuid();
    const role = recipe.missionRoles?.[index] || missionDefaultRole(safeUrl);
    mission.tabs.push({ tabId: missionTabId, role, url: safeUrl, title: titleFromUrl(safeUrl), pinned: false, paneId });
    missionRuntimeTabs.set(missionTabId, runtimeTabId);
  });
  syncMissionLayoutPanes();
  const saveResult = await window.tahaiBrowser.saveMission(mission);
  if (saveResult.ok && saveResult.mission) currentMission = saveResult.mission;
  await refreshMissionStore();
  renderOpsHub();
  renderMissionLayout();
  setStatus('Mission recipe started', `${recipe.label} · ${missionLayoutLabel(recipe.missionLayout || 'single')}`);
}


type BookmarkFolderMissionDetail = { title?: string; urls?: string[]; titles?: string[]; totalBookmarks?: number; sourceFolderId?: string; sourceKind?: 'folder' | 'bookmark'; launchManifest?: string };

type BookmarkMissionSafetySummary = {
  requestedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  blockedCount: number;
  openedPaneCount: number;
};

function bookmarkMissionRole(url: string, title: string, index: number): MissionTabRole {
  const haystack = `${title} ${url}`.toLowerCase();
  if (/log|logs|monitor|status|uptime|cloudwatch|observability/.test(haystack)) return 'logs';
  if (/ticket|case|issue|jira|linear|zendesk|freshservice|halo|autotask|connectwise/.test(haystack)) return 'ticket';
  if (/doc|docs|runbook|wiki|guide|readme|learn\.microsoft|developer/.test(haystack)) return 'docs';
  if (/live|prod|production|staging|preview|app\./.test(haystack)) return 'live-target';
  if (/github|actions|vercel|cloudflare|aws|azure|entra|admin\.microsoft|console|dashboard|portal/.test(haystack)) return index === 0 ? 'primary-console' : 'vendor-portal';
  return index === 0 ? 'primary-console' : 'docs';
}

function bookmarkMissionLayoutForCount(count: number): MissionLayoutType {
  if (count >= 4) return 'quad';
  if (count === 3) return 'triple';
  if (count === 2) return 'split-horizontal';
  return 'single';
}

async function startMissionFromBookmarkFolder(detail: BookmarkFolderMissionDetail): Promise<void> {
  const seen = new Set<string>();
  const suppliedUrls = detail.urls || [];
  const suppliedTitles = detail.titles || [];
  let duplicateCount = 0;
  let blockedCount = 0;
  const safeEntries = suppliedUrls
    .map((url, index) => {
      const normalized = normalizeTarget(url);
      if (!/^https?:\/\//i.test(normalized)) {
        blockedCount += 1;
        return null;
      }
      return { url: normalized, title: compactText(suppliedTitles[index] || titleFromUrl(normalized), titleFromUrl(normalized)).slice(0, 160) };
    })
    .filter((entry): entry is { url: string; title: string } => {
      if (!entry) return false;
      if (seen.has(entry.url)) {
        duplicateCount += 1;
        return false;
      }
      seen.add(entry.url);
      return true;
    });
  const paneEntries = safeEntries.slice(0, 4);
  const safetySummary: BookmarkMissionSafetySummary = {
    requestedCount: detail.totalBookmarks || suppliedUrls.length,
    acceptedCount: safeEntries.length,
    duplicateCount,
    blockedCount: Math.max(blockedCount, (detail.totalBookmarks || suppliedUrls.length) - suppliedUrls.length + blockedCount),
    openedPaneCount: paneEntries.length
  };
  if (!paneEntries.length) {
    setStatus('Bookmark Mission blocked', `${safetySummary.blockedCount || suppliedUrls.length} unsafe or invalid URL(s) rejected.`);
    return;
  }
  const now = new Date().toISOString();
  const missionName = compactText(detail.title || 'Bookmark Mission', 'Bookmark Mission').slice(0, 120);
  closeAllTabsForProfileSwitch();
  const mission: MissionState = {
    schemaVersion: 1,
    missionId: missionUuid(),
    name: missionName,
    missionType: 'documentation',
    mode: 'local-only',
    createdAt: now,
    updatedAt: now,
    tabs: [],
    layout: { type: bookmarkMissionLayoutForCount(paneEntries.length), activePaneId: 'pane-1', panes: [] },
    notes: [
      `Started from bookmark ${detail.sourceKind === 'bookmark' ? 'URL' : 'folder'}: ${missionName}.`,
      `Bookmark source supplied ${safetySummary.requestedCount} item(s); ${safetySummary.acceptedCount} safe URL(s) accepted, ${safetySummary.duplicateCount} duplicate(s) skipped, ${safetySummary.blockedCount} unsafe/invalid item(s) blocked.`,
      `First ${safetySummary.openedPaneCount} safe URL(s) opened into Mission panes; remaining safe bookmarks are preserved as Mission Evidence metadata for handoff/export.`,
      ...(detail.launchManifest ? [`Launch manifest copied into Mission notes for handoff/export.\n\n${detail.launchManifest}`] : [])
    ],
    runbook: {
      objective: 'Use this bookmarked workspace as a local-only Mission Control workspace.',
      rollback: 'Close the mission or return to normal browsing if any URL is unexpected or out of scope.',
      steps: paneEntries.map((entry, index) => ({ stepId: missionUuid(), label: `Review pane ${index + 1}: ${entry.title}`, state: 'todo' as MissionRunbookStepState, evidenceNote: 'Bookmark Mission pane seeded from safe bookmark URL.' }))
    },
    evidence: safeEntries.map((entry, index) => ({
      eventId: missionUuid(),
      kind: 'url' as MissionEvidenceKind,
      title: entry.title || `Bookmark mission URL ${index + 1}`,
      url: entry.url,
      createdAt: now,
      operatorNote: index < 4 ? 'Opened into a Mission pane from bookmarks. Add notes or evidence before export.' : 'Included as supporting bookmark evidence; not opened because Mission panes are capped at four.',
      metadata: { source: 'bookmark-folder', sourceFolderId: detail.sourceFolderId || '', sourceKind: detail.sourceKind || 'folder', paneOpened: String(index < 4), requestedCount: String(safetySummary.requestedCount), acceptedCount: String(safetySummary.acceptedCount), duplicateCount: String(safetySummary.duplicateCount), blockedCount: String(safetySummary.blockedCount) }
    })),
    timeline: [
      { eventId: missionUuid(), kind: 'created', createdAt: now, title: 'Bookmark Mission started', detail: `${missionName} · ${paneEntries.length} pane(s) · ${safeEntries.length} evidence URL(s)` },
      { eventId: missionUuid(), kind: 'note', createdAt: now, title: 'Bookmark Mission safety summary', detail: `${safetySummary.acceptedCount} accepted · ${safetySummary.duplicateCount} duplicate(s) skipped · ${safetySummary.blockedCount} blocked` }
    ],
    links: { itDocs: null, psa: null }
  };
  currentMission = mission;
  missionRuntimeTabs.clear();
  paneEntries.forEach((entry, index) => {
    const runtimeTabId = createTab(entry.url);
    const paneId = missionPaneIds[index] || 'pane-1';
    const runtimeTab = tabs.get(runtimeTabId);
    if (runtimeTab) runtimeTab.missionPaneId = paneId;
    const missionTabId = missionUuid();
    mission.tabs.push({ tabId: missionTabId, role: bookmarkMissionRole(entry.url, entry.title, index), url: entry.url, title: entry.title || titleFromUrl(entry.url), pinned: false, paneId });
    missionRuntimeTabs.set(missionTabId, runtimeTabId);
  });
  syncMissionLayoutPanes();
  const saveResult = await window.tahaiBrowser.saveMission(mission);
  if (saveResult.ok && saveResult.mission) currentMission = saveResult.mission;
  await refreshMissionStore();
  renderOpsHub();
  renderMissionControl();
  renderMissionLayout();
  openMissionControl();
  setStatus('Bookmark Mission started', `${missionName} · ${missionLayoutLabel(currentMission?.layout.type || mission.layout.type)} · ${safeEntries.length} evidence URL(s) · ${safetySummary.blockedCount} blocked`);
}

function openKeyboardShortcuts(): void {
  shortcutList.innerHTML = shortcutRows.map(([keys, action]) => '<article><kbd>' + escapeHtml(keys) + '</kbd><span>' + escapeHtml(action) + '</span></article>').join('');
  if (!shortcutDialog.open) shortcutDialog.showModal();
}


function commandActionSearchText(action: CommandPaletteAction): string {
  return `${action.title} ${action.detail} ${action.group} ${action.shortcut || ''} ${action.target || ''} ${action.phase || ''}`.toLowerCase();
}

function commandActionMeta(action: CommandPaletteAction): string {
  return [action.group, action.target ? `Target: ${action.target}` : '', action.detail].filter(Boolean).join(' · ');
}

function sendActiveTabToMissionPane(paneId: string): void {
  const tab = active();
  if (!tab) {
    setStatus('No active tab to send', 'Mission Command Center');
    return;
  }
  upsertBrowserTabIntoMissionPane(tab.id, paneId, { activateLayout: true });
  setMissionActivePane(paneId);
  setStatus('Active tab sent to mission pane', paneId.replace('pane-', 'Pane '));
}

function focusMissionPaneFromCommand(paneId: string): void {
  ensureCurrentMission();
  setMissionActivePane(paneId);
  setMissionLayout('focus');
  openMissionControl();
}

function buildCommandPaletteActions(): CommandPaletteAction[] {
  const actions: CommandPaletteAction[] = [
    { id: 'open-ops-hub', title: 'Open Ops Panel', detail: 'Persistent right-side DevOps / IT operational rail.', group: 'Shell', shortcut: 'Ctrl+Alt+H', target: 'Browser shell', phase: 'browser', run: () => toggleOpsHub(true) },
    { id: 'mission-control', title: 'Mission Control', detail: 'Create, restore, save, and lay out local Mission Tabs.', group: 'Mission', shortcut: 'Ctrl+Alt+M', target: 'Current mission', phase: 'mission', run: openMissionControl },
    { id: 'start-deploy-cockpit', title: 'Start DevOps Deploy Cockpit', detail: 'Open source/logs, deployment provider, status, and runbook in Quad View.', group: 'DevOps Mission Recipe', shortcut: 'Ctrl+Alt+D', target: 'New DevOps mission', phase: 'devops', run: () => startMissionFromRecipe('deploy-cockpit') },
    { id: 'mission-add-tab', title: 'Add Active Tab to Mission', detail: 'Assign the active tab to the current local Mission.', group: 'Mission', target: 'Active tab', phase: 'mission', run: addActiveTabToMission },
    { id: 'mission-make-quad', title: 'Make Quad From Open Tabs', detail: 'Assign the first four browser tabs to Mission panes and switch to Quad View.', group: 'Mission', target: 'Open tabs', phase: 'mission', run: makeQuadFromOpenTabs },
    { id: 'mission-quad', title: 'Mission Quad View', detail: 'Switch Mission Control to 4-Up Quad Ops View.', group: 'Mission View', shortcut: 'Ctrl+Alt+Q', target: 'Current mission', phase: 'mission', run: () => setMissionLayout('quad') },
    { id: 'mission-split', title: 'Mission Split View', detail: 'Switch Mission Control to 2-Up Split View.', group: 'Mission View', shortcut: 'Ctrl+Alt+S', target: 'Current mission', phase: 'mission', run: () => setMissionLayout('split-horizontal') },
    { id: 'mission-triad', title: 'Mission 3-Up Triad', detail: 'Switch Mission Control to a 3-pane operational triad.', group: 'Mission View', shortcut: 'Ctrl+Alt+3', target: 'Current mission', phase: 'mission', run: () => setMissionLayout('triple') },
    { id: 'mission-pane-swap-left', title: 'Swap Active Pane Left', detail: 'Quick-swap the active Mission pane with the previous visible pane.', group: 'Mission View', shortcut: 'Ctrl+Alt+Shift+←', target: 'Active pane', phase: 'mission', run: () => swapActiveMissionPane(-1) },
    { id: 'mission-pane-swap-right', title: 'Swap Active Pane Right', detail: 'Quick-swap the active Mission pane with the next visible pane.', group: 'Mission View', shortcut: 'Ctrl+Alt+Shift+→', target: 'Active pane', phase: 'mission', run: () => swapActiveMissionPane(1) },
    { id: 'mission-rename', title: 'Rename Current Mission', detail: 'Rename the active local Mission Tab set without using a native prompt.', group: 'Mission', target: 'Current mission', phase: 'mission', run: renameCurrentMission },
    { id: 'mission-runbook', title: 'Mission Runbook Rail', detail: 'Open checklist, rollback, notes, and mission timeline.', group: 'Mission', shortcut: 'Ctrl+Alt+N', target: 'Runbook rail', phase: 'mission', run: openMissionControl },
    { id: 'mission-focus-pane', title: 'Toggle Mission Focus Pane', detail: 'Maximize the active mission pane without losing Quad/Split context.', group: 'Mission View', shortcut: 'Ctrl+Alt+F', target: 'Active pane', phase: 'mission', run: () => toggleMissionFocusPane() },
    { id: 'save-workspace', title: 'Save Workspace Snapshot', detail: 'Save current tabs and active profile context.', group: 'Workspace', run: saveWorkspaceSnapshot },
    { id: 'pin-evidence', title: 'Pin Latest Evidence', detail: 'Add current tool output to the local evidence timeline.', group: 'Evidence', run: pinLatestEvidence },
    { id: 'build-bundle', title: 'Build Evidence / Change Bundle', detail: 'Bundle pinned evidence, workspaces, IT Docs handoff, and PSA-ready fields.', group: 'Evidence', shortcut: 'Ctrl+Alt+B', run: openChangeBundleComposer },
    { id: 'handoff-center', title: 'IT Docs / PSA Handoff Center', detail: 'Generate operational handoff markdown for IT Docs today and PSA soon.', group: 'TAHAI', shortcut: 'Ctrl+Alt+Y', run: () => openHandoffCenter('it-docs') },
    { id: 'handoff-psa', title: 'TAHAI PSA Handoff Draft', detail: 'Stage a PSA ticket/change draft with pinned evidence and workspace context.', group: 'TAHAI', run: () => openHandoffCenter('psa') },
    { id: 'shortcuts', title: 'Keyboard Shortcuts', detail: 'Show the TAHAI keyboard map.', group: 'Help', shortcut: 'Ctrl+/', run: openKeyboardShortcuts },
    { id: 'profiles', title: 'Profiles', detail: 'Manage isolated browser profiles.', group: 'Profiles', shortcut: 'Ctrl+Shift+P', run: openProfileManager },
    { id: 'secret-boundary', title: 'Secret Boundary', detail: 'Open Ops Guard and integration-secret boundary. No browser-side vault.', group: 'IT', shortcut: 'Ctrl+Alt+K', run: openSecretBoundary },
    { id: 'devops-menu', title: 'DevOps Tools Menu', detail: 'Open DevOps and developer flyout.', group: 'Tools', shortcut: 'Ctrl+Alt+O', run: () => openToolMenu('devops') },
    { id: 'it-menu', title: 'IT Tools Menu', detail: 'Open IT engineering flyout.', group: 'Tools', shortcut: 'Ctrl+Alt+I', run: () => openToolMenu('it') },
    { id: 'last-tool-menu', title: 'Reopen Last Command Toolbar', detail: 'Open whichever command lane was used last: DevOps or IT Tools.', group: 'Tools', shortcut: 'Ctrl+Alt+L', run: () => openLastToolMenu() },
    { id: 'capture', title: 'Capture DevOps Evidence', detail: 'Create Markdown evidence for tickets/runbooks.', group: 'Tools', shortcut: 'Ctrl+Shift+E', run: openDevOpsCapture },
    { id: 'ops-check', title: 'Run Ops Check', detail: 'HTTP and safe header readiness report.', group: 'Tools', shortcut: 'Ctrl+Shift+D', run: openOpsCheck },
    { id: 'deploy', title: 'Deploy Readiness', detail: 'Go/no-go, rollback, smoke checks, post-deploy matrix.', group: 'Tools', shortcut: 'Ctrl+Alt+R', run: openDeployReadiness },
    { id: 'it-card', title: 'IT Service Card', detail: 'TAHAI IT Docs / CMDB-ready service card.', group: 'Tools', shortcut: 'Ctrl+Shift+M', run: openItServiceCard },
    { id: 'endpoint', title: 'Endpoint Snapshot', detail: 'Safe workstation/browser profile for support.', group: 'Tools', shortcut: 'Ctrl+Alt+E', run: openEndpointSnapshot },
    { id: 'triage', title: 'Support Triage Packet', detail: 'Impact/repro/escalation packet for helpdesk.', group: 'Tools', shortcut: 'Ctrl+Alt+T', run: openSupportTriage },
    { id: 'routes', title: 'Route Map', detail: 'Frontend route/API surface map.', group: 'Tools', shortcut: 'Ctrl+Alt+P', run: openRouteMap },
    { id: 'dev-audit', title: 'Developer Audit', detail: 'Console signal, timings, resources, page quality.', group: 'Tools', shortcut: 'Ctrl+Alt+A', run: openDeveloperAudit },
    { id: 'devtools', title: 'Chromium DevTools', detail: 'Open active tab Chromium DevTools.', group: 'Developer', shortcut: 'F12', run: toggleActiveDevTools },
    { id: 'it-docs', title: 'TAHAI IT Docs', detail: 'Open production TAHAI IT Docs.', group: 'TAHAI', run: () => openLaunchRecipe('tahai-it-docs') },
    { id: 'psa', title: 'TAHAI PSA Reference Lane', detail: 'IT Docs-routed PSA reference lane; no direct browser connector.', group: 'TAHAI', run: () => openLaunchRecipe('tahai-psa') }
  ];
  for (const paneId of missionPaneIds) {
    const paneLabel = paneId.replace('pane-', 'Pane ');
    actions.push({ id: `mission-focus-${paneId}`, title: `Focus ${paneLabel}`, detail: 'Make this Mission pane the active focused work surface.', group: 'Mission View', shortcut: `Ctrl+Alt+${paneId.slice(-1)}`, target: paneLabel, phase: 'mission', run: () => focusMissionPaneFromCommand(paneId) });
    actions.push({ id: `mission-send-active-${paneId}`, title: `Send Active Tab to ${paneLabel}`, detail: 'Route the active tab into a Mission pane and keep navigation targeted.', group: 'Mission Routing', target: 'Active tab to ' + paneLabel, phase: 'mission', run: () => sendActiveTabToMissionPane(paneId) });
  }
  for (const recipe of premiumLaunchRecipes) {
    actions.push({ id: 'recipe-' + recipe.id, title: recipe.label, detail: recipe.note, group: 'Launch Recipe', target: recipe.profileName, phase: commandPalettePhaseFromRecipePhase(recipe.missionPhase, 'browser'), run: () => openLaunchRecipe(recipe.id) });
    if (!recipe.comingSoon) actions.push({ id: 'mission-recipe-' + recipe.id, title: 'Start Mission: ' + recipe.label, detail: recipePhaseLabel(recipe) + ' · ' + recipe.group + ' · ' + missionLayoutLabel(recipe.missionLayout || 'single'), group: recipe.missionPhase === 'devops' ? 'DevOps Mission Recipe' : 'Mission Recipe', target: 'New mission', phase: commandPalettePhaseFromRecipePhase(recipe.missionPhase, 'mission'), shortcut: recipe.operatorShortcut, run: () => startMissionFromRecipe(recipe.id) });
    if (!recipe.comingSoon && recipe.missionPhase === 'devops') actions.push({ id: 'pin-recipe-blueprint-' + recipe.id, title: 'Pin Blueprint: ' + recipe.label, detail: 'Add runbook, stop condition, launch surfaces, and evidence prompts to the local timeline.', group: 'DevOps Cockpit Evidence', target: recipeProviderLabel(recipe), phase: 'evidence', run: () => pinRecipeEvidenceBlueprint(recipe.id) });
  }
  for (const profile of browserProfileState?.profiles || []) actions.push({ id: 'profile-' + profile.id, title: 'Switch Profile: ' + profile.name, detail: profileKindLabel(profile.kind) + ' · ' + profile.partition, group: 'Profiles', run: async () => { browserProfileState = await window.tahaiBrowser.setActiveProfile(profile.id); renderProfileBadge(); reloadForActiveProfile(); renderOpsHub(); } });
  for (const snapshot of readJsonArray<WorkspaceSnapshot>(workspaceStorageKey)) actions.push({ id: 'workspace-' + snapshot.id, title: 'Restore Workspace: ' + snapshot.name, detail: snapshot.profileName + ' · ' + snapshot.urls.length + ' tab(s)', group: 'Workspace', run: () => restoreWorkspaceSnapshot(snapshot.id) });
  return actions;
}

function renderCommandPalette(): void {
  const query = commandPaletteInput.value.trim().toLowerCase();
  commandPaletteActions = buildCommandPaletteActions().filter((action) => !query || commandActionSearchText(action).includes(query));
  if (commandPaletteIndex >= commandPaletteActions.length) commandPaletteIndex = Math.max(0, commandPaletteActions.length - 1);
  commandPaletteList.innerHTML = commandPaletteActions.length ? commandPaletteActions.map((action, index) =>
    '<button class="command-row' + (index === commandPaletteIndex ? ' active' : '') + ' phase-' + escapeHtml(action.phase || 'all') + '" type="button" data-command-index="' + index + '">' +
    '<span><strong>' + escapeHtml(action.title) + '</strong><small>' + escapeHtml(commandActionMeta(action)) + '</small>' +
    (action.target ? '<em class="command-target">' + escapeHtml(action.target) + '</em>' : '') + '</span>' +
    (action.shortcut ? '<kbd>' + escapeHtml(action.shortcut) + '</kbd>' : '') +
    '</button>'
  ).join('') : '<article class="command-empty">No matching command.</article>';
  commandPaletteList.querySelector<HTMLButtonElement>('.command-row.active')?.scrollIntoView({ block: 'nearest' });
}

function openCommandPalette(): void {
  closeToolMenus();
  commandPaletteInput.value = '';
  commandPaletteIndex = 0;
  renderCommandPalette();
  if (!commandPaletteDialog.open) commandPaletteDialog.showModal();
  window.setTimeout(() => commandPaletteInput.focus(), 0);
}

function moveCommandPalette(delta: number): void {
  if (!commandPaletteActions.length) return;
  commandPaletteIndex = (commandPaletteIndex + delta + commandPaletteActions.length) % commandPaletteActions.length;
  renderCommandPalette();
}

function runCommandPaletteAction(index = commandPaletteIndex): void {
  const action = commandPaletteActions[index];
  if (!action) return;
  commandPaletteDialog.close();
  void action.run();
}


function populateSettingsForm(): void {
  settingHomeUrl.value = settings.homeUrl;
  settingStartup.value = settings.startup;
  settingSearch.value = settings.searchProvider;
  settingMedia.checked = settings.permissions.allowMedia;
  settingClipboard.checked = settings.permissions.allowClipboardRead;
  settingGeolocation.checked = settings.permissions.allowGeolocation;
  settingNotifications.checked = settings.permissions.allowNotifications;
  settingDoNotTrack.checked = settings.privacy?.sendDoNotTrack !== false;
  settingThirdPartyCookies.checked = settings.privacy?.blockThirdPartyCookies === true;
  settingReduceReferrers.checked = settings.privacy?.reduceCrossSiteReferrers !== false;
  settingClearOnExit.checked = settings.privacy?.clearProfileDataOnExit === true;
  settingDownloads.checked = settings.downloads.askEveryTime;
  settingStatusBar.checked = settings.ui.showStatusBar;
}

function settingsFromForm(): BrowserSettings {
  const nextSearchProvider: BrowserSettings['searchProvider'] = settingSearch.value === 'duckduckgo' || settingSearch.value === 'bing' ? settingSearch.value : 'google';
  return {
    ...settings,
    homeUrl: settingHomeUrl.value.trim() || 'https://tahaiportal.com',
    startup: settingStartup.value === 'launchpad' ? 'launchpad' : 'home',
    searchProvider: nextSearchProvider,
    permissions: {
      allowMedia: settingMedia.checked,
      allowClipboardRead: settingClipboard.checked,
      allowGeolocation: settingGeolocation.checked,
      allowNotifications: settingNotifications.checked
    },
    downloads: {
      ...settings.downloads,
      askEveryTime: settingDownloads.checked
    },
    ui: {
      ...settings.ui,
      showStatusBar: settingStatusBar.checked
    },
    privacy: {
      ...settings.privacy,
      sendDoNotTrack: settingDoNotTrack.checked,
      blockThirdPartyCookies: settingThirdPartyCookies.checked,
      reduceCrossSiteReferrers: settingReduceReferrers.checked,
      clearProfileDataOnExit: settingClearOnExit.checked
    }
  };
}

function showSettingsResult(message: string): void {
  settingsResult.textContent = message;
  window.setTimeout(() => { settingsResult.textContent = ''; }, 3200);
}

function openSettings(): void {
  populateSettingsForm();
  settingsDialog.showModal();
}

function toggleActiveDevTools(): void {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for DevTools.');
    return;
  }

  const inspectable = tab.webview as Electron.WebviewTag & {
    isDevToolsOpened?: () => boolean;
    openDevTools?: () => void;
    closeDevTools?: () => void;
  };

  try {
    if (typeof inspectable.isDevToolsOpened === 'function' && inspectable.isDevToolsOpened()) {
      inspectable.closeDevTools?.();
      setStatus('Chromium DevTools closed', tab.title);
      return;
    }
    if (typeof inspectable.openDevTools === 'function') {
      inspectable.openDevTools();
      setStatus('Chromium DevTools opened', `Inspecting ${tab.title}`);
      return;
    }
    setStatus('Chromium DevTools unavailable', 'The active webview does not expose openDevTools().');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown DevTools error';
    setStatus('Chromium DevTools failed to open', detail);
  }
}


function compactText(value: unknown, fallback = ''): string {
  const clean = String(value ?? fallback).replace(/\s+/g, ' ').trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
}

function md(value: unknown, fallback = ''): string {
  return compactText(value, fallback).replace(/[|]/g, '\\|');
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function captureScript(): string {
  return String.raw`(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const text = (node) => clean(node && node.textContent).slice(0, 180);
    const attr = (node, name) => clean(node && node.getAttribute(name)).slice(0, 500);
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map((node) => text(node))
      .filter(Boolean)
      .slice(0, 14);
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((node) => ({ text: text(node) || attr(node, 'aria-label') || attr(node, 'title') || 'link', href: node.href || '' }))
      .filter((link) => /^https?:/i.test(link.href))
      .slice(0, 10);
    return {
      title: clean(document.title).slice(0, 220),
      url: String(location.href || ''),
      origin: String(location.origin || ''),
      userAgent: String(navigator.userAgent || ''),
      language: String(navigator.language || ''),
      viewport: String(window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x'),
      metaDescription: attr(document.querySelector('meta[name="description"]'), 'content'),
      headings,
      links,
      counts: {
        forms: document.forms ? document.forms.length : 0,
        inputs: document.querySelectorAll('input,textarea,select').length,
        buttons: document.querySelectorAll('button,[role="button"]').length,
        anchors: document.querySelectorAll('a[href]').length,
        images: document.images ? document.images.length : 0,
        scripts: document.scripts ? document.scripts.length : 0,
        stylesheets: document.styleSheets ? document.styleSheets.length : 0
      },
      timing: {
        domContentLoadedMs: Math.max(0, Math.round((nav.domContentLoadedEventEnd || 0) - (nav.startTime || 0))),
        loadMs: Math.max(0, Math.round((nav.loadEventEnd || 0) - (nav.startTime || 0))),
        responseMs: Math.max(0, Math.round((nav.responseEnd || 0) - (nav.requestStart || 0))),
        transferKb: Math.max(0, Math.round((nav.transferSize || 0) / 1024))
      }
    };
  })();`;
}

function normalizeCapture(raw: Partial<PageCapture> | undefined, tab: TabState): PageCapture {
  const counts = raw?.counts || {} as PageCapture['counts'];
  const timing = raw?.timing || {} as PageCapture['timing'];
  return {
    title: compactText(raw?.title, tab.title),
    url: compactText(raw?.url, tab.url),
    origin: compactText(raw?.origin, ''),
    userAgent: compactText(raw?.userAgent, navigator.userAgent),
    language: compactText(raw?.language, navigator.language),
    viewport: compactText(raw?.viewport, `${window.innerWidth}x${window.innerHeight}`),
    metaDescription: compactText(raw?.metaDescription, ''),
    headings: Array.isArray(raw?.headings) ? raw.headings.map((item) => compactText(item)).filter(Boolean).slice(0, 14) : [],
    links: Array.isArray(raw?.links) ? raw.links.map((link) => ({ text: compactText(link?.text, 'link'), href: compactText(link?.href) })).filter((link) => /^https?:/i.test(link.href)).slice(0, 10) : [],
    counts: {
      forms: num(counts.forms),
      inputs: num(counts.inputs),
      buttons: num(counts.buttons),
      anchors: num(counts.anchors),
      images: num(counts.images),
      scripts: num(counts.scripts),
      stylesheets: num(counts.stylesheets)
    },
    timing: {
      domContentLoadedMs: num(timing.domContentLoadedMs),
      loadMs: num(timing.loadMs),
      responseMs: num(timing.responseMs),
      transferKb: num(timing.transferKb)
    }
  };
}

function bulletList(values: string[], empty = '- _No visible headings captured._'): string {
  if (!values.length) return empty;
  return values.map((value) => `- ${md(value)}`).join('\n');
}

function linkList(values: Array<{ text: string; href: string }>): string {
  if (!values.length) return '- _No external links sampled._';
  return values.map((link) => `- ${md(link.text)} — ${md(link.href)}`).join('\n');
}

function buildDevOpsCaptureMarkdown(page: PageCapture, tab: TabState): string {
  const capturedAt = new Date().toISOString();
  const host = (() => { try { return new URL(page.url || tab.url).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI DevOps Evidence Capture — ${md(host)}\n\n` +
`> Documentation-ready browser capture for DevOps, IT operations, QA, support, and implementation notes. This capture intentionally excludes cookies, localStorage values, session tokens, passwords, and form contents.\n\n` +
`## Capture metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Captured at | ${md(capturedAt)} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Release channel | ${md(config.releaseChannel)} |\n` +
`| Active tab title | ${md(tab.title)} |\n` +
`| Page title | ${md(page.title, tab.title)} |\n` +
`| URL | ${md(page.url || tab.url)} |\n` +
`| Origin | ${md(page.origin || 'local / unavailable')} |\n` +
`| Transport | ${md(securityLabel(page.url || tab.url))} |\n` +
`| Viewport | ${md(page.viewport)} |\n` +
`| Language | ${md(page.language)} |\n` +
`| User agent | ${md(page.userAgent)} |\n\n` +
`## Page summary\n\n` +
`${page.metaDescription ? `**Meta description:** ${md(page.metaDescription)}\n\n` : ''}` +
`### Visible heading outline\n\n${bulletList(page.headings)}\n\n` +
`### Sample links\n\n${linkList(page.links)}\n\n` +
`### DOM and load diagnostics\n\n` +
`| Metric | Value |\n| --- | ---: |\n` +
`| Forms | ${page.counts.forms} |\n` +
`| Inputs/selects/textareas | ${page.counts.inputs} |\n` +
`| Buttons | ${page.counts.buttons} |\n` +
`| Links | ${page.counts.anchors} |\n` +
`| Images | ${page.counts.images} |\n` +
`| Scripts | ${page.counts.scripts} |\n` +
`| Stylesheets | ${page.counts.stylesheets} |\n` +
`| DOMContentLoaded | ${page.timing.domContentLoadedMs} ms |\n` +
`| Load complete | ${page.timing.loadMs} ms |\n` +
`| Response timing | ${page.timing.responseMs} ms |\n` +
`| Transfer size | ${page.timing.transferKb} KB |\n\n` +
`## Runbook / ticket draft\n\n` +
`### Context\n- System / application:\n- Environment: production / staging / local / customer tenant\n- Owner:\n- Related change, incident, or ticket:\n\n` +
`### Observed behavior\n- \n\n` +
`### Expected behavior\n- \n\n` +
`### Reproduction / validation steps\n1. Open ${md(page.url || tab.url)}\n2. \n3. \n\n` +
`### Evidence to attach\n- [ ] Screenshot\n- [ ] Console errors from Chromium DevTools\n- [ ] Network HAR or failed request details\n- [ ] Deployment/build ID\n- [ ] DNS/CDN/provider status evidence\n- [ ] Customer/org impact notes\n\n` +
`### Resolution / rollback notes\n- Change applied:\n- Verification result:\n- Rollback path:\n- Follow-up documentation needed:\n\n` +
`### Acceptance checks\n- [ ] Active URL loads successfully\n- [ ] Authentication/session behavior verified\n- [ ] Primary CTA or workflow verified\n- [ ] No new console errors introduced\n- [ ] Documentation updated in TAHAI IT Docs / runbook repository\n`;
}

function showCaptureResult(message: string): void {
  captureResult.textContent = message;
  window.setTimeout(() => { captureResult.textContent = ''; }, 3400);
}

async function openDevOpsCapture(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available to capture.');
    return;
  }
  setStatus('Capturing DevOps evidence note...', tab.title);
  try {
    const raw = await tab.webview.executeJavaScript(captureScript(), true) as Partial<PageCapture>;
    const page = normalizeCapture(raw, tab);
    const markdown = buildDevOpsCaptureMarkdown(page, tab);
    latestCapture = { markdown, sourceUrl: page.url || tab.url };
    captureMarkdown.value = markdown;
    if (!captureDialog.open) captureDialog.showModal();
    captureMarkdown.focus();
    captureMarkdown.setSelectionRange(0, 0);
    setStatus('DevOps evidence note ready', 'Copy or save as Markdown.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown capture error';
    setStatus('DevOps evidence capture failed', detail);
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusIcon(status: string): string {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  if (status === 'fail') return 'FAIL';
  return 'INFO';
}

function statusClass(status: string): string {
  if (status === 'pass' || status === 'warn' || status === 'fail') return status;
  return 'info';
}

function markdownTableRows(values: Record<string, string>): string {
  const entries = Object.entries(values);
  if (!entries.length) return '| _None captured_ | _No allowed operational headers were returned._ |\n';
  return entries.map(([key, value]) => `| ${md(key)} | ${md(value)} |`).join('\n') + '\n';
}

function opsCheckList(diagnostics: OpsUrlDiagnostics): string {
  if (!diagnostics.checks.length) return '- [INFO] No checks returned.';
  return diagnostics.checks.map((check) => `- [${statusIcon(check.status)}] ${md(check.label)} — ${md(check.detail)}`).join('\n');
}

function headersForSummary(headers: Record<string, string>): string {
  const important = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'referrer-policy', 'cache-control', 'server', 'x-powered-by'];
  return important
    .filter((name) => headers[name])
    .map((name) => `<span><strong>${escapeHtml(name)}</strong>${escapeHtml(headers[name])}</span>`)
    .join('') || '<span><strong>No key headers captured</strong>Review report for reachable status and next checks.</span>';
}

function renderOpsSummary(diagnostics: OpsUrlDiagnostics): void {
  const counts = diagnostics.checks.reduce((acc, check) => {
    acc[statusClass(check.status)] = (acc[statusClass(check.status)] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  opsSummary.innerHTML = `
    <article class="ops-card ${diagnostics.ok ? 'pass' : diagnostics.error ? 'fail' : 'warn'}">
      <strong>${diagnostics.ok ? 'Reachable' : diagnostics.error ? 'Failed' : 'Review'}</strong>
      <span>${escapeHtml(diagnostics.statusCode || diagnostics.error || 'No status')}</span>
    </article>
    <article class="ops-card info">
      <strong>${escapeHtml(diagnostics.method)}</strong>
      <span>${escapeHtml(`${diagnostics.durationMs} ms`)}</span>
    </article>
    <article class="ops-card warn">
      <strong>${escapeHtml(`${counts.warn || 0} warnings`)}</strong>
      <span>${escapeHtml(`${counts.fail || 0} failures / ${counts.pass || 0} passes`)}</span>
    </article>
    <article class="ops-card headers">
      ${headersForSummary(diagnostics.headers)}
    </article>
  `;
}

function buildOpsCheckMarkdown(diagnostics: OpsUrlDiagnostics, page: PageCapture | undefined, tab: TabState): string {
  const targetUrl = diagnostics.normalizedUrl || page?.url || tab.url;
  const host = (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI URL Ops Check — ${md(host)}\n\n` +
`> Documentation-ready IT engineering / DevOps browser diagnostic. This report uses a safe HEAD request and excludes cookies, authorization headers, request bodies, localStorage values, passwords, tokens, and form contents.\n\n` +
`## Result summary\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Checked at | ${md(diagnostics.checkedAt)} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Active tab | ${md(tab.title)} |\n` +
`| Input URL | ${md(diagnostics.inputUrl || tab.url)} |\n` +
`| Checked URL | ${md(targetUrl)} |\n` +
`| Method | ${md(diagnostics.method)} |\n` +
`| HTTP status | ${diagnostics.statusCode ? md(`${diagnostics.statusCode} ${diagnostics.statusMessage}`) : md(diagnostics.error || 'No HTTP status')} |\n` +
`| Duration | ${md(`${diagnostics.durationMs} ms`)} |\n` +
`| Overall | ${diagnostics.ok ? 'PASS' : diagnostics.error ? 'FAIL' : 'REVIEW'} |\n\n` +
`## Operational checks\n\n${opsCheckList(diagnostics)}\n\n` +
`## Safe response headers captured\n\n` +
`| Header | Value |\n| --- | --- |\n${markdownTableRows(diagnostics.headers)}\n` +
`## Page context from active tab\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Page title | ${md(page?.title || tab.title)} |\n` +
`| Page URL | ${md(page?.url || tab.url)} |\n` +
`| Transport label | ${md(securityLabel(page?.url || tab.url))} |\n` +
`| Viewport | ${md(page?.viewport || 'not captured')} |\n` +
`| DOMContentLoaded | ${md(page ? `${page.timing.domContentLoadedMs} ms` : 'not captured')} |\n` +
`| Load complete | ${md(page ? `${page.timing.loadMs} ms` : 'not captured')} |\n` +
`| Forms / inputs | ${md(page ? `${page.counts.forms} / ${page.counts.inputs}` : 'not captured')} |\n\n` +
`### Heading outline\n\n${bulletList(page?.headings || [])}\n\n` +
`## IT / DevOps follow-up checklist\n\n` +
`- [ ] Confirm DNS record, CDN/proxy route, and origin target are expected\n` +
`- [ ] Confirm TLS certificate chain and renewal ownership outside this browser check\n` +
`- [ ] Review CSP/HSTS/referrer/clickjacking findings above\n` +
`- [ ] Open Chromium DevTools and capture console/network errors if present\n` +
`- [ ] Attach deployment/build ID, provider status page evidence, and screenshot if this relates to an incident\n` +
`- [ ] Update TAHAI IT Docs, runbook, or change ticket with this report\n\n` +
`## Notes\n\n- Owner:\n- Environment: production / staging / local / customer tenant\n- Related ticket/change/incident:\n- Resolution / rollback path:\n`;
}

function showOpsResult(message: string): void {
  opsResult.textContent = message;
  window.setTimeout(() => { opsResult.textContent = ''; }, 3400);
}

async function openOpsCheck(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Ops Check.');
    return;
  }
  setStatus('Running URL Ops Check...', tab.url);
  opsSummary.innerHTML = '<article class="ops-card info"><strong>Checking</strong><span>Collecting HTTP headers and page context…</span></article>';
  opsMarkdown.value = '';
  if (!opsDialog.open) opsDialog.showModal();
  try {
    const [diagnostics, rawPage] = await Promise.all([
      window.tahaiBrowser.runUrlDiagnostics(tab.url),
      tab.webview.executeJavaScript(captureScript(), true).catch(() => undefined) as Promise<Partial<PageCapture> | undefined>
    ]);
    const page = rawPage ? normalizeCapture(rawPage, tab) : undefined;
    const markdown = buildOpsCheckMarkdown(diagnostics, page, tab);
    latestOpsCheck = { markdown, sourceUrl: diagnostics.normalizedUrl || tab.url, diagnostics };
    renderOpsSummary(diagnostics);
    opsMarkdown.value = markdown;
    opsMarkdown.focus();
    opsMarkdown.setSelectionRange(0, 0);
    setStatus('URL Ops Check ready', diagnostics.ok ? 'Operational checks passed or informational.' : 'Review warnings/failures in report.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Ops Check error';
    opsSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('URL Ops Check failed', detail);
  }
}


function deployDecision(diagnostics: OpsUrlDiagnostics, page: PageCapture | undefined, consoleMessages: ConsoleEntry[]): { label: string; status: OpsCheckStatus; detail: string } {
  const failCount = diagnostics.checks.filter((check) => check.status === 'fail').length;
  const warnCount = diagnostics.checks.filter((check) => check.status === 'warn').length;
  const consoleErrors = consoleMessages.filter((entry) => entry.level === 'error').length;
  if (failCount > 0 || consoleErrors > 0 || diagnostics.statusCode >= 500) {
    return { label: 'BLOCK / investigate', status: 'fail', detail: `${failCount} failed ops check(s), ${consoleErrors} console error(s), HTTP ${diagnostics.statusCode || 'n/a'}.` };
  }
  if (warnCount > 0 || diagnostics.statusCode >= 400 || (page?.timing.loadMs || 0) > 5000) {
    return { label: 'CAUTION / human review', status: 'warn', detail: `${warnCount} warning(s), HTTP ${diagnostics.statusCode || 'n/a'}, load ${page?.timing.loadMs || 0} ms.` };
  }
  return { label: 'READY / proceed with checks', status: 'pass', detail: `No blocking browser-side signal captured; HTTP ${diagnostics.statusCode || 'n/a'}, load ${page?.timing.loadMs || 0} ms.` };
}

function renderDeploySummary(diagnostics: OpsUrlDiagnostics, page: PageCapture | undefined, consoleMessages: ConsoleEntry[]): void {
  const decision = deployDecision(diagnostics, page, consoleMessages);
  const warnCount = diagnostics.checks.filter((check) => check.status === 'warn').length;
  const errorCount = consoleMessages.filter((entry) => entry.level === 'error').length;
  const warningCount = consoleMessages.filter((entry) => entry.level === 'warning').length;
  deploySummary.innerHTML = `
    <article class="ops-card ${statusClass(decision.status)}">
      <strong>${escapeHtml(decision.label)}</strong>
      <span>${escapeHtml(decision.detail)}</span>
    </article>
    <article class="ops-card ${diagnostics.ok ? 'pass' : diagnostics.error ? 'fail' : 'warn'}">
      <strong>HTTP gate</strong>
      <span>${escapeHtml(diagnostics.statusCode ? `${diagnostics.statusCode} ${diagnostics.statusMessage || ''}`.trim() : diagnostics.error || 'No HTTP status')}</span>
    </article>
    <article class="ops-card ${warnCount ? 'warn' : 'pass'}">
      <strong>Header review</strong>
      <span>${escapeHtml(`${warnCount} warning(s) from safe header checks`)}</span>
    </article>
    <article class="ops-card ${errorCount ? 'fail' : warningCount ? 'warn' : 'pass'}">
      <strong>Console signal</strong>
      <span>${escapeHtml(`${errorCount} error(s), ${warningCount} warning(s) since tab open`)}</span>
    </article>
  `;
}

function consoleSummaryMarkdown(consoleMessages: ConsoleEntry[]): string {
  const scoped = consoleMessages.slice(-25);
  if (!scoped.length) return '- _No console messages captured since this tab opened._';
  return scoped.map((entry) => `- [${md(entry.level.toUpperCase())}] ${md(entry.message)}${entry.sourceId ? ` — ${md(entry.sourceId)}:${md(entry.line)}` : ''}`).join('\n');
}

function buildDeployReadinessMarkdown(diagnostics: OpsUrlDiagnostics, page: PageCapture | undefined, consoleMessages: ConsoleEntry[], tab: TabState): string {
  const targetUrl = diagnostics.normalizedUrl || page?.url || tab.url;
  const host = (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  const decision = deployDecision(diagnostics, page, consoleMessages);
  const errorCount = consoleMessages.filter((entry) => entry.level === 'error').length;
  const warningCount = consoleMessages.filter((entry) => entry.level === 'warning').length;
  return `# TAHAI DevOps Deploy Readiness — ${md(host)}\n\n` +
`> Deployment/change-readiness report generated from TAHAI Web Services Browser. This combines safe HTTP/header diagnostics, active-page smoke evidence, load timing, and console error/warning counts. It excludes cookies, authorization headers, request bodies, response bodies, storage values, credentials, tokens, and form contents.\n\n` +
`## Go / no-go summary\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Decision | ${md(decision.label)} |\n` +
`| Decision detail | ${md(decision.detail)} |\n` +
`| Captured at | ${md(new Date().toISOString())} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Release channel | ${md(config.releaseChannel)} |\n` +
`| Target URL | ${md(targetUrl)} |\n` +
`| Transport | ${md(securityLabel(targetUrl))} |\n` +
`| Active tab title | ${md(tab.title)} |\n\n` +
`## Deploy/change ticket metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Application / service | ${md(page?.title || tab.title || host)} |\n` +
`| Environment | production / staging / local / customer tenant |\n` +
`| Change type | release / hotfix / config / DNS / provider / rollback / validation |\n` +
`| Owner |  |\n` +
`| Reviewer / approver |  |\n` +
`| Deploy window |  |\n` +
`| Build / commit / artifact ID |  |\n` +
`| Related ticket / incident |  |\n\n` +
`## HTTP readiness gate\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Checked URL | ${md(diagnostics.normalizedUrl || targetUrl)} |\n` +
`| Method | ${md(diagnostics.method || 'HEAD')} |\n` +
`| HTTP status | ${diagnostics.statusCode ? md(`${diagnostics.statusCode} ${diagnostics.statusMessage}`) : md(diagnostics.error || 'No HTTP status')} |\n` +
`| Duration | ${md(`${diagnostics.durationMs} ms`)} |\n\n` +
`### Header / platform findings\n\n${opsCheckList(diagnostics)}\n\n` +
`### Captured safe headers\n\n` +
`| Header | Value |\n| --- | --- |\n${markdownTableRows(diagnostics.headers)}\n` +
`## Active-page smoke evidence\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Page title | ${md(page?.title || tab.title)} |\n` +
`| Page URL | ${md(page?.url || tab.url)} |\n` +
`| Viewport | ${md(page?.viewport || 'not captured')} |\n` +
`| DOMContentLoaded | ${md(page ? `${page.timing.domContentLoadedMs} ms` : 'not captured')} |\n` +
`| Load complete | ${md(page ? `${page.timing.loadMs} ms` : 'not captured')} |\n` +
`| Response timing | ${md(page ? `${page.timing.responseMs} ms` : 'not captured')} |\n` +
`| Forms / inputs / buttons | ${md(page ? `${page.counts.forms} / ${page.counts.inputs} / ${page.counts.buttons}` : 'not captured')} |\n` +
`| Console signal | ${md(`${errorCount} error(s), ${warningCount} warning(s) since tab open`)} |\n\n` +
`### Visible heading outline\n\n${bulletList(page?.headings || [])}\n\n` +
`### Console messages sampled\n\n${consoleSummaryMarkdown(consoleMessages)}\n\n` +
`## Pre-deploy checklist\n\n` +
`- [ ] Scope, owner, approver, and deploy window confirmed\n` +
`- [ ] Build/artifact/commit identifier recorded\n` +
`- [ ] Environment variables and provider settings reviewed outside this browser report\n` +
`- [ ] Database/data migration plan reviewed, if applicable\n` +
`- [ ] DNS/CDN/cache impact reviewed, if applicable\n` +
`- [ ] Customer/user impact and communications plan reviewed\n` +
`- [ ] Monitoring dashboard, alert route, and logs ready before change\n\n` +
`## Rollback plan\n\n` +
`- Rollback owner:\n` +
`- Rollback trigger:\n` +
`- Previous known-good artifact/config:\n` +
`- Data rollback or forward-fix requirement:\n` +
`- DNS/CDN rollback notes:\n` +
`- Maximum acceptable time to rollback:\n\n` +
`## Post-deploy verification matrix\n\n` +
`| Check | Expected | Result | Owner |\n| --- | --- | --- | --- |\n` +
`| Home/landing route loads | 2xx/3xx expected response |  |  |\n` +
`| Login/auth path | Expected provider and redirect behavior |  |  |\n` +
`| Primary workflow | Core CTA/user path succeeds |  |  |\n` +
`| Console | No new blocking errors |  |  |\n` +
`| Network | No failed critical requests |  |  |\n` +
`| Headers/security | No unexpected regression |  |  |\n` +
`| Monitoring | Alerts quiet or expected |  |  |\n\n` +
`## Notes / decision log\n\n` +
`- Final go/no-go:\n` +
`- Human reviewer notes:\n` +
`- Follow-up docs/runbook updates:\n` +
`- TAHAI IT Docs record link:\n`;
}

function showDeployResult(message: string): void {
  deployResult.textContent = message;
  window.setTimeout(() => { deployResult.textContent = ''; }, 3400);
}

async function openDeployReadiness(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Deploy Readiness.');
    return;
  }
  setStatus('Creating Deploy Readiness report...', tab.url);
  deploySummary.innerHTML = '<article class="ops-card info"><strong>Building</strong><span>Collecting safe URL/header, page smoke, and console signals…</span></article>';
  deployMarkdown.value = '';
  if (!deployDialog.open) deployDialog.showModal();
  try {
    const [diagnostics, rawPage] = await Promise.all([
      window.tahaiBrowser.runUrlDiagnostics(tab.url),
      tab.webview.executeJavaScript(captureScript(), true).catch(() => undefined) as Promise<Partial<PageCapture> | undefined>
    ]);
    const page = rawPage ? normalizeCapture(rawPage, tab) : undefined;
    const messages = tab.consoleMessages.slice(-80);
    const markdown = buildDeployReadinessMarkdown(diagnostics, page, messages, tab);
    latestDeployReadiness = { markdown, sourceUrl: diagnostics.normalizedUrl || page?.url || tab.url, diagnostics, page, consoleMessages: messages };
    renderDeploySummary(diagnostics, page, messages);
    deployMarkdown.value = markdown;
    deployMarkdown.focus();
    deployMarkdown.setSelectionRange(0, 0);
    setStatus('Deploy Readiness report ready', 'Copy or save as Markdown for a release, change, or rollback ticket.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Deploy Readiness error';
    deploySummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('Deploy Readiness failed', detail);
  }
}

function dnsMarkdownList(values: string[], empty = '- _None captured._'): string {
  if (!values.length) return empty;
  return values.map((value) => `- ${md(value)}`).join('\n');
}

function mxMarkdownList(values: ItServiceCardDiagnostics['records']['mx']): string {
  if (!values.length) return '- _None captured._';
  return values.map((record) => `- ${md(record.exchange)} (priority ${md(record.priority)})`).join('\n');
}

function dnsErrorsMarkdown(errors: Record<string, string>): string {
  const entries = Object.entries(errors).filter(([, value]) => value);
  if (!entries.length) return '- _None._';
  return entries.map(([key, value]) => `- ${md(key.toUpperCase())}: ${md(value)}`).join('\n');
}

function itCardNotesMarkdown(diagnostics: ItServiceCardDiagnostics): string {
  if (!diagnostics.notes.length) return '- [INFO] No diagnostic notes returned.';
  return diagnostics.notes.map((note) => `- [${statusIcon(note.status)}] ${md(note.label)} — ${md(note.detail)}`).join('\n');
}

function renderItCardSummary(diagnostics: ItServiceCardDiagnostics, ops: OpsUrlDiagnostics): void {
  const addressCount = diagnostics.records.a.length + diagnostics.records.aaaa.length + diagnostics.records.cname.length;
  const opsLabel = ops.statusCode ? `${ops.statusCode} ${ops.statusMessage || ''}`.trim() : (ops.error || 'No HTTP status');
  itCardSummary.innerHTML = `
    <article class="ops-card ${diagnostics.ok ? 'pass' : 'warn'}">
      <strong>${diagnostics.ok ? 'DNS captured' : 'DNS review'}</strong>
      <span>${escapeHtml(`${addressCount} route record(s)`)}</span>
    </article>
    <article class="ops-card info">
      <strong>Hostname</strong>
      <span>${escapeHtml(diagnostics.hostname || 'not captured')}</span>
    </article>
    <article class="ops-card ${ops.ok ? 'pass' : ops.error ? 'fail' : 'warn'}">
      <strong>HTTP signal</strong>
      <span>${escapeHtml(opsLabel)}</span>
    </article>
    <article class="ops-card warn">
      <strong>Documentation</strong>
      <span>Owner, lifecycle, monitoring, access, recovery, and renewal fields need human confirmation.</span>
    </article>
  `;
}

function buildItServiceCardMarkdown(diagnostics: ItServiceCardDiagnostics, ops: OpsUrlDiagnostics, page: PageCapture | undefined, tab: TabState): string {
  const targetUrl = diagnostics.normalizedUrl || ops.normalizedUrl || page?.url || tab.url;
  const host = diagnostics.hostname || (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI IT Service Card — ${md(host)}\n\n` +
`> Documentation-ready IT engineering card generated from TAHAI Web Services Browser. This report captures public DNS, safe HTTP headers, and active-tab page context only. It excludes cookies, authorization headers, request bodies, response bodies, localStorage/sessionStorage values, passwords, tokens, and form contents.\n\n` +
`## Service identity\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Service / application | ${md(page?.title || tab.title || host)} |\n` +
`| Primary URL | ${md(targetUrl)} |\n` +
`| Hostname | ${md(host)} |\n` +
`| Environment | production / staging / development / customer tenant |\n` +
`| Category | SaaS / website / provider console / internal app / customer system |\n` +
`| Browser evidence time | ${md(diagnostics.checkedAt)} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n\n` +
`## Ownership and lifecycle\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Business owner |  |\n` +
`| Technical owner |  |\n` +
`| Vendor / provider |  |\n` +
`| Support portal / contract |  |\n` +
`| Renewal owner / date |  |\n` +
`| Data classification | public / internal / confidential / regulated |\n` +
`| Criticality | low / medium / high / mission-critical |\n\n` +
`## Access and authentication\n\n` +
`- Primary access URL: ${md(targetUrl)}\n` +
`- Admin URL:\n` +
`- SSO provider:\n` +
`- MFA required: yes / no / unknown\n` +
`- Privileged roles to document:\n` +
`- Break-glass / recovery owner:\n\n` +
`## Public DNS snapshot\n\n` +
`### A records\n${dnsMarkdownList(diagnostics.records.a)}\n\n` +
`### AAAA records\n${dnsMarkdownList(diagnostics.records.aaaa)}\n\n` +
`### CNAME records\n${dnsMarkdownList(diagnostics.records.cname)}\n\n` +
`### NS records\n${dnsMarkdownList(diagnostics.records.ns)}\n\n` +
`### MX records\n${mxMarkdownList(diagnostics.records.mx)}\n\n` +
`### DNS lookup notes\n${dnsErrorsMarkdown(diagnostics.errors)}\n\n` +
`## HTTP / security header snapshot\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Checked URL | ${md(ops.normalizedUrl || targetUrl)} |\n` +
`| Method | ${md(ops.method || 'HEAD')} |\n` +
`| HTTP status | ${ops.statusCode ? md(`${ops.statusCode} ${ops.statusMessage}`) : md(ops.error || 'No HTTP status')} |\n` +
`| Duration | ${md(`${ops.durationMs} ms`)} |\n` +
`| Transport | ${md(securityLabel(targetUrl))} |\n\n` +
`| Header | Value |\n| --- | --- |\n${markdownTableRows(ops.headers)}\n` +
`## Operational findings\n\n${itCardNotesMarkdown(diagnostics)}\n\n${opsCheckList(ops)}\n\n` +
`## Active page context\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Page title | ${md(page?.title || tab.title)} |\n` +
`| Page URL | ${md(page?.url || tab.url)} |\n` +
`| Meta description | ${md(page?.metaDescription || 'not captured')} |\n` +
`| Viewport | ${md(page?.viewport || 'not captured')} |\n` +
`| DOMContentLoaded | ${md(page ? `${page.timing.domContentLoadedMs} ms` : 'not captured')} |\n` +
`| Load complete | ${md(page ? `${page.timing.loadMs} ms` : 'not captured')} |\n` +
`| Forms / inputs / buttons | ${md(page ? `${page.counts.forms} / ${page.counts.inputs} / ${page.counts.buttons}` : 'not captured')} |\n\n` +
`### Heading outline\n\n${bulletList(page?.headings || [])}\n\n` +
`## Monitoring / backup / recovery\n\n` +
`- Monitoring source:\n` +
`- Expected uptime / service window:\n` +
`- Alert recipients:\n` +
`- Backup / export location:\n` +
`- Recovery procedure:\n` +
`- RTO / RPO:\n` +
`- Last recovery test:\n\n` +
`## Change and support hooks\n\n` +
`- Related change ticket:\n` +
`- Deployment/build identifier:\n` +
`- Rollback path:\n` +
`- Vendor escalation path:\n` +
`- Internal runbook link:\n` +
`- TAHAI IT Docs record link:\n\n` +
`## Documentation acceptance checklist\n\n` +
`- [ ] Owner and support contacts filled in\n` +
`- [ ] Environment and criticality confirmed\n` +
`- [ ] SSO/MFA and privileged roles documented\n` +
`- [ ] DNS/CDN/provider ownership confirmed\n` +
`- [ ] TLS certificate ownership and renewal path documented\n` +
`- [ ] Monitoring and recovery path documented\n` +
`- [ ] Stored in TAHAI IT Docs / runbook repository\n`;
}

function showItCardResult(message: string): void {
  itCardResult.textContent = message;
  window.setTimeout(() => { itCardResult.textContent = ''; }, 3400);
}

async function openItServiceCard(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for IT Service Card.');
    return;
  }
  setStatus('Creating IT Service Card...', tab.url);
  itCardSummary.innerHTML = '<article class="ops-card info"><strong>Building</strong><span>Collecting DNS, safe HTTP headers, and active page context…</span></article>';
  itCardMarkdown.value = '';
  if (!itCardDialog.open) itCardDialog.showModal();
  try {
    const [diagnostics, ops, rawPage] = await Promise.all([
      window.tahaiBrowser.runItServiceCardDiagnostics(tab.url),
      window.tahaiBrowser.runUrlDiagnostics(tab.url),
      tab.webview.executeJavaScript(captureScript(), true).catch(() => undefined) as Promise<Partial<PageCapture> | undefined>
    ]);
    const page = rawPage ? normalizeCapture(rawPage, tab) : undefined;
    const markdown = buildItServiceCardMarkdown(diagnostics, ops, page, tab);
    latestItCard = { markdown, sourceUrl: diagnostics.normalizedUrl || tab.url, diagnostics };
    renderItCardSummary(diagnostics, ops);
    itCardMarkdown.value = markdown;
    itCardMarkdown.focus();
    itCardMarkdown.setSelectionRange(0, 0);
    setStatus('IT Service Card ready', 'Copy or save as Markdown for TAHAI IT Docs / runbooks.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown IT Service Card error';
    itCardSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('IT Service Card failed', detail);
  }
}


function endpointScript(): string {
  return String.raw`(async () => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const bool = (fn) => { try { return Boolean(fn()); } catch { return false; } };
    const permissionNames = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read', 'clipboard-write'];
    const permissions = [];
    for (const name of permissionNames) {
      try {
        if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
          permissions.push({ name, state: 'unavailable' });
          continue;
        }
        const result = await navigator.permissions.query({ name });
        permissions.push({ name, state: clean(result && result.state) || 'unknown' });
      } catch {
        permissions.push({ name, state: 'unavailable' });
      }
    }
    let parsed = { host: '', protocol: '' };
    try { const url = new URL(String(location.href || '')); parsed = { host: clean(url.hostname), protocol: clean(url.protocol) }; } catch {}
    return {
      title: clean(document.title).slice(0, 220),
      url: String(location.href || ''),
      origin: String(location.origin || ''),
      host: parsed.host,
      protocol: parsed.protocol,
      userAgent: String(navigator.userAgent || ''),
      platform: String(navigator.platform || ''),
      languages: Array.from(navigator.languages || [navigator.language || '']).map((item) => clean(item)).filter(Boolean).slice(0, 8),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      viewport: String(window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x'),
      screen: String((screen && screen.width) || 0) + 'x' + String((screen && screen.height) || 0) + ' / avail ' + String((screen && screen.availWidth) || 0) + 'x' + String((screen && screen.availHeight) || 0),
      colorScheme: bool(() => window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : (bool(() => window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'no-preference'),
      devicePixelRatio: Number(window.devicePixelRatio || 1),
      hardwareConcurrency: Number(navigator.hardwareConcurrency || 0),
      deviceMemoryGb: Number(navigator.deviceMemory || 0),
      online: Boolean(navigator.onLine),
      cookieEnabled: Boolean(navigator.cookieEnabled),
      doNotTrack: String(navigator.doNotTrack || window.doNotTrack || ''),
      storage: {
        localStorageAvailable: bool(() => window.localStorage),
        sessionStorageAvailable: bool(() => window.sessionStorage),
        indexedDbAvailable: bool(() => window.indexedDB),
        cacheStorageAvailable: bool(() => window.caches),
        serviceWorkerAvailable: bool(() => navigator.serviceWorker)
      },
      permissions
    };
  })()`;
}

function normalizeEndpointSnapshot(raw: Partial<EndpointSnapshot> | undefined, tab: TabState): EndpointSnapshot {
  const storage = raw?.storage || {} as EndpointSnapshot['storage'];
  const safePermissions = Array.isArray(raw?.permissions) ? raw.permissions.map((permission) => ({
    name: compactText(permission?.name, 'unknown'),
    state: compactText(permission?.state, 'unknown')
  })).filter((permission) => permission.name).slice(0, 12) : [];
  const fallbackUrl = tab.url || config.homeUrl;
  let host = compactText(raw?.host, '');
  let protocol = compactText(raw?.protocol, '');
  try {
    const parsed = new URL(String(raw?.url || fallbackUrl));
    host = host || parsed.hostname;
    protocol = protocol || parsed.protocol;
  } catch {}
  return {
    title: compactText(raw?.title, tab.title),
    url: String(raw?.url || fallbackUrl),
    origin: compactText(raw?.origin, ''),
    host,
    protocol,
    userAgent: compactText(raw?.userAgent, navigator.userAgent),
    platform: compactText(raw?.platform, navigator.platform),
    languages: Array.isArray(raw?.languages) ? raw.languages.map((item) => compactText(item)).filter(Boolean).slice(0, 8) : [navigator.language].filter(Boolean),
    timezone: compactText(raw?.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
    timezoneOffsetMinutes: typeof raw?.timezoneOffsetMinutes === 'number' && Number.isFinite(raw.timezoneOffsetMinutes) ? Math.round(raw.timezoneOffsetMinutes) : new Date().getTimezoneOffset(),
    viewport: compactText(raw?.viewport, `${window.innerWidth}x${window.innerHeight}`),
    screen: compactText(raw?.screen, `${window.screen.width}x${window.screen.height}`),
    colorScheme: compactText(raw?.colorScheme, 'not captured'),
    devicePixelRatio: typeof raw?.devicePixelRatio === 'number' && Number.isFinite(raw.devicePixelRatio) ? raw.devicePixelRatio : window.devicePixelRatio || 1,
    hardwareConcurrency: num(raw?.hardwareConcurrency),
    deviceMemoryGb: num(raw?.deviceMemoryGb),
    online: Boolean(raw?.online),
    cookieEnabled: Boolean(raw?.cookieEnabled),
    doNotTrack: compactText(raw?.doNotTrack, 'not set'),
    storage: {
      localStorageAvailable: Boolean(storage.localStorageAvailable),
      sessionStorageAvailable: Boolean(storage.sessionStorageAvailable),
      indexedDbAvailable: Boolean(storage.indexedDbAvailable),
      cacheStorageAvailable: Boolean(storage.cacheStorageAvailable),
      serviceWorkerAvailable: Boolean(storage.serviceWorkerAvailable)
    },
    permissions: safePermissions
  };
}

function boolWord(value: boolean): string {
  return value ? 'yes' : 'no';
}

function permissionMarkdown(permissions: EndpointPermissionSnapshot[]): string {
  if (!permissions.length) return '| _None captured_ | _unavailable_ |\n';
  return permissions.map((permission) => `| ${md(permission.name)} | ${md(permission.state)} |`).join('\n') + '\n';
}

function renderEndpointSummary(snapshot: EndpointSnapshot, ops?: OpsUrlDiagnostics): void {
  const storageCount = Object.values(snapshot.storage).filter(Boolean).length;
  const permissionReview = snapshot.permissions.filter((permission) => permission.state === 'granted' || permission.state === 'prompt').length;
  const httpLabel = ops ? (ops.statusCode ? `${ops.statusCode} ${ops.statusMessage || ''}`.trim() : (ops.error || 'No HTTP status')) : 'Skipped for local/non-HTTP URL';
  endpointSummary.innerHTML = `
    <article class="ops-card ${snapshot.online ? 'pass' : 'warn'}">
      <strong>Network</strong>
      <span>${escapeHtml(snapshot.online ? 'navigator.onLine = true' : 'navigator.onLine = false')}</span>
    </article>
    <article class="ops-card info">
      <strong>Client</strong>
      <span>${escapeHtml(`${snapshot.platform || 'unknown'} / ${snapshot.timezone || 'timezone n/a'}`)}</span>
    </article>
    <article class="ops-card ${permissionReview ? 'warn' : 'pass'}">
      <strong>Permissions</strong>
      <span>${escapeHtml(`${permissionReview} permission state(s) need review`)}</span>
    </article>
    <article class="ops-card ${ops ? (ops.ok ? 'pass' : ops.error ? 'fail' : 'warn') : 'info'}">
      <strong>HTTP</strong>
      <span>${escapeHtml(`${httpLabel}; ${storageCount} storage surfaces available`)}</span>
    </article>
  `;
}

function buildEndpointSnapshotMarkdown(snapshot: EndpointSnapshot, ops: OpsUrlDiagnostics | undefined, tab: TabState): string {
  const targetUrl = snapshot.url || tab.url;
  const host = snapshot.host || (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI Endpoint Snapshot — ${md(host)}\n\n` +
`> Safe IT helpdesk / endpoint troubleshooting profile generated from TAHAI Web Services Browser. This captures browser/client environment signals only and intentionally excludes cookies, cookie values, localStorage/sessionStorage values, clipboard contents, passwords, tokens, request bodies, response bodies, local files, IP addresses, and form contents.\n\n` +
`## Snapshot metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Captured at | ${md(new Date().toISOString())} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Release channel | ${md(config.releaseChannel)} |\n` +
`| Active tab title | ${md(tab.title)} |\n` +
`| Page title | ${md(snapshot.title || tab.title)} |\n` +
`| Active URL | ${md(targetUrl)} |\n` +
`| Origin | ${md(snapshot.origin || 'local / unavailable')} |\n` +
`| Host | ${md(host)} |\n` +
`| Protocol | ${md(snapshot.protocol || 'not captured')} |\n` +
`| Transport label | ${md(securityLabel(targetUrl))} |\n\n` +
`## Browser / client profile\n\n` +
`| Signal | Value |\n| --- | --- |\n` +
`| User agent | ${md(snapshot.userAgent)} |\n` +
`| Platform | ${md(snapshot.platform || 'not captured')} |\n` +
`| Languages | ${md(snapshot.languages.join(', ') || 'not captured')} |\n` +
`| Timezone | ${md(snapshot.timezone || 'not captured')} |\n` +
`| Timezone offset minutes | ${md(snapshot.timezoneOffsetMinutes)} |\n` +
`| Viewport | ${md(snapshot.viewport)} |\n` +
`| Screen | ${md(snapshot.screen)} |\n` +
`| Color scheme preference | ${md(snapshot.colorScheme)} |\n` +
`| Device pixel ratio | ${md(snapshot.devicePixelRatio)} |\n` +
`| Hardware concurrency | ${md(snapshot.hardwareConcurrency || 'not captured')} |\n` +
`| Device memory GB | ${md(snapshot.deviceMemoryGb || 'not captured')} |\n` +
`| Online state | ${md(boolWord(snapshot.online))} |\n` +
`| Cookies enabled | ${md(boolWord(snapshot.cookieEnabled))} |\n` +
`| Do Not Track | ${md(snapshot.doNotTrack || 'not set')} |\n\n` +
`## Storage availability only\n\n` +
`| Surface | Available |\n| --- | --- |\n` +
`| localStorage | ${boolWord(snapshot.storage.localStorageAvailable)} |\n` +
`| sessionStorage | ${boolWord(snapshot.storage.sessionStorageAvailable)} |\n` +
`| IndexedDB | ${boolWord(snapshot.storage.indexedDbAvailable)} |\n` +
`| Cache Storage | ${boolWord(snapshot.storage.cacheStorageAvailable)} |\n` +
`| Service Worker API | ${boolWord(snapshot.storage.serviceWorkerAvailable)} |\n\n` +
`## Permission states\n\n` +
`| Permission | State |\n| --- | --- |\n${permissionMarkdown(snapshot.permissions)}\n` +
`## Safe HTTP reachability context\n\n` +
(ops ?
`| Field | Value |\n| --- | --- |\n` +
`| Checked URL | ${md(ops.normalizedUrl || targetUrl)} |\n` +
`| Method | ${md(ops.method || 'HEAD')} |\n` +
`| HTTP status | ${ops.statusCode ? md(`${ops.statusCode} ${ops.statusMessage}`) : md(ops.error || 'No HTTP status')} |\n` +
`| Duration | ${md(`${ops.durationMs} ms`)} |\n` +
`| Overall | ${ops.ok ? 'PASS' : ops.error ? 'FAIL' : 'REVIEW'} |\n\n` +
`### HTTP/header findings\n\n${opsCheckList(ops)}\n\n`
: `- _Skipped: active tab is local or not an HTTP/HTTPS URL._\n\n`) +
`## Helpdesk / IT troubleshooting checklist\n\n` +
`- [ ] Confirm affected user/device identity outside this browser-generated note\n` +
`- [ ] Confirm OS build, browser package version, and network path with user/device management tools\n` +
`- [ ] Compare viewport/screen/language/timezone against expected workstation profile\n` +
`- [ ] Review permission states if camera, microphone, geolocation, notifications, or clipboard workflows are affected\n` +
`- [ ] Check proxy/VPN/DNS/security tooling outside this browser if HTTP reachability differs from the user report\n` +
`- [ ] Attach screenshot, ticket ID, and reproduction steps if this becomes a support or implementation record\n` +
`- [ ] Store final notes in TAHAI IT Docs / endpoint runbook / CMDB record\n\n` +
`## Ticket draft\n\n` +
`- User / device:\n` +
`- Environment: production / staging / customer tenant / internal\n` +
`- Reported issue:\n` +
`- Expected behavior:\n` +
`- Reproduction steps:\n` +
`- Resolution / escalation path:\n`;
}

function showEndpointResult(message: string): void {
  endpointResult.textContent = message;
  window.setTimeout(() => { endpointResult.textContent = ''; }, 3400);
}

async function openEndpointSnapshot(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Endpoint Snapshot.');
    return;
  }
  setStatus('Creating Endpoint Snapshot...', tab.url);
  endpointSummary.innerHTML = '<article class="ops-card info"><strong>Building</strong><span>Collecting safe browser/client environment signals…</span></article>';
  endpointMarkdown.value = '';
  if (!endpointDialog.open) endpointDialog.showModal();
  try {
    const canCheckHttp = /^https?:\/\//i.test(tab.url);
    const [rawSnapshot, ops] = await Promise.all([
      tab.webview.executeJavaScript(endpointScript(), true) as Promise<Partial<EndpointSnapshot>>,
      canCheckHttp ? window.tahaiBrowser.runUrlDiagnostics(tab.url).catch(() => undefined) : Promise.resolve(undefined)
    ]);
    const snapshot = normalizeEndpointSnapshot(rawSnapshot, tab);
    const markdown = buildEndpointSnapshotMarkdown(snapshot, ops, tab);
    latestEndpoint = { markdown, sourceUrl: snapshot.url || tab.url, snapshot, ops };
    renderEndpointSummary(snapshot, ops);
    endpointMarkdown.value = markdown;
    endpointMarkdown.focus();
    endpointMarkdown.setSelectionRange(0, 0);
    setStatus('Endpoint Snapshot ready', 'Copy or save as Markdown for helpdesk, IT Docs, or endpoint runbooks.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Endpoint Snapshot error';
    endpointSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('Endpoint Snapshot failed', detail);
  }
}


function triageIssueLevel(ops: OpsUrlDiagnostics | undefined, page: PageCapture | undefined, consoleMessages: ConsoleEntry[]): 'low' | 'medium' | 'high' {
  const errors = consoleMessages.filter((message) => message.level === 'error').length;
  if (ops?.error || (ops?.statusCode && ops.statusCode >= 500) || errors >= 3) return 'high';
  if ((ops?.statusCode && ops.statusCode >= 400) || errors > 0 || !page) return 'medium';
  return 'low';
}

function renderTriageSummary(endpoint: EndpointSnapshot, ops: OpsUrlDiagnostics | undefined, page: PageCapture | undefined, messages: ConsoleEntry[]): void {
  const errors = messages.filter((message) => message.level === 'error').length;
  const warnings = messages.filter((message) => message.level === 'warning').length;
  const level = triageIssueLevel(ops, page, messages);
  const httpLabel = ops ? (ops.statusCode ? `${ops.statusCode} ${ops.statusMessage || ''}`.trim() : (ops.error || 'No HTTP status')) : 'Skipped for local/non-HTTP URL';
  triageSummary.innerHTML = `
    <article class="ops-card ${level === 'high' ? 'fail' : level === 'medium' ? 'warn' : 'pass'}">
      <strong>Initial severity</strong>
      <span>${escapeHtml(level.toUpperCase())} based on safe browser signals</span>
    </article>
    <article class="ops-card ${ops ? (ops.ok ? 'pass' : ops.error ? 'fail' : 'warn') : 'info'}">
      <strong>HTTP</strong>
      <span>${escapeHtml(httpLabel)}</span>
    </article>
    <article class="ops-card ${endpoint.online ? 'pass' : 'warn'}">
      <strong>Endpoint</strong>
      <span>${escapeHtml(`${endpoint.platform || 'unknown'}; online=${boolWord(endpoint.online)}`)}</span>
    </article>
    <article class="ops-card ${errors ? 'warn' : 'pass'}">
      <strong>Console</strong>
      <span>${escapeHtml(`${errors} error(s), ${warnings} warning(s) since tab open`)}</span>
    </article>
  `;
}

function buildSupportTriageMarkdown(endpoint: EndpointSnapshot, ops: OpsUrlDiagnostics | undefined, page: PageCapture | undefined, consoleMessages: ConsoleEntry[], tab: TabState): string {
  const targetUrl = page?.url || endpoint.url || tab.url;
  const host = endpoint.host || (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  const level = triageIssueLevel(ops, page, consoleMessages).toUpperCase();
  const errors = consoleMessages.filter((message) => message.level === 'error').length;
  const warnings = consoleMessages.filter((message) => message.level === 'warning').length;
  return `# TAHAI Support Triage Packet — ${md(host)}

` +
`> Helpdesk-ready IT support/escalation packet generated from TAHAI Web Services Browser. It combines safe active-page context, browser/client environment signals, HTTP reachability, and console counts for triage. It excludes cookies, storage values, clipboard contents, passwords, tokens, local files, IP addresses, request bodies, response bodies, form values, and authorization headers.

` +
`## Triage metadata

` +
`| Field | Value |
| --- | --- |
` +
`| Captured at | ${md(new Date().toISOString())} |
` +
`| Browser | ${md(config.productName)} ${md(config.version)} |
` +
`| Active tab title | ${md(tab.title)} |
` +
`| Page title | ${md(page?.title || endpoint.title || tab.title)} |
` +
`| Active URL | ${md(targetUrl)} |
` +
`| Host | ${md(host)} |
` +
`| Initial severity hint | ${md(level)} |
` +
`| Transport label | ${md(securityLabel(targetUrl))} |

` +
`## User-impact intake

` +
`| Field | Value |
| --- | --- |
` +
`| Affected user / device |  |
` +
`| Organization / tenant / site |  |
` +
`| Reported symptom |  |
` +
`| Business impact | none / low / medium / high / outage |
` +
`| First observed |  |
` +
`| Scope | one user / group / site / all users / unknown |
` +
`| Last known good |  |

` +
`## Safe browser/page context

` +
`| Signal | Value |
| --- | --- |
` +
`| Viewport | ${md(page?.viewport || endpoint.viewport)} |
` +
`| Language(s) | ${md(endpoint.languages.join(', ') || page?.language || 'not captured')} |
` +
`| Timezone | ${md(endpoint.timezone || 'not captured')} |
` +
`| Platform | ${md(endpoint.platform || 'not captured')} |
` +
`| Online state | ${md(boolWord(endpoint.online))} |
` +
`| Cookies enabled | ${md(boolWord(endpoint.cookieEnabled))} |
` +
`| Storage availability | localStorage=${boolWord(endpoint.storage.localStorageAvailable)}, sessionStorage=${boolWord(endpoint.storage.sessionStorageAvailable)}, IndexedDB=${boolWord(endpoint.storage.indexedDbAvailable)} |
` +
`| DOMContentLoaded | ${md(page ? `${page.timing.domContentLoadedMs} ms` : 'not captured')} |
` +
`| Load complete | ${md(page ? `${page.timing.loadMs} ms` : 'not captured')} |
` +
`| Forms / inputs / buttons | ${md(page ? `${page.counts.forms} / ${page.counts.inputs} / ${page.counts.buttons}` : 'not captured')} |
` +
`| Console signal | ${md(`${errors} error(s), ${warnings} warning(s) since tab open`)} |

` +
`### Visible heading outline

${bulletList(page?.headings || [])}

` +
`## HTTP reachability snapshot

` +
(ops ?
`| Field | Value |
| --- | --- |
` +
`| Checked URL | ${md(ops.normalizedUrl || targetUrl)} |
` +
`| Method | ${md(ops.method || 'HEAD')} |
` +
`| HTTP status | ${ops.statusCode ? md(`${ops.statusCode} ${ops.statusMessage}`) : md(ops.error || 'No HTTP status')} |
` +
`| Duration | ${md(`${ops.durationMs} ms`)} |
` +
`| Overall | ${ops.ok ? 'PASS' : ops.error ? 'FAIL' : 'REVIEW'} |

` +
`### Header/ops findings

${opsCheckList(ops)}

`
: `- _Skipped: active tab is local or not an HTTP/HTTPS URL._

`) +
`## Console sample

${consoleSummaryMarkdown(consoleMessages)}

` +
`## Reproduction steps

` +
`1. Open ${md(targetUrl)}
` +
`2. Confirm affected account/role/network outside this browser-generated packet
` +
`3. Reproduce reported symptom:
` +
`4. Expected result:
` +
`5. Actual result:

` +
`## IT triage checklist

` +
`- [ ] Confirm issue scope: single user, site, tenant, provider, or global
` +
`- [ ] Compare against another browser/profile/device/network path
` +
`- [ ] Check SSO/MFA/session state without recording credentials or tokens here
` +
`- [ ] Check DNS/CDN/provider status outside this generated packet
` +
`- [ ] Review recent deployment/change tickets if HTTP or console signals changed
` +
`- [ ] Attach screenshot/HAR separately if needed, after redacting secrets
` +
`- [ ] Store final resolution in TAHAI IT Docs, service card, endpoint note, or runbook

` +
`## Escalation / resolution

` +
`| Field | Value |
| --- | --- |
` +
`| Escalate to | helpdesk / sysadmin / vendor / developer / DevOps |
` +
`| Escalation reason |  |
` +
`| Workaround |  |
` +
`| Root cause |  |
` +
`| Resolution applied |  |
` +
`| Verification completed |  |
` +
`| Follow-up documentation |  |
`;
}

function showTriageResult(message: string): void {
  triageResult.textContent = message;
  window.setTimeout(() => { triageResult.textContent = ''; }, 3400);
}

function openSecretBoundary(): void {
  closeToolMenus();
  openOpsGuardReview();
  setStatus('Secret Boundary active', 'TAHAI Browser does not include a public-lane IT Docs secret reference. Use IT Docs/server-authorized secret handling and Ops Guard redaction before sharing.');
}

async function openSupportTriage(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Support Triage.');
    return;
  }
  setStatus('Creating Support Triage packet...', tab.url);
  triageSummary.innerHTML = '<article class="ops-card info"><strong>Building</strong><span>Collecting safe endpoint, page, HTTP, and console signals…</span></article>';
  triageMarkdown.value = '';
  if (!triageDialog.open) triageDialog.showModal();
  try {
    const canCheckHttp = /^https?:\/\//i.test(tab.url);
    const [rawEndpoint, rawPage, ops] = await Promise.all([
      tab.webview.executeJavaScript(endpointScript(), true) as Promise<Partial<EndpointSnapshot>>,
      tab.webview.executeJavaScript(captureScript(), true).catch(() => undefined) as Promise<Partial<PageCapture> | undefined>,
      canCheckHttp ? window.tahaiBrowser.runUrlDiagnostics(tab.url).catch(() => undefined) : Promise.resolve(undefined)
    ]);
    const endpoint = normalizeEndpointSnapshot(rawEndpoint, tab);
    const page = rawPage ? normalizeCapture(rawPage, tab) : undefined;
    const messages = tab.consoleMessages.slice(-80);
    const markdown = buildSupportTriageMarkdown(endpoint, ops, page, messages, tab);
    latestTriage = { markdown, sourceUrl: page?.url || endpoint.url || tab.url, endpoint, ops, page, consoleMessages: messages };
    renderTriageSummary(endpoint, ops, page, messages);
    triageMarkdown.value = markdown;
    triageMarkdown.focus();
    triageMarkdown.setSelectionRange(0, 0);
    setStatus('Support Triage packet ready', 'Copy or save as Markdown for helpdesk, escalation, or TAHAI IT Docs.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Support Triage error';
    triageSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('Support Triage failed', detail);
  }
}

function routeMapScript(): string {
  return String.raw`(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const safePath = (pathname) => {
      const path = String(pathname || '/').replace(/\/+$/, '') || '/';
      return path.split('/').map((segment) => {
        if (/^[A-Za-z0-9_-]{28,}$/.test(segment)) return '[redacted-id]';
        if (/^[0-9a-f]{24,}$/i.test(segment)) return '[redacted-hex]';
        return segment;
      }).join('/').slice(0, 240);
    };
    const strip = (value) => {
      try {
        const parsed = new URL(String(value || ''), location.href);
        if (!/^https?:$/i.test(parsed.protocol)) return '';
        return (parsed.origin + safePath(parsed.pathname)).slice(0, 520) || parsed.origin;
      } catch {
        return '';
      }
    };
    const pathOnly = (value) => {
      try {
        const parsed = new URL(String(value || ''), location.href);
        return safePath(parsed.pathname);
      } catch {
        return '';
      }
    };
    const originOnly = (value) => {
      try {
        const parsed = new URL(String(value || ''), location.href);
        return /^https?:$/i.test(parsed.protocol) ? parsed.origin : '';
      } catch {
        return '';
      }
    };
    const addUnique = (list, value, limit = 40) => {
      const cleanValue = clean(value);
      if (cleanValue && !list.includes(cleanValue) && list.length < limit) list.push(cleanValue);
    };
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const sameOrigin = location.origin || '';
    const internalLinks = [];
    const externalOrigins = [];
    const routeCandidates = [];
    anchors.forEach((node) => {
      const href = strip(node.href || node.getAttribute('href') || '');
      if (!href) return;
      const origin = originOnly(href);
      const path = pathOnly(href);
      if (origin === sameOrigin) {
        addUnique(internalLinks, path, 45);
        addUnique(routeCandidates, path, 55);
      } else {
        addUnique(externalOrigins, origin, 30);
      }
    });
    Array.from(document.querySelectorAll('nav a[href], [role="navigation"] a[href], header a[href], footer a[href]')).forEach((node) => {
      const path = pathOnly(node.href || node.getAttribute('href') || '');
      addUnique(routeCandidates, path, 55);
    });
    const forms = Array.from(document.forms || []).slice(0, 12).map((form) => {
      const controls = Array.from(form.querySelectorAll('input,select,textarea,button'));
      const action = strip(form.action || location.href);
      const origin = originOnly(action);
      const fieldTypes = [];
      controls.forEach((control) => {
        const type = clean(control.getAttribute('type') || control.tagName || 'control').toLowerCase().slice(0, 40);
        addUnique(fieldTypes, type || 'control', 16);
      });
      addUnique(routeCandidates, pathOnly(action), 55);
      return {
        method: clean(form.method || 'get').toUpperCase().slice(0, 12),
        action,
        sameOrigin: origin === sameOrigin,
        controlCount: controls.length,
        submitCount: controls.filter((control) => String(control.getAttribute('type') || '').toLowerCase() === 'submit' || control.tagName === 'BUTTON').length,
        passwordCount: controls.filter((control) => String(control.getAttribute('type') || '').toLowerCase() === 'password').length,
        fileCount: controls.filter((control) => String(control.getAttribute('type') || '').toLowerCase() === 'file').length,
        fieldTypes
      };
    });
    const resources = performance.getEntriesByType('resource') || [];
    const resourceMap = new Map();
    const apiSamples = [];
    resources.forEach((entry) => {
      const type = clean(entry.initiatorType || 'resource').toLowerCase() || 'resource';
      const origin = originOnly(entry.name || '');
      if (origin) {
        const existing = resourceMap.get(origin) || { origin, count: 0, types: [] };
        existing.count += 1;
        if (!existing.types.includes(type) && existing.types.length < 8) existing.types.push(type);
        resourceMap.set(origin, existing);
      }
      if (['fetch', 'xmlhttprequest', 'beacon'].includes(type)) {
        const safe = strip(entry.name || '');
        if (safe && apiSamples.length < 24) apiSamples.push({ path: pathOnly(safe), origin: originOnly(safe), type });
      }
    });
    const scripts = Array.from(document.scripts || []);
    const html = document.documentElement ? document.documentElement.outerHTML.slice(0, 50000).toLowerCase() : '';
    const frameworkHints = [];
    if (document.getElementById('__NEXT_DATA__') || html.includes('/_next/')) addUnique(frameworkHints, 'Next.js');
    if (window.__NUXT__ || document.querySelector('[data-nuxt]') || html.includes('/_nuxt/')) addUnique(frameworkHints, 'Nuxt');
    if (document.querySelector('[ng-version]')) addUnique(frameworkHints, 'Angular');
    if (document.querySelector('[data-reactroot], #root') || html.includes('react')) addUnique(frameworkHints, 'React / React-like');
    if (document.querySelector('#app') || html.includes('vue')) addUnique(frameworkHints, 'Vue / Vue-like');
    if (scripts.some((script) => String(script.src || '').includes('/assets/') && String(script.type || '').toLowerCase() === 'module')) addUnique(frameworkHints, 'Vite/module-bundled app');
    const meta = (selector) => clean(document.querySelector(selector)?.getAttribute('content') || '');
    const canonical = strip(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '');
    const baseHref = strip(document.querySelector('base[href]')?.getAttribute('href') || '');
    return {
      title: clean(document.title).slice(0, 220),
      url: String(location.href || ''),
      origin: String(location.origin || ''),
      pathname: String(location.pathname || '/'),
      canonical,
      baseHref,
      robots: meta('meta[name="robots"]'),
      frameworkHints,
      routeCandidates: routeCandidates.sort().slice(0, 55),
      internalLinks: internalLinks.sort().slice(0, 45),
      externalOrigins: externalOrigins.sort().slice(0, 30),
      forms,
      resourceOrigins: Array.from(resourceMap.values()).sort((a, b) => b.count - a.count).slice(0, 22),
      apiSamples,
      counts: {
        anchors: anchors.length,
        internalAnchors: anchors.filter((node) => originOnly(node.href || '') === sameOrigin).length,
        externalAnchors: anchors.filter((node) => originOnly(node.href || '') && originOnly(node.href || '') !== sameOrigin).length,
        navLinks: document.querySelectorAll('nav a[href], [role="navigation"] a[href], header a[href], footer a[href]').length,
        forms: forms.length,
        scripts: scripts.length,
        moduleScripts: scripts.filter((script) => String(script.type || '').toLowerCase() === 'module').length,
        resources: resources.length,
        apiResources: apiSamples.length
      }
    };
  })()`;
}

function normalizeRouteMapPage(raw: Partial<RouteMapPage> | undefined, tab: TabState): RouteMapPage {
  const counts = raw?.counts || {} as RouteMapPage['counts'];
  const cleanList = (values: unknown, limit: number): string[] => Array.isArray(values)
    ? values.map((item) => compactText(item, '')).filter(Boolean).slice(0, limit)
    : [];
  const forms = Array.isArray(raw?.forms) ? raw.forms.map((form) => ({
    method: compactText(form?.method, 'GET').toUpperCase().slice(0, 12),
    action: compactText(form?.action, ''),
    sameOrigin: Boolean(form?.sameOrigin),
    controlCount: num(form?.controlCount),
    submitCount: num(form?.submitCount),
    passwordCount: num(form?.passwordCount),
    fileCount: num(form?.fileCount),
    fieldTypes: cleanList(form?.fieldTypes, 16)
  })).slice(0, 12) : [];
  const resourceOrigins = Array.isArray(raw?.resourceOrigins) ? raw.resourceOrigins.map((resource) => ({
    origin: compactText(resource?.origin, ''),
    count: num(resource?.count),
    types: cleanList(resource?.types, 8)
  })).filter((resource) => resource.origin).slice(0, 22) : [];
  const apiSamples = Array.isArray(raw?.apiSamples) ? raw.apiSamples.map((sample) => ({
    path: compactText(sample?.path, ''),
    origin: compactText(sample?.origin, ''),
    type: compactText(sample?.type, 'fetch')
  })).filter((sample) => sample.path || sample.origin).slice(0, 24) : [];
  let pathname = compactText(raw?.pathname, '/');
  try { pathname = pathname || new URL(String(raw?.url || tab.url)).pathname || '/'; } catch {}
  return {
    title: compactText(raw?.title, tab.title),
    url: String(raw?.url || tab.url),
    origin: compactText(raw?.origin, ''),
    pathname,
    canonical: compactText(raw?.canonical, ''),
    baseHref: compactText(raw?.baseHref, ''),
    robots: compactText(raw?.robots, ''),
    frameworkHints: cleanList(raw?.frameworkHints, 12),
    routeCandidates: cleanList(raw?.routeCandidates, 55),
    internalLinks: cleanList(raw?.internalLinks, 45),
    externalOrigins: cleanList(raw?.externalOrigins, 30),
    forms,
    resourceOrigins,
    apiSamples,
    counts: {
      anchors: num(counts.anchors),
      internalAnchors: num(counts.internalAnchors),
      externalAnchors: num(counts.externalAnchors),
      navLinks: num(counts.navLinks),
      forms: num(counts.forms),
      scripts: num(counts.scripts),
      moduleScripts: num(counts.moduleScripts),
      resources: num(counts.resources),
      apiResources: num(counts.apiResources)
    }
  };
}

function routeMapBulletList(values: string[], empty: string): string {
  if (!values.length) return empty;
  return values.map((value) => `- ${md(value)}`).join('\n');
}

function routeMapResourceMarkdown(resources: RouteMapResourceOrigin[]): string {
  if (!resources.length) return '| _None captured_ | 0 | _n/a_ |\n';
  return resources.map((resource) => `| ${md(resource.origin)} | ${resource.count} | ${md(resource.types.join(', ') || 'resource')} |`).join('\n') + '\n';
}

function routeMapApiMarkdown(samples: RouteMapApiSample[]): string {
  if (!samples.length) return '| _None captured_ | _n/a_ | _n/a_ |\n';
  return samples.map((sample) => `| ${md(sample.origin || 'same-origin/local')} | ${md(sample.path || '/')} | ${md(sample.type)} |`).join('\n') + '\n';
}

function routeMapFormsMarkdown(forms: RouteMapFormSnapshot[]): string {
  if (!forms.length) return '| _None captured_ | _n/a_ | _n/a_ | _n/a_ | _n/a_ |\n';
  return forms.map((form) => `| ${md(form.method)} | ${md(form.action || 'current route')} | ${form.sameOrigin ? 'yes' : 'no'} | ${form.controlCount} / ${form.submitCount} | ${md(form.fieldTypes.join(', ') || 'control')} |`).join('\n') + '\n';
}

function renderRouteMapSummary(map: RouteMapPage): void {
  const routeCount = map.routeCandidates.length;
  const externalCount = map.externalOrigins.length;
  const apiCount = map.apiSamples.length;
  const formRisk = map.forms.filter((form) => form.passwordCount || form.fileCount || !form.sameOrigin).length;
  routeMapSummary.innerHTML = `
    <article class="ops-card ${routeCount ? 'pass' : 'warn'}">
      <strong>Routes</strong>
      <span>${escapeHtml(`${routeCount} candidate route(s), ${map.counts.navLinks} nav link(s)`)}</span>
    </article>
    <article class="ops-card ${externalCount ? 'info' : 'pass'}">
      <strong>Origins</strong>
      <span>${escapeHtml(`${externalCount} external origin(s), ${map.resourceOrigins.length} resource origin(s)`)}</span>
    </article>
    <article class="ops-card ${apiCount ? 'warn' : 'info'}">
      <strong>API hints</strong>
      <span>${escapeHtml(`${apiCount} fetch/XHR/beacon sample(s)`)}</span>
    </article>
    <article class="ops-card ${formRisk ? 'warn' : 'pass'}">
      <strong>Forms</strong>
      <span>${escapeHtml(`${map.forms.length} form(s), ${formRisk} need review`)}</span>
    </article>
  `;
}

function buildRouteMapMarkdown(map: RouteMapPage, tab: TabState): string {
  const targetUrl = map.url || tab.url;
  const host = (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI Route Map — ${md(host)}\n\n` +
`> Developer-focused frontend route/API surface map generated from the active Chromium tab. It documents route candidates, form actions, external origins, framework hints, and API-like resource paths. Query strings and fragments are stripped. This report excludes cookies, storage values, credentials, tokens, request bodies, response bodies, form values, clipboard contents, and local files.\n\n` +
`## Map metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Mapped at | ${md(new Date().toISOString())} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Active tab title | ${md(tab.title)} |\n` +
`| Page title | ${md(map.title || tab.title)} |\n` +
`| URL | ${md(targetUrl)} |\n` +
`| Origin | ${md(map.origin || 'local / unavailable')} |\n` +
`| Pathname | ${md(map.pathname || '/')} |\n` +
`| Transport | ${md(securityLabel(targetUrl))} |\n` +
`| Canonical | ${md(map.canonical || 'not captured')} |\n` +
`| Base href | ${md(map.baseHref || 'not captured')} |\n` +
`| Robots | ${md(map.robots || 'not captured')} |\n\n` +
`## Framework / build hints\n\n${routeMapBulletList(map.frameworkHints, '- _No framework hints captured._')}\n\n` +
`## Surface counts\n\n` +
`| Metric | Value |\n| --- | ---: |\n` +
`| Anchors | ${map.counts.anchors} |\n` +
`| Internal anchors | ${map.counts.internalAnchors} |\n` +
`| External anchors | ${map.counts.externalAnchors} |\n` +
`| Navigation/header/footer links | ${map.counts.navLinks} |\n` +
`| Forms sampled | ${map.forms.length} |\n` +
`| Scripts / modules | ${map.counts.scripts} / ${map.counts.moduleScripts} |\n` +
`| Resource timing entries | ${map.counts.resources} |\n` +
`| Fetch/XHR/beacon samples | ${map.apiSamples.length} |\n\n` +
`## Candidate frontend routes\n\n${routeMapBulletList(map.routeCandidates, '- _No same-origin route candidates captured._')}\n\n` +
`## Same-origin link sample\n\n${routeMapBulletList(map.internalLinks, '- _No same-origin links sampled._')}\n\n` +
`## External link origins\n\n${routeMapBulletList(map.externalOrigins, '- _No external origins sampled._')}\n\n` +
`## Form/action map\n\n` +
`| Method | Safe action URL | Same origin | Controls / submits | Field types only |\n| --- | --- | --- | ---: | --- |\n${routeMapFormsMarkdown(map.forms)}\n` +
`## Resource origin map\n\n` +
`| Origin | Count | Initiator types |\n| --- | ---: | --- |\n${routeMapResourceMarkdown(map.resourceOrigins)}\n` +
`## API-like resource samples\n\n` +
`| Origin | Path | Type |\n| --- | --- | --- |\n${routeMapApiMarkdown(map.apiSamples)}\n` +
`## Developer follow-up checklist\n\n` +
`- [ ] Confirm expected public/private route list against the app router source\n` +
`- [ ] Confirm auth-required routes are protected server-side, not only hidden in UI\n` +
`- [ ] Review form actions for cross-origin submission, password/file upload, and CSRF expectations\n` +
`- [ ] Verify API paths against gateway/provider routes and deployment environment variables\n` +
`- [ ] Attach this map to the PR, release ticket, or TAHAI IT Docs app/runbook record\n\n` +
`## Route ownership draft\n\n` +
`- App / component owner:\n` +
`- Environment: production / staging / local / customer tenant\n` +
`- Critical routes:\n` +
`- Protected routes:\n` +
`- API/gateway owner:\n` +
`- Documentation updates needed:\n`;
}

function showRouteMapResult(message: string): void {
  routeMapResult.textContent = message;
  window.setTimeout(() => { routeMapResult.textContent = ''; }, 3400);
}

async function openRouteMap(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Route Map.');
    return;
  }
  setStatus('Creating Route Map...', tab.url);
  routeMapSummary.innerHTML = '<article class="ops-card info"><strong>Mapping</strong><span>Collecting route, form, resource, and API-like surface signals…</span></article>';
  routeMapMarkdown.value = '';
  if (!routeMapDialog.open) routeMapDialog.showModal();
  try {
    const raw = await tab.webview.executeJavaScript(routeMapScript(), true) as Partial<RouteMapPage>;
    const map = normalizeRouteMapPage(raw, tab);
    const markdown = buildRouteMapMarkdown(map, tab);
    latestRouteMap = { markdown, sourceUrl: map.url || tab.url, map };
    renderRouteMapSummary(map);
    routeMapMarkdown.value = markdown;
    routeMapMarkdown.focus();
    routeMapMarkdown.setSelectionRange(0, 0);
    setStatus('Route Map ready', 'Copy or save as Markdown for PRs, docs, or runbooks.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Route Map error';
    routeMapSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('Route Map failed', detail);
  }
}

function redactDiagnosticText(value: unknown): string {
  return compactText(value, '')
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|password|secret|authorization)=)[^\s&]+/gi, '$1[REDACTED]')
    .replace(/\b[A-Za-z0-9_\-]{36,}\b/g, '[REDACTED_LONG_TOKEN]');
}

function consoleLevelName(level: unknown): string {
  const text = String(level ?? '').toLowerCase();
  if (text.includes('error') || text === '3') return 'error';
  if (text.includes('warn') || text === '2') return 'warning';
  if (text.includes('info') || text === '1') return 'info';
  return text || 'log';
}

function recordConsoleMessage(tab: TabState, event: any): void {
  const message = redactDiagnosticText(event?.message || '');
  if (!message) return;
  const entry: ConsoleEntry = {
    level: consoleLevelName(event?.level),
    message,
    sourceId: redactDiagnosticText(event?.sourceId || ''),
    line: num(event?.line),
    capturedAt: new Date().toISOString()
  };
  tab.consoleMessages.push(entry);
  if (tab.consoleMessages.length > 90) tab.consoleMessages.splice(0, tab.consoleMessages.length - 90);
}

function devAuditScript(): string {
  return String.raw`(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const safeUrl = (value) => {
      try { const url = new URL(String(value || ''), location.href); return (url.origin + url.pathname).slice(0, 500); }
      catch { return clean(value).split('?')[0].split('#')[0].slice(0, 500); }
    };
    const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
    const kb = (value) => Math.max(0, Math.round(Number(value || 0) / 1024));
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint') || [];
    const paintValue = (name) => {
      const entry = paint.find((item) => item && item.name === name);
      return entry ? number(entry.startTime) : 0;
    };
    const scripts = Array.from(document.scripts || []);
    const stylesheets = Array.from(document.querySelectorAll('link[rel~="stylesheet"]'));
    const images = Array.from(document.images || []);
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]'));
    const inputs = Array.from(document.querySelectorAll('input,select,textarea'));
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const labelFor = (node) => {
      if (!node) return false;
      if (node.id && document.querySelector('label[for="' + CSS.escape(node.id) + '"]')) return true;
      if (node.closest && node.closest('label')) return true;
      if (node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || node.getAttribute('title')) return true;
      return false;
    };
    const visibleText = (node) => clean((node && node.innerText) || (node && node.textContent) || node?.getAttribute?.('aria-label') || node?.getAttribute?.('title'));
    const resources = performance.getEntriesByType('resource')
      .map((entry) => ({
        name: safeUrl(entry.name),
        initiatorType: clean(entry.initiatorType || 'resource').slice(0, 80),
        durationMs: number(entry.duration),
        transferKb: kb(entry.transferSize),
        sizeKb: kb(entry.decodedBodySize || entry.encodedBodySize || entry.transferSize)
      }))
      .sort((left, right) => (right.transferKb - left.transferKb) || (right.durationMs - left.durationMs))
      .slice(0, 18);
    const meta = (selector) => clean(document.querySelector(selector)?.getAttribute('content') || '');
    return {
      title: clean(document.title).slice(0, 220),
      url: String(location.href || ''),
      origin: String(location.origin || ''),
      userAgent: String(navigator.userAgent || ''),
      viewport: String(window.innerWidth + 'x' + window.innerHeight),
      language: String(document.documentElement.lang || navigator.language || ''),
      doctype: document.doctype ? clean(document.doctype.name) : '',
      charset: clean(document.characterSet || ''),
      metaViewport: meta('meta[name="viewport"]'),
      metaDescription: meta('meta[name="description"]').slice(0, 260),
      robots: meta('meta[name="robots"]'),
      cspMeta: meta('meta[http-equiv="Content-Security-Policy" i]').slice(0, 420),
      counts: {
        scripts: scripts.length,
        externalScripts: scripts.filter((node) => !!node.src).length,
        inlineScripts: scripts.filter((node) => !node.src).length,
        moduleScripts: scripts.filter((node) => String(node.type || '').toLowerCase() === 'module').length,
        stylesheets: stylesheets.length,
        inlineStyles: document.querySelectorAll('style').length,
        images: images.length,
        imagesMissingAlt: images.filter((node) => !node.hasAttribute('alt')).length,
        buttons: buttons.length,
        buttonsWithoutText: buttons.filter((node) => !visibleText(node)).length,
        inputs: inputs.length,
        inputsMissingLabels: inputs.filter((node) => !labelFor(node)).length,
        anchors: anchors.length,
        anchorsWithoutText: anchors.filter((node) => !visibleText(node)).length,
        forms: document.forms ? document.forms.length : 0,
        customElements: document.querySelectorAll('*').length ? Array.from(document.querySelectorAll('*')).filter((node) => node.localName && node.localName.includes('-')).length : 0
      },
      timing: {
        domContentLoadedMs: number((nav.domContentLoadedEventEnd || 0) - (nav.startTime || 0)),
        loadMs: number((nav.loadEventEnd || 0) - (nav.startTime || 0)),
        responseMs: number((nav.responseEnd || 0) - (nav.requestStart || 0)),
        firstPaintMs: paintValue('first-paint'),
        firstContentfulPaintMs: paintValue('first-contentful-paint'),
        transferKb: kb(nav.transferSize),
        encodedBodyKb: kb(nav.encodedBodySize),
        decodedBodyKb: kb(nav.decodedBodySize)
      },
      resources,
      storageCounts: {
        localStorageKeys: (() => { try { return localStorage.length || 0; } catch { return 0; } })(),
        sessionStorageKeys: (() => { try { return sessionStorage.length || 0; } catch { return 0; } })(),
        cookiesAccessible: (() => { try { return Boolean(document.cookie); } catch { return false; } })()
      }
    };
  })()`;
}

function normalizeDevAuditPage(raw: Partial<DevAuditPage> | undefined, tab: TabState): DevAuditPage {
  const counts = raw?.counts || {} as DevAuditPage['counts'];
  const timing = raw?.timing || {} as DevAuditPage['timing'];
  const storageCounts = raw?.storageCounts || {} as DevAuditPage['storageCounts'];
  return {
    title: compactText(raw?.title, tab.title),
    url: String(raw?.url || tab.url),
    origin: compactText(raw?.origin, ''),
    userAgent: compactText(raw?.userAgent, ''),
    viewport: compactText(raw?.viewport, ''),
    language: compactText(raw?.language, ''),
    doctype: compactText(raw?.doctype, ''),
    charset: compactText(raw?.charset, ''),
    metaViewport: compactText(raw?.metaViewport, ''),
    metaDescription: compactText(raw?.metaDescription, ''),
    robots: compactText(raw?.robots, ''),
    cspMeta: compactText(raw?.cspMeta, ''),
    counts: {
      scripts: num(counts.scripts),
      externalScripts: num(counts.externalScripts),
      inlineScripts: num(counts.inlineScripts),
      moduleScripts: num(counts.moduleScripts),
      stylesheets: num(counts.stylesheets),
      inlineStyles: num(counts.inlineStyles),
      images: num(counts.images),
      imagesMissingAlt: num(counts.imagesMissingAlt),
      buttons: num(counts.buttons),
      buttonsWithoutText: num(counts.buttonsWithoutText),
      inputs: num(counts.inputs),
      inputsMissingLabels: num(counts.inputsMissingLabels),
      anchors: num(counts.anchors),
      anchorsWithoutText: num(counts.anchorsWithoutText),
      forms: num(counts.forms),
      customElements: num(counts.customElements)
    },
    timing: {
      domContentLoadedMs: num(timing.domContentLoadedMs),
      loadMs: num(timing.loadMs),
      responseMs: num(timing.responseMs),
      firstPaintMs: num(timing.firstPaintMs),
      firstContentfulPaintMs: num(timing.firstContentfulPaintMs),
      transferKb: num(timing.transferKb),
      encodedBodyKb: num(timing.encodedBodyKb),
      decodedBodyKb: num(timing.decodedBodyKb)
    },
    resources: Array.isArray(raw?.resources) ? raw.resources.map((resource) => ({
      name: compactText(resource.name, ''),
      initiatorType: compactText(resource.initiatorType, 'resource'),
      durationMs: num(resource.durationMs),
      transferKb: num(resource.transferKb),
      sizeKb: num(resource.sizeKb)
    })).filter((resource) => resource.name).slice(0, 18) : [],
    storageCounts: {
      localStorageKeys: num(storageCounts.localStorageKeys),
      sessionStorageKeys: num(storageCounts.sessionStorageKeys),
      cookiesAccessible: Boolean(storageCounts.cookiesAccessible)
    }
  };
}

function consoleMarkdown(messages: ConsoleEntry[]): string {
  if (!messages.length) return '- _No console messages captured since the tab was opened in this TAHAI browser session._';
  return messages.slice(-35).map((entry) => `- [${md(entry.level).toUpperCase()}] ${md(entry.message)}${entry.sourceId ? ` — ${md(entry.sourceId)}:${entry.line || 0}` : ''}`).join('\n');
}

function resourceMarkdown(resources: DevAuditResource[]): string {
  if (!resources.length) return '| _None captured_ | _n/a_ | _0_ | _0_ | _0_ |\n';
  return resources.map((resource) => `| ${md(resource.name)} | ${md(resource.initiatorType)} | ${resource.transferKb} | ${resource.sizeKb} | ${resource.durationMs} |`).join('\n') + '\n';
}

function devAuditFindingList(page: DevAuditPage, messages: ConsoleEntry[]): string {
  const findings: string[] = [];
  const errors = messages.filter((entry) => entry.level === 'error').length;
  const warnings = messages.filter((entry) => entry.level === 'warning').length;
  if (errors) findings.push(`- [FAIL] Console errors captured — ${errors} error message(s) need review in DevTools.`);
  else findings.push('- [PASS] No console errors captured after this tab opened.');
  if (warnings) findings.push(`- [WARN] Console warnings captured — ${warnings} warning message(s) should be reviewed.`);
  if (page.timing.loadMs > 3000) findings.push(`- [WARN] Load timing is ${page.timing.loadMs} ms; profile network and main-thread work.`);
  else if (page.timing.loadMs) findings.push(`- [INFO] Load timing captured at ${page.timing.loadMs} ms.`);
  if (page.counts.imagesMissingAlt) findings.push(`- [WARN] ${page.counts.imagesMissingAlt} image(s) without alt attributes.`);
  if (page.counts.buttonsWithoutText) findings.push(`- [WARN] ${page.counts.buttonsWithoutText} button/control(s) without visible text or labels.`);
  if (page.counts.inputsMissingLabels) findings.push(`- [WARN] ${page.counts.inputsMissingLabels} input/control(s) without detected labels.`);
  if (!page.metaViewport) findings.push('- [WARN] Missing viewport meta tag; responsive behavior may be degraded.');
  if (!page.doctype) findings.push('- [WARN] Missing document doctype.');
  if (!page.cspMeta) findings.push('- [INFO] No CSP meta tag captured; header-level CSP may still exist and should be checked with Ops Check.');
  return findings.join('\n');
}

function renderDevAuditSummary(page: DevAuditPage, messages: ConsoleEntry[]): void {
  const errors = messages.filter((entry) => entry.level === 'error').length;
  const warnings = messages.filter((entry) => entry.level === 'warning').length;
  const resourceKb = page.resources.reduce((sum, resource) => sum + resource.transferKb, 0);
  const a11yIssues = page.counts.imagesMissingAlt + page.counts.buttonsWithoutText + page.counts.inputsMissingLabels + page.counts.anchorsWithoutText;
  devAuditSummary.innerHTML = `
    <article class="ops-card ${errors ? 'fail' : warnings ? 'warn' : 'pass'}">
      <strong>Console</strong>
      <span>${escapeHtml(`${errors} errors / ${warnings} warnings`)}</span>
    </article>
    <article class="ops-card info">
      <strong>Load</strong>
      <span>${escapeHtml(`${page.timing.loadMs || 0} ms / ${resourceKb} KB sampled`)}</span>
    </article>
    <article class="ops-card ${a11yIssues ? 'warn' : 'pass'}">
      <strong>Page quality</strong>
      <span>${escapeHtml(`${a11yIssues} lightweight issue(s)`)}</span>
    </article>
    <article class="ops-card info">
      <strong>Surface</strong>
      <span>${escapeHtml(`${page.counts.scripts} scripts / ${page.counts.forms} forms / ${page.counts.customElements} custom elements`)}</span>
    </article>
  `;
}

function buildDeveloperAuditMarkdown(page: DevAuditPage, messages: ConsoleEntry[], tab: TabState): string {
  const targetUrl = page.url || tab.url;
  const host = (() => { try { return new URL(targetUrl).hostname || 'local-page'; } catch { return 'local-page'; } })();
  return `# TAHAI Developer Audit — ${md(host)}\n\n` +
`> Developer-ready browser audit generated from the active Chromium tab. It captures console signal, resource timing, page structure, and lightweight frontend quality checks. It strips query strings from resource URLs and excludes cookies, storage values, credentials, tokens, request bodies, response bodies, and form contents.\n\n` +
`## Audit metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Audited at | ${md(new Date().toISOString())} |\n` +
`| Browser | ${md(config.productName)} ${md(config.version)} |\n` +
`| Active tab title | ${md(tab.title)} |\n` +
`| Page title | ${md(page.title || tab.title)} |\n` +
`| URL | ${md(targetUrl)} |\n` +
`| Origin | ${md(page.origin || 'local / unavailable')} |\n` +
`| Transport | ${md(securityLabel(targetUrl))} |\n` +
`| Viewport | ${md(page.viewport || 'not captured')} |\n` +
`| Language | ${md(page.language || 'not captured')} |\n` +
`| User agent | ${md(page.userAgent || 'not captured')} |\n\n` +
`## Developer findings\n\n${devAuditFindingList(page, messages)}\n\n` +
`## Runtime / render timing\n\n` +
`| Metric | Value |\n| --- | ---: |\n` +
`| Response timing | ${page.timing.responseMs} ms |\n` +
`| DOMContentLoaded | ${page.timing.domContentLoadedMs} ms |\n` +
`| Load complete | ${page.timing.loadMs} ms |\n` +
`| First paint | ${page.timing.firstPaintMs || 0} ms |\n` +
`| First contentful paint | ${page.timing.firstContentfulPaintMs || 0} ms |\n` +
`| Navigation transfer | ${page.timing.transferKb} KB |\n` +
`| Encoded body | ${page.timing.encodedBodyKb} KB |\n` +
`| Decoded body | ${page.timing.decodedBodyKb} KB |\n\n` +
`## Page structure snapshot\n\n` +
`| Metric | Value |\n| --- | ---: |\n` +
`| Scripts | ${page.counts.scripts} |\n` +
`| External scripts | ${page.counts.externalScripts} |\n` +
`| Inline scripts | ${page.counts.inlineScripts} |\n` +
`| Module scripts | ${page.counts.moduleScripts} |\n` +
`| Stylesheets | ${page.counts.stylesheets} |\n` +
`| Inline style blocks | ${page.counts.inlineStyles} |\n` +
`| Images | ${page.counts.images} |\n` +
`| Images missing alt | ${page.counts.imagesMissingAlt} |\n` +
`| Buttons / unlabeled buttons | ${page.counts.buttons} / ${page.counts.buttonsWithoutText} |\n` +
`| Inputs / unlabeled inputs | ${page.counts.inputs} / ${page.counts.inputsMissingLabels} |\n` +
`| Links / unlabeled links | ${page.counts.anchors} / ${page.counts.anchorsWithoutText} |\n` +
`| Forms | ${page.counts.forms} |\n` +
`| Custom elements | ${page.counts.customElements} |\n` +
`| localStorage key count | ${page.storageCounts.localStorageKeys} |\n` +
`| sessionStorage key count | ${page.storageCounts.sessionStorageKeys} |\n` +
`| Cookie string accessible | ${page.storageCounts.cookiesAccessible ? 'yes (value not captured)' : 'no / unavailable'} |\n\n` +
`## Document metadata\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Doctype | ${md(page.doctype || 'not captured')} |\n` +
`| Charset | ${md(page.charset || 'not captured')} |\n` +
`| Meta viewport | ${md(page.metaViewport || 'not captured')} |\n` +
`| Meta description | ${md(page.metaDescription || 'not captured')} |\n` +
`| Robots | ${md(page.robots || 'not captured')} |\n` +
`| CSP meta | ${md(page.cspMeta || 'not captured; check response headers with Ops Check')} |\n\n` +
`## Console messages captured by TAHAI Browser\n\n${consoleMarkdown(messages)}\n\n` +
`## Largest / slowest resource timing samples\n\n` +
`| Resource | Type | Transfer KB | Size KB | Duration ms |\n| --- | --- | ---: | ---: | ---: |\n${resourceMarkdown(page.resources)}\n` +
`## DevTools follow-up\n\n` +
`- [ ] Press F12 / DevTools and inspect Console for full stack traces\n` +
`- [ ] Check Network waterfall for blocked, redirected, or slow resources\n` +
`- [ ] Run Lighthouse or framework-specific profiling outside this source capture if needed\n` +
`- [ ] Attach build/deployment SHA, environment, and reproduction steps\n` +
`- [ ] Link this audit to the change ticket, bug report, or TAHAI IT Docs runbook\n\n` +
`## Developer ticket draft\n\n` +
`- Component / route:\n` +
`- Environment: production / staging / local / customer tenant\n` +
`- Observed issue:\n` +
`- Expected behavior:\n` +
`- Reproduction steps:\n` +
`- Suspected owner:\n` +
`- Fix / rollback notes:\n`;
}

function showDevAuditResult(message: string): void {
  devAuditResult.textContent = message;
  window.setTimeout(() => { devAuditResult.textContent = ''; }, 3400);
}

async function openDeveloperAudit(): Promise<void> {
  const tab = active();
  if (!tab) {
    setStatus('No active tab available for Developer Audit.');
    return;
  }
  setStatus('Running Developer Audit...', tab.title);
  devAuditSummary.innerHTML = '<article class="ops-card info"><strong>Auditing</strong><span>Collecting console signal, resource timing, and page quality signals…</span></article>';
  devAuditMarkdown.value = '';
  if (!devAuditDialog.open) devAuditDialog.showModal();
  try {
    const raw = await tab.webview.executeJavaScript(devAuditScript(), true) as Partial<DevAuditPage>;
    const page = normalizeDevAuditPage(raw, tab);
    const messages = tab.consoleMessages.slice(-90);
    const markdown = buildDeveloperAuditMarkdown(page, messages, tab);
    latestDevAudit = { markdown, sourceUrl: page.url || tab.url, page, consoleMessages: messages };
    renderDevAuditSummary(page, messages);
    devAuditMarkdown.value = markdown;
    devAuditMarkdown.focus();
    devAuditMarkdown.setSelectionRange(0, 0);
    setStatus('Developer Audit ready', 'Copy or save as Markdown for a bug report, PR, or runbook.');
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown Developer Audit error';
    devAuditSummary.innerHTML = `<article class="ops-card fail"><strong>Failed</strong><span>${escapeHtml(detail)}</span></article>`;
    setStatus('Developer Audit failed', detail);
  }
}



function profileKindLabel(kind: BrowserProfileKind): string {
  if (kind === 'google') return 'Google';
  if (kind === 'microsoft') return 'Microsoft';
  if (kind === 'work') return 'Work';
  if (kind === 'client') return 'Client';
  return 'Local';
}

function activeBrowserProfile(): BrowserProfileRecord | undefined {
  return browserProfileState?.activeProfile;
}

function showProfileResult(message: string): void {
  profileResult.textContent = message;
  window.setTimeout(() => { profileResult.textContent = ''; }, 3600);
}

function renderProfileBadge(): void {
  const profile = activeBrowserProfile();
  profileDot.style.background = profile?.color || '#77dbff';
  profileName.textContent = profile?.name || 'Default';
  profileSwitcherButton.title = profile ? `Active profile: ${profile.name} (${profileKindLabel(profile.kind)})` : 'Manage browser profiles';
}

function fillProfileForm(profile?: BrowserProfileRecord): void {
  editingProfileId = profile?.id || '';
  profileId.value = editingProfileId;
  profileLabel.value = profile?.name || '';
  profileKind.value = profile?.kind || 'local';
  profileColor.value = profile?.color || '#77dbff';
  deleteProfileButton.disabled = Boolean(profile?.isDefault || !profile);
  switchProfileButton.disabled = Boolean(!profile || profile.id === browserProfileState?.activeProfileId);
}

function renderProfileList(state: BrowserProfileState): void {
  profileStatus.textContent = `Active profile: ${state.activeProfile.name}. ${state.profiles.length} profile(s). Cookies, cache, auth cache, permissions, service workers, and local storage are partitioned per profile.`;
  profileList.innerHTML = state.profiles.map((profile) => {
    const selected = profile.id === editingProfileId ? ' selected' : '';
    const active = profile.id === state.activeProfileId ? ' active' : '';
    const defaultText = profile.isDefault ? ' · default' : '';
    return '<button class="profile-row' + selected + active + '" type="button" data-profile-id="' + escapeHtml(profile.id) + '">' +
      '<span class="profile-swatch" style="background:' + escapeHtml(profile.color) + '"></span>' +
      '<strong>' + escapeHtml(profile.name) + '</strong>' +
      '<small>' + escapeHtml(profileKindLabel(profile.kind)) + defaultText + ' · isolated storage' + '</small>' +
      '</button>';
  }).join('');
  renderProfileBadge();
}

async function refreshProfiles(selectId = editingProfileId): Promise<void> {
  browserProfileState = await window.tahaiBrowser.listProfiles();
  const selected = selectId
    ? browserProfileState.profiles.find((profile) => profile.id === selectId)
    : browserProfileState.activeProfile;
  fillProfileForm(selected || browserProfileState.activeProfile);
  renderProfileList(browserProfileState);
}

function closeAllTabsForProfileSwitch(): void {
  for (const tab of tabs.values()) {
    tab.button.remove();
    tab.webview.remove();
  }
  tabs.clear();
  activeTabId = '';
}

function reloadForActiveProfile(): void {
  closeAllTabsForProfileSwitch();
  createTab(config.startupUrl || config.homeUrl);
}

async function openProfileManager(): Promise<void> {
  closeToolMenus();
  if (!profileDialog.open) profileDialog.showModal();
  await refreshProfiles(browserProfileState?.activeProfileId);
}

async function createProfileDraft(kind: BrowserProfileKind): Promise<void> {
  if (!profileDialog.open) profileDialog.showModal();
  const label = kind === 'google' ? 'Google Profile' : kind === 'microsoft' ? 'Microsoft Profile' : kind === 'work' ? 'Work Profile' : kind === 'client' ? 'Client Profile' : 'Local Profile';
  browserProfileState = await window.tahaiBrowser.createProfile({ name: label, kind });
  fillProfileForm(browserProfileState.activeProfile);
  renderProfileList(browserProfileState);
  reloadForActiveProfile();
  showProfileResult(`${label} created and activated.`);
  setStatus('Profile created', `${browserProfileState.activeProfile.name} uses ${browserProfileState.activeProfile.partition}`);
}

async function saveProfileFromForm(): Promise<void> {
  if (!browserProfileState) await refreshProfiles();
  if (editingProfileId) {
    browserProfileState = await window.tahaiBrowser.updateProfile({ id: editingProfileId, name: profileLabel.value, kind: profileKind.value as BrowserProfileKind, color: profileColor.value });
    await refreshProfiles(editingProfileId);
    showProfileResult('Profile saved.');
    return;
  }
  browserProfileState = await window.tahaiBrowser.createProfile({ name: profileLabel.value, kind: profileKind.value as BrowserProfileKind, color: profileColor.value });
  fillProfileForm(browserProfileState.activeProfile);
  renderProfileList(browserProfileState);
  reloadForActiveProfile();
  showProfileResult('Profile created and activated.');
}

async function switchSelectedProfile(): Promise<void> {
  if (!editingProfileId) return;
  browserProfileState = await window.tahaiBrowser.setActiveProfile(editingProfileId);
  fillProfileForm(browserProfileState.activeProfile);
  renderProfileList(browserProfileState);
  reloadForActiveProfile();
  showProfileResult(`Switched to ${browserProfileState.activeProfile.name}.`);
  setStatus('Profile switched', `${browserProfileState.activeProfile.name} · ${profileKindLabel(browserProfileState.activeProfile.kind)}`);
}

async function deleteSelectedProfile(): Promise<void> {
  if (!editingProfileId) return;
  const selected = browserProfileState?.profiles.find((profile) => profile.id === editingProfileId);
  if (!selected || selected.isDefault) {
    showProfileResult('Default profile cannot be deleted.');
    return;
  }
  if (!window.confirm(`Delete profile "${selected.name}"? This removes it from TAHAI's profile list. Local partition data remains on disk until manually cleaned.`)) return;
  const wasActive = selected.id === browserProfileState?.activeProfileId;
  browserProfileState = await window.tahaiBrowser.deleteProfile(selected.id);
  fillProfileForm(browserProfileState.activeProfile);
  renderProfileList(browserProfileState);
  if (wasActive) reloadForActiveProfile();
  showProfileResult('Profile deleted from the list.');
}

async function clearSelectedProfileData(): Promise<void> {
  const profile = browserProfileState?.profiles.find((candidate) => candidate.id === editingProfileId) || browserProfileState?.activeProfile;
  if (!profile) return;
  if (!window.confirm(`Clear cookies, cache, auth cache, service workers, IndexedDB, localStorage, and other site data for profile "${profile.name}"?`)) return;
  const result = await window.tahaiBrowser.clearBrowsingData({ scope: 'selected-profile', profileId: profile.id });
  showProfileResult(result.ok ? `Cleared local browsing data for ${profile.name}.` : `Clear failed: ${result.error}`);
}

async function openActiveProfileData(): Promise<void> {
  const profile = browserProfileState?.profiles.find((candidate) => candidate.id === editingProfileId) || browserProfileState?.activeProfile;
  if (!profile) return;
  await window.tahaiBrowser.openProfileData(profile.id);
  showProfileResult('Opened profile data folder.');
}

function handleMenuCommand(command: string): void {
  if (command === 'new-tab') createTab(config.newTabUrl);
  if (command === 'close-tab') closeTab(activeTabId);
  if (command === 'settings') openSettings();
  if (command === 'command-palette') openCommandPalette();
  if (command === 'ops-hub') toggleOpsHub(true);
  if (command === 'mission-control') void openMissionControl();
  if (command === 'mission-add-tab') addActiveTabToMission();
  if (command === 'mission-make-quad') makeQuadFromOpenTabs();
  if (command === 'mission-quad') setMissionLayout('quad');
  if (command === 'mission-split') setMissionLayout('split-horizontal');
  if (command === 'shortcuts') openKeyboardShortcuts();
  if (command === 'save-workspace') void saveWorkspaceSnapshot();
  if (command === 'pin-evidence') void pinLatestEvidence();
  if (command === 'bundle') openChangeBundleComposer();
  if (command === 'handoff') openHandoffCenter('it-docs');
  if (command === 'ops-guard') openOpsGuardReview();
  if (command === 'handoff-psa') openHandoffCenter('psa');
  if (command === 'open-devops-menu') openToolMenu('devops');
  if (command === 'open-it-menu') openToolMenu('it');
  if (command === 'open-last-tool-menu') openLastToolMenu();
  if (command === 'profiles') void openProfileManager();
  if (command === 'new-google-profile') void createProfileDraft('google');
  if (command === 'new-microsoft-profile') void createProfileDraft('microsoft');
  if (command === 'open-active-profile-folder') void openActiveProfileData();
  if (command === 'focus-address') { addressInput.focus(); addressInput.select(); }
  if (command === 'back') goBackTarget();
  if (command === 'forward') goForwardTarget();
  if (command === 'home') navigate(settings.homeUrl || config.homeUrl);
  if (command === 'print') active()?.webview.print();
  if (command === 'reload') active()?.webview.reload();
  if (command === 'launchpad') navigate(config.newTabUrl);
  if (command === 'guide') navigate(config.onboardingUrl);
  if (command === 'about') navigate(config.aboutUrl);
  if (command === 'capture') void openDevOpsCapture();
  if (command === 'ops-check') void openOpsCheck();
  if (command === 'deploy') void openDeployReadiness();
  if (command === 'it-card') void openItServiceCard();
  if (command === 'endpoint') void openEndpointSnapshot();
  if (command === 'triage') void openSupportTriage();
  if (command === 'secret-boundary') openSecretBoundary();
  if (command === 'route-map') void openRouteMap();
  if (command === 'dev-audit') void openDeveloperAudit();
}


addressForm.addEventListener('submit', (event) => { event.preventDefault(); navigate(addressInput.value); });
backButton.addEventListener('click', goBackTarget);
forwardButton.addEventListener('click', goForwardTarget);
reloadButton.addEventListener('click', reloadTarget);
homeButton.addEventListener('click', () => navigate(settings.homeUrl || config.homeUrl));
launchpadButton.addEventListener('click', () => navigate(config.newTabUrl));
onboardingButton.addEventListener('click', () => navigate(config.onboardingUrl));
profileSwitcherButton.addEventListener('click', () => { void openProfileManager(); });
opsHubToggleButton.addEventListener('click', () => toggleOpsHub());
missionControlButton.addEventListener('click', () => { void openMissionControl(); });
closeOpsHubButton.addEventListener('click', () => toggleOpsHub(false));
opsHub.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest('button') as HTMLButtonElement | null;
  if (!button) return;
  const action = button.dataset.opsAction;
  if (action === 'command') openCommandPalette();
  if (action === 'mission') void openMissionControl();
  if (action === 'save-workspace') void saveWorkspaceSnapshot();
  if (action === 'pin-evidence') void pinLatestEvidence();
  if (action === 'bundle') openChangeBundleComposer();
  if (action === 'handoff') openHandoffCenter('it-docs');
    if (action === 'guard') openOpsGuardReview();
  if (action === 'shortcuts') openKeyboardShortcuts();
  if (button.dataset.recipeId) void openLaunchRecipe(button.dataset.recipeId);
  if (button.dataset.workspaceId) void restoreWorkspaceSnapshot(button.dataset.workspaceId);
  if (button.dataset.deleteWorkspaceId) deleteWorkspaceSnapshot(button.dataset.deleteWorkspaceId);
  if (button.dataset.copyEvidenceId) void copyEvidenceItem(button.dataset.copyEvidenceId);
  if (button.dataset.deleteEvidenceId) deleteEvidenceItem(button.dataset.deleteEvidenceId);
});
closeMissionButton.addEventListener('click', () => missionDialog.close());
missionForm.addEventListener('submit', (event) => { event.preventDefault(); createMissionFromForm(); });
missionCreateButton.addEventListener('click', () => createMissionFromForm());
missionAddActiveTabButton.addEventListener('click', () => addActiveTabToMission());
missionMakeQuadButton.addEventListener('click', () => makeQuadFromOpenTabs());
missionSaveButton.addEventListener('click', () => { void saveCurrentMission(); });
missionCopyExportButton.addEventListener('click', () => { void copyMissionExportPacket(); });
missionSaveExportButton.addEventListener('click', () => { void saveMissionExportPacket(); });
missionPinLatestEvidenceButton.addEventListener('click', () => pinLatestToolOutputToMission());
missionPinActivePageButton.addEventListener('click', () => pinActivePageToMission());
missionLayoutsEl.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const layoutButton = target.closest<HTMLButtonElement>('[data-mission-layout]');
  if (layoutButton?.dataset.missionLayout) setMissionLayout(layoutButton.dataset.missionLayout as MissionLayoutType);
  const paneButton = target.closest<HTMLButtonElement>('[data-send-active-pane]');
  if (paneButton?.dataset.sendActivePane) {
    const tab = active();
    if (tab) upsertBrowserTabIntoMissionPane(tab.id, paneButton.dataset.sendActivePane, { activateLayout: true });
  }
});
missionList.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return; if (button.dataset.loadMissionId) void loadMissionById(button.dataset.loadMissionId, 'preview'); if (button.dataset.restoreMissionId) void chooseAndRestoreMissionById(button.dataset.restoreMissionId); if (button.dataset.duplicateMissionId) void duplicateMissionById(button.dataset.duplicateMissionId); if (button.dataset.deleteMissionId) void deleteMissionById(button.dataset.deleteMissionId); });
missionEvidenceList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.copyMissionEvidence) void copyMissionEvidenceEntry(button.dataset.copyMissionEvidence);
  if (button.dataset.removeMissionEvidence) removeMissionEvidenceEntry(button.dataset.removeMissionEvidence);
});

missionRecipes.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-start-mission-recipe-id]'); if (button?.dataset.startMissionRecipeId) void startMissionFromRecipe(button.dataset.startMissionRecipeId); });
missionRunbookObjective.addEventListener('change', updateMissionRunbookFromFields);
missionRunbookRollback.addEventListener('change', updateMissionRunbookFromFields);
missionRunbookStepInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addMissionRunbookStep(); } });
missionRunbookAddStepButton.addEventListener('click', addMissionRunbookStep);
missionAddNoteButton.addEventListener('click', addMissionNote);
missionRunbookList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.cycleRunbookStep) cycleMissionRunbookStep(button.dataset.cycleRunbookStep);
  if (button.dataset.removeRunbookStep) removeMissionRunbookStep(button.dataset.removeRunbookStep);
});
missionTabsList.addEventListener('click', (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || !currentMission) return; if (button.dataset.focusMissionTab) { const runtimeTabId = missionRuntimeTabs.get(button.dataset.focusMissionTab); if (runtimeTabId) setActive(runtimeTabId); } if (button.dataset.paneMissionTab) { const tab = currentMission.tabs.find((candidate) => candidate.tabId === button.dataset.paneMissionTab); if (tab) { const currentIndex = missionPaneIds.indexOf(tab.paneId as typeof missionPaneIds[number]); moveMissionTabToPane(tab.tabId, missionPaneIds[(currentIndex + 1) % missionPaneIds.length]); } } if (button.dataset.pinMissionTab) toggleMissionTabPin(button.dataset.pinMissionTab); if (button.dataset.removeMissionTab) removeMissionTab(button.dataset.removeMissionTab); });
missionTabsList.addEventListener('dragstart', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-mission-tab]');
  if (!row || !event.dataTransfer) return;
  missionTabsListDragTabId = row.dataset.dragMissionTab || '';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-tahai-mission-tab-id', missionTabsListDragTabId);
  row.classList.add('dragging');
});
missionTabsList.addEventListener('dragend', (event) => {
  missionTabsListDragTabId = '';
  (event.target as HTMLElement).closest<HTMLElement>('[data-drag-mission-tab]')?.classList.remove('dragging');
  missionTabsList.querySelectorAll('.drag-over').forEach((element) => element.classList.remove('drag-over'));
});
missionTabsList.addEventListener('dragover', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-mission-tab]');
  if (!row || !missionTabsListDragTabId) return;
  event.preventDefault();
  row.classList.add('drag-over');
});
missionTabsList.addEventListener('dragleave', (event) => {
  (event.target as HTMLElement).closest<HTMLElement>('[data-drag-mission-tab]')?.classList.remove('drag-over');
});
missionTabsList.addEventListener('drop', (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-mission-tab]');
  if (!row || !currentMission || !missionTabsListDragTabId) return;
  event.preventDefault();
  row.classList.remove('drag-over');
  const fromIndex = currentMission.tabs.findIndex((tab) => tab.tabId === missionTabsListDragTabId);
  const toIndex = currentMission.tabs.findIndex((tab) => tab.tabId === row.dataset.dragMissionTab);
  if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
    const [moved] = currentMission.tabs.splice(fromIndex, 1);
    currentMission.tabs.splice(toIndex, 0, moved);
    missionTimelineEvent('layout-set', 'Mission tab order changed', moved.title);
    renderMissionControl();
  }
});
missionTabsList.addEventListener('change', (event) => { const select = (event.target as HTMLElement).closest<HTMLSelectElement>('select[data-role-mission-tab]'); if (!select || !currentMission) return; const tab = currentMission.tabs.find((candidate) => candidate.tabId === select.dataset.roleMissionTab); if (tab && missionTabRoles.includes(select.value as MissionTabRole)) { tab.role = select.value as MissionTabRole; syncMissionLayoutPanes(); missionTimelineEvent('tab-role-set', tab.title, tab.role); renderMissionControl(); } });
closeCommandPaletteButton.addEventListener('click', () => commandPaletteDialog.close());
commandPaletteInput.addEventListener('input', () => { commandPaletteIndex = 0; renderCommandPalette(); });
commandPaletteList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.command-row');
  if (!button) return;
  runCommandPaletteAction(Number(button.dataset.commandIndex || '0'));
});
commandPaletteDialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') { event.preventDefault(); moveCommandPalette(1); }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveCommandPalette(-1); }
  if (event.key === 'Enter') { event.preventDefault(); runCommandPaletteAction(); }
  if (event.key === 'Escape') commandPaletteDialog.close();
});
closeShortcutsButton.addEventListener('click', () => shortcutDialog.close());
devopsToolsButton.addEventListener('click', (event) => { event.stopPropagation(); toggleToolMenu('devops'); });
itToolsButton.addEventListener('click', (event) => { event.stopPropagation(); toggleToolMenu('it'); });
devopsToolsButton.addEventListener('keydown', (event) => handleToolMenuButtonKeyboard('devops', event));
itToolsButton.addEventListener('keydown', (event) => handleToolMenuButtonKeyboard('it', event));
devopsToolsPanel.addEventListener('click', (event) => event.stopPropagation());
itToolsPanel.addEventListener('click', (event) => event.stopPropagation());
devopsToolsPanel.addEventListener('keydown', (event) => handleToolMenuKeyboard('devops', event));
itToolsPanel.addEventListener('keydown', (event) => handleToolMenuKeyboard('it', event));
settingsButton.addEventListener('click', () => { closeToolMenus(); openSettings(); });
captureButton.addEventListener('click', () => runToolFromMenu(openDevOpsCapture));
opsCheckButton.addEventListener('click', () => runToolFromMenu(openOpsCheck));
deployButton.addEventListener('click', () => runToolFromMenu(openDeployReadiness));
itCardButton.addEventListener('click', () => runToolFromMenu(openItServiceCard));
endpointButton.addEventListener('click', () => runToolFromMenu(openEndpointSnapshot));
triageButton.addEventListener('click', () => runToolFromMenu(openSupportTriage));
secretBoundaryButton.addEventListener('click', () => runToolFromMenu(openSecretBoundary));
routeMapButton.addEventListener('click', () => runToolFromMenu(openRouteMap));
devAuditButton.addEventListener('click', () => runToolFromMenu(openDeveloperAudit));
opsGuardButton.addEventListener('click', () => runToolFromMenu(openOpsGuardReview));
devtoolsButton.addEventListener('click', () => runToolFromMenu(toggleActiveDevTools));
aboutButton.addEventListener('click', () => { closeToolMenus(); navigate(config.aboutUrl); });
newTabButton.addEventListener('click', () => { closeToolMenus(); createTab(config.newTabUrl); });
document.addEventListener('click', () => closeToolMenus());
window.addEventListener('tahai-browser:start-mission-from-bookmark-folder', (event) => {
  const detail = (event as CustomEvent<BookmarkFolderMissionDetail>).detail || {};
  void startMissionFromBookmarkFolder(detail);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeToolMenus();
});
closeSettingsButton.addEventListener('click', () => settingsDialog.close());
closeProfileButton.addEventListener('click', () => profileDialog.close());
newLocalProfileButton.addEventListener('click', () => { void createProfileDraft('local'); });
newGoogleProfileButton.addEventListener('click', () => { void createProfileDraft('google'); });
newMicrosoftProfileButton.addEventListener('click', () => { void createProfileDraft('microsoft'); });
profileList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-profile-id]');
  if (!button || !browserProfileState) return;
  const profile = browserProfileState.profiles.find((candidate) => candidate.id === button.dataset.profileId);
  fillProfileForm(profile);
  renderProfileList(browserProfileState);
});
profileForm.addEventListener('submit', (event) => { event.preventDefault(); void saveProfileFromForm(); });
switchProfileButton.addEventListener('click', () => { void switchSelectedProfile(); });
deleteProfileButton.addEventListener('click', () => { void deleteSelectedProfile(); });
clearSelectedProfileDataButton.addEventListener('click', () => { void clearSelectedProfileData(); });
openActiveProfileDataButton.addEventListener('click', () => { void openActiveProfileData(); });
openProfileButton.addEventListener('click', async () => { await window.tahaiBrowser.openUserData(); showSettingsResult('Opened app profile folder.'); });
closeCaptureButton.addEventListener('click', () => captureDialog.close());
closeOpsButton.addEventListener('click', () => opsDialog.close());
closeDeployButton.addEventListener('click', () => deployDialog.close());
closeItCardButton.addEventListener('click', () => itCardDialog.close());
closeEndpointButton.addEventListener('click', () => endpointDialog.close());
closeTriageButton.addEventListener('click', () => triageDialog.close());
copyCaptureButton.addEventListener('click', async () => {
  const markdown = captureMarkdown.value.trim() || latestCapture?.markdown || '';
  if (!markdown) { showCaptureResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showCaptureResult(copied ? 'Copied Markdown.' : 'Copy failed.');
});
saveCaptureButton.addEventListener('click', async () => {
  const markdown = captureMarkdown.value.trim() || latestCapture?.markdown || '';
  if (!markdown) { showCaptureResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestCapture?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showCaptureResult(`Saved ${result.path}`); setStatus('DevOps evidence note saved', result.path); }
  else if (result.canceled) showCaptureResult('Save cancelled.');
  else showCaptureResult('Save failed.');
});
copyOpsButton.addEventListener('click', async () => {
  const markdown = opsMarkdown.value.trim() || latestOpsCheck?.markdown || '';
  if (!markdown) { showOpsResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showOpsResult(copied ? 'Copied Ops Check report.' : 'Copy failed.');
});
saveOpsButton.addEventListener('click', async () => {
  const markdown = opsMarkdown.value.trim() || latestOpsCheck?.markdown || '';
  if (!markdown) { showOpsResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestOpsCheck?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showOpsResult(`Saved ${result.path}`); setStatus('URL Ops Check saved', result.path); }
  else if (result.canceled) showOpsResult('Save cancelled.');
  else showOpsResult('Save failed.');
});
copyDeployButton.addEventListener('click', async () => {
  const markdown = deployMarkdown.value.trim() || latestDeployReadiness?.markdown || '';
  if (!markdown) { showDeployResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showDeployResult(copied ? 'Copied Deploy Readiness report.' : 'Copy failed.');
});
saveDeployButton.addEventListener('click', async () => {
  const markdown = deployMarkdown.value.trim() || latestDeployReadiness?.markdown || '';
  if (!markdown) { showDeployResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestDeployReadiness?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showDeployResult(`Saved ${result.path}`); setStatus('Deploy Readiness report saved', result.path); }
  else if (result.canceled) showDeployResult('Save cancelled.');
  else showDeployResult('Save failed.');
});
copyItCardButton.addEventListener('click', async () => {
  const markdown = itCardMarkdown.value.trim() || latestItCard?.markdown || '';
  if (!markdown) { showItCardResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showItCardResult(copied ? 'Copied IT Service Card.' : 'Copy failed.');
});
saveItCardButton.addEventListener('click', async () => {
  const markdown = itCardMarkdown.value.trim() || latestItCard?.markdown || '';
  if (!markdown) { showItCardResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestItCard?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showItCardResult(`Saved ${result.path}`); setStatus('IT Service Card saved', result.path); }
  else if (result.canceled) showItCardResult('Save cancelled.');
  else showItCardResult('Save failed.');
});
copyEndpointButton.addEventListener('click', async () => {
  const markdown = endpointMarkdown.value.trim() || latestEndpoint?.markdown || '';
  if (!markdown) { showEndpointResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showEndpointResult(copied ? 'Copied Endpoint Snapshot.' : 'Copy failed.');
});
saveEndpointButton.addEventListener('click', async () => {
  const markdown = endpointMarkdown.value.trim() || latestEndpoint?.markdown || '';
  if (!markdown) { showEndpointResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestEndpoint?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showEndpointResult(`Saved ${result.path}`); setStatus('Endpoint Snapshot saved', result.path); }
  else if (result.canceled) showEndpointResult('Save cancelled.');
  else showEndpointResult('Save failed.');
});
copyTriageButton.addEventListener('click', async () => {
  const markdown = triageMarkdown.value.trim() || latestTriage?.markdown || '';
  if (!markdown) { showTriageResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showTriageResult(copied ? 'Copied Support Triage packet.' : 'Copy failed.');
});
saveTriageButton.addEventListener('click', async () => {
  const markdown = triageMarkdown.value.trim() || latestTriage?.markdown || '';
  if (!markdown) { showTriageResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestTriage?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showTriageResult(`Saved ${result.path}`); setStatus('Support Triage packet saved', result.path); }
  else if (result.canceled) showTriageResult('Save cancelled.');
  else showTriageResult('Save failed.');
});
copyRouteMapButton.addEventListener('click', async () => {
  const markdown = routeMapMarkdown.value.trim() || latestRouteMap?.markdown || '';
  if (!markdown) { showRouteMapResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showRouteMapResult(copied ? 'Copied Route Map.' : 'Copy failed.');
});
saveRouteMapButton.addEventListener('click', async () => {
  const markdown = routeMapMarkdown.value.trim() || latestRouteMap?.markdown || '';
  if (!markdown) { showRouteMapResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestRouteMap?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showRouteMapResult(`Saved ${result.path}`); setStatus('Route Map saved', result.path); }
  else if (result.canceled) showRouteMapResult('Save cancelled.');
  else showRouteMapResult('Save failed.');
});
copyDevAuditButton.addEventListener('click', async () => {
  const markdown = devAuditMarkdown.value.trim() || latestDevAudit?.markdown || '';
  if (!markdown) { showDevAuditResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showDevAuditResult(copied ? 'Copied Developer Audit.' : 'Copy failed.');
});
saveDevAuditButton.addEventListener('click', async () => {
  const markdown = devAuditMarkdown.value.trim() || latestDevAudit?.markdown || '';
  if (!markdown) { showDevAuditResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestDevAudit?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showDevAuditResult(`Saved ${result.path}`); setStatus('Developer Audit saved', result.path); }
  else if (result.canceled) showDevAuditResult('Save cancelled.');
  else showDevAuditResult('Save failed.');
});
closeBundleButton.addEventListener('click', () => bundleDialog.close());
copyBundleButton.addEventListener('click', async () => {
  const markdown = bundleMarkdown.value.trim() || latestChangeBundle?.markdown || '';
  if (!markdown) { showBundleResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showBundleResult(copied ? 'Copied evidence/change bundle.' : 'Copy failed.');
});
saveBundleButton.addEventListener('click', async () => {
  const markdown = bundleMarkdown.value.trim() || latestChangeBundle?.markdown || '';
  if (!markdown) { showBundleResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestChangeBundle?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showBundleResult(`Saved ${result.path}`); setStatus('Evidence / Change Bundle saved', result.path); }
  else if (result.canceled) showBundleResult('Save cancelled.');
  else showBundleResult('Save failed.');
});
closeHandoffButton.addEventListener('click', () => handoffDialog.close());
handoffTargetButtons.forEach((button) => {
  button.addEventListener('click', () => setHandoffTarget(button.dataset.handoffTarget === 'psa' ? 'psa' : 'it-docs'));
});
copyHandoffButton.addEventListener('click', async () => {
  const markdown = handoffMarkdown.value.trim() || latestOperationalHandoff?.markdown || '';
  if (!markdown) { showHandoffResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showHandoffResult(copied ? 'Copied operational handoff.' : 'Copy failed.');
});
saveHandoffButton.addEventListener('click', async () => {
  const markdown = handoffMarkdown.value.trim() || latestOperationalHandoff?.markdown || '';
  if (!markdown) { showHandoffResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, latestOperationalHandoff?.sourceUrl || active()?.url || config.homeUrl);
  if (result.saved) { showHandoffResult(`Saved ${result.path}`); setStatus('Operational handoff saved', result.path); }
  else if (result.canceled) showHandoffResult('Save cancelled.');
  else showHandoffResult('Save failed.');
});
refreshItDocsCapabilitiesButton.addEventListener('click', async () => {
  const capabilities = await refreshItDocsCapabilityState();
  showHandoffResult(capabilities?.signedIn ? 'IT Docs contract refreshed.' : capabilities?.message || 'IT Docs local-only.');
});
copyItDocsCapabilitiesButton.addEventListener('click', async () => {
  const copied = await window.tahaiBrowser.copyItDocsCapabilities();
  showHandoffResult(copied ? 'Copied IT Docs contract state.' : 'Copy failed.');
});
copyPsaReferenceContractButton.addEventListener('click', async () => {
  const copied = await window.tahaiBrowser.copyPsaReferenceContract();
  showHandoffResult(copied ? 'Copied PSA reference contract.' : 'Copy failed.');
});
openItDocsFromHandoffButton.addEventListener('click', async () => {
  const opened = await window.tahaiBrowser.openItDocs();
  if (!opened) void openLaunchRecipe('tahai-it-docs');
});
openPsaFromHandoffButton.addEventListener('click', () => { void openLaunchRecipe('tahai-psa'); });
closeOpsGuardButton.addEventListener('click', () => opsGuardDialog.close());
copyOpsGuardButton.addEventListener('click', async () => {
  const markdown = opsGuardMarkdown.value.trim() || latestOpsGuard?.markdown || '';
  if (!markdown) { showOpsGuardResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showOpsGuardResult(copied ? 'Copied Ops Guard review.' : 'Copy failed.');
});
copyOpsGuardRedactedButton.addEventListener('click', async () => {
  const markdown = opsGuardRedacted.value.trim() || latestOpsGuard?.redactedMarkdown || '';
  if (!markdown) { showOpsGuardResult('Nothing to copy.'); return; }
  const copied = await window.tahaiBrowser.copyDevOpsCapture(markdown);
  showOpsGuardResult(copied ? 'Copied redacted sharing copy.' : 'Copy failed.');
});
saveOpsGuardButton.addEventListener('click', async () => {
  const markdown = opsGuardMarkdown.value.trim() || latestOpsGuard?.markdown || '';
  if (!markdown) { showOpsGuardResult('Nothing to save.'); return; }
  const result = await window.tahaiBrowser.saveDevOpsCapture(markdown, currentActiveUrl());
  if (result.saved) { showOpsGuardResult(`Saved ${result.path}`); setStatus('Ops Guard review saved', result.path); }
  else if (result.canceled) showOpsGuardResult('Save cancelled.');
  else showOpsGuardResult('Save failed.');
});
clearDataButton.addEventListener('click', async () => {
  const profile = browserProfileState?.activeProfile || (await window.tahaiBrowser.listProfiles()).activeProfile;
  if (!window.confirm(`Clear cookies, cache, auth cache, service workers, IndexedDB, localStorage, and other site data for active profile "${profile.name}"?`)) return;
  const result = await window.tahaiBrowser.clearBrowsingData({ scope: 'active-profile' });
  showSettingsResult(result.ok ? `Cleared ${profile.name} profile data.` : `Clear failed: ${result.error}`);
});
clearAllDataButton.addEventListener('click', async () => {
  if (!window.confirm('Clear cookies, cache, auth cache, service workers, IndexedDB, localStorage, and other site data for ALL TAHAI browser profiles?')) return;
  const result = await window.tahaiBrowser.clearBrowsingData({ scope: 'all-profiles' });
  showSettingsResult(result.ok ? `Cleared ${result.clearedProfileIds.length} profile(s).` : `Clear failed: ${result.error}`);
});
resetSettingsButton.addEventListener('click', async () => {
  settings = await window.tahaiBrowser.resetSettings();
  populateSettingsForm();
  applyUiSettings();
  showSettingsResult('Settings reset.');
});
settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  settings = await window.tahaiBrowser.updateSettings(settingsFromForm());
  config.homeUrl = settings.homeUrl;
  populateSettingsForm();
  applyUiSettings();
  showSettingsResult('Settings saved.');
});

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommandPalette(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'h') { event.preventDefault(); toggleOpsHub(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'm') { event.preventDefault(); void openMissionControl(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); void openMissionControl(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'q') { event.preventDefault(); setMissionLayout('quad'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); setMissionLayout('split-horizontal'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'f') { event.preventDefault(); toggleMissionFocusPane(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'b') { event.preventDefault(); openChangeBundleComposer(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'y') { event.preventDefault(); openHandoffCenter('it-docs'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'g') { event.preventDefault(); openOpsGuardReview(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'o') { event.preventDefault(); openToolMenu('devops'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'd') { event.preventDefault(); void startMissionFromRecipe('deploy-cockpit'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'w') { event.preventDefault(); void startMissionFromRecipe('aws-release-cockpit'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'c') { event.preventDefault(); void startMissionFromRecipe('dns-migration-cockpit'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'j') { event.preventDefault(); void startMissionFromRecipe('github-actions-monitor'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'v') { event.preventDefault(); void startMissionFromRecipe('vercel-firebase-release'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'u') { event.preventDefault(); void startMissionFromRecipe('azure-release-cockpit'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === '5') { event.preventDefault(); void startMissionFromRecipe('m365-change-cockpit'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'i') { event.preventDefault(); openToolMenu('it'); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'l') { event.preventDefault(); openLastToolMenu(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && ['1','2','3','4'].includes(event.key)) { event.preventDefault(); setMissionActivePane('pane-' + event.key); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key === 'ArrowLeft') { event.preventDefault(); swapActiveMissionPane(-1); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key === 'ArrowRight') { event.preventDefault(); swapActiveMissionPane(1); }
  if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); addressInput.focus(); addressInput.select(); }
  if (event.ctrlKey && event.key.toLowerCase() === 'r') { event.preventDefault(); reloadTarget(); }
  if (event.ctrlKey && event.key.toLowerCase() === 't') { event.preventDefault(); createTab(config.newTabUrl); }
  if (event.ctrlKey && event.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(activeTabId); }
  if (event.ctrlKey && event.key === ',') { event.preventDefault(); openSettings(); }
  if (event.ctrlKey && event.key === '/') { event.preventDefault(); openKeyboardShortcuts(); }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); void openProfileManager(); }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') { event.preventDefault(); void openDevOpsCapture(); }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); void openOpsCheck(); }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') { event.preventDefault(); void openItServiceCard(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'e') { event.preventDefault(); void openEndpointSnapshot(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 't') { event.preventDefault(); void openSupportTriage(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openSecretBoundary(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'p') { event.preventDefault(); void openRouteMap(); }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'a') { event.preventDefault(); void openDeveloperAudit(); }
  if ((event.key === 'F12') || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i')) { event.preventDefault(); toggleActiveDevTools(); }
  if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); goBackTarget(); }
  if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); goForwardTarget(); }
});

if (window.tahaiBrowser) {
  window.tahaiBrowser.onOpenInTab((url) => createTab(url));
  window.tahaiBrowser.onMenuCommand((command) => handleMenuCommand(command));
  window.tahaiBrowser.onToggleDevTools(() => toggleActiveDevTools());
  window.tahaiBrowser.onDownloadState((state) => {
    const detail = state.path ? `${state.filename} → ${state.path}` : state.filename;
    setStatus(`Download ${state.state}`, detail);
  });
} else {
  showBootDiagnostic('Preload bridge missing. Browser shell loaded in fallback mode; rebuild after npm run build and confirm dist/preload/preload.js exists.');
}

loadBrowserConfigWithRuntimeFallback().then((loaded) => {
  config = loaded;
  settings = loaded.settings;
  browserProfileState = loaded.profiles;
  document.title = config.productName;
  applyUiSettings();
  renderProfileBadge();
  renderOpsHub();
  void refreshMissionStore();
  createTab(config.startupUrl || config.homeUrl);
  markRendererShellReady();
}).catch((error) => {
  showBootDiagnostic(`Preload/config bridge failed; using fallback config. ${error instanceof Error ? error.message : String(error || '')}`);
  config = fallbackBrowserConfig();
  settings = config.settings;
  browserProfileState = config.profiles;
  document.title = config.productName;
  applyUiSettings();
  renderProfileBadge();
  renderOpsHub();
  createTab(config.homeUrl);
  markRendererShellReady();
});
