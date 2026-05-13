export const PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION = 'PASS193-bookmark-admin-launch-reliability-v1' as const;

export type Pass193LaunchSurface =
  | 'bookmark-bar'
  | 'bookmark-menu'
  | 'bookmark-folder-view'
  | 'bookmark-manager'
  | 'ops-hub'
  | 'mission-control'
  | 'command-palette'
  | 'keyboard-shortcut';

export type Pass193LaunchTargetKind =
  | 'bookmark-url'
  | 'bookmark-folder-tabs'
  | 'bookmark-folder-mission'
  | 'admin-console-profile'
  | 'mission-recipe'
  | 'kb-link';

export type Pass193ReliabilityCaseId =
  | 'bookmark-url-launches-through-address-router'
  | 'bookmark-folder-mission-sanitizes-event-detail'
  | 'admin-console-profile-ids-resolve-before-launch'
  | 'launch-recipe-ids-are-unique-and-not-dead'
  | 'launch-surfaces-carry-source-and-kind-diagnostics'
  | 'wrong-pane-replacement-is-blocked-by-active-target-routing';

export type Pass193ReliabilityCase = {
  id: Pass193ReliabilityCaseId;
  surface: Pass193LaunchSurface | 'all';
  targetKind: Pass193LaunchTargetKind | 'all';
  requirement: string;
};

export const PASS193_BOOKMARK_ADMIN_RELIABILITY_CASES: Pass193ReliabilityCase[] = [
  {
    id: 'bookmark-url-launches-through-address-router',
    surface: 'bookmark-bar',
    targetKind: 'bookmark-url',
    requirement: 'Saved bookmark URLs are normalized and launched through the same address/router path as operator-entered URLs.'
  },
  {
    id: 'bookmark-folder-mission-sanitizes-event-detail',
    surface: 'bookmark-folder-view',
    targetKind: 'bookmark-folder-mission',
    requirement: 'Bookmark-folder Mission events are treated as untrusted input and revalidated before tabs, panes, evidence, or notes are created.'
  },
  {
    id: 'admin-console-profile-ids-resolve-before-launch',
    surface: 'ops-hub',
    targetKind: 'admin-console-profile',
    requirement: 'Admin Console Profile launch buttons resolve to an existing recipe/profile before any profile switch or tab close happens.'
  },
  {
    id: 'launch-recipe-ids-are-unique-and-not-dead',
    surface: 'all',
    targetKind: 'mission-recipe',
    requirement: 'Launch recipe IDs remain unique and missing/deprecated IDs fail with a visible no-op instead of closing tabs or opening the wrong workspace.'
  },
  {
    id: 'launch-surfaces-carry-source-and-kind-diagnostics',
    surface: 'all',
    targetKind: 'all',
    requirement: 'Bookmark, profile, and recipe launch controls expose source/kind diagnostics for manual QA and support bundles.'
  },
  {
    id: 'wrong-pane-replacement-is-blocked-by-active-target-routing',
    surface: 'all',
    targetKind: 'all',
    requirement: 'Bookmark/admin launches use deterministic tab creation or active target routing and never silently replace an unrelated Mission pane.'
  }
];

export const PASS193_BOOKMARK_MISSION_EVENT_NAME = 'tahai-browser:start-mission-from-bookmark-folder' as const;

export const PASS193_REQUIRED_BOOKMARK_DEFAULT_FOLDERS = [
  'TAHAI',
  'IT Admin',
  'DevOps',
  'AI Workbench'
] as const;

export const PASS193_REQUIRED_ADMIN_PROFILE_PROVIDERS = [
  'microsoft',
  'azure',
  'google',
  'aws',
  'cloudflare',
  'github',
  'vercel',
  'firebase',
  'registrar-dns',
  'firewall-vpn',
  'itdocs',
  'psa'
] as const;

export function pass193BookmarkAdminLaunchSummary(): string {
  return `${PASS193_BOOKMARK_ADMIN_RELIABILITY_CASES.length} bookmark/admin launch reliability invariants active`;
}
