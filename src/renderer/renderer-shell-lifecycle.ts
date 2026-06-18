import type { TahaiBrowserConfig, TahaiBrowserSettings } from '../preload/preload';
import { RUNTIME_E2E_HARNESS_CONTRACT_ID, runtimeE2eHarnessSummary } from '../shared/runtime-e2e-harness-contract';
import { firstRunOperatorWalkthroughState } from '../shared/first-run-operator-walkthrough';

export type RendererBrowserConfig = TahaiBrowserConfig;
export type RendererBrowserSettings = TahaiBrowserSettings;

export const PASS161_RENDERER_LIFECYCLE_MODULE = 'renderer-shell-lifecycle-pass161';

export function showBootDiagnostic(detail: string): void {
  const panel = document.getElementById('boot-diagnostic');
  const detailEl = document.getElementById('boot-diagnostic-detail');
  if (detailEl) detailEl.textContent = detail;
  if (panel) panel.removeAttribute('hidden');
}

export function markRendererShellReady(): void {
  document.documentElement.dataset.tahaiShellReady = '1';
  document.body.dataset.pass158RuntimeE2eHarness = RUNTIME_E2E_HARNESS_CONTRACT_ID;
  document.body.dataset.pass158RuntimeE2eHarnessSummary = runtimeE2eHarnessSummary();
  document.body.dataset.pass161RendererLifecycleModule = PASS161_RENDERER_LIFECYCLE_MODULE;
  void window.tahaiBrowser?.notifyRendererReady?.().catch(() => undefined);
  window.dispatchEvent(new CustomEvent('tahai-renderer-ready'));
  const panel = document.getElementById('boot-diagnostic');
  if (panel) panel.setAttribute('hidden', 'true');
}

export function fallbackBrowserConfig(): RendererBrowserConfig {
  const fallbackSettings: RendererBrowserSettings = {
    homeUrl: 'https://tahaiportal.com',
    startup: 'home',
    searchProvider: 'google',
    permissions: { allowClipboardRead: false, allowMedia: true, allowGeolocation: false, allowNotifications: false },
    downloads: { askEveryTime: true, defaultDirectory: '', defaultDirectoryLabel: 'System Downloads folder', hasCustomDirectory: false, blockInsecureDownloads: true },
    ui: {
      showStatusBar: true,
      openExternalLinksInNewTab: true,
      allowPopupsAsTabs: true,
      defaultZoomPercent: 100,
      launchToMaximized: false,
      confirmBeforeClosingMultipleTabs: false,
      surfaceMode: 'tahai-workbench',
      showWorkbenchTools: true
    },
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
    releasePass: 'fallback',
    updateChannel: 'fallback',
    updatePolicy: 'Fallback config only. Runtime release truth unavailable until preload/config bridge responds.',
    signingStatus: 'Unknown in fallback config.',
    releaseTruth: { productName: 'TAHAI Web Services Browser', bundleName: 'TAHAI—SENTINEL Browser', version: '0.0.0', releasePass: 'fallback', releaseChannel: 'fallback', releasePhase: 'fallback', updateChannel: 'fallback', updatePolicy: 'Fallback config only. Runtime release truth unavailable until preload/config bridge responds.', signingStatus: 'Unknown in fallback config.', downloadOrigin: 'https://browser.tahai.net', downloadAliasOrigin: 'https://browser.tahaiportal.com', publicRepoUrl: 'https://github.com/JTAHAI/tahai-web-services-browser' },
    firstLaunch: { product: 'TAHAI Web Services Browser', defaultHome: 'https://tahaiportal.com', initializedAt: '', sourceGuardrails: [], operatorWalkthrough: firstRunOperatorWalkthroughState() },
    userDataLabel: 'Filesystem paths hidden.',
    settingsLabel: 'Filesystem paths hidden.',
    settings: fallbackSettings,
    adminPolicy: {
      pass: 'PASS154',
      contractId: 'enterprise-admin-policy-framework-v1',
      schemaVersion: 1,
      managed: false,
      sourceKind: 'none',
      sourceLabel: 'local-default',
      loadedAt: '',
      errors: [],
      warnings: [],
      policy: {
        schemaVersion: 1,
        policyId: 'local-default',
        policyName: 'Local default policy',
        managedBy: 'local-user',
        lockedSettings: {},
        disabledTools: [],
        allowedProtocols: ['https:', 'http:'],
        blockedProtocols: ['javascript:', 'data:', 'vbscript:', 'file:'],
        allowedDomains: [],
        blockedDomains: [],
        downloads: { allowedDirectories: [], blockExternalHttpDownloads: true },
        missionExport: { mode: 'allowed', requireRedactionPreview: true },
        evidenceExport: { mode: 'sanitized-only', requireRedactionPreview: true },
        supportBundle: { mode: 'sanitized-only', includePolicyTruth: true },
        update: { channel: 'manual-release', allowSilentAutoUpdate: false }
      }
    },
    adminPolicySummary: 'PASS154 enterprise-admin-policy-framework-v1 fallback: managed=false; source=none;',
    enterpriseSupportBundlePass: 'PASS160',
    runtimeControl: {
      runtimeE2e: false,
      runtimeE2eQuit: true,
      diagnostics: false,
      resultPath: '',
      runId: ''
    },
    profiles: {
      activeProfileId: 'default',
      activeProfile: { id: 'default', name: 'Default', kind: 'local', color: '#77dbff', partition: 'persist:tahai-profile-default', createdAt: '', updatedAt: '', lastUsedAt: '', isDefault: true },
      profiles: [{ id: 'default', name: 'Default', kind: 'local', color: '#77dbff', partition: 'persist:tahai-profile-default', createdAt: '', updatedAt: '', lastUsedAt: '', isDefault: true }],
      storageLabel: 'Filesystem paths hidden.'
    }
  };
}

export function loadBrowserConfigWithRuntimeFallback(timeoutMs = 4500): Promise<RendererBrowserConfig> {
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
