import { app, clipboard, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { listBrowserProfiles } from './profile-manager';
import { listMissions } from './mission-store';
import { getEnterpriseAdminPolicyForRenderer, getEnterpriseAdminPolicySummary } from './enterprise-admin-policy';
import { TAHAI_PRODUCT_NAME, TAHAI_RELEASE_CHANNEL, TAHAI_RELEASE_PASS, TAHAI_RELEASE_VERSION, releaseTruthForRenderer } from '../shared/release-truth';
import {
  ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID,
  ENTERPRISE_SUPPORT_BUNDLE_PASS,
  ENTERPRISE_SUPPORT_BUNDLE_SCHEMA_VERSION,
  enterpriseSupportBundleMarkdown,
  enterpriseSupportBundleSection,
  type EnterpriseSupportBundleManifest,
  type EnterpriseSupportBundleMode,
  type EnterpriseSupportBundleResult
} from '../shared/enterprise-support-bundle-contract';

const SUPPORT_BUNDLE_SAFE_NAME = `TAHAI-enterprise-support-bundle-${TAHAI_RELEASE_VERSION}.md`;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return 0;
}

function supportBundleManifest(mode: EnterpriseSupportBundleMode): EnterpriseSupportBundleManifest {
  const releaseTruth = releaseTruthForRenderer();
  const policy = getEnterpriseAdminPolicyForRenderer();
  const profiles = listBrowserProfiles();
  const missions = listMissions();
  const policySummary = getEnterpriseAdminPolicySummary();
  const argvHash = sha256(process.argv.map((arg) => arg.replace(/=.*/, '=[REDACTED]')).join('|')).slice(0, 16);

  const sections = [
    enterpriseSupportBundleSection('versionTruth', 'Version truth', 'public-safe', [
      `product=${TAHAI_PRODUCT_NAME}`,
      `version=${TAHAI_RELEASE_VERSION}`,
      `releasePass=${TAHAI_RELEASE_PASS}`,
      `releaseChannel=${TAHAI_RELEASE_CHANNEL}`,
      `signingStatus=${releaseTruth.signingStatus}`,
      `updatePolicy=${releaseTruth.updatePolicy}`,
      `downloadOrigin=${releaseTruth.downloadOrigin}`,
      `publicRepoUrl=${releaseTruth.publicRepoUrl}`
    ]),
    enterpriseSupportBundleSection('policyTruth', 'Enterprise policy truth', 'internal-redacted', [
      `policyId=${policy.policy.policyId}`,
      `policyName=${policy.policy.policyName}`,
      `source=${policy.sourceLabel}`,
      `managedBy=${policy.policy.managedBy}`,
      `disabledTools=${policy.policy.disabledTools.join(',') || 'none'}`,
      `blockedProtocols=${policy.policy.blockedProtocols.join(',') || 'none'}`,
      `allowedProtocols=${policy.policy.allowedProtocols.join(',') || 'none'}`,
      `supportBundleMode=${policy.policy.supportBundle.mode}`,
      `supportBundleIncludesPolicyTruth=${policy.policy.supportBundle.includePolicyTruth}`,
      ...policySummary
    ]),
    enterpriseSupportBundleSection('installTruth', 'Install truth', 'internal-redacted', [
      `isPackaged=${app.isPackaged}`,
      `appName=${app.getName()}`,
      `appVersion=${app.getVersion()}`,
      `portableOrDev=${app.isPackaged ? 'packaged' : 'development-source-run'}`,
      'installPath=[REDACTED_LOCAL_PATH]',
      'userDataPath=[REDACTED_LOCAL_PATH]',
      'generatedInstallerArtifactsIncluded=false'
    ]),
    enterpriseSupportBundleSection('runtimeTruth', 'Runtime truth', 'internal-redacted', [
      `platform=${process.platform}`,
      `arch=${process.arch}`,
      `electron=${process.versions.electron || 'unavailable'}`,
      `chrome=${process.versions.chrome || 'unavailable'}`,
      `node=${process.versions.node}`,
      `v8=${process.versions.v8}`,
      `sandboxExpected=true`,
      `argvHash=${argvHash}`,
      'rawCommandLineIncluded=false'
    ]),
    enterpriseSupportBundleSection('profileTruth', 'Profile truth', 'internal-redacted', [
      `activeProfileId=${profiles.activeProfileId}`,
      `profileCount=${safeCount(profiles.profiles)}`,
      `profileKinds=${profiles.profiles.map((profile) => profile.kind).join(',') || 'none'}`,
      'profileDataPathsIncluded=false',
      'cookiesIncluded=false',
      'localStorageIncluded=false'
    ]),
    enterpriseSupportBundleSection('missionTruth', 'Mission truth', 'internal-redacted', [
      `missionListOk=${missions.ok}`,
      `missionCount=${safeCount(missions.missions)}`,
      `missionError=${missions.error || 'none'}`,
      'rawMissionFilesIncluded=false',
      'missionNotesIncluded=false',
      'evidenceBodiesIncluded=false'
    ]),
    enterpriseSupportBundleSection('privacyTruth', 'Privacy and redaction truth', 'public-safe', [
      'redactionApplied=true',
      'localPathsRedacted=true',
      'rawCookiesIncluded=false',
      'rawTokensIncluded=false',
      'rawBrowserProfilesIncluded=false',
      'rawMissionFilesIncluded=false',
      'clipboardInputIncluded=false',
      'pageDomIncluded=false'
    ]),
    enterpriseSupportBundleSection('provenanceTruth', 'Signing, provenance, and SBOM truth', 'public-safe', [
      'PASS159 source gate present=true',
      'SBOM required before enterprise GA=true',
      'release provenance required before enterprise GA=true',
      'signed-artifact-or-unsigned-preview truth required=true',
      'installer smoke evidence required before enterprise GA=true'
    ]),
    enterpriseSupportBundleSection('logTruth', 'Log truth', 'internal-redacted', [
      'liveLogCollection=not-enabled-in-source-only-pass',
      'logPathsIncluded=false',
      'logLineLimit=80',
      'supportBundleCanBeSavedAsMarkdown=true',
      'supportBundleCanBeCopied=true'
    ])
  ];

  return {
    schemaVersion: ENTERPRISE_SUPPORT_BUNDLE_SCHEMA_VERSION,
    pass: ENTERPRISE_SUPPORT_BUNDLE_PASS,
    contractId: ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID,
    createdAt: new Date().toISOString(),
    product: TAHAI_PRODUCT_NAME,
    version: TAHAI_RELEASE_VERSION,
    releasePass: TAHAI_RELEASE_PASS,
    releaseChannel: TAHAI_RELEASE_CHANNEL,
    bundleMode: mode,
    redactionApplied: true,
    localPathsRedacted: true,
    secretsRedacted: true,
    rawCookiesIncluded: false,
    rawTokensIncluded: false,
    rawBrowserProfilesIncluded: false,
    rawMissionFilesIncluded: false,
    sections,
    blockedFromEnterpriseGAClaims: [
      'Support bundle is a redacted diagnostic/handoff artifact, not proof of installed-app GA readiness by itself.',
      'Enterprise GA remains blocked until PASS162 validates source, package, installed smoke, policy, security, evidence, signing/provenance, and manual attestations.',
      'No raw cookies, tokens, browser profiles, mission notes, or local filesystem paths are included in this support bundle.'
    ]
  };
}

function resultFor(mode: EnterpriseSupportBundleMode): EnterpriseSupportBundleResult {
  const manifest = supportBundleManifest(mode);
  const markdown = enterpriseSupportBundleMarkdown(manifest);
  return { ok: true, canceled: false, savedLabel: '', markdown, manifest, error: '' };
}

export function previewEnterpriseSupportBundle(): EnterpriseSupportBundleResult {
  return resultFor('preview');
}

export function copyEnterpriseSupportBundle(): EnterpriseSupportBundleResult {
  const result = resultFor('copy');
  clipboard.writeText(result.markdown);
  return result;
}

export async function saveEnterpriseSupportBundle(): Promise<EnterpriseSupportBundleResult> {
  const result = resultFor('save');
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save TAHAI Enterprise Support Bundle',
    defaultPath: SUPPORT_BUNDLE_SAFE_NAME,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (canceled || !filePath) return { ...result, ok: false, canceled: true, markdown: '', savedLabel: '', error: '' };
  const safeExt = path.extname(filePath).toLowerCase() === '.md' ? filePath : `${filePath}.md`;
  await fs.promises.writeFile(safeExt, result.markdown, 'utf8');
  return { ...result, savedLabel: 'Saved redacted enterprise support bundle.' };
}
