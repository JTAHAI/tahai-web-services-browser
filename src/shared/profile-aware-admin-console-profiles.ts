/**
 * PASS323 — Admin Console Profiles by Browser Profile
 *
 * Makes Admin Console Profiles profile-aware.
 * IT Admin profiles see IT/MSP admin consoles.
 * DevOps profiles see developer/cloud consoles.
 * Personal/Minimal profiles see none unless enabled.
 */

import type { BrowserProfileKindUx, BrowserProfileUxConfig } from './browser-profile-ux-model';
import { isSurfaceVisible } from './browser-profile-ux-model';

export const PASS323_ADMIN_CONSOLE_PROFILES_PASS = 'PASS323';
export const PROFILE_AWARE_ADMIN_CONTRACT_ID = 'profile-aware-admin-console-profiles-v1';

// ─── Console Group Kinds ──────────────────────────────────────────────────────

export type AdminConsoleGroup = 'it-admin' | 'devops' | 'both';

export type ProfileAwareAdminConsoleEntry = {
  id: string;
  label: string;
  description: string;
  url: string;
  consoleGroup: AdminConsoleGroup;
  /** Safe protocol check — only https allowed. */
  safeProtocol: true;
  icon: string;
};

// ─── IT Admin Consoles ────────────────────────────────────────────────────────

const IT_ADMIN_CONSOLES: ProfileAwareAdminConsoleEntry[] = [
  { id: 'microsoft-365', label: 'Microsoft 365 Admin', description: 'Microsoft 365 admin center for users, licenses, and services.', url: 'https://admin.microsoft.com', consoleGroup: 'it-admin', safeProtocol: true, icon: '🏢' },
  { id: 'azure-entra', label: 'Entra / Azure AD', description: 'Azure Entra ID for identity, groups, and conditional access.', url: 'https://entra.microsoft.com', consoleGroup: 'it-admin', safeProtocol: true, icon: '🔐' },
  { id: 'azure-portal', label: 'Azure Portal', description: 'Microsoft Azure resource management portal.', url: 'https://portal.azure.com', consoleGroup: 'both', safeProtocol: true, icon: '☁️' },
  { id: 'google-workspace', label: 'Google Workspace Admin', description: 'Google Workspace admin console for users and services.', url: 'https://admin.google.com', consoleGroup: 'it-admin', safeProtocol: true, icon: '🌐' },
  { id: 'gcp-console', label: 'Google Cloud Console', description: 'Google Cloud Platform resource management.', url: 'https://console.cloud.google.com', consoleGroup: 'both', safeProtocol: true, icon: '🔵' },
  { id: 'aws-console', label: 'AWS Management Console', description: 'Amazon Web Services management console.', url: 'https://console.aws.amazon.com', consoleGroup: 'both', safeProtocol: true, icon: '🟠' },
  { id: 'cloudflare', label: 'Cloudflare Dashboard', description: 'DNS, CDN, security, and zero-trust management.', url: 'https://dash.cloudflare.com', consoleGroup: 'both', safeProtocol: true, icon: '🟡' },
  { id: 'registrar-dns', label: 'Registrar / DNS', description: 'Placeholder for your domain registrar or DNS provider.', url: 'https://dash.cloudflare.com', consoleGroup: 'it-admin', safeProtocol: true, icon: '🌍' },
  { id: 'firewall-vpn', label: 'Firewall / VPN', description: 'Placeholder for your firewall or VPN management console.', url: 'https://www.cisco.com/c/en/us/support/security/index.html', consoleGroup: 'it-admin', safeProtocol: true, icon: '🛡️' },
  { id: 'it-docs', label: 'IT Documentation', description: 'IT documentation reference — browser-side only. No PSA API calls from this browser.', url: 'https://learn.microsoft.com/en-us/microsoft-365/', consoleGroup: 'it-admin', safeProtocol: true, icon: '📄' },
];

// ─── DevOps Consoles ──────────────────────────────────────────────────────────

const DEVOPS_CONSOLES: ProfileAwareAdminConsoleEntry[] = [
  { id: 'github', label: 'GitHub', description: 'Source control, pull requests, code review.', url: 'https://github.com', consoleGroup: 'devops', safeProtocol: true, icon: '🐙' },
  { id: 'github-actions', label: 'GitHub Actions', description: 'CI/CD workflows and pipeline management.', url: 'https://github.com/actions', consoleGroup: 'devops', safeProtocol: true, icon: '⚙️' },
  { id: 'aws-console-devops', label: 'AWS Console', description: 'Amazon Web Services management console.', url: 'https://console.aws.amazon.com', consoleGroup: 'devops', safeProtocol: true, icon: '🟠' },
  { id: 'azure-portal-devops', label: 'Azure Portal', description: 'Microsoft Azure resource management.', url: 'https://portal.azure.com', consoleGroup: 'devops', safeProtocol: true, icon: '☁️' },
  { id: 'gcp-console-devops', label: 'Google Cloud', description: 'Google Cloud Platform resource management.', url: 'https://console.cloud.google.com', consoleGroup: 'devops', safeProtocol: true, icon: '🔵' },
  { id: 'cloudflare-devops', label: 'Cloudflare', description: 'DNS, CDN, Cloudflare Pages, Workers.', url: 'https://dash.cloudflare.com', consoleGroup: 'devops', safeProtocol: true, icon: '🟡' },
  { id: 'vercel', label: 'Vercel', description: 'Frontend cloud deployments and edge functions.', url: 'https://vercel.com/dashboard', consoleGroup: 'devops', safeProtocol: true, icon: '▲' },
  { id: 'firebase', label: 'Firebase Console', description: 'Firebase hosting, Firestore, Functions.', url: 'https://console.firebase.google.com', consoleGroup: 'devops', safeProtocol: true, icon: '🔥' },
  { id: 'cloudflare-pages', label: 'Cloudflare Pages', description: 'Static site and full-stack deployments.', url: 'https://pages.cloudflare.com', consoleGroup: 'devops', safeProtocol: true, icon: '📄' },
  { id: 'monitoring', label: 'Logs / Monitoring', description: 'Placeholder for your observability or logging platform.', url: 'https://grafana.com/login', consoleGroup: 'devops', safeProtocol: true, icon: '📊' },
];

// ─── Combined Registry ────────────────────────────────────────────────────────

const ALL_CONSOLES = [...IT_ADMIN_CONSOLES, ...DEVOPS_CONSOLES];

/**
 * Returns the admin console entries visible for the given profile config.
 * Personal and Minimal profiles return empty unless adminProfilesEnabled is true.
 */
export function getAdminConsolesForProfile(config: BrowserProfileUxConfig): ProfileAwareAdminConsoleEntry[] {
  // Surface must be visible
  if (!isSurfaceVisible(config, 'admin-console-profiles')) return [];
  if (!config.adminProfilesEnabled) return [];

  switch (config.profileKind) {
    case 'it-admin':
      return ALL_CONSOLES.filter(c => c.consoleGroup === 'it-admin' || c.consoleGroup === 'both');
    case 'devops':
      return ALL_CONSOLES.filter(c => c.consoleGroup === 'devops' || c.consoleGroup === 'both');
    case 'msp-support':
      // MSP gets a subset of IT admin consoles (no firewall/VPN by default)
      return ALL_CONSOLES.filter(c => (c.consoleGroup === 'it-admin' || c.consoleGroup === 'both') && c.id !== 'firewall-vpn');
    case 'security-incident':
      return ALL_CONSOLES.filter(c => c.consoleGroup === 'it-admin' || c.consoleGroup === 'both');
    case 'custom':
      return ALL_CONSOLES;
    case 'personal':
    case 'minimal-privacy':
      return [];
    default:
      return [];
  }
}

/**
 * Validates that a console URL is safe (https only, no local file/javascript).
 */
export function validateAdminConsoleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns the console entries that are safe to launch (URL validated).
 */
export function getSafeAdminConsolesForProfile(config: BrowserProfileUxConfig): ProfileAwareAdminConsoleEntry[] {
  return getAdminConsolesForProfile(config).filter(c => validateAdminConsoleUrl(c.url));
}

export function profileAwareAdminConsolesSummary(config: BrowserProfileUxConfig): string {
  const consoles = getSafeAdminConsolesForProfile(config);
  return `${PASS323_ADMIN_CONSOLE_PROFILES_PASS} ${PROFILE_AWARE_ADMIN_CONTRACT_ID}: kind=${config.profileKind}; adminEnabled=${config.adminProfilesEnabled}; consoles=${consoles.length}`;
}
