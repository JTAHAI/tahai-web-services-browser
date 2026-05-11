import {
  TAHAI_PRODUCT_NAME,
  TAHAI_RELEASE_CHANNEL,
  TAHAI_RELEASE_PASS,
  TAHAI_RELEASE_PHASE,
  TAHAI_RELEASE_VERSION,
  TAHAI_UPDATE_CHANNEL,
} from './release-truth';

export const RC1_FREEZE_PASS = 'PASS149' as const;
export const RC1_FREEZE_VERSION = TAHAI_RELEASE_VERSION;
export const RC1_FREEZE_PRODUCT = TAHAI_PRODUCT_NAME;
export const RC1_FREEZE_RELEASE_PASS = TAHAI_RELEASE_PASS;
export const RC1_FREEZE_CHANNEL = TAHAI_RELEASE_CHANNEL;
export const RC1_FREEZE_PHASE = TAHAI_RELEASE_PHASE;
export const RC1_FREEZE_UPDATE_CHANNEL = TAHAI_UPDATE_CHANNEL;
export const RC1_FREEZE_STATUS = 'rc1-freeze-no-new-features' as const;

export type Rc1FreezeAllowedChangeId =
  | 'release-blocker-fix'
  | 'security-blocker-fix'
  | 'build-or-packaging-fix'
  | 'installer-handoff-truth-fix'
  | 'documentation-truth-fix'
  | 'manual-qa-evidence-fix'
  | 'critical-regression-fix'
  | 'checksum-or-manifest-fix';

export type Rc1FreezeBlockedChangeId =
  | 'new-user-facing-feature'
  | 'new-integration-or-provider'
  | 'direct-psa-api-call'
  | 'itdocs-backend-code'
  | 'secret-or-token-storage'
  | 'silent-auto-update'
  | 'telemetry-or-analytics'
  | 'unreviewed-dependency-addition'
  | 'generated-artifact-in-source'
  | 'version-bump-without-explicit-release-decision';

export type Rc1FreezeSurfaceId =
  | 'normal-browser-shell'
  | 'titlebar-tabs-and-adaptive-chrome'
  | 'guide-kb-more-tools'
  | 'mission-control-one-up-two-up-triview-quad-focus'
  | 'active-pane-routing'
  | 'command-center'
  | 'runbook-rail'
  | 'evidence-pack-redaction-export'
  | 'kb-screenshot-intake-navigation'
  | 'windows-installer-handoff'
  | 'linux-rpm-appimage-deb-handoff'
  | 'download-install-checksum-ux'
  | 'version-about-update-channel-truth'
  | 'electron-security-boundary'
  | 'public-repo-supply-chain-boundary'
  | 'privacy-support-known-issues-truth'
  | 'windows-linux-cross-size-manual-qa-runners';

export type Rc1FreezeAllowedChange = {
  id: Rc1FreezeAllowedChangeId;
  label: string;
  rule: string;
};

export type Rc1FreezeBlockedChange = {
  id: Rc1FreezeBlockedChangeId;
  label: string;
  rule: string;
};

export type Rc1FrozenSurface = {
  id: Rc1FreezeSurfaceId;
  label: string;
  freezeRule: string;
};

export const RC1_FREEZE_ALLOWED_CHANGES: readonly Rc1FreezeAllowedChange[] = [
  {
    id: 'release-blocker-fix',
    label: 'Release-blocker verifier repair',
    rule: 'Allowed only when a current release-blocker gate is stale, contradictory, or incorrectly rejects the frozen source truth.',
  },
  {
    id: 'security-blocker-fix',
    label: 'Security blocker repair',
    rule: 'Allowed when a change strengthens the existing Electron, mission-file, IPC, export, or repo-hygiene boundary without adding product scope.',
  },
  {
    id: 'build-or-packaging-fix',
    label: 'Build or packaging repair',
    rule: 'Allowed when build, installer handoff, checksum, or package generation would otherwise block RC evidence.',
  },
  {
    id: 'installer-handoff-truth-fix',
    label: 'Installer handoff truth repair',
    rule: 'Allowed for Windows/Linux manifest, SHA256, and generated artifact exclusion accuracy only.',
  },
  {
    id: 'documentation-truth-fix',
    label: 'Documentation truth repair',
    rule: 'Allowed when public docs, README, support, known issues, privacy, download, or release notes are stale or overclaiming.',
  },
  {
    id: 'manual-qa-evidence-fix',
    label: 'Manual QA evidence repair',
    rule: 'Allowed for Windows, Linux, and cross-size evidence runners or checklists without claiming unrun manual tests.',
  },
  {
    id: 'critical-regression-fix',
    label: 'Critical regression repair',
    rule: 'Allowed when normal browsing, Mission Control entry/recovery, active-pane routing, installer launch, or export safety is broken.',
  },
  {
    id: 'checksum-or-manifest-fix',
    label: 'Checksum or manifest repair',
    rule: 'Allowed when generated release handoff files are missing, stale, mismatched, or not reproducible by the package lane.',
  },
] as const;

export const RC1_FREEZE_BLOCKED_CHANGES: readonly Rc1FreezeBlockedChange[] = [
  {
    id: 'new-user-facing-feature',
    label: 'New user-facing feature',
    rule: 'Blocked after PASS149 unless Justin explicitly reopens scope; defer to a post-GA pass.',
  },
  {
    id: 'new-integration-or-provider',
    label: 'New integration or provider',
    rule: 'Blocked after PASS149; IT Docs/PSA remain browser-side contracts only.',
  },
  {
    id: 'direct-psa-api-call',
    label: 'Direct PSA API call',
    rule: 'Always blocked in this open-source browser repo.',
  },
  {
    id: 'itdocs-backend-code',
    label: 'IT Docs backend code',
    rule: 'Blocked in the browser repo; this pass is browser-side only.',
  },
  {
    id: 'secret-or-token-storage',
    label: 'Secret or token storage',
    rule: 'Blocked in source, mission files, evidence fixtures, generated docs, and local manifests.',
  },
  {
    id: 'silent-auto-update',
    label: 'Silent auto-update lane',
    rule: 'Blocked for RC1; update channel remains manual-release.',
  },
  {
    id: 'telemetry-or-analytics',
    label: 'Telemetry or analytics',
    rule: 'Blocked for RC1 unless a future privacy-reviewed release explicitly adds it.',
  },
  {
    id: 'unreviewed-dependency-addition',
    label: 'Unreviewed dependency addition',
    rule: 'Blocked after PASS149 except for an explicit security/build blocker with lockfile review.',
  },
  {
    id: 'generated-artifact-in-source',
    label: 'Generated artifact in source',
    rule: 'Blocked: release, dist, artifacts, installers, manifests, runtime profiles, mission/evidence output, and node_modules remain excluded.',
  },
  {
    id: 'version-bump-without-explicit-release-decision',
    label: 'Version bump without explicit release decision',
    rule: 'Blocked; PASS149 keeps version at 1.8.30 and freezes the current public-rc lane.',
  },
] as const;

export const RC1_FROZEN_SURFACES: readonly Rc1FrozenSurface[] = [
  {
    id: 'normal-browser-shell',
    label: 'Normal browser shell',
    freezeRule: 'No new browsing features; only blocker fixes that preserve clean normal-mode behavior.',
  },
  {
    id: 'titlebar-tabs-and-adaptive-chrome',
    label: 'Titlebar tabs and adaptive chrome',
    freezeRule: 'No new chrome layout concepts; only regression repairs for clipping, overflow, or unusable controls.',
  },
  {
    id: 'guide-kb-more-tools',
    label: 'Guide/KB and More Tools overflow',
    freezeRule: 'Content and discoverability may be truth-fixed; no new feature categories.',
  },
  {
    id: 'mission-control-one-up-two-up-triview-quad-focus',
    label: 'Mission Control layouts',
    freezeRule: '1-Up, 2-Up, Tri-view, Quad, and Focus Pane are frozen for RC1 except critical entry/recovery repairs.',
  },
  {
    id: 'active-pane-routing',
    label: 'Active-pane routing',
    freezeRule: 'Routing must remain stable; repairs may only preserve or restore active-pane truth.',
  },
  {
    id: 'command-center',
    label: 'Command Center',
    freezeRule: 'Command inventory is frozen; no new commands unless needed to recover an existing RC workflow.',
  },
  {
    id: 'runbook-rail',
    label: 'Runbook Rail',
    freezeRule: 'No new rail features; allow usability or evidence-truth repairs only.',
  },
  {
    id: 'evidence-pack-redaction-export',
    label: 'Evidence Pack redaction/export',
    freezeRule: 'Redaction and export safety may be tightened; do not add new sync/writeback behavior.',
  },
  {
    id: 'kb-screenshot-intake-navigation',
    label: 'KB screenshot intake/navigation',
    freezeRule: 'Screenshot-aware KB flow is frozen; only docs/manifests/search truth may be corrected.',
  },
  {
    id: 'windows-installer-handoff',
    label: 'Windows installer handoff',
    freezeRule: 'Only package output, manifest, checksum, and smoke-evidence truth repairs are allowed.',
  },
  {
    id: 'linux-rpm-appimage-deb-handoff',
    label: 'Linux RPM/AppImage/DEB handoff',
    freezeRule: 'Only package output, target-specific handoff, checksum, and smoke-evidence truth repairs are allowed.',
  },
  {
    id: 'download-install-checksum-ux',
    label: 'Download/install/checksum UX',
    freezeRule: 'Only public download copy and checksum truth repairs are allowed.',
  },
  {
    id: 'version-about-update-channel-truth',
    label: 'Version/About/update-channel truth',
    freezeRule: 'Version remains 1.8.30; release pass may advance to PASS149; update channel remains manual-release.',
  },
  {
    id: 'electron-security-boundary',
    label: 'Electron security boundary',
    freezeRule: 'May only be tightened; never loosen BrowserWindow, webview, IPC, or protocol constraints.',
  },
  {
    id: 'public-repo-supply-chain-boundary',
    label: 'Public repo and supply-chain boundary',
    freezeRule: 'May only be tightened; no unreviewed package/dependency expansion.',
  },
  {
    id: 'privacy-support-known-issues-truth',
    label: 'Privacy/support/known-issues truth',
    freezeRule: 'May be updated for accuracy; never overpromise support, telemetry, or GA status.',
  },
  {
    id: 'windows-linux-cross-size-manual-qa-runners',
    label: 'Installed-app and cross-size manual QA runners',
    freezeRule: 'May collect evidence; must not claim unrun manual smoke success.',
  },
] as const;

export const RC1_FREEZE_REQUIRED_DOC_TOKENS = [
  'PASS149',
  'RC1 freeze',
  'no-new-features',
  'Version remains `1.8.30`',
  'public-rc',
  'manual-release',
  'No direct PSA API calls',
  'No IT Docs backend work',
  'No generated artifacts in source',
  'PASS150 final ship candidate / GA manifest',
] as const;
