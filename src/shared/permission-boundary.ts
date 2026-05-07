export const PASS95_PERMISSION_BOUNDARY_TAG = 'PASS95_ORIGIN_AWARE_PERMISSION_BOUNDARY';

export type BrowserPermissionName = 'media' | 'geolocation' | 'notifications' | 'clipboard-read' | 'fullscreen';

export type BrowserPermissionBoundarySettings = {
  allowClipboardRead?: boolean;
  allowMedia?: boolean;
  allowGeolocation?: boolean;
  allowNotifications?: boolean;
};

export type BrowserPermissionBoundaryDecision = {
  ok: boolean;
  permission: string;
  normalizedPermission: BrowserPermissionName | '';
  origin: string;
  reason: string;
  secureContext: boolean;
};

const POWERFUL_PERMISSION_ALIASES = new Map<string, BrowserPermissionName>([
  ['media', 'media'],
  ['camera', 'media'],
  ['microphone', 'media'],
  ['geolocation', 'geolocation'],
  ['notifications', 'notifications'],
  ['clipboard-read', 'clipboard-read'],
  ['fullscreen', 'fullscreen']
]);

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const MAX_PERMISSION_ORIGIN_CHARS = 2048;

function cleanText(value: unknown, max = MAX_PERMISSION_ORIGIN_CHARS): string {
  return String(value ?? '').replace(CONTROL_CHARS_RE, '').trim().slice(0, max);
}

function normalizePermission(permission: unknown): BrowserPermissionName | '' {
  return POWERFUL_PERMISSION_ALIASES.get(cleanText(permission, 80).toLowerCase()) || '';
}

function localhost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function parseOrigin(value: unknown): URL | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  try {
    return new URL(cleaned);
  } catch {
    try {
      return new URL(`${cleaned}/`);
    } catch {
      return null;
    }
  }
}

export function isSecureBrowserPermissionOrigin(origin: unknown): boolean {
  const parsed = parseOrigin(origin);
  if (!parsed) return false;
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:' && localhost(parsed.hostname)) return true;
  return false;
}

function settingEnabled(permission: BrowserPermissionName, settings: BrowserPermissionBoundarySettings): boolean {
  switch (permission) {
    case 'media': return settings.allowMedia === true;
    case 'geolocation': return settings.allowGeolocation === true;
    case 'notifications': return settings.allowNotifications === true;
    case 'clipboard-read': return settings.allowClipboardRead === true;
    case 'fullscreen': return true;
    default: return false;
  }
}

export function evaluateBrowserPermissionRequest(
  permission: unknown,
  origin: unknown,
  settings: BrowserPermissionBoundarySettings = {}
): BrowserPermissionBoundaryDecision {
  const rawPermission = cleanText(permission, 80).toLowerCase();
  const normalizedPermission = normalizePermission(rawPermission);
  const cleanedOrigin = cleanText(origin);
  const secureContext = isSecureBrowserPermissionOrigin(cleanedOrigin);

  if (!normalizedPermission) {
    return { ok: false, permission: rawPermission, normalizedPermission: '', origin: cleanedOrigin, secureContext, reason: 'Unknown browser permission denied by PASS95 boundary.' };
  }

  if (normalizedPermission === 'fullscreen') {
    const parsed = parseOrigin(cleanedOrigin);
    const fullscreenOk = secureContext || parsed?.protocol === 'file:';
    return {
      ok: fullscreenOk,
      permission: rawPermission,
      normalizedPermission,
      origin: cleanedOrigin,
      secureContext: fullscreenOk,
      reason: fullscreenOk ? 'Fullscreen allowed for secure, localhost, or trusted shell origins.' : 'Fullscreen denied for insecure or unknown origin.'
    };
  }

  if (!settingEnabled(normalizedPermission, settings)) {
    return { ok: false, permission: rawPermission, normalizedPermission, origin: cleanedOrigin, secureContext, reason: `${normalizedPermission} disabled in browser settings.` };
  }

  if (!secureContext) {
    return { ok: false, permission: rawPermission, normalizedPermission, origin: cleanedOrigin, secureContext, reason: `${normalizedPermission} denied because origin is not HTTPS or localhost.` };
  }

  return { ok: true, permission: rawPermission, normalizedPermission, origin: cleanedOrigin, secureContext, reason: `${normalizedPermission} allowed for configured secure origin.` };
}

export function browserPermissionBoundaryReason(permission: unknown, origin: unknown, settings: BrowserPermissionBoundarySettings = {}): string {
  return evaluateBrowserPermissionRequest(permission, origin, settings).reason;
}
