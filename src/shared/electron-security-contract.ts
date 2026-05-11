export type TahaiElectronSecurityBoolean = true | false;

export const TAHAI_ELECTRON_SECURITY_PASS = 'PASS142' as const;

export const TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: true
});

export const TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES = 'contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=yes,devTools=yes' as const;

export const TAHAI_BLOCKED_RUNTIME_PROTOCOLS = Object.freeze([
  'ftp:',
  'gopher:',
  'javascript:',
  'data:',
  'vbscript:'
] as const);

export const TAHAI_TRUSTED_IPC_CHANNELS = Object.freeze([
  'tahai-browser:get-config',
  'tahai-browser:get-admin-policy',
  'tahai-browser:preview-enterprise-support-bundle',
  'tahai-browser:copy-enterprise-support-bundle',
  'tahai-browser:save-enterprise-support-bundle',
  'tahai-browser:get-settings',
  'tahai-browser:update-settings',
  'tahai-browser:reset-settings',
  'tahai-browser:clear-browsing-data',
  'tahai-browser:open-user-data',
  'tahai-browser:open-external',
  'tahai-browser:open-itdocs',
  'tahai-browser:get-itdocs-capabilities',
  'tahai-browser:copy-itdocs-capabilities',
  'tahai-browser:copy-psa-reference-contract',
  'tahai-browser:copy-devops-capture',
  'tahai-browser:save-devops-capture',
  'tahai-browser:run-url-diagnostics',
  'tahai-browser:run-it-service-card-diagnostics',
  'tahai-browser:list-profiles',
  'tahai-browser:create-profile',
  'tahai-browser:update-profile',
  'tahai-browser:set-active-profile',
  'tahai-browser:delete-profile',
  'tahai-browser:open-profile-data',
  'tahai-browser:list-missions',
  'tahai-browser:load-mission',
  'tahai-browser:save-mission',
  'tahai-browser:delete-mission',
  'tahai-browser:preview-mission-export',
  'tahai-browser:copy-mission-export',
  'tahai-browser:save-mission-export'
] as const);

export const TAHAI_TRUSTED_RENDERER_EVENT_CHANNELS = Object.freeze([
  'tahai-browser:open-in-tab',
  'tahai-browser:menu-command',
  'tahai-browser:toggle-devtools',
  'tahai-browser:download-state'
] as const);

export type TahaiTrustedIpcChannel = typeof TAHAI_TRUSTED_IPC_CHANNELS[number];
export type TahaiTrustedRendererEventChannel = typeof TAHAI_TRUSTED_RENDERER_EVENT_CHANNELS[number];

export function isTrustedTahaiIpcChannel(channel: unknown): channel is TahaiTrustedIpcChannel {
  return typeof channel === 'string' && (TAHAI_TRUSTED_IPC_CHANNELS as readonly string[]).includes(channel);
}

export function isTrustedTahaiRendererEventChannel(channel: unknown): channel is TahaiTrustedRendererEventChannel {
  return typeof channel === 'string' && (TAHAI_TRUSTED_RENDERER_EVENT_CHANNELS as readonly string[]).includes(channel);
}

export function normalizeTahaiWebviewPreferences(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES;
  const lower = raw.toLowerCase();
  const required = [
    'contextisolation=yes',
    'nodeintegration=no',
    'sandbox=yes'
  ];
  return required.every((token) => lower.includes(token)) ? raw : TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES;
}

export function electronSecuritySummary(): string[] {
  return [
    `securityPass=${TAHAI_ELECTRON_SECURITY_PASS}`,
    'browserWindow=contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false',
    `webview=${TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES}`,
    `blockedProtocols=${TAHAI_BLOCKED_RUNTIME_PROTOCOLS.join(',')}`,
    `trustedIpcChannels=${TAHAI_TRUSTED_IPC_CHANNELS.length}`,
    `rendererEventChannels=${TAHAI_TRUSTED_RENDERER_EVENT_CHANNELS.length}`
  ];
}
