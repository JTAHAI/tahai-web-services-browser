/**
 * PASS346 (Responsive View) — Responsive View Contract
 *
 * Responsive View (Mobile / Tablet / Big Screen) is a TOP-LEVEL free feature
 * available in ALL profiles and ALL modes WITHOUT requiring DevTools.
 *
 * Product claim: TAHAI Browser includes Mobile, Tablet, Desktop, and Big Screen
 * views without opening DevTools.
 *
 * Implementation level:
 *   LEVEL 1 (required, implemented):
 *     - viewport/device frame presets via CSS-transform + explicit webview bounds
 *     - active tab / active pane targeting
 *     - rotate orientation
 *     - reset to desktop
 *     - visible size badge
 *     - works without DevTools being open
 *
 *   LEVEL 2 (optional, not claimed unless implemented):
 *     - user-agent profile spoofing
 *     - touch event emulation
 *     - DPR / device scale emulation
 *     - per-site remembered device preset
 *
 * IMPORTANT: No fake claims. Level 2 is explicitly NOT claimed here unless
 * actually implemented and verified.
 *
 * Safety:
 * - Remote content remains untrusted
 * - No Node integration
 * - No raw IPC exposure
 * - No unsafe preload
 * - No fake mobile capability claims
 */

export const PASS346_RESPONSIVE_VIEW_PASS = 'PASS346_RESPONSIVE';
export const RESPONSIVE_VIEW_CONTRACT_ID = 'responsive-view-no-devtools-v1';

// ─── Device Presets ────────────────────────────────────────────────────────────

export const RESPONSIVE_VIEW_PRESETS = [
  'phone-portrait',
  'phone-landscape',
  'tablet-portrait',
  'tablet-landscape',
  'small-laptop',
  'desktop',
  'big-screen',
  'custom',
] as const;

export type ResponsiveViewPreset = typeof RESPONSIVE_VIEW_PRESETS[number];

export type ResponsiveViewDimensions = {
  width: number;
  height: number;
  label: string;
  description: string;
  category: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'big-screen' | 'custom';
};

export const RESPONSIVE_VIEW_PRESET_DIMENSIONS: Record<ResponsiveViewPreset, ResponsiveViewDimensions> = {
  'phone-portrait': { width: 390, height: 844, label: 'Phone Portrait', description: 'Portrait phone view (390×844)', category: 'phone' },
  'phone-landscape': { width: 844, height: 390, label: 'Phone Landscape', description: 'Landscape phone view (844×390)', category: 'phone' },
  'tablet-portrait': { width: 768, height: 1024, label: 'Tablet Portrait', description: 'Portrait tablet view (768×1024)', category: 'tablet' },
  'tablet-landscape': { width: 1024, height: 768, label: 'Tablet Landscape', description: 'Landscape tablet view (1024×768)', category: 'tablet' },
  'small-laptop': { width: 1280, height: 800, label: 'Small Laptop', description: 'Small laptop / notebook view (1280×800)', category: 'laptop' },
  'desktop': { width: 0, height: 0, label: 'Desktop', description: 'Full desktop view — natural pane size', category: 'desktop' },
  'big-screen': { width: 1920, height: 1080, label: 'Big Screen / TV', description: '1080p / TV view (1920×1080)', category: 'big-screen' },
  'custom': { width: 0, height: 0, label: 'Custom Size', description: 'Enter custom width and height', category: 'custom' },
};

export const RESPONSIVE_VIEW_PRESET_LABELS: Record<ResponsiveViewPreset, string> = Object.fromEntries(
  Object.entries(RESPONSIVE_VIEW_PRESET_DIMENSIONS).map(([k, v]) => [k, v.label])
) as Record<ResponsiveViewPreset, string>;

// ─── Responsive View Target ────────────────────────────────────────────────────

export type ResponsiveViewTarget =
  | 'active-tab'
  | 'active-quad-pane'
  | 'pane-1'
  | 'pane-2'
  | 'pane-3'
  | 'pane-4'
  | 'all-quad-panes';

// ─── Responsive View State ────────────────────────────────────────────────────

export type ResponsiveViewState = {
  active: boolean;
  preset: ResponsiveViewPreset;
  customWidth: number;
  customHeight: number;
  orientation: 'portrait' | 'landscape';
  target: ResponsiveViewTarget;
  /** Current resolved dimensions (accounting for orientation swap) */
  resolvedWidth: number;
  resolvedHeight: number;
  /** Level 2 features — NOT claimed unless actually implemented */
  level2: {
    userAgentSpoofing: false;
    touchEmulation: false;
    dprEmulation: false;
  };
};

export function defaultResponsiveViewState(): ResponsiveViewState {
  return {
    active: false,
    preset: 'desktop',
    customWidth: 390,
    customHeight: 844,
    orientation: 'portrait',
    target: 'active-tab',
    resolvedWidth: 0,
    resolvedHeight: 0,
    level2: {
      userAgentSpoofing: false,
      touchEmulation: false,
      dprEmulation: false,
    },
  };
}

export function resolveResponsiveViewDimensions(state: ResponsiveViewState): { width: number; height: number } {
  if (state.preset === 'desktop') return { width: 0, height: 0 };
  if (state.preset === 'custom') {
    const w = Math.max(240, Math.min(3840, state.customWidth || 390));
    const h = Math.max(240, Math.min(2160, state.customHeight || 844));
    return state.orientation === 'portrait' ? { width: Math.min(w, h), height: Math.max(w, h) } : { width: Math.max(w, h), height: Math.min(w, h) };
  }
  const dims = RESPONSIVE_VIEW_PRESET_DIMENSIONS[state.preset];
  if (!dims || dims.width === 0) return { width: 0, height: 0 };
  const shouldSwap = (state.orientation === 'landscape' && dims.width < dims.height) || (state.orientation === 'portrait' && dims.width > dims.height);
  return shouldSwap ? { width: dims.height, height: dims.width } : { width: dims.width, height: dims.height };
}

export function toggleResponsiveViewOrientation(state: ResponsiveViewState): ResponsiveViewState {
  return { ...state, orientation: state.orientation === 'portrait' ? 'landscape' : 'portrait' };
}

export function resetToDesktopView(state: ResponsiveViewState): ResponsiveViewState {
  return { ...state, active: false, preset: 'desktop', resolvedWidth: 0, resolvedHeight: 0 };
}

// ─── Profile Availability ─────────────────────────────────────────────────────

export type ResponsiveViewProfileAvailability = {
  profileKind: string;
  responsiveViewAvailable: true;
  defaultVisible: boolean;
  canEnable: true;
  note: string;
};

export const RESPONSIVE_VIEW_PROFILE_AVAILABILITY: ResponsiveViewProfileAvailability[] = [
  { profileKind: 'personal', responsiveViewAvailable: true, defaultVisible: false, canEnable: true, note: 'Hidden by default. Enable in UI Customization → Responsive View.' },
  { profileKind: 'it-admin', responsiveViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Enabled by default. Check admin portals in mobile/tablet view.' },
  { profileKind: 'devops', responsiveViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Enabled by default. Test web app responsive layouts.' },
  { profileKind: 'msp-support', responsiveViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Enabled by default. Preview client sites on mobile/tablet.' },
  { profileKind: 'security-incident', responsiveViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Enabled by default. Inspect page layout safely without DevTools.' },
  { profileKind: 'minimal-privacy', responsiveViewAvailable: true, defaultVisible: false, canEnable: true, note: 'Hidden by default. Enable in UI Customization → Responsive View.' },
  { profileKind: 'custom', responsiveViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Fully available in Custom profile.' },
];

// ─── New Tab Cards ────────────────────────────────────────────────────────────

export type ResponsiveViewNewTabCard = {
  profileKind: string;
  id: string;
  label: string;
  description: string;
  action: string;
  visibleByDefault: boolean;
};

export const RESPONSIVE_VIEW_NEW_TAB_CARDS: ResponsiveViewNewTabCard[] = [
  { profileKind: 'personal', id: 'rv-personal', label: 'Preview a site on phone or tablet', description: 'See how any site looks on mobile or tablet without opening DevTools.', action: 'responsive-view-open', visibleByDefault: false },
  { profileKind: 'it-admin', id: 'rv-it', label: 'Check admin portal mobile/tablet layout', description: 'Preview your admin consoles and portals in mobile or tablet view.', action: 'responsive-view-open', visibleByDefault: true },
  { profileKind: 'devops', id: 'rv-devops', label: 'Test app responsive layout', description: 'Preview your web app or service in mobile, tablet, and desktop views.', action: 'responsive-view-open', visibleByDefault: true },
  { profileKind: 'msp-support', id: 'rv-msp', label: 'Preview client site on mobile/tablet', description: 'Reproduce client mobile issues or check site layout on their device size.', action: 'responsive-view-open', visibleByDefault: true },
  { profileKind: 'security-incident', id: 'rv-security', label: 'Inspect page layout safely', description: 'View a suspicious or broken page in different device contexts without DevTools.', action: 'responsive-view-open', visibleByDefault: true },
  { profileKind: 'minimal-privacy', id: 'rv-minimal', label: 'Preview a page on phone or tablet', description: 'Mobile/Tablet View without DevTools. Enable in UI Customization.', action: 'responsive-view-open', visibleByDefault: false },
  { profileKind: 'custom', id: 'rv-custom', label: 'Responsive View', description: 'Mobile, Tablet, Desktop, Big Screen — switch any pane to any device size.', action: 'responsive-view-open', visibleByDefault: true },
];

// ─── Command Center Commands ──────────────────────────────────────────────────

export type ResponsiveViewCommand = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  hiddenByProfileReason: string;
  disabledReason: string;
};

export const RESPONSIVE_VIEW_COMMANDS: ResponsiveViewCommand[] = [
  { id: 'rv-open', label: 'Open Responsive View', description: 'Open the Responsive View panel for the active tab.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-phone-portrait', label: 'Phone Portrait View', description: 'Switch active tab or pane to phone portrait (390×844).', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-phone-landscape', label: 'Phone Landscape View', description: 'Switch active tab or pane to phone landscape (844×390).', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-tablet-portrait', label: 'Tablet Portrait View', description: 'Switch active tab or pane to tablet portrait (768×1024).', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-tablet-landscape', label: 'Tablet Landscape View', description: 'Switch active tab or pane to tablet landscape (1024×768).', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-desktop', label: 'Desktop View', description: 'Reset active tab or pane to normal desktop view.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-big-screen', label: 'Big Screen / TV View', description: 'Switch active tab or pane to 1920×1080 big screen view.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-rotate', label: 'Rotate Device View', description: 'Toggle portrait/landscape orientation.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-apply-pane', label: 'Apply Device View to Active Pane', description: 'Apply current device view preset to the active Quad pane.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-apply-all-panes', label: 'Apply Device View to All Quad Panes', description: 'Apply current device view preset to all four Quad panes.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
  { id: 'rv-reset', label: 'Reset Device View', description: 'Reset all panes to normal desktop view.', hiddenByProfileReason: 'Responsive View is hidden by this profile. Enable it in UI Customization.', disabledReason: 'Responsive View is unavailable for this target.' },
];

// ─── Implementation Level Claim ───────────────────────────────────────────────

/**
 * Honest capability declaration.
 * Level 1 is implemented via CSS-transform viewport framing.
 * Level 2 is NOT claimed.
 */
export const RESPONSIVE_VIEW_IMPLEMENTATION_LEVEL = {
  level1: {
    implemented: true,
    features: [
      'viewport/device frame presets',
      'active tab targeting',
      'active quad pane targeting',
      'rotate orientation',
      'reset to desktop',
      'visible size badge',
      'no DevTools required',
      'safe — no Node integration, no raw IPC, no unsafe preload',
    ],
  },
  level2: {
    implemented: false,
    reason: 'Chromium device emulation APIs (user-agent spoofing, touch emulation, DPR emulation) require DevTools Protocol access that is not safely available in this Electron webview setup. These features are planned, not claimed.',
    features: [
      'user-agent profile spoofing — NOT implemented',
      'touch event emulation — NOT implemented',
      'DPR / device scale emulation — NOT implemented',
      'per-site remembered device preset — NOT implemented',
    ],
  },
} as const;

// ─── Summary ──────────────────────────────────────────────────────────────────

export function responsiveViewSummary(): string {
  const allProfilesHave = RESPONSIVE_VIEW_PROFILE_AVAILABILITY.every(p => p.responsiveViewAvailable && p.canEnable);
  return `${RESPONSIVE_VIEW_CONTRACT_ID}: profiles=${RESPONSIVE_VIEW_PROFILE_AVAILABILITY.length}; allHaveRV=${allProfilesHave}; requiresDevTools=false; level1=true; level2=false; presets=${RESPONSIVE_VIEW_PRESETS.length}; commands=${RESPONSIVE_VIEW_COMMANDS.length}`;
}
