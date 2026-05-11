import { TAHAI_RELEASE_VERSION } from './release-truth';

export const PRIVACY_SUPPORT_KNOWN_ISSUES_PASS = 'PASS145' as const;
export const PRIVACY_SUPPORT_KNOWN_ISSUES_VERSION = TAHAI_RELEASE_VERSION;
export const PRIVACY_SUPPORT_KNOWN_ISSUES_CHANNEL = 'public-rc' as const;

export const PRIVACY_POSTURE = {
  telemetry: 'no-intentional-telemetry',
  saleOfData: 'no-sale-of-user-data',
  storage: 'local-browser-and-mission-data-only',
  thirdPartySites: 'third-party-sites-keep-their-own-policies',
  officialDownloads: 'github-releases-and-official-tahai-download-pages-only',
  updateModel: 'manual-release-no-silent-auto-update',
  missionEvidence: 'redaction-before-export-or-sync',
} as const;

export const SUPPORT_POSTURE = {
  lane: 'early-public-preview',
  supportModel: 'best-effort-open-source-support',
  bugReports: 'github-issues-with-redacted-reproduction-steps',
  securityReports: 'security-md-or-private-vulnerability-reporting',
  installHelp: 'include-platform-installer-type-version-and-checksum-status',
  dataRule: 'never-post-secrets-cookies-tokens-or-customer-data',
} as const;

export const KNOWN_ISSUES_POSTURE = {
  currentSection: '1.8.30 PASS145 documentation closeout',
  windowsSigning: 'unsigned-preview-until-approved-signing-lane',
  linuxValidation: 'manual-installed-package-smoke-required-before-broad-announcement',
  macos: 'developer-packaging-only-until-apple-signing-notarization',
  integrationBoundary: 'it-docs-and-psa-remain-browser-side-contracts',
  gaTruth: 'not-enterprise-ga-until-pass150-ga-manifest',
} as const;

export const REQUIRED_PRIVACY_DOC_TOKENS = [
  'does not intentionally collect',
  'does not sell',
  'local Mission Control',
  'Evidence Pack',
  'redaction',
  'third-party websites',
  'official TAHAI download pages',
  'GitHub Releases',
  'manual release downloads only',
  'no silent auto-update',
] as const;

export const REQUIRED_SUPPORT_DOC_TOKENS = [
  'early public preview',
  'best-effort open-source support',
  'GitHub issue',
  'SECURITY.md',
  'Do not post secrets',
  'Browser version',
  'installer type',
  'SHA256',
  'Mission Control',
  'PASS145',
] as const;

export const REQUIRED_KNOWN_ISSUES_TOKENS = [
  '1.8.30 PASS145 documentation closeout',
  'not enterprise GA',
  'PASS150',
  'Unsigned Windows preview',
  'manual installed-app smoke',
  'Linux AppImage',
  'Linux deb',
  'Linux rpm',
  'macOS packages must be built on macOS',
  'IT Docs and PSA integration surfaces are browser-side contracts only',
  'no direct PSA API calls',
  'Privacy Policy',
  'Support',
] as const;
