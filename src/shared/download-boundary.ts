export const PASS96_DOWNLOAD_BOUNDARY_TAG = 'PASS96_DOWNLOAD_HANDOFF_BOUNDARY';

export const MAX_DOWNLOAD_FILENAME_CHARS = 180;
export const MAX_DOWNLOAD_DETAIL_CHARS = 240;

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

export type BrowserDownloadState = {
  state: string;
  filename: string;
  detail?: string;
  warning?: string;
  sourceOrigin?: string;
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

export function downloadRiskWarning(filename: unknown, mimeType?: unknown): string {
  const extension = downloadFileExtension(filename);
  if (HIGH_RISK_DOWNLOAD_EXTENSIONS.has(extension)) return 'Executable or installer download. Verify publisher/signature before opening.';
  const mime = compactText(mimeType, 120).toLowerCase();
  if (mime.includes('application/x-msdownload') || mime.includes('application/x-msdos-program')) return 'Executable download. Verify publisher/signature before opening.';
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

export function createDownloadStatePayload(input: {
  state: unknown;
  filename: unknown;
  detail?: unknown;
  warning?: unknown;
  sourceUrl?: unknown;
}): BrowserDownloadState {
  const warning = compactText(input.warning || downloadRiskWarning(input.filename), MAX_DOWNLOAD_DETAIL_CHARS);
  const detail = compactText(input.detail, MAX_DOWNLOAD_DETAIL_CHARS);
  return {
    state: compactText(input.state, 80) || 'unknown',
    filename: sanitizeDownloadFilename(input.filename),
    ...(detail ? { detail } : {}),
    ...(warning ? { warning } : {}),
    ...(sanitizeDownloadSourceOrigin(input.sourceUrl) ? { sourceOrigin: sanitizeDownloadSourceOrigin(input.sourceUrl) } : {}),
    sensitivePathHidden: true
  };
}
