/**
 * PASS346 — Quad View Contract
 *
 * Quad View (Big Screen 4-Up) is a TOP-LEVEL free feature available in ALL profiles.
 * It is NOT Ops-only. It is NOT Mission-only. It is a broad-release differentiator.
 *
 * Product claim: TAHAI Browser brings Big Screen Quad View to everyday browsing
 * and operator workflows.
 *
 * Positioning:
 *   1-Up   — normal browsing
 *   Quad   — signature power browsing
 *   Mission Control — makes Quad operational for IT/DevOps/MSP/Security work
 *
 * Plain Quad View must NOT require Mission Control.
 * Mission Control may ENHANCE Quad View with roles, runbook, evidence, timeline.
 */

export const PASS346_QUAD_VIEW_PASS = 'PASS346';
export const QUAD_VIEW_CONTRACT_ID = 'quad-view-free-flagship-v1';

// ─── Layout Types ─────────────────────────────────────────────────────────────

export const QUAD_VIEW_LAYOUT_TYPES = [
  '1-up',
  '2-up-horizontal',
  '2-up-vertical',
  '3-up',
  '4-up-quad',
  'focus',
] as const;

export type QuadViewLayoutType = typeof QUAD_VIEW_LAYOUT_TYPES[number];

export const QUAD_VIEW_LAYOUT_LABELS: Record<QuadViewLayoutType, string> = {
  '1-up': '1-Up (Single)',
  '2-up-horizontal': '2-Up Side by Side',
  '2-up-vertical': '2-Up Stacked',
  '3-up': '3-Up',
  '4-up-quad': 'Quad View (4-Up)',
  'focus': 'Focus Pane',
};

export const QUAD_VIEW_LAYOUT_DESCRIPTIONS: Record<QuadViewLayoutType, string> = {
  '1-up': 'Normal single-tab browsing.',
  '2-up-horizontal': 'Two panes side by side. Great for comparing pages or referencing while browsing.',
  '2-up-vertical': 'Two panes stacked. Great for long-form content.',
  '3-up': 'Three panes. Primary pane plus two supporting panes.',
  '4-up-quad': 'Big Screen Quad View. Four panes simultaneously. Signature TAHAI browsing mode.',
  'focus': 'Maximize the active pane without losing the quad/split layout. Return to previous layout when done.',
};

// ─── Profile Availability ─────────────────────────────────────────────────────

/**
 * Quad View is available in ALL profiles.
 * Personal and Minimal hide the button by default but the user can enable it.
 * Custom shows all layouts clearly.
 */
export type QuadViewProfileAvailability = {
  profileKind: string;
  quadViewAvailable: true;
  defaultVisible: boolean;
  canEnable: true;
  note: string;
};

export const QUAD_VIEW_PROFILE_AVAILABILITY: QuadViewProfileAvailability[] = [
  { profileKind: 'personal', quadViewAvailable: true, defaultVisible: false, canEnable: true, note: 'Hidden by default in Personal profile. Enable in UI Customization → Quad View.' },
  { profileKind: 'it-admin', quadViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Quad View enabled by default. Used for admin consoles + IT tools + logs + runbook.' },
  { profileKind: 'devops', quadViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Quad View enabled by default. Used for GitHub Actions + cloud console + staging + evidence.' },
  { profileKind: 'msp-support', quadViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Quad View enabled by default. Used for support + evidence + handoff + client context.' },
  { profileKind: 'security-incident', quadViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Quad View enabled by default. Used for DNS/TLS + logs + live site + incident evidence.' },
  { profileKind: 'minimal-privacy', quadViewAvailable: true, defaultVisible: false, canEnable: true, note: 'Hidden by default in Minimal profile. Enable in UI Customization → Quad View.' },
  { profileKind: 'custom', quadViewAvailable: true, defaultVisible: true, canEnable: true, note: 'Quad View available and visible in Custom profile.' },
];

// ─── Quad View Use Cases ──────────────────────────────────────────────────────

export type QuadViewUseCase = {
  id: string;
  label: string;
  description: string;
  category: 'daily-browsing' | 'professional' | 'operator';
  example: [string, string, string, string];
};

export const QUAD_VIEW_USE_CASES: QuadViewUseCase[] = [
  // Daily browsing — Quad View is for everyone
  { id: 'personal-research', label: 'Research + Notes + Video + Search', category: 'daily-browsing', description: 'Quad View for focused research on a big screen.', example: ['Research article', 'Notes / writing', 'Related video', 'Search engine'] },
  { id: 'personal-news', label: 'Sports / News / Social / Wiki', category: 'daily-browsing', description: 'Four content streams simultaneously.', example: ['Sports scores', 'News feed', 'Social timeline', 'Wikipedia'] },
  { id: 'personal-productivity', label: 'Email + Calendar + Docs + Music', category: 'daily-browsing', description: 'Personal productivity in one big-screen view.', example: ['Email', 'Calendar', 'Document editor', 'Music streaming'] },
  { id: 'personal-dashboard', label: 'Dashboard + Browser + Chat + Docs', category: 'daily-browsing', description: 'Work context in four panes.', example: ['Dashboard', 'Browser/research', 'Chat', 'Working document'] },
  // Professional
  { id: 'creator-preview', label: 'Creator Preview', category: 'professional', description: 'Preview content across desktop and mobile layouts.', example: ['Desktop layout', 'Mobile preview', 'Analytics', 'Social post'] },
  { id: 'business-monitor', label: 'Business Monitor', category: 'professional', description: 'Monitor your online presence across four surfaces.', example: ['Website live', 'Analytics', 'Reviews/feedback', 'Email/inbox'] },
  // Operator
  { id: 'devops-deploy', label: 'DevOps Deploy Quad', category: 'operator', description: 'Source/logs + deploy provider + live site + runbook.', example: ['GitHub Actions', 'Cloud console', 'Staging app', 'Evidence/runbook'] },
  { id: 'it-admin-quad', label: 'IT Admin Quad', category: 'operator', description: 'Admin consoles + IT tools + monitoring + docs.', example: ['M365 Admin', 'Entra/Azure', 'DNS/TLS Tools', 'IT Documentation'] },
  { id: 'security-incident', label: 'Security Incident Quad', category: 'operator', description: 'DNS/TLS + logs + live site + evidence timeline.', example: ['DNS/TLS/Headers', 'Security logs', 'Live site', 'Evidence pack'] },
  { id: 'dns-migration', label: 'DNS / Cloudflare Quad', category: 'operator', description: 'Cloudflare + registrar + live site + DNS/TLS tools.', example: ['Cloudflare Dashboard', 'Registrar DNS', 'Live site', 'DNS/TLS tools'] },
];

// ─── Quad View Command Center Actions ────────────────────────────────────────

export type QuadViewCommand = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  requiresMission: false;
  hiddenByProfileReason: string;
};

export const QUAD_VIEW_COMMANDS: QuadViewCommand[] = [
  { id: 'quad-open', label: 'Open Quad View', description: 'Switch to 4-Up Big Screen Quad View.', shortcut: 'Ctrl+Alt+Q', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-send-active', label: 'Send Current Tab to Quad View', description: 'Add the current tab to Quad View as the active pane.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-focus-pane', label: 'Focus Active Pane', description: 'Maximize the active pane without losing the Quad layout.', shortcut: 'Ctrl+Alt+F', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-restore-focus', label: 'Restore from Focus Pane', description: 'Return to the previous Quad layout from Focus Pane.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-return-1up', label: 'Return to 1-Up', description: 'Exit Quad View and return to normal single-tab browsing.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-save-workspace', label: 'Save Quad Layout as Workspace', description: 'Save the current 4-pane layout as a named workspace or mission.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-2up', label: '2-Up Side by Side', description: 'Switch to 2-Up horizontal layout.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
  { id: 'quad-3up', label: '3-Up Layout', description: 'Switch to 3-Up layout.', requiresMission: false, hiddenByProfileReason: 'Quad View is hidden by this profile. Enable it in UI Customization → Quad View.' },
];

// ─── Quad View New Tab Cards ──────────────────────────────────────────────────

export type QuadViewNewTabCard = {
  profileKind: string;
  id: string;
  label: string;
  description: string;
  action: string;
  visibleByDefault: boolean;
};

export const QUAD_VIEW_NEW_TAB_CARDS: QuadViewNewTabCard[] = [
  { profileKind: 'personal', id: 'quad-personal', label: 'Open Big Screen Quad View', description: 'Browse four pages simultaneously on your big screen.', action: 'quad-open', visibleByDefault: false },
  { profileKind: 'it-admin', id: 'quad-it', label: 'Open Admin Quad', description: 'Admin console + IT tools + monitoring + docs in one view.', action: 'quad-open-it', visibleByDefault: true },
  { profileKind: 'devops', id: 'quad-devops', label: 'Open Build/Deploy Quad', description: 'GitHub Actions + cloud console + staging + evidence.', action: 'quad-open-devops', visibleByDefault: true },
  { profileKind: 'msp-support', id: 'quad-msp', label: 'Open Support Handoff Quad', description: 'Support context + evidence + handoff + client reference.', action: 'quad-open-msp', visibleByDefault: true },
  { profileKind: 'security-incident', id: 'quad-security', label: 'Open Incident Quad', description: 'DNS/TLS tools + logs + live site + evidence timeline.', action: 'quad-open-security', visibleByDefault: true },
  { profileKind: 'minimal-privacy', id: 'quad-minimal', label: 'Big Screen Quad View', description: 'Browse four pages simultaneously. Enable in UI Customization.', action: 'quad-open', visibleByDefault: false },
  { profileKind: 'custom', id: 'quad-custom', label: 'Open Quad View', description: 'Four panes, fully configurable.', action: 'quad-open', visibleByDefault: true },
];

// ─── Summary ──────────────────────────────────────────────────────────────────

export function quadViewSummary(): string {
  const allProfilesHaveQuad = QUAD_VIEW_PROFILE_AVAILABILITY.every(p => p.quadViewAvailable && p.canEnable);
  const enableableInAll = QUAD_VIEW_PROFILE_AVAILABILITY.every(p => p.canEnable);
  return `${PASS346_QUAD_VIEW_PASS} ${QUAD_VIEW_CONTRACT_ID}: profiles=${QUAD_VIEW_PROFILE_AVAILABILITY.length}; allHaveQuad=${allProfilesHaveQuad}; allCanEnable=${enableableInAll}; requiresMission=false; useCases=${QUAD_VIEW_USE_CASES.length}; commands=${QUAD_VIEW_COMMANDS.length}`;
}
