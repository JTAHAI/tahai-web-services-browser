import {
  TAHAI_RELEASE_PASS,
  TAHAI_RELEASE_PHASE,
  TAHAI_RELEASE_VERSION,
  TAHAI_UPDATE_CHANNEL,
} from './release-truth';

export const FINAL_SHIP_CANDIDATE_PASS = 'PASS150';
export const FINAL_SHIP_CANDIDATE_VERSION = TAHAI_RELEASE_VERSION;
export const FINAL_SHIP_CANDIDATE_RELEASE_PASS = TAHAI_RELEASE_PASS;
export const FINAL_SHIP_CANDIDATE_RELEASE_PHASE = TAHAI_RELEASE_PHASE;
export const FINAL_SHIP_CANDIDATE_UPDATE_CHANNEL = TAHAI_UPDATE_CHANNEL;
export const FINAL_SHIP_CANDIDATE_STATUS = 'rc2-final-ship-candidate-ga-manifest';

export const FINAL_SHIP_CANDIDATE_REQUIRED_PRIOR_PASSES = [
  'PASS138',
  'PASS139',
  'PASS140',
  'PASS141',
  'PASS142',
  'PASS143',
  'PASS144',
  'PASS145',
  'PASS146',
  'PASS147',
  'PASS148',
  'PASS149',
] as const;

export const FINAL_SHIP_CANDIDATE_RELEASE_BLOCKERS = [
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-139-linux-package-handoff-closeout',
  'verify:pass-140-download-install-checksum-ux',
  'verify:pass-141-version-about-update-channel-truth',
  'verify:pass-142-electron-security-final-audit',
  'verify:pass-143-mission-redaction-closeout',
  'verify:pass-144-public-repo-supply-chain',
  'verify:pass-145-privacy-support-known-issues',
  'verify:pass-146-windows-installed-smoke',
  'verify:pass-147-linux-installed-smoke',
  'verify:pass-148-cross-size-responsive-regression',
  'verify:pass-149-rc1-freeze',
  'verify:pass-150-final-ship-candidate',
] as const;

export const FINAL_SHIP_CANDIDATE_FROZEN_SURFACES = [
  'normal-browser-shell',
  'tabs-titlebar-chrome-and-window-drag-region',
  'mission-control-one-up-two-up-triview-quad-focus',
  'active-pane-routing',
  'guide-kb-more-tools-overflow',
  'evidence-pack-redaction-export',
  'windows-installer-handoff',
  'linux-rpm-appimage-deb-handoff',
  'download-install-checksum-truth',
  'version-about-update-channel-truth',
  'electron-security-boundary',
  'public-repo-supply-chain-boundary',
  'privacy-support-known-issues-truth',
  'windows-linux-cross-size-manual-qa-runners',
] as const;

export const FINAL_SHIP_CANDIDATE_ALLOWED_CHANGES = [
  'release-blocker-fix',
  'security-blocker-fix',
  'critical-ui-regression-fix',
  'titlebar-drag-region-fix',
  'installer-handoff-truth-fix',
  'checksum-or-manifest-fix',
  'documentation-truth-fix',
  'manual-qa-evidence-fix',
] as const;

export const FINAL_SHIP_CANDIDATE_BLOCKED_CHANGES = [
  'new-user-facing-feature',
  'new-integration-or-provider',
  'direct-psa-api-call',
  'itdocs-backend-code',
  'secret-or-token-storage',
  'silent-auto-update',
  'telemetry-or-analytics',
  'unreviewed-dependency-addition',
  'generated-artifact-in-source',
  'version-bump-without-explicit-release-decision',
] as const;
