/**
 * PASS337 — Free Release Product Truth + No-Crippleware Gate
 *
 * TAHAI Browser is a free configurable Chromium daily driver and IT/DevOps command browser.
 *
 * Core rules:
 * - EVERYTHING is available in the free browser unless blocked by security,
 *   missing platform capability, or an honest not-yet-implemented state.
 * - Profiles are presets (UI personality), NOT license tiers.
 * - Enterprise policy is managed-environment control, NOT a monetization gate.
 * - A Personal profile can hide IT/DevOps by default, but the user can enable them.
 * - A Custom profile enables everything.
 * - No surface is paywalled.
 */

export const PASS337_FREE_RELEASE_PASS = 'PASS337';
export const FREE_RELEASE_CONTRACT_ID = 'free-release-product-truth-no-crippleware-v1';

// ─── Product Sentence ──────────────────────────────────────────────────────────

export const TAHAI_PRODUCT_SENTENCE =
  'TAHAI Browser is a free configurable Chromium daily driver that can become an IT, DevOps, MSP, security, or operator command browser per profile — with Mission Control, evidence, tools, and enterprise-grade controls available to everyone.';

export const TAHAI_PRODUCT_SHORT =
  'TAHAI Browser is a free configurable Chromium daily-driver and IT/DevOps command browser.';

export const TAHAI_PROFILE_PHILOSOPHY =
  'Profiles are browser presets — they control which surfaces are visible by default. They are not license tiers. Any user can enable any surface in any profile. Enterprise policy may restrict surfaces in managed environments, but the free public browser exposes the full product to all users.';

export const TAHAI_ENTERPRISE_POLICY_PHILOSOPHY =
  'Enterprise policy is managed-environment control for IT administrators. It is not a monetization gate. The free public browser ships with full capability. Enterprise policy only applies when a managed-policy.json is present.';

// ─── Feature Availability Status ──────────────────────────────────────────────

export type FeatureStatus =
  | 'implemented'
  | 'partially-implemented'
  | 'planned'
  | 'blocked';

export type FreeReleaseFeature = {
  id: string;
  label: string;
  description: string;
  status: FeatureStatus;
  blockedReason?: string;
  availableInFreeRelease: true;
  availableWhen: string;
};

// ─── Free Release Feature Matrix ──────────────────────────────────────────────

export const FREE_RELEASE_FEATURE_MATRIX: FreeReleaseFeature[] = [
  {
    id: 'daily-browsing',
    label: 'Daily Browsing',
    description: 'Navigate the web, use tabs, bookmarks, history, address bar, find-in-page, zoom, fullscreen. Credible Chromium daily-driver experience.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Core of the product.',
  },
  {
    id: 'profiles',
    label: 'Profiles',
    description: 'Create multiple browser profiles with separate session partitions, names, colors, and UI presets. Profiles are presets, not tiers.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Free feature for all users.',
  },
  {
    id: 'ui-customization',
    label: 'UI Customization',
    description: 'Show/hide surfaces per profile. Choose toolbar density, new-tab layout, default mode. Custom profile enables everything.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Free feature for all users.',
  },
  {
    id: 'it-tools',
    label: 'IT Tools',
    description: 'DNS lookup, TLS/cert check, HTTP headers, redirect chain, endpoint smoke check. Available when IT Tools surface is enabled.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable IT Tools surface in UI Customization or use IT Admin / Security profile.',
  },
  {
    id: 'devops-tools',
    label: 'DevOps Tools',
    description: 'JSON/YAML viewer, JWT decoder, CIDR calculator, checksum verifier, endpoint smoke check. Available when DevOps Tools surface is enabled.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable DevOps Tools surface in UI Customization or use DevOps / Builder profile.',
  },
  {
    id: 'admin-console-profiles',
    label: 'Admin Console Profiles',
    description: 'Quick-launch admin consoles: Microsoft 365, Entra/Azure, Google Workspace, GCP, AWS, Cloudflare, GitHub, GitHub Actions, Vercel, Firebase, and more. No credentials embedded.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Admin Console Profiles surface in UI Customization or use IT Admin / DevOps profile.',
  },
  {
    id: 'mission-control',
    label: 'Mission Control',
    description: 'Multi-pane operator workspace. 1-Up, 2-Up, Tri-View, Quad View, Focus Pane. Mission creation, active pane routing, save/restore.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Mission Control surface in UI Customization or use IT Admin / DevOps / MSP / Security profile.',
  },
  {
    id: 'mission-recipes',
    label: 'Mission Recipes',
    description: 'Pre-built operator workflow templates for IT, DevOps, security, and MSP workflows. Launch into multi-pane missions.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Mission Recipes surface in UI Customization or use DevOps / Security / IT Admin profile.',
  },
  {
    id: 'evidence-pack',
    label: 'Evidence Pack',
    description: 'Capture, annotate, redact, and export operator evidence. Incident packets, change records, sanitized handoffs.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Evidence Pack surface in UI Customization or use IT Admin / DevOps / MSP / Security profile.',
  },
  {
    id: 'runbook-rail',
    label: 'Runbook Rail',
    description: 'Live runbook attached to active mission. Steps, validation, rollback, timestamps.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Mission Control surface. Available in IT Admin / DevOps / MSP / Security profiles.',
  },
  {
    id: 'mission-timeline',
    label: 'Mission Timeline',
    description: 'Chronological timeline of mission events, captures, notes, and navigation. Filterable by event kind.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Mission Control surface. Available in IT Admin / DevOps / MSP / Security profiles.',
  },
  {
    id: 'command-center',
    label: 'Command Center (Ctrl+K)',
    description: 'Universal command surface. Search all commands, navigate all surfaces, launch missions, tools, and settings.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Ctrl+K from any view.',
  },
  {
    id: 'artifact-shelf',
    label: 'Artifact Shelf',
    description: 'Download tracking shelf. Reveal, open, or export downloaded artifacts.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Downloads or Artifact Shelf surface. Appears automatically on download.',
  },
  {
    id: 'support-bundle',
    label: 'Support Bundle',
    description: 'Capture and export a sanitized support bundle for handoff or diagnostics.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Support Bundle surface in UI Customization or use IT Admin / MSP profile.',
  },
  {
    id: 'policy-diagnostics',
    label: 'Policy Diagnostics',
    description: 'View active enterprise policy source, locked fields, disabled surfaces, and update channel truth.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Enable Policy Diagnostics surface in UI Customization or use IT Admin profile.',
  },
  {
    id: 'privacy-controls',
    label: 'Privacy Controls',
    description: 'Do Not Track, third-party cookie blocking, referrer reduction, clear data on exit.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. In Settings → Privacy and Security.',
  },
  {
    id: 'site-settings',
    label: 'Site Settings / Permissions',
    description: 'Control camera, microphone, geolocation, notifications, clipboard access per site.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. In Settings → Site Permissions.',
  },
  {
    id: 'downloads',
    label: 'Downloads',
    description: 'Download files, choose download directory, reveal in Finder/Explorer, track download status.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always.',
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    description: 'Add, remove, and manage bookmarks. Bookmark bar. Bookmark manager route.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Enable Bookmarks surface in UI Customization (default on in most profiles).',
  },
  {
    id: 'history',
    label: 'History',
    description: 'Browser history list, recent sites. Clear history.',
    status: 'implemented',
    availableInFreeRelease: true,
    availableWhen: 'Always. Enable History surface in UI Customization (default on in most profiles).',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Full settings panel: profiles, search engine, startup, appearance, tabs, privacy, permissions, downloads, accessibility, enterprise policy, ops mode, UI customization.',
    status: 'partially-implemented',
    blockedReason: 'Some subsections are marked coming-soon where Electron/Chromium shell support is missing or not yet implemented. No false claims.',
    availableInFreeRelease: true,
    availableWhen: 'Always. Settings is always accessible.',
  },
];

// ─── Profile Preset Descriptions ──────────────────────────────────────────────

export type ProfilePresetDescription = {
  kind: string;
  label: string;
  isPreset: true;
  isLicenseTier: false;
  description: string;
  defaultSurfaces: string;
  canEnableMore: true;
};

export const PROFILE_PRESET_DESCRIPTIONS: ProfilePresetDescription[] = [
  {
    kind: 'personal',
    label: 'Personal Daily Driver',
    isPreset: true,
    isLicenseTier: false,
    description: 'Clean, fast daily browser. IT/DevOps surfaces are hidden by default — but you can enable any of them in UI Customization.',
    defaultSurfaces: 'Home, Bookmarks, History, Downloads, Settings, New Tab, Command Center',
    canEnableMore: true,
  },
  {
    kind: 'it-admin',
    label: 'IT Admin',
    isPreset: true,
    isLicenseTier: false,
    description: 'IT tools, admin consoles, Mission Control, evidence, runbook, and policy surfaces visible by default.',
    defaultSurfaces: 'All of Personal + Ops Mode, Mission Control, Admin Consoles, IT Tools, Evidence, Runbook, Support Bundle, Policy Diagnostics',
    canEnableMore: true,
  },
  {
    kind: 'devops',
    label: 'DevOps / Builder',
    isPreset: true,
    isLicenseTier: false,
    description: 'DevOps tools, cloud consoles, Mission Recipes, release evidence, endpoint checks visible by default.',
    defaultSurfaces: 'All of Personal + Ops Mode, Mission Control, Mission Recipes, Admin Consoles (DevOps), DevOps Tools, Evidence, Runbook',
    canEnableMore: true,
  },
  {
    kind: 'msp-support',
    label: 'MSP / Support Desk',
    isPreset: true,
    isLicenseTier: false,
    description: 'Ticket references, handoff exports, evidence, and support bundle surfaces visible by default.',
    defaultSurfaces: 'All of Personal + Ops Mode, Mission Control, Evidence, Runbook, Support Bundle',
    canEnableMore: true,
  },
  {
    kind: 'security-incident',
    label: 'Security / Incident Response',
    isPreset: true,
    isLicenseTier: false,
    description: 'DNS/TLS/headers/redirects/JWT/CIDR/checksum tools, incident recipes, timeline, and evidence visible by default.',
    defaultSurfaces: 'All of Personal + Ops Mode, Mission Control, Mission Recipes, Mission Timeline, IT Tools (security), Evidence, Runbook',
    canEnableMore: true,
  },
  {
    kind: 'minimal-privacy',
    label: 'Minimal / Privacy',
    isPreset: true,
    isLicenseTier: false,
    description: 'Maximum clean UI. Only search/address and privacy controls visible. Enable anything you want in UI Customization.',
    defaultSurfaces: 'Home, History, Downloads, Settings, New Tab',
    canEnableMore: true,
  },
  {
    kind: 'custom',
    label: 'Custom',
    isPreset: true,
    isLicenseTier: false,
    description: 'Full control over every visible surface and enabled tool group. Enable everything or curate exactly what you need.',
    defaultSurfaces: 'Everything available. User-configurable.',
    canEnableMore: true,
  },
];

// ─── Crippleware Audit ─────────────────────────────────────────────────────────

/**
 * Strings that must NOT appear in user-facing copy (they imply paid tiers or locked features).
 */
export const CRIPPLEWARE_FORBIDDEN_COPY: string[] = [
  'enterprise only',
  'enterprise-only',
  'pro only',
  'pro-only',
  'premium only',
  'premium-only',
  'paid feature',
  'requires license',
  'upgrade to unlock',
  'upgrade to access',
  'available with subscription',
  'not available in free',
  'enterprise license required',
  'locked to enterprise',
  'locked behind',
];

/**
 * Strings that ARE acceptable for honest capability gaps.
 */
export const HONEST_CAPABILITY_COPY_EXAMPLES: string[] = [
  'coming soon',
  'not yet implemented',
  'requires platform support',
  'blocked by Electron/Chromium capability',
  'disabled by enterprise policy',
  'hidden by profile setting',
  'enable in UI Customization',
];

// ─── Summary ──────────────────────────────────────────────────────────────────

export function freeReleaseFeatureMatrixSummary(): string {
  const implemented = FREE_RELEASE_FEATURE_MATRIX.filter(f => f.status === 'implemented').length;
  const partial = FREE_RELEASE_FEATURE_MATRIX.filter(f => f.status === 'partially-implemented').length;
  const planned = FREE_RELEASE_FEATURE_MATRIX.filter(f => f.status === 'planned').length;
  const blocked = FREE_RELEASE_FEATURE_MATRIX.filter(f => f.status === 'blocked').length;
  return `${PASS337_FREE_RELEASE_PASS} ${FREE_RELEASE_CONTRACT_ID}: features=${FREE_RELEASE_FEATURE_MATRIX.length}; implemented=${implemented}; partial=${partial}; planned=${planned}; blocked=${blocked}; allFree=true`;
}

export function noPaywallSummary(): string {
  const paywalled = FREE_RELEASE_FEATURE_MATRIX.filter(f => !f.availableInFreeRelease);
  return paywalled.length === 0
    ? 'No features are paywalled. All features available in free release.'
    : `VIOLATION: ${paywalled.length} features marked as not free: ${paywalled.map(f => f.id).join(', ')}`;
}
