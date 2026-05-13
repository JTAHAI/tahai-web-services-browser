export const PASS96_DOWNLOAD_BOUNDARY_TAG = 'PASS96_DOWNLOAD_HANDOFF_BOUNDARY';
export const PASS194_DOWNLOAD_ARTIFACT_SHELF_TAG = 'PASS194_DOWNLOAD_ARTIFACT_SHELF_UX';

export const MAX_DOWNLOAD_FILENAME_CHARS = 180;
export const MAX_DOWNLOAD_DETAIL_CHARS = 240;
export const MAX_DOWNLOAD_CHECKSUM_CHARS = 128;

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const WINDOWS_UNSAFE_CHARS_RE = /[<>:"/\\|?*]/g;
const RESERVED_WINDOWS_BASENAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

const HIGH_RISK_DOWNLOAD_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'js', 'jse', 'wsf', 'scr', 'com', 'pif',
  'app', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'sh', 'bash', 'zsh', 'jar'
]);

const ELEVATED_RISK_DOWNLOAD_EXTENSIONS = new Set([
  'zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'xz', 'iso', 'img', 'vhd', 'vhdx', 'docm', 'xlsm', 'pptm'
]);

export type BrowserDownloadArtifactRiskLevel = 'low' | 'elevated' | 'high';

export type BrowserDownloadState = {
  artifactId: string;
  state: string;
  filename: string;
  displayLabel: string;
  detail?: string;
  warning?: string;
  sourceOrigin?: string;
  riskLevel: BrowserDownloadArtifactRiskLevel;
  riskLabel: string;
  checksumSha256?: string;
  canRevealInFolder: boolean;
  handoffRelation: string;
  sensitivePathHidden: true;
};

function compactText(value: unknown, max = MAX_DOWNLOAD_DETAIL_CHARS): string {
  return String(value ?? '').replace(CONTROL_CHARS_RE, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function pathTail(value: string): string {
  const parts = value.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : value;
}

function splitExtension(filename: string): { stem: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return { stem: filename, extension: '' };
  return { stem: filename.slice(0, lastDot), extension: filename.slice(lastDot) };
}

export function sanitizeDownloadFilename(input: unknown, fallback = 'download'): string {
  const raw = compactText(input, MAX_DOWNLOAD_FILENAME_CHARS * 2) || fallback;
  const tail = pathTail(raw)
    .replace(WINDOWS_UNSAFE_CHARS_RE, '_')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  const cleaned = tail || fallback;
  const { stem, extension } = splitExtension(cleaned);
  const safeStem = RESERVED_WINDOWS_BASENAMES.has(stem.toLowerCase()) ? `${stem}_download` : stem;
  const clipped = `${safeStem}${extension}`.slice(0, MAX_DOWNLOAD_FILENAME_CHARS).trim().replace(/[. ]+$/g, '');
  return clipped || fallback;
}

export function downloadFileExtension(filename: unknown): string {
  const safe = sanitizeDownloadFilename(filename);
  const lastDot = safe.lastIndexOf('.');
  return lastDot > 0 && lastDot < safe.length - 1 ? safe.slice(lastDot + 1).toLowerCase() : '';
}

export function classifyDownloadArtifactRisk(filename: unknown, mimeType?: unknown): BrowserDownloadArtifactRiskLevel {
  const extension = downloadFileExtension(filename);
  const mime = compactText(mimeType, 120).toLowerCase();
  if (HIGH_RISK_DOWNLOAD_EXTENSIONS.has(extension)) return 'high';
  if (mime.includes('application/x-msdownload') || mime.includes('application/x-msdos-program')) return 'high';
  if (ELEVATED_RISK_DOWNLOAD_EXTENSIONS.has(extension)) return 'elevated';
  if (mime.includes('application/zip') || mime.includes('application/x-7z') || mime.includes('application/x-rar')) return 'elevated';
  return 'low';
}

export function downloadArtifactRiskLabel(riskLevel: BrowserDownloadArtifactRiskLevel): string {
  if (riskLevel === 'high') return 'High risk';
  if (riskLevel === 'elevated') return 'Review';
  return 'Normal';
}

export function downloadRiskWarning(filename: unknown, mimeType?: unknown): string {
  const riskLevel = classifyDownloadArtifactRisk(filename, mimeType);
  if (riskLevel === 'high') return 'Executable or installer download. Verify publisher/signature before opening.';
  if (riskLevel === 'elevated') return 'Archive, disk image, or macro-capable file. Verify source and checksum before handoff.';
  return '';
}

export function sanitizeDownloadSourceOrigin(sourceUrl: unknown): string {
  const raw = compactText(sourceUrl, 2048);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) return '';
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}


export function createDownloadArtifactId(input: { filename?: unknown; sourceUrl?: unknown; startedAt?: unknown }): string {
  const seed = [sanitizeDownloadFilename(input.filename), compactText(input.sourceUrl, 512), compactText(input.startedAt, 80)].join('|') || 'download';
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `artifact-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function sanitizeDownloadArtifactId(value: unknown): string {
  const raw = compactText(value, 96).toLowerCase();
  return /^artifact-[a-f0-9]{8,16}$/.test(raw) ? raw : '';
}

export function sanitizeDownloadChecksum(value: unknown): string {
  const raw = compactText(value, MAX_DOWNLOAD_CHECKSUM_CHARS).toLowerCase();
  return /^[a-f0-9]{64}$/.test(raw) ? raw : '';
}

export function downloadArtifactHandoffRelation(state: unknown): string {
  const cleanState = compactText(state, 80).toLowerCase();
  if (cleanState === 'completed') return 'Evidence-ready metadata; file content stays local unless the operator explicitly attaches it.';
  if (cleanState === 'progressing' || cleanState === 'started') return 'Download is being tracked for later evidence or handoff review.';
  if (cleanState === 'cancelled' || cleanState === 'interrupted') return 'Not evidence-ready; keep the failed state in the operator trail only.';
  return 'Artifact metadata only; local filesystem path is never exposed to the renderer.';
}

export function createDownloadStatePayload(input: {
  state: unknown;
  filename: unknown;
  detail?: unknown;
  warning?: unknown;
  sourceUrl?: unknown;
  artifactId?: unknown;
  startedAt?: unknown;
  mimeType?: unknown;
  checksumSha256?: unknown;
  canRevealInFolder?: unknown;
}): BrowserDownloadState {
  const state = compactText(input.state, 80) || 'unknown';
  const filename = sanitizeDownloadFilename(input.filename);
  const riskLevel = classifyDownloadArtifactRisk(filename, input.mimeType);
  const warning = compactText(input.warning || downloadRiskWarning(filename, input.mimeType), MAX_DOWNLOAD_DETAIL_CHARS);
  const detail = compactText(input.detail, MAX_DOWNLOAD_DETAIL_CHARS);
  const sourceOrigin = sanitizeDownloadSourceOrigin(input.sourceUrl);
  const artifactId = sanitizeDownloadArtifactId(input.artifactId) || createDownloadArtifactId({ filename, sourceUrl: input.sourceUrl, startedAt: input.startedAt });
  const checksumSha256 = sanitizeDownloadChecksum(input.checksumSha256);
  return {
    artifactId,
    state,
    filename,
    displayLabel: filename,
    ...(detail ? { detail } : {}),
    ...(warning ? { warning } : {}),
    ...(sourceOrigin ? { sourceOrigin } : {}),
    riskLevel,
    riskLabel: downloadArtifactRiskLabel(riskLevel),
    ...(checksumSha256 ? { checksumSha256 } : {}),
    canRevealInFolder: input.canRevealInFolder === true,
    handoffRelation: downloadArtifactHandoffRelation(state),
    sensitivePathHidden: true
  };
}
