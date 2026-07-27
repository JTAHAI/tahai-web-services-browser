/**
 * PASS339 — Chromium Daily Driver Core Parity Runtime
 *
 * Contract defining which Chromium daily-driver behaviors are implemented,
 * partially implemented, planned, or blocked with honest reasons.
 *
 * No fake claims. Every behavior is marked accurately.
 */

export const PASS339_DAILY_DRIVER_PASS = 'PASS339';
export const DAILY_DRIVER_PARITY_CONTRACT_ID = 'chromium-daily-driver-core-parity-v1';

export type DailyDriverBehaviorStatus =
  | 'implemented'
  | 'partially-implemented'
  | 'planned'
  | 'blocked';

export type DailyDriverBehavior = {
  id: string;
  label: string;
  description: string;
  status: DailyDriverBehaviorStatus;
  shortcut?: string;
  domId?: string;
  blockedReason?: string;
};

export const DAILY_DRIVER_BEHAVIORS: DailyDriverBehavior[] = [
  {
    id: 'new-tab',
    label: 'New Tab',
    description: 'Open a new tab with the profile-aware new tab page.',
    status: 'implemented',
    shortcut: 'Ctrl+T',
    domId: 'new-tab',
  },
  {
    id: 'close-tab',
    label: 'Close Tab',
    description: 'Close the active tab.',
    status: 'implemented',
    shortcut: 'Ctrl+W',
  },
  {
    id: 'duplicate-tab',
    label: 'Duplicate Tab',
    description: 'Open a new tab with the same URL as the active tab.',
    status: 'implemented',
  },
  {
    id: 'reopen-closed-tab',
    label: 'Reopen Closed Tab',
    description: 'Reopen the most recently closed tab from the recently-closed list.',
    status: 'implemented',
    shortcut: 'Ctrl+Shift+T',
  },
  {
    id: 'back',
    label: 'Navigate Back',
    description: 'Navigate the active tab back in history.',
    status: 'implemented',
    shortcut: 'Alt+Left',
    domId: 'back',
  },
  {
    id: 'forward',
    label: 'Navigate Forward',
    description: 'Navigate the active tab forward in history.',
    status: 'implemented',
    shortcut: 'Alt+Right',
    domId: 'forward',
  },
  {
    id: 'mouse-back-forward',
    label: 'Mouse Button 4/5 (Back/Forward)',
    description: 'Use mouse buttons 4 and 5 for back/forward navigation.',
    status: 'implemented',
  },
  {
    id: 'reload',
    label: 'Reload Page',
    description: 'Reload the current page.',
    status: 'implemented',
    shortcut: 'Ctrl+R / F5 / Ctrl+Shift+R',
    domId: 'reload',
  },
  {
    id: 'stop',
    label: 'Stop Loading',
    description: 'Stop the current page load. Reload button converts to stop while loading.',
    status: 'implemented',
  },
  {
    id: 'address-bar',
    label: 'Address / Search Bar',
    description: 'Navigate to a URL or search the web from the address bar.',
    status: 'implemented',
    shortcut: 'Ctrl+L / Alt+D',
    domId: 'address',
  },
  {
    id: 'home-startup',
    label: 'Home / Startup Behavior',
    description: 'Configure startup to open home URL, launchpad, or restore last session.',
    status: 'implemented',
    domId: 'home',
  },
  {
    id: 'find-in-page',
    label: 'Find in Page',
    description: 'Search for text within the current page.',
    status: 'implemented',
    shortcut: 'Ctrl+F',
    domId: 'find-bar',
  },
  {
    id: 'zoom-in',
    label: 'Zoom In',
    description: 'Increase page zoom.',
    status: 'implemented',
    shortcut: 'Ctrl++',
  },
  {
    id: 'zoom-out',
    label: 'Zoom Out',
    description: 'Decrease page zoom.',
    status: 'implemented',
    shortcut: 'Ctrl+-',
  },
  {
    id: 'zoom-reset',
    label: 'Reset Zoom',
    description: 'Reset page zoom to default (100% or configured default).',
    status: 'implemented',
    shortcut: 'Ctrl+0',
  },
  {
    id: 'fullscreen',
    label: 'Fullscreen',
    description: 'Toggle browser fullscreen.',
    status: 'implemented',
    shortcut: 'F11',
  },
  {
    id: 'print',
    label: 'Print Page',
    description: 'Open the system print dialog for the current page.',
    status: 'implemented',
    shortcut: 'Ctrl+P',
  },
  {
    id: 'save-page',
    label: 'Save Page / Download',
    description: 'Save the current page to disk.',
    status: 'partially-implemented',
    blockedReason: 'Electron webview does not expose save-page via standard toolbar UI; falls back to Ctrl+S passthrough inside the webview.',
  },
  {
    id: 'devtools',
    label: 'Developer Tools',
    description: 'Open Chromium DevTools for the active webview.',
    status: 'implemented',
    shortcut: 'F12 / Ctrl+Shift+I',
    domId: 'devtools',
  },
  {
    id: 'view-source',
    label: 'View Page Source',
    description: 'View the page source. Opens view-source: URL in a new tab.',
    status: 'partially-implemented',
    blockedReason: 'view-source: URLs require special handling with Electron webviews; not all sites support direct source view.',
  },
  {
    id: 'copy-url',
    label: 'Copy URL',
    description: 'Copy the current page URL to clipboard.',
    status: 'implemented',
  },
  {
    id: 'open-external',
    label: 'Open in External Browser',
    description: 'Open the current URL in the system default browser. Uses safe wrapper that validates protocol.',
    status: 'implemented',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcut Discovery',
    description: 'View all available keyboard shortcuts.',
    status: 'implemented',
    shortcut: '?',
    domId: 'shortcut-dialog',
  },
];

export function dailyDriverBehaviorById(id: string): DailyDriverBehavior | undefined {
  return DAILY_DRIVER_BEHAVIORS.find(b => b.id === id);
}

export function dailyDriverParitySummary(): string {
  const impl = DAILY_DRIVER_BEHAVIORS.filter(b => b.status === 'implemented').length;
  const partial = DAILY_DRIVER_BEHAVIORS.filter(b => b.status === 'partially-implemented').length;
  const blocked = DAILY_DRIVER_BEHAVIORS.filter(b => b.status === 'blocked').length;
  const planned = DAILY_DRIVER_BEHAVIORS.filter(b => b.status === 'planned').length;
  return `${PASS339_DAILY_DRIVER_PASS} ${DAILY_DRIVER_PARITY_CONTRACT_ID}: behaviors=${DAILY_DRIVER_BEHAVIORS.length}; implemented=${impl}; partial=${partial}; planned=${planned}; blocked=${blocked}`;
}
