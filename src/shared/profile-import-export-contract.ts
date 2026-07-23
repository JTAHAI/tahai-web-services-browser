/**
 * PASS326 — Profile Import / Export / Reset
 *
 * Safe profile config portability:
 * - Export profile UI config as sanitized JSON (no cookies/passwords/tokens/history/credentials/session data)
 * - Import with schema validation and malicious-input rejection
 * - Reset to defaults
 * - Duplicate profile
 * - Rename profile
 * - Delete profile (with confirmation; cannot delete last profile)
 */

import type { BrowserProfileUxConfig, BrowserProfileKindUx } from './browser-profile-ux-model';
import { BROWSER_PROFILE_KINDS, sanitizeProfileUxConfig, defaultProfileUxConfig } from './browser-profile-ux-model';

export const PASS326_PROFILE_IMPORT_EXPORT_PASS = 'PASS326';
export const PROFILE_IMPORT_EXPORT_CONTRACT_ID = 'profile-import-export-reset-v1';
export const PROFILE_IMPORT_EXPORT_SCHEMA_VERSION = 1;

// ─── Export ───────────────────────────────────────────────────────────────────

export type ProfileExportEnvelope = {
  exportVersion: typeof PROFILE_IMPORT_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  profileName: string;
  profileKind: BrowserProfileKindUx;
  uxConfig: Omit<BrowserProfileUxConfig, 'enterprisePolicyLockedFields'>;
  guardrails: {
    noSessionData: true;
    noCookies: true;
    noHistory: true;
    noCredentials: true;
    noPasswords: true;
    noTokens: true;
    noStorageData: true;
    uiConfigOnly: true;
  };
};

/**
 * Build a safe export envelope from a profile UX config.
 * Strips enterprise policy locked fields (they are policy-managed, not portable).
 */
export function buildProfileExportEnvelope(name: string, config: BrowserProfileUxConfig): ProfileExportEnvelope {
  const { enterprisePolicyLockedFields: _stripped, ...uxConfig } = config;
  void _stripped;
  return {
    exportVersion: PROFILE_IMPORT_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profileName: name.slice(0, 72).replace(/[\u0000-\u001f\u007f]+/g, ''),
    profileKind: config.profileKind,
    uxConfig,
    guardrails: {
      noSessionData: true,
      noCookies: true,
      noHistory: true,
      noCredentials: true,
      noPasswords: true,
      noTokens: true,
      noStorageData: true,
      uiConfigOnly: true,
    },
  };
}

// ─── Import Validation ────────────────────────────────────────────────────────

export type ProfileImportResult =
  | { ok: true; config: BrowserProfileUxConfig; warnings: string[] }
  | { ok: false; error: string; config: null };

const MAX_IMPORT_BYTES = 64 * 1024;
const SECRETISH_IMPORT = /(?:bearer\s+|authorization\s*:|cookie\s*:|set-cookie\s*:|refresh[_-]?token|access[_-]?token|client[_-]?secret|api[_-]?key\s*[:=]\s*["'][^"']{8,}|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY|password\s*[:=]\s*["'][^"']{4,})/i;
const HTML_INJECTION = /<script|<html|<iframe|javascript:|data:text\/html/i;
const GIANT_FIELD = /[^\s]{4000,}/;

/**
 * Parse and validate a profile import JSON string.
 * Returns ok=false with a clean error if the input is invalid or malicious.
 */
export function importProfileFromJson(json: string): ProfileImportResult {
  if (!json || typeof json !== 'string') return { ok: false, error: 'Input is empty or not a string.', config: null };
  if (json.length > MAX_IMPORT_BYTES) return { ok: false, error: `Profile config is too large (max ${MAX_IMPORT_BYTES / 1024}KB).`, config: null };
  if (SECRETISH_IMPORT.test(json)) return { ok: false, error: 'Profile config contains secretish content (token, key, password). Rejected for safety.', config: null };
  if (HTML_INJECTION.test(json)) return { ok: false, error: 'Profile config contains HTML or script injection. Rejected.', config: null };
  if (GIANT_FIELD.test(json)) return { ok: false, error: 'Profile config contains an oversized field value. Rejected.', config: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Profile config is not valid JSON.', config: null };
  }

  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Profile config must be a JSON object.', config: null };

  const warnings: string[] = [];
  const raw = parsed as Record<string, unknown>;

  // Accept both envelope format and raw config
  const uxConfigRaw = raw.uxConfig ?? raw;

  // Check for unknown top-level keys (envelope)
  if (raw.uxConfig) {
    const knownEnvelopeKeys = new Set(['exportVersion', 'exportedAt', 'profileName', 'profileKind', 'uxConfig', 'guardrails']);
    for (const k of Object.keys(raw)) {
      if (!knownEnvelopeKeys.has(k)) warnings.push(`Unknown envelope field ignored: ${k}`);
    }
    // Verify guardrails
    const g = raw.guardrails as Record<string, unknown> | undefined;
    if (!g || g.uiConfigOnly !== true) {
      warnings.push('Guardrails not found or malformed — import treated as unverified.');
    }
  }

  const config = sanitizeProfileUxConfig(uxConfigRaw);
  if (config.visibleSurfaces.length === 0) {
    return { ok: false, error: 'Imported config has no valid visible surfaces.', config: null };
  }

  return { ok: true, config, warnings };
}

// ─── Reset / Duplicate ────────────────────────────────────────────────────────

export type ProfileResetResult = {
  ok: boolean;
  config: BrowserProfileUxConfig;
  message: string;
};

export function resetProfileToDefaults(currentKind: BrowserProfileKindUx): ProfileResetResult {
  const config = defaultProfileUxConfig(currentKind);
  return {
    ok: true,
    config,
    message: `Profile reset to ${currentKind} defaults. Your browsing data is unchanged.`,
  };
}

export function duplicateProfileConfig(source: BrowserProfileUxConfig): BrowserProfileUxConfig {
  return sanitizeProfileUxConfig({
    ...source,
    enterprisePolicyLockedFields: [],
  });
}

// ─── Delete Validation ────────────────────────────────────────────────────────

export type ProfileDeleteResult =
  | { ok: true; deletedId: string; message: string }
  | { ok: false; error: string };

/**
 * Validates that a profile can be deleted.
 * Cannot delete the last profile or a policy-locked profile.
 */
export function validateProfileDelete(
  profileId: string,
  totalProfiles: number,
  isDefault: boolean,
  policyAllowsSwitching: boolean
): ProfileDeleteResult {
  if (totalProfiles <= 1) return { ok: false, error: 'Cannot delete the last profile. At least one profile is required.' };
  if (isDefault) return { ok: false, error: 'Cannot delete the default profile. Set another profile as default first.' };
  if (!policyAllowsSwitching) return { ok: false, error: 'Profile deletion is disabled by enterprise policy.' };
  return { ok: true, deletedId: profileId, message: 'Profile deleted. Your browsing data was not affected.' };
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function profileImportExportSummary(action: 'export' | 'import' | 'reset' | 'duplicate', config: BrowserProfileUxConfig): string {
  return `${PASS326_PROFILE_IMPORT_EXPORT_PASS} ${PROFILE_IMPORT_EXPORT_CONTRACT_ID}: action=${action}; kind=${config.profileKind}; surfaces=${config.visibleSurfaces.length}; groups=${config.enabledToolGroups.length}; noSessionData=true; noCredentials=true`;
}
