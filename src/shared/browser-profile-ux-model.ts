/**
 * PASS317 — Browser Profile UX Model + Policy Foundation
 *
 * Defines the shared types and defaults for TAHAI Browser profile UX configuration.
 * A profile controls UI layout, visible surfaces, enabled tool groups, startup behavior,
 * and operator feature availability. Enterprise policy can lock any field.
 *
 * Non-negotiable constraints:
 * - No secrets stored in profile config.
 * - No runtime session/cookie/history/credentials in profile config.
 * - Malformed/unknown config falls back to safe defaults.
 * - Enterprise policy overrides local profile config.
 */

export const PASS317_PROFILE_UX_MODEL_PASS = 'PASS317';
export const BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION = 1;
export const BROWSER_PROFILE_UX_MODEL_CONTRACT_ID = 'browser-profile-ux-model-v1';

// ─── Profile Kind ─────────────────────────────────────────────────────────────

export const BROWSER_PROFILE_KINDS = [
  'personal',
  'it-admin',
  'devops',
  'msp-support',
  'security-incident',
  'minimal-privacy',
  'custom',
] as const;

export type BrowserProfileKindUx = typeof BROWSER_PROFILE_KINDS[number];

export const BROWSER_PROFILE_KIND_LABELS: Record<BrowserProfileKindUx, string> = {
  'personal': 'Personal Daily Driver',
  'it-admin': 'IT Admin',
  'devops': 'DevOps / Builder',
  'msp-support': 'MSP / Support Desk',
  'security-incident': 'Security / Incident Response',
  'minimal-privacy': 'Minimal / Privacy',
  'custom': 'Custom',
};

export const BROWSER_PROFILE_KIND_DESCRIPTIONS: Record<BrowserProfileKindUx, string> = {
  'personal': 'Clean browser. Normal daily browsing. No IT or DevOps clutter.',
  'it-admin': 'IT tools, Admin Console Profiles, Mission Control, Evidence, Runbook, and policy surfaces.',
  'devops': 'DevOps tools, GitHub, cloud consoles, release evidence, endpoint checks, and mission recipes.',
  'msp-support': 'Ticket/reference surfaces, handoff exports, evidence packets, and client-safe sanitized exports.',
  'security-incident': 'DNS/TLS/headers/redirects/JWT/CIDR/checksum tools, timeline, evidence, redaction, and incident packets.',
  'minimal-privacy': 'Very clean UI. Privacy controls surfaced. All operator surfaces hidden unless explicitly enabled.',
  'custom': 'You choose every visible surface and enabled tool group.',
};

// ─── Default Mode ─────────────────────────────────────────────────────────────

export const BROWSER_PROFILE_DEFAULT_MODES = [
  'daily-driver',
  'ops-mode',
  'last-session',
] as const;

export type BrowserProfileDefaultMode = typeof BROWSER_PROFILE_DEFAULT_MODES[number];

// ─── Visible Surfaces ─────────────────────────────────────────────────────────

export const VISIBLE_SURFACES = [
  'home',
  'bookmarks',
  'history',
  'downloads',
  'settings',
  'extensions-placeholder',
  'daily-driver-new-tab',
  // ─── Quad View — top-level free feature, available in ALL profiles ──────────
  'quad-view',
  // ─── Responsive View — top-level free feature, available in ALL profiles ───
  'responsive-view',
  // ─── Operator surfaces ───────────────────────────────────────────────────────
  'ops-mode',
  'mission-control',
  'mission-recipes',
  'admin-console-profiles',
  'it-tools',
  'devops-tools',
  'evidence-pack',
  'runbook-rail',
  'mission-timeline',
  'command-center',
  'support-bundle',
  'policy-diagnostics',
  'artifact-shelf',
] as const;

export type VisibleSurface = typeof VISIBLE_SURFACES[number];

export const VISIBLE_SURFACE_LABELS: Record<VisibleSurface, string> = {
  'home': 'Home',
  'bookmarks': 'Bookmarks',
  'history': 'History',
  'downloads': 'Downloads',
  'settings': 'Settings',
  'extensions-placeholder': 'Extensions (placeholder)',
  'daily-driver-new-tab': 'Daily Driver New Tab',
  'quad-view': 'Quad View (Big Screen 4-Up)',
  'responsive-view': 'Responsive View (Mobile / Tablet / Big Screen)',
  'ops-mode': 'Ops Mode',
  'mission-control': 'Mission Control',
  'mission-recipes': 'Mission Recipes',
  'admin-console-profiles': 'Admin Console Profiles',
  'it-tools': 'IT Tools',
  'devops-tools': 'DevOps Tools',
  'evidence-pack': 'Evidence Pack',
  'runbook-rail': 'Runbook Rail',
  'mission-timeline': 'Mission Timeline',
  'command-center': 'Command Center',
  'support-bundle': 'Support Bundle',
  'policy-diagnostics': 'Policy Diagnostics',
  'artifact-shelf': 'Artifact Shelf',
};

// ─── Enabled Tool Groups ──────────────────────────────────────────────────────

export const ENABLED_TOOL_GROUPS = [
  'browsing',
  'privacy',
  'downloads',
  'bookmarks',
  'history',
  'devops',
  'it-admin',
  'dns',
  'tls',
  'headers',
  'redirects',
  'json-yaml',
  'jwt',
  'cidr',
  'checksum',
  'endpoint-smoke',
  'evidence',
  'mission',
  'support',
  'enterprise-policy',
] as const;

export type EnabledToolGroup = typeof ENABLED_TOOL_GROUPS[number];

export const ENABLED_TOOL_GROUP_LABELS: Record<EnabledToolGroup, string> = {
  'browsing': 'Browsing',
  'privacy': 'Privacy',
  'downloads': 'Downloads',
  'bookmarks': 'Bookmarks',
  'history': 'History',
  'devops': 'DevOps',
  'it-admin': 'IT Admin',
  'dns': 'DNS Lookup',
  'tls': 'TLS / Certificate',
  'headers': 'HTTP Headers',
  'redirects': 'Redirect Chain',
  'json-yaml': 'JSON / YAML Viewer',
  'jwt': 'JWT Decoder',
  'cidr': 'CIDR Calculator',
  'checksum': 'Checksum Verifier',
  'endpoint-smoke': 'Endpoint Smoke Check',
  'evidence': 'Evidence Pack',
  'mission': 'Mission Control',
  'support': 'Support Bundle',
  'enterprise-policy': 'Enterprise Policy',
};

// ─── New Tab Layout ───────────────────────────────────────────────────────────

export const NEW_TAB_LAYOUTS = [
  'personal',
  'it-admin',
  'devops',
  'msp-support',
  'security-incident',
  'minimal-privacy',
  'custom',
] as const;

export type NewTabLayout = typeof NEW_TAB_LAYOUTS[number];

// ─── Toolbar Layout ───────────────────────────────────────────────────────────

export const TOOLBAR_LAYOUTS = ['full', 'compact', 'minimal'] as const;
export type ToolbarLayout = typeof TOOLBAR_LAYOUTS[number];

// ─── Command Center Categories ────────────────────────────────────────────────

export const COMMAND_CENTER_CATEGORIES = [
  'daily-browsing',
  'tabs-windows',
  'settings',
  'profiles',
  'ui-customization',
  'it-tools',
  'devops-tools',
  'mission-control',
  'evidence',
  'runbook',
  'admin-console-profiles',
  'support',
  'enterprise-policy',
] as const;

export type CommandCenterCategory = typeof COMMAND_CENTER_CATEGORIES[number];

export const COMMAND_CENTER_CATEGORY_LABELS: Record<CommandCenterCategory, string> = {
  'daily-browsing': 'Daily Browsing',
  'tabs-windows': 'Tabs & Windows',
  'settings': 'Settings',
  'profiles': 'Profiles',
  'ui-customization': 'UI Customization',
  'it-tools': 'IT Tools',
  'devops-tools': 'DevOps Tools',
  'mission-control': 'Mission Control',
  'evidence': 'Evidence',
  'runbook': 'Runbook',
  'admin-console-profiles': 'Admin Console Profiles',
  'support': 'Support',
  'enterprise-policy': 'Enterprise Policy',
};

// ─── Profile UX Config ────────────────────────────────────────────────────────

export type BrowserProfileUxConfig = {
  /** Schema version. Always 1 for PASS317. */
  schemaVersion: typeof BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION;
  /** Profile kind that this config belongs to. */
  profileKind: BrowserProfileKindUx;
  /** Default mode when the profile is activated. */
  defaultMode: BrowserProfileDefaultMode;
  /** Surfaces shown in the UI for this profile. */
  visibleSurfaces: VisibleSurface[];
  /** Tool groups enabled for this profile. */
  enabledToolGroups: EnabledToolGroup[];
  /** Toolbar layout density. */
  toolbarLayout: ToolbarLayout;
  /** Which new-tab layout to show. */
  newTabLayout: NewTabLayout;
  /** Which command center categories are enabled. */
  commandCenterCategories: CommandCenterCategory[];
  /**
   * Whether Quad View (Big Screen 4-Up) is available in this profile.
   * Quad View is a top-level free feature — NOT Ops-only, NOT Mission-only.
   * Personal/Minimal hide it by default but users can enable it.
   * Custom profile shows it by default.
   */
  quadViewEnabled: boolean;
  /**
   * Whether Responsive View (Mobile/Tablet/Big Screen without DevTools) is available.
   * Top-level free feature available in ALL profiles.
   * Personal/Minimal hide it by default but users can enable it.
   */
  responsiveViewEnabled: boolean;
  /** Whether Mission Control is available in this profile. */
  missionControlEnabled: boolean;
  /** Whether evidence capture is available. */
  evidenceEnabled: boolean;
  /** Whether runbook rail is available. */
  runbookEnabled: boolean;
  /** Whether Admin Console Profiles surface is available. */
  adminProfilesEnabled: boolean;
  /** Whether DevOps tools are available. */
  devOpsToolsEnabled: boolean;
  /** Whether IT tools are available. */
  itToolsEnabled: boolean;
  /** Whether the downloads shelf is visible. */
  downloadsShelfEnabled: boolean;
  /** Whether the support bundle surface is available. */
  supportBundleEnabled: boolean;
  /**
   * Fields locked by enterprise policy. These are field keys that the user
   * cannot modify. The actual locked values come from the policy object.
   * Example: ['visibleSurfaces', 'missionControlEnabled']
   */
  enterprisePolicyLockedFields: string[];
};

// ─── Enterprise Policy UI Locks (PASS325 forward-declaration) ─────────────────

export type BrowserProfileUxPolicyLocks = {
  allowedProfileKinds?: BrowserProfileKindUx[];
  defaultProfileKind?: BrowserProfileKindUx;
  lockedVisibleSurfaces?: VisibleSurface[];
  disabledVisibleSurfaces?: VisibleSurface[];
  lockedToolGroups?: EnabledToolGroup[];
  disabledToolGroups?: EnabledToolGroup[];
  allowCustomProfiles?: boolean;
  allowOpsMode?: boolean;
  allowMissionExports?: boolean;
  allowEvidenceCapture?: boolean;
  allowSupportBundle?: boolean;
  allowDevOpsTools?: boolean;
  allowITTools?: boolean;
  allowAdminConsoleProfiles?: boolean;
  allowProfileSwitching?: boolean;
  allowUserUiCustomization?: boolean;
};

// ─── Default Configs per Profile Kind ────────────────────────────────────────

const CORE_BROWSING_TOOLS: EnabledToolGroup[] = ['browsing', 'privacy', 'downloads', 'bookmarks', 'history'];

const CORE_SURFACES: VisibleSurface[] = ['home', 'bookmarks', 'history', 'downloads', 'settings', 'daily-driver-new-tab', 'command-center'];

export function defaultProfileUxConfig(kind: BrowserProfileKindUx): BrowserProfileUxConfig {
  switch (kind) {
    case 'personal':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'personal',
        defaultMode: 'daily-driver',
        // Quad View hidden by default in Personal — user can enable in UI Customization
        visibleSurfaces: [...CORE_SURFACES],
        enabledToolGroups: [...CORE_BROWSING_TOOLS],
        toolbarLayout: 'full',
        newTabLayout: 'personal',
        commandCenterCategories: ['daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization'],
        quadViewEnabled: false,
        responsiveViewEnabled: false,
        missionControlEnabled: false,
        evidenceEnabled: false,
        runbookEnabled: false,
        adminProfilesEnabled: false,
        devOpsToolsEnabled: false,
        itToolsEnabled: false,
        downloadsShelfEnabled: true,
        supportBundleEnabled: false,
        enterprisePolicyLockedFields: [],
      };

    case 'it-admin':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'it-admin',
        defaultMode: 'ops-mode',
        visibleSurfaces: [
          ...CORE_SURFACES,
          // Quad View + Responsive View: enabled by default for IT Admin
          'quad-view', 'responsive-view',
          'ops-mode', 'mission-control', 'admin-console-profiles', 'it-tools',
          'evidence-pack', 'runbook-rail', 'mission-timeline', 'artifact-shelf',
          'support-bundle', 'policy-diagnostics',
        ],
        enabledToolGroups: [
          ...CORE_BROWSING_TOOLS,
          'it-admin', 'dns', 'tls', 'headers', 'redirects', 'endpoint-smoke',
          'evidence', 'mission', 'support', 'enterprise-policy',
        ],
        toolbarLayout: 'full',
        newTabLayout: 'it-admin',
        commandCenterCategories: [
          'daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization',
          'it-tools', 'mission-control', 'evidence', 'runbook', 'admin-console-profiles',
          'support', 'enterprise-policy',
        ],
        quadViewEnabled: true,
        responsiveViewEnabled: true,
        missionControlEnabled: true,
        evidenceEnabled: true,
        runbookEnabled: true,
        adminProfilesEnabled: true,
        devOpsToolsEnabled: false,
        itToolsEnabled: true,
        downloadsShelfEnabled: true,
        supportBundleEnabled: true,
        enterprisePolicyLockedFields: [],
      };

    case 'devops':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'devops',
        defaultMode: 'ops-mode',
        visibleSurfaces: [
          ...CORE_SURFACES,
          // Quad View + Responsive View: enabled by default for DevOps
          'quad-view', 'responsive-view',
          'ops-mode', 'mission-control', 'mission-recipes', 'admin-console-profiles',
          'devops-tools', 'evidence-pack', 'runbook-rail', 'mission-timeline',
          'artifact-shelf',
        ],
        enabledToolGroups: [
          ...CORE_BROWSING_TOOLS,
          'devops', 'dns', 'tls', 'headers', 'redirects', 'json-yaml', 'jwt',
          'checksum', 'endpoint-smoke', 'evidence', 'mission',
        ],
        toolbarLayout: 'full',
        newTabLayout: 'devops',
        commandCenterCategories: [
          'daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization',
          'devops-tools', 'mission-control', 'evidence', 'runbook',
          'admin-console-profiles',
        ],
        quadViewEnabled: true,
        responsiveViewEnabled: true,
        missionControlEnabled: true,
        evidenceEnabled: true,
        runbookEnabled: true,
        adminProfilesEnabled: true,
        devOpsToolsEnabled: true,
        itToolsEnabled: false,
        downloadsShelfEnabled: true,
        supportBundleEnabled: false,
        enterprisePolicyLockedFields: [],
      };

    case 'msp-support':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'msp-support',
        defaultMode: 'ops-mode',
        visibleSurfaces: [
          ...CORE_SURFACES,
          // Quad View + Responsive View: enabled by default for MSP/Support
          'quad-view', 'responsive-view',
          'ops-mode', 'mission-control', 'evidence-pack', 'runbook-rail',
          'support-bundle', 'artifact-shelf',
        ],
        enabledToolGroups: [
          ...CORE_BROWSING_TOOLS,
          'dns', 'tls', 'headers', 'endpoint-smoke', 'evidence', 'mission', 'support',
        ],
        toolbarLayout: 'full',
        newTabLayout: 'msp-support',
        commandCenterCategories: [
          'daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization',
          'mission-control', 'evidence', 'runbook', 'support',
        ],
        quadViewEnabled: true,
        responsiveViewEnabled: true,
        missionControlEnabled: true,
        evidenceEnabled: true,
        runbookEnabled: true,
        adminProfilesEnabled: false,
        devOpsToolsEnabled: false,
        itToolsEnabled: false,
        downloadsShelfEnabled: true,
        supportBundleEnabled: true,
        enterprisePolicyLockedFields: [],
      };

    case 'security-incident':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'security-incident',
        defaultMode: 'ops-mode',
        visibleSurfaces: [
          ...CORE_SURFACES,
          // Quad View + Responsive View: enabled by default for Security
          'quad-view', 'responsive-view',
          'ops-mode', 'mission-control', 'mission-recipes', 'mission-timeline',
          'evidence-pack', 'runbook-rail', 'artifact-shelf',
        ],
        enabledToolGroups: [
          ...CORE_BROWSING_TOOLS,
          'dns', 'tls', 'headers', 'redirects', 'json-yaml', 'jwt', 'cidr',
          'checksum', 'endpoint-smoke', 'evidence', 'mission',
        ],
        toolbarLayout: 'full',
        newTabLayout: 'security-incident',
        commandCenterCategories: [
          'daily-browsing', 'tabs-windows', 'settings', 'profiles', 'ui-customization',
          'it-tools', 'devops-tools', 'mission-control', 'evidence', 'runbook',
        ],
        quadViewEnabled: true,
        responsiveViewEnabled: true,
        missionControlEnabled: true,
        evidenceEnabled: true,
        runbookEnabled: true,
        adminProfilesEnabled: false,
        devOpsToolsEnabled: false,
        itToolsEnabled: true,
        downloadsShelfEnabled: true,
        supportBundleEnabled: false,
        enterprisePolicyLockedFields: [],
      };

    case 'minimal-privacy':
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'minimal-privacy',
        defaultMode: 'daily-driver',
        // Quad View + Responsive View hidden by default in Minimal — user can enable
        visibleSurfaces: ['home', 'history', 'downloads', 'settings', 'daily-driver-new-tab'],
        enabledToolGroups: ['browsing', 'privacy'],
        toolbarLayout: 'minimal',
        newTabLayout: 'minimal-privacy',
        commandCenterCategories: ['daily-browsing', 'tabs-windows', 'settings'],
        quadViewEnabled: false,
        responsiveViewEnabled: false,
        missionControlEnabled: false,
        evidenceEnabled: false,
        runbookEnabled: false,
        adminProfilesEnabled: false,
        devOpsToolsEnabled: false,
        itToolsEnabled: false,
        downloadsShelfEnabled: false,
        supportBundleEnabled: false,
        enterprisePolicyLockedFields: [],
      };

    case 'custom':
      // Custom starts with everything visible — full user control, Quad + Responsive View on
      return {
        schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
        profileKind: 'custom',
        defaultMode: 'daily-driver',
        visibleSurfaces: [...VISIBLE_SURFACES],
        enabledToolGroups: [...ENABLED_TOOL_GROUPS],
        toolbarLayout: 'full',
        newTabLayout: 'custom',
        commandCenterCategories: [...COMMAND_CENTER_CATEGORIES],
        quadViewEnabled: true,
        responsiveViewEnabled: true,
        missionControlEnabled: true,
        evidenceEnabled: true,
        runbookEnabled: true,
        adminProfilesEnabled: true,
        devOpsToolsEnabled: true,
        itToolsEnabled: true,
        downloadsShelfEnabled: true,
        supportBundleEnabled: true,
        enterprisePolicyLockedFields: [],
      };

    default: {
      // Exhaustive guard — fallback to personal
      const _exhaustive: never = kind;
      void _exhaustive;
      return defaultProfileUxConfig('personal');
    }
  }
}

// ─── Safety Validation ────────────────────────────────────────────────────────

const SECRETISH = /(?:bearer\s+|authorization\s*:|cookie\s*:|set-cookie\s*:|refresh[_-]?token|access[_-]?token|client[_-]?secret|api[_-]?key|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i;

function cleanEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanStringArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of value.slice(0, 64)) {
    if (!allowed.includes(item as T)) continue;
    if (seen.has(item as T)) continue;
    const str = String(item);
    if (SECRETISH.test(str)) continue;
    seen.add(item as T);
    out.push(item as T);
  }
  return out;
}

function cleanLockedFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 32)) {
    const str = String(item ?? '').slice(0, 64).replace(/[^\w-]/g, '');
    if (!str || seen.has(str) || SECRETISH.test(str)) continue;
    seen.add(str);
    out.push(str);
  }
  return out;
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Sanitize an unknown value into a safe BrowserProfileUxConfig.
 * Falls back to the appropriate profile-kind default for any unknown/malformed field.
 * Rejects any secretish strings.
 */
export function sanitizeProfileUxConfig(value: unknown): BrowserProfileUxConfig {
  const raw = plainRecord(value);
  const kind = cleanEnum(raw.profileKind, BROWSER_PROFILE_KINDS, 'personal');
  const defaults = defaultProfileUxConfig(kind);

  return {
    schemaVersion: BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
    profileKind: kind,
    defaultMode: cleanEnum(raw.defaultMode, BROWSER_PROFILE_DEFAULT_MODES, defaults.defaultMode),
    visibleSurfaces: cleanStringArray(raw.visibleSurfaces, VISIBLE_SURFACES).length > 0
      ? cleanStringArray(raw.visibleSurfaces, VISIBLE_SURFACES)
      : defaults.visibleSurfaces,
    enabledToolGroups: cleanStringArray(raw.enabledToolGroups, ENABLED_TOOL_GROUPS).length > 0
      ? cleanStringArray(raw.enabledToolGroups, ENABLED_TOOL_GROUPS)
      : defaults.enabledToolGroups,
    toolbarLayout: cleanEnum(raw.toolbarLayout, TOOLBAR_LAYOUTS, defaults.toolbarLayout),
    newTabLayout: cleanEnum(raw.newTabLayout, NEW_TAB_LAYOUTS, defaults.newTabLayout),
    commandCenterCategories: cleanStringArray(raw.commandCenterCategories, COMMAND_CENTER_CATEGORIES).length > 0
      ? cleanStringArray(raw.commandCenterCategories, COMMAND_CENTER_CATEGORIES)
      : defaults.commandCenterCategories,
    quadViewEnabled: cleanBoolean(raw.quadViewEnabled, defaults.quadViewEnabled),
    responsiveViewEnabled: cleanBoolean(raw.responsiveViewEnabled, defaults.responsiveViewEnabled),
    missionControlEnabled: cleanBoolean(raw.missionControlEnabled, defaults.missionControlEnabled),
    evidenceEnabled: cleanBoolean(raw.evidenceEnabled, defaults.evidenceEnabled),
    runbookEnabled: cleanBoolean(raw.runbookEnabled, defaults.runbookEnabled),
    adminProfilesEnabled: cleanBoolean(raw.adminProfilesEnabled, defaults.adminProfilesEnabled),
    devOpsToolsEnabled: cleanBoolean(raw.devOpsToolsEnabled, defaults.devOpsToolsEnabled),
    itToolsEnabled: cleanBoolean(raw.itToolsEnabled, defaults.itToolsEnabled),
    downloadsShelfEnabled: cleanBoolean(raw.downloadsShelfEnabled, defaults.downloadsShelfEnabled),
    supportBundleEnabled: cleanBoolean(raw.supportBundleEnabled, defaults.supportBundleEnabled),
    enterprisePolicyLockedFields: cleanLockedFields(raw.enterprisePolicyLockedFields),
  };
}

/**
 * Returns true if the given surface is visible for the active profile config.
 */
export function isSurfaceVisible(config: BrowserProfileUxConfig, surface: VisibleSurface): boolean {
  return config.visibleSurfaces.includes(surface);
}

/**
 * Returns true if the given tool group is enabled for the active profile config.
 */
export function isToolGroupEnabled(config: BrowserProfileUxConfig, group: EnabledToolGroup): boolean {
  return config.enabledToolGroups.includes(group);
}

/**
 * Returns true if the given command center category is enabled for the active profile config.
 */
export function isCommandCenterCategoryEnabled(config: BrowserProfileUxConfig, category: CommandCenterCategory): boolean {
  return config.commandCenterCategories.includes(category);
}

/**
 * Returns true if the given field is locked by enterprise policy.
 */
export function isProfileFieldLocked(config: BrowserProfileUxConfig, field: string): boolean {
  return config.enterprisePolicyLockedFields.includes(field);
}

/**
 * Returns a human-readable label for the profile kind.
 */
export function profileKindLabel(kind: BrowserProfileKindUx): string {
  return BROWSER_PROFILE_KIND_LABELS[kind] ?? kind;
}

/**
 * Returns a human-readable description for the profile kind.
 */
export function profileKindDescription(kind: BrowserProfileKindUx): string {
  return BROWSER_PROFILE_KIND_DESCRIPTIONS[kind] ?? '';
}

/**
 * Summary string for contract verification.
 */
export function profileUxModelSummary(config: BrowserProfileUxConfig): string {
  return `${PASS317_PROFILE_UX_MODEL_PASS} ${BROWSER_PROFILE_UX_MODEL_CONTRACT_ID}: kind=${config.profileKind}; defaultMode=${config.defaultMode}; visibleSurfaces=${config.visibleSurfaces.length}; enabledToolGroups=${config.enabledToolGroups.length}; missionControl=${config.missionControlEnabled}; evidence=${config.evidenceEnabled}; itTools=${config.itToolsEnabled}; devOpsTools=${config.devOpsToolsEnabled}; lockedFields=${config.enterprisePolicyLockedFields.length}`;
}
