/**
 * PASS321 — Per-Profile New Tab Experience
 *
 * Defines new tab content layout per active profile kind.
 * Each layout is a structured data contract — no HTML injection, no secrets.
 */

import type { BrowserProfileKindUx } from './browser-profile-ux-model';
import { isSurfaceVisible, isToolGroupEnabled, type BrowserProfileUxConfig } from './browser-profile-ux-model';

export const PASS321_PROFILE_NEW_TAB_PASS = 'PASS321';
export const PROFILE_NEW_TAB_CONTRACT_ID = 'profile-aware-new-tab-experience-v1';

// ─── New Tab Card Types ───────────────────────────────────────────────────────

export type NewTabCardKind =
  | 'search'
  | 'quicklink'
  | 'tool-launcher'
  | 'admin-console-launcher'
  | 'privacy-control'
  | 'recent-missions'
  | 'devops-launcher'
  | 'evidence-shortcut'
  | 'support-shortcut'
  | 'incident-shortcut'
  | 'branding';

export type NewTabCard = {
  kind: NewTabCardKind;
  id: string;
  title: string;
  description: string;
  action: string;
  /** Surface that must be visible for this card to show. null = always show. */
  requiredSurface: string | null;
  /** Tool group that must be enabled. null = always show. */
  requiredToolGroup: string | null;
};

export type NewTabLayout = {
  pass: typeof PASS321_PROFILE_NEW_TAB_PASS;
  profileKind: BrowserProfileKindUx;
  heading: string;
  subheading: string;
  cards: NewTabCard[];
};

// ─── Layout Definitions ───────────────────────────────────────────────────────

export const NEW_TAB_LAYOUTS: Record<BrowserProfileKindUx, NewTabLayout> = {
  'personal': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'personal',
    heading: 'TAHAI Browser',
    subheading: 'Your daily driver browser.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'branding', id: 'brand', title: 'TAHAI Browser', description: 'A configurable, enterprise-grade Chromium browser.', action: 'open-about', requiredSurface: null, requiredToolGroup: null },
    ],
  },
  'it-admin': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'it-admin',
    heading: 'IT Admin Workspace',
    subheading: 'Admin consoles, IT tools, mission control, and evidence.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'admin-console-launcher', id: 'admin-consoles', title: 'Admin Console Profiles', description: 'M365, Entra, Google Workspace, AWS, GCP, Cloudflare, and more.', action: 'open-admin-console-profiles', requiredSurface: 'admin-console-profiles', requiredToolGroup: null },
      { kind: 'tool-launcher', id: 'it-tools', title: 'IT Tools', description: 'DNS, TLS, headers, redirects, endpoint checks.', action: 'open-it-tools', requiredSurface: 'it-tools', requiredToolGroup: 'it-admin' },
      { kind: 'recent-missions', id: 'recent-missions', title: 'Recent Missions', description: 'Continue or review recent operator missions.', action: 'open-mission-control', requiredSurface: 'mission-control', requiredToolGroup: 'mission' },
      { kind: 'evidence-shortcut', id: 'evidence', title: 'Evidence Pack', description: 'Capture, redact, and export evidence.', action: 'open-evidence-pack', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence' },
      { kind: 'support-shortcut', id: 'support', title: 'Support Bundle', description: 'Capture and export a sanitized support bundle.', action: 'open-support-bundle', requiredSurface: 'support-bundle', requiredToolGroup: 'support' },
    ],
  },
  'devops': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'devops',
    heading: 'DevOps Workspace',
    subheading: 'GitHub, cloud consoles, release tools, endpoint checks.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'admin-console-launcher', id: 'admin-consoles', title: 'DevOps Consoles', description: 'GitHub, GitHub Actions, AWS, Azure, GCP, Cloudflare, Vercel, Firebase.', action: 'open-admin-console-profiles', requiredSurface: 'admin-console-profiles', requiredToolGroup: null },
      { kind: 'devops-launcher', id: 'devops-tools', title: 'DevOps Tools', description: 'JSON/YAML, JWT decoder, checksum verifier, endpoint smoke check.', action: 'open-devops-tools', requiredSurface: 'devops-tools', requiredToolGroup: 'devops' },
      { kind: 'recent-missions', id: 'recent-missions', title: 'Mission Recipes', description: 'Launch a release, deploy, or debug recipe.', action: 'open-mission-recipes', requiredSurface: 'mission-recipes', requiredToolGroup: 'mission' },
      { kind: 'evidence-shortcut', id: 'evidence', title: 'Release Evidence', description: 'Capture and export release artifacts and evidence.', action: 'open-evidence-pack', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence' },
    ],
  },
  'msp-support': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'msp-support',
    heading: 'MSP Support Workspace',
    subheading: 'Handoffs, evidence, sanitized exports, ticket references.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'support-shortcut', id: 'support-bundle', title: 'Support Bundle', description: 'Capture and export a sanitized client-safe support bundle.', action: 'open-support-bundle', requiredSurface: 'support-bundle', requiredToolGroup: 'support' },
      { kind: 'evidence-shortcut', id: 'evidence', title: 'Evidence Pack', description: 'Capture, redact, and export evidence for handoff.', action: 'open-evidence-pack', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence' },
      { kind: 'recent-missions', id: 'recent-missions', title: 'Recent Missions', description: 'Continue or review recent support missions.', action: 'open-mission-control', requiredSurface: 'mission-control', requiredToolGroup: 'mission' },
      { kind: 'tool-launcher', id: 'ticket-reference', title: 'Ticket & Reference', description: 'Quick links for ticket systems and reference documentation.', action: 'open-bookmarks', requiredSurface: 'bookmarks', requiredToolGroup: null },
    ],
  },
  'security-incident': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'security-incident',
    heading: 'Security / Incident Response',
    subheading: 'DNS, TLS, headers, redirects, JWT, CIDR, timeline, evidence.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'tool-launcher', id: 'security-tools', title: 'Security Tools', description: 'DNS lookup, TLS check, HTTP headers, redirect chain, JWT decoder, CIDR, checksum.', action: 'open-it-tools', requiredSurface: 'it-tools', requiredToolGroup: 'dns' },
      { kind: 'incident-shortcut', id: 'incident-recipes', title: 'Incident Recipes', description: 'Launch an incident response or security audit recipe.', action: 'open-mission-recipes', requiredSurface: 'mission-recipes', requiredToolGroup: 'mission' },
      { kind: 'evidence-shortcut', id: 'evidence', title: 'Evidence & Timeline', description: 'Capture evidence, review timeline, export redacted incident packet.', action: 'open-evidence-pack', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence' },
    ],
  },
  'minimal-privacy': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'minimal-privacy',
    heading: 'TAHAI Browser',
    subheading: 'Clean. Private. Minimal.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'privacy-control', id: 'privacy', title: 'Privacy Controls', description: 'Do Not Track, third-party cookie blocking, referrer policy.', action: 'open-settings-privacy', requiredSurface: 'settings', requiredToolGroup: 'privacy' },
    ],
  },
  'custom': {
    pass: PASS321_PROFILE_NEW_TAB_PASS,
    profileKind: 'custom',
    heading: 'Custom Workspace',
    subheading: 'Your personalized TAHAI Browser.',
    cards: [
      { kind: 'search', id: 'search', title: 'Search or enter address', description: 'Navigate anywhere.', action: 'focus-address-bar', requiredSurface: null, requiredToolGroup: null },
      { kind: 'admin-console-launcher', id: 'admin-consoles', title: 'Admin Console Profiles', description: 'Launch a configured admin console.', action: 'open-admin-console-profiles', requiredSurface: 'admin-console-profiles', requiredToolGroup: null },
      { kind: 'tool-launcher', id: 'it-tools', title: 'IT Tools', description: 'DNS, TLS, headers, redirects, endpoint checks.', action: 'open-it-tools', requiredSurface: 'it-tools', requiredToolGroup: 'it-admin' },
      { kind: 'devops-launcher', id: 'devops-tools', title: 'DevOps Tools', description: 'JSON/YAML, JWT, checksum, endpoint checks.', action: 'open-devops-tools', requiredSurface: 'devops-tools', requiredToolGroup: 'devops' },
      { kind: 'recent-missions', id: 'recent-missions', title: 'Missions', description: 'Mission Control, Recipes, Evidence, Timeline.', action: 'open-mission-control', requiredSurface: 'mission-control', requiredToolGroup: 'mission' },
    ],
  },
};

/**
 * Get the new tab layout for the active profile, filtered by surface/tool-group visibility.
 */
export function getNewTabLayoutForProfile(config: BrowserProfileUxConfig): NewTabLayout {
  const base = NEW_TAB_LAYOUTS[config.newTabLayout] ?? NEW_TAB_LAYOUTS['personal'];
  const filteredCards = base.cards.filter(card => {
    if (card.requiredSurface && !isSurfaceVisible(config, card.requiredSurface as Parameters<typeof isSurfaceVisible>[1])) return false;
    if (card.requiredToolGroup && !isToolGroupEnabled(config, card.requiredToolGroup as Parameters<typeof isToolGroupEnabled>[1])) return false;
    return true;
  });
  return { ...base, cards: filteredCards };
}

export function profileNewTabSummary(config: BrowserProfileUxConfig): string {
  const layout = getNewTabLayoutForProfile(config);
  return `${PASS321_PROFILE_NEW_TAB_PASS} ${PROFILE_NEW_TAB_CONTRACT_ID}: kind=${config.profileKind}; layout=${config.newTabLayout}; cards=${layout.cards.length}`;
}
