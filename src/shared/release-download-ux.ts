import { TAHAI_RELEASE_VERSION } from './release-truth';

export type ReleaseDownloadPlatform = 'windows' | 'linux' | 'macos';
export type ReleaseDownloadAudience = 'public-preview' | 'enterprise-it' | 'tahai-os-sentinel';

export interface ReleaseDownloadArtifactCopy {
  readonly platform: ReleaseDownloadPlatform;
  readonly fileName: string;
  readonly label: string;
  readonly bestFor: string;
  readonly installHint: string;
  readonly checksumHint: string;
  readonly previewWarning?: string;
  readonly audience: readonly ReleaseDownloadAudience[];
}

export const RELEASE_DOWNLOAD_VERSION = TAHAI_RELEASE_VERSION;

export const RELEASE_DOWNLOAD_CHECKSUM_FILES = Object.freeze({
  windows: 'TAHAI-Windows-installers-SHA256SUMS.txt',
  linux: 'TAHAI-Linux-installers-SHA256SUMS.txt',
  linuxManifestJson: 'TAHAI-Linux-installers-manifest.json',
  linuxManifestText: 'TAHAI-Linux-installers-manifest.txt',
});

export const RELEASE_DOWNLOAD_ARTIFACTS: readonly ReleaseDownloadArtifactCopy[] = Object.freeze([
  {
    platform: 'windows',
    fileName: `TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.exe`,
    label: 'Windows x64 installer',
    bestFor: 'Most Windows preview installs.',
    installHint: 'Download the EXE, verify SHA256, then run the installer from an official TAHAI or GitHub Release location.',
    checksumHint: `Compare against ${RELEASE_DOWNLOAD_CHECKSUM_FILES.windows}.`,
    previewWarning: 'Unsigned preview: Windows SmartScreen may warn until the approved signing lane is active.',
    audience: ['public-preview', 'enterprise-it'],
  },
  {
    platform: 'windows',
    fileName: `TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.msi`,
    label: 'Windows x64 MSI',
    bestFor: 'Managed deployment testing after local MSI verification.',
    installHint: 'Use the MSI when packaging policy prefers MSI handoff; verify SHA256 before deployment.',
    checksumHint: `Compare against ${RELEASE_DOWNLOAD_CHECKSUM_FILES.windows}.`,
    previewWarning: 'Unsigned preview: deploy only to test rings until signing is active.',
    audience: ['enterprise-it'],
  },
  {
    platform: 'linux',
    fileName: `TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.AppImage`,
    label: 'Linux AppImage',
    bestFor: 'Portable Linux preview testing without package-manager install.',
    installHint: 'Run chmod +x, verify SHA256, then launch the AppImage directly.',
    checksumHint: `Compare against ${RELEASE_DOWNLOAD_CHECKSUM_FILES.linux}.`,
    audience: ['public-preview', 'enterprise-it'],
  },
  {
    platform: 'linux',
    fileName: `TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.deb`,
    label: 'Debian/Ubuntu DEB',
    bestFor: 'Ubuntu, Debian, and compatible desktop package testing.',
    installHint: 'Install with apt from the local DEB after checksum verification.',
    checksumHint: `Compare against ${RELEASE_DOWNLOAD_CHECKSUM_FILES.linux}.`,
    audience: ['public-preview', 'enterprise-it'],
  },
  {
    platform: 'linux',
    fileName: `TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.rpm`,
    label: 'Fedora/RHEL RPM',
    bestFor: 'Fedora, RHEL-family, and TAHAI OS/SENTINEL RPM handoff testing.',
    installHint: 'Install with dnf from the local RPM after checksum verification.',
    checksumHint: `Compare against ${RELEASE_DOWNLOAD_CHECKSUM_FILES.linux} and preserve the PASS139 manifest for downstream OS bundling.`,
    audience: ['public-preview', 'enterprise-it', 'tahai-os-sentinel'],
  },
]);

export function releaseDownloadArtifactNames(): string[] {
  return RELEASE_DOWNLOAD_ARTIFACTS.map((artifact) => artifact.fileName);
}

export function releaseDownloadChecksumFile(platform: ReleaseDownloadPlatform): string | null {
  if (platform === 'windows') return RELEASE_DOWNLOAD_CHECKSUM_FILES.windows;
  if (platform === 'linux') return RELEASE_DOWNLOAD_CHECKSUM_FILES.linux;
  return null;
}
