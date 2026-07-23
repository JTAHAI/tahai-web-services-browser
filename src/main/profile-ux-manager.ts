/**
 * PASS317 — Profile UX Manager (main process)
 *
 * Reads and writes per-profile UX configuration.
 * Profile UX config is stored separately from session data.
 * No secrets, cookies, history, or credentials are stored here.
 */

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
  type BrowserProfileKindUx,
  type BrowserProfileUxConfig,
  type BrowserProfileUxPolicyLocks,
  BROWSER_PROFILE_KINDS,
  COMMAND_CENTER_CATEGORIES,
  ENABLED_TOOL_GROUPS,
  VISIBLE_SURFACES,
  defaultProfileUxConfig,
  sanitizeProfileUxConfig,
} from '../shared/browser-profile-ux-model';
import { readEnterpriseAdminPolicy } from './enterprise-admin-policy';

const MAX_PROFILE_UX_FILE_BYTES = 64 * 1024;

function profileUxDir(): string {
  return path.join(app.getPath('userData'), 'profile-ux');
}

function profileUxFilePath(profileId: string): string {
  const safe = profileId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default';
  return path.join(profileUxDir(), `${safe}.json`);
}

export function readProfileUxConfig(profileId: string): BrowserProfileUxConfig {
  const file = profileUxFilePath(profileId);
  if (!fs.existsSync(file)) {
    return defaultProfileUxConfig('personal');
  }
  try {
    const stat = fs.statSync(file);
    if (stat.size > MAX_PROFILE_UX_FILE_BYTES) return defaultProfileUxConfig('personal');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return sanitizeProfileUxConfig(raw);
  } catch {
    return defaultProfileUxConfig('personal');
  }
}

export function writeProfileUxConfig(profileId: string, config: BrowserProfileUxConfig): BrowserProfileUxConfig {
  const safe = sanitizeProfileUxConfig(config);
  // Apply any enterprise policy locks before writing
  const locked = applyProfileUxPolicyLocks(safe);
  const dir = profileUxDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    profileUxFilePath(profileId),
    `${JSON.stringify(locked, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 }
  );
  return locked;
}

export function initProfileUxConfig(profileId: string, kind: BrowserProfileKindUx): BrowserProfileUxConfig {
  // Only write if no config exists yet
  const file = profileUxFilePath(profileId);
  if (!fs.existsSync(file)) {
    return writeProfileUxConfig(profileId, defaultProfileUxConfig(kind));
  }
  return readProfileUxConfig(profileId);
}

export function resetProfileUxConfig(profileId: string): BrowserProfileUxConfig {
  const existing = readProfileUxConfig(profileId);
  const reset = defaultProfileUxConfig(existing.profileKind);
  return writeProfileUxConfig(profileId, reset);
}

export function deleteProfileUxConfig(profileId: string): void {
  const file = profileUxFilePath(profileId);
  if (fs.existsSync(file)) {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }
}

// ─── Enterprise Policy Application ───────────────────────────────────────────

function applyProfileUxPolicyLocks(config: BrowserProfileUxConfig): BrowserProfileUxConfig {
  const policyState = readEnterpriseAdminPolicy();
  if (!policyState.managed) return config;

  // Read UI policy if it exists (PASS325 extension point)
  // For now we apply the base enterprise admin policy surface constraints.
  const ui = policyState.policy.lockedSettings?.ui;
  if (!ui) return config;

  const patched = { ...config };

  // If enterprise policy disables Ops/workbench tools, reflect in profile
  if (ui.showWorkbenchTools === false) {
    patched.missionControlEnabled = false;
    patched.evidenceEnabled = false;
    patched.runbookEnabled = false;
    patched.devOpsToolsEnabled = false;
    patched.itToolsEnabled = false;
    patched.adminProfilesEnabled = false;
    patched.supportBundleEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s =>
      !['ops-mode', 'mission-control', 'mission-recipes', 'admin-console-profiles',
        'it-tools', 'devops-tools', 'evidence-pack', 'runbook-rail', 'mission-timeline',
        'support-bundle', 'policy-diagnostics', 'artifact-shelf'].includes(s)
    );
  }

  if (ui.surfaceMode === 'daily-driver') {
    patched.defaultMode = 'daily-driver';
  }

  return patched;
}

/**
 * Get the profile UX policy locks derived from the active enterprise admin policy.
 * Used by PASS325 for the policy diagnostics surface.
 */
export function getProfileUxPolicyLocks(): BrowserProfileUxPolicyLocks {
  const policyState = readEnterpriseAdminPolicy();
  if (!policyState.managed) return {};

  const ui = policyState.policy.lockedSettings?.ui;
  const locks: BrowserProfileUxPolicyLocks = {};

  if (ui?.showWorkbenchTools === false) {
    locks.allowOpsMode = false;
    locks.allowMissionExports = false;
    locks.allowEvidenceCapture = false;
    locks.allowSupportBundle = false;
    locks.allowDevOpsTools = false;
    locks.allowITTools = false;
    locks.allowAdminConsoleProfiles = false;
  }
  if (ui?.surfaceMode === 'daily-driver') {
    locks.defaultProfileKind = 'personal';
  }

  return locks;
}

/**
 * Export a profile UX config as sanitized JSON — no secrets, no session data.
 */
export function exportProfileUxConfig(profileId: string): string {
  const config = readProfileUxConfig(profileId);
  // Explicitly omit enterprisePolicyLockedFields from export (they're policy-managed)
  const exportable = { ...config, enterprisePolicyLockedFields: [] };
  return JSON.stringify(exportable, null, 2);
}

/**
 * Import and validate a profile UX config from JSON string.
 * Returns null if invalid/malicious.
 */
export function importProfileUxConfigFromJson(json: string, profileId: string): BrowserProfileUxConfig | null {
  if (!json || typeof json !== 'string') return null;
  if (json.length > MAX_PROFILE_UX_FILE_BYTES) return null;

  // Reject secretish content
  const SECRETISH = /(?:bearer\s+|authorization\s*:|cookie\s*:|set-cookie\s*:|refresh[_-]?token|access[_-]?token|client[_-]?secret|api[_-]?key|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i;
  if (SECRETISH.test(json)) return null;

  // Reject HTML/script injection
  if (/<script|<html|javascript:|data:text\/html/i.test(json)) return null;

  try {
    const parsed = JSON.parse(json);
    const config = sanitizeProfileUxConfig(parsed);
    // Verify at least one valid surface exists
    if (config.visibleSurfaces.length === 0) return null;
    // Ensure all values are from allowed enums (sanitizeProfileUxConfig handles this)
    const written = writeProfileUxConfig(profileId, config);
    return written;
  } catch {
    return null;
  }
}

/**
 * All supported profile kinds with labels — for UI consumption.
 */
export function listProfileKinds(): Array<{ kind: BrowserProfileKindUx; label: string; description: string }> {
  return BROWSER_PROFILE_KINDS.map(kind => ({
    kind,
    label: kind === 'personal' ? 'Personal Daily Driver'
      : kind === 'it-admin' ? 'IT Admin'
      : kind === 'devops' ? 'DevOps / Builder'
      : kind === 'msp-support' ? 'MSP / Support Desk'
      : kind === 'security-incident' ? 'Security / Incident Response'
      : kind === 'minimal-privacy' ? 'Minimal / Privacy'
      : 'Custom',
    description: kind === 'personal' ? 'Clean browser. Normal daily browsing. No IT or DevOps clutter.'
      : kind === 'it-admin' ? 'IT tools, Admin Console Profiles, Mission Control, Evidence, Runbook, and policy surfaces.'
      : kind === 'devops' ? 'DevOps tools, GitHub, cloud consoles, release evidence, endpoint checks, and mission recipes.'
      : kind === 'msp-support' ? 'Ticket/reference surfaces, handoff exports, evidence packets, and client-safe sanitized exports.'
      : kind === 'security-incident' ? 'DNS/TLS/headers/redirects/JWT/CIDR/checksum tools, timeline, evidence, redaction, and incident packets.'
      : kind === 'minimal-privacy' ? 'Very clean UI. Privacy controls surfaced. All operator surfaces hidden unless explicitly enabled.'
      : 'You choose every visible surface and enabled tool group.',
  }));
}

export {
  BROWSER_PROFILE_UX_MODEL_SCHEMA_VERSION,
  BROWSER_PROFILE_KINDS,
  COMMAND_CENTER_CATEGORIES,
  ENABLED_TOOL_GROUPS,
  VISIBLE_SURFACES,
  defaultProfileUxConfig,
  sanitizeProfileUxConfig,
};
