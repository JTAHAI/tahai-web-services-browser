import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell, session, IpcMainInvokeEvent } from 'electron';
import type { WebContents } from 'electron';
import { createBrowserProfile, deleteBrowserProfile, listBrowserProfiles, profileDataPath, profileSessionPartitions, setActiveBrowserProfile, updateBrowserProfile } from './profile-manager';
import * as dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBrowserSettings, resetBrowserSettings, setBrowserDownloadDirectory, settingsForRenderer, writeBrowserSettings, writeBrowserSettingsWithOptions } from './settings';
import { hardenSession, revealDownloadArtifact } from './runtime-security';
import { runFirstLaunchChecks } from './first-run';
import { copyMissionExport, deleteMission, listMissions, loadMission, previewMissionExport, saveMission, saveMissionExport } from './mission-store';
import { getItDocsMissionCapabilities, itDocsCapabilitiesMarkdown, itDocsHomeUrl } from './itdocs-client';
import { localOnlyPsaReferenceContractState, psaReferenceMarkdown } from '../shared/psa-reference-contract';
import { isSafeExternalUrl, safeOpenExternal, safeExternalUrl as normalizeSafeExternalWindowUrl } from './safe-open-external';
import { sanitizeEvidenceMarkdown } from '../shared/evidence-safety';
import { localFilesystemHandoffLabel } from '../shared/local-path-boundary';
import { assertTrustedShellOrigin, isTrustedShellOrigin } from '../shared/shell-origin-boundary';
import { sanitizeActiveCaptureUrl } from '../shared/active-capture-boundary';
import { DIAGNOSTIC_TIMEOUT_MS, evaluateDiagnosticsHostScope, evaluateDiagnosticsRequestUrl, safeDiagnosticText, safeDiagnosticsRequestUrl, sanitizeDiagnosticHeaderMap } from '../shared/diagnostics-boundary';
import { TAHAI_BUNDLE_NAME, TAHAI_DEFAULT_HOME_URL, TAHAI_PRODUCT_NAME, TAHAI_RELEASE_CHANNEL, TAHAI_RELEASE_PASS, TAHAI_RELEASE_VERSION, releaseTruthForRenderer } from '../shared/release-truth';
import { TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES, isTrustedTahaiIpcChannel, isTrustedTahaiRendererEventChannel, type TahaiTrustedRendererEventChannel } from '../shared/electron-security-contract';
import { hardenWebviewAttachOptions, TAHAI_WEBVIEW_ATTACH_SECURITY_PASS, webviewAttachSecuritySummary, type TahaiWebviewAttachRecord } from '../shared/webview-attach-security-contract';
import { PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION, pass188NormalizeBeforeInputCommand, type Pass188BeforeInputLike, type Pass188InputBoundaryCommand, type Pass188InputBoundaryPayload, type Pass188InputBoundarySource } from '../shared/webview-focus-input-boundary-contract';
import { ENTERPRISE_ADMIN_POLICY_PASS, enterpriseAdminPolicySummary } from '../shared/enterprise-admin-policy-contract';
import { RUNTIME_E2E_HARNESS_PASS } from '../shared/runtime-e2e-harness-contract';
import { ENTERPRISE_SUPPORT_BUNDLE_PASS } from '../shared/enterprise-support-bundle-contract';
import { getEnterpriseAdminPolicyForRenderer, getEnterpriseAdminPolicySummary } from './enterprise-admin-policy';
import { copyEnterpriseSupportBundle, previewEnterpriseSupportBundle, saveEnterpriseSupportBundle } from './enterprise-support-bundle';
import { shouldRejectSettingsFileSize } from '../shared/settings-boundary';

const PRODUCT_NAME = TAHAI_PRODUCT_NAME;
const SOURCE_DEFAULT_HOME_URL = TAHAI_DEFAULT_HOME_URL;
const ITDOCS_HOME_URL = itDocsHomeUrl();
const BUNDLE_NAME = TAHAI_BUNDLE_NAME;
const RELEASE_CHANNEL = TAHAI_RELEASE_CHANNEL;
const SAFE_HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const MAX_MAIN_PROCESS_CAPTURE_CHARS = 120000;
const WINDOWS_TITLEBAR_CHROME_HEIGHT_PX = 44;
const WINDOWS_TITLEBAR_CAPTION_RESERVE_PX = 168;
const TAHAI_RUNTIME_DIAGNOSTIC_MODE = process.env.TAHAI_BROWSER_RUNTIME_DIAGNOSTICS === '1' || process.env.TAHAI_RUNTIME_E2E === '1';
const TAHAI_SINGLE_INSTANCE_LOCK_DISABLED = process.env.TAHAI_BROWSER_DISABLE_SINGLE_INSTANCE_LOCK === '1' || process.env.TAHAI_RUNTIME_E2E === '1';
const TAHAI_USER_DATA_SUFFIX = String(process.env.TAHAI_BROWSER_USER_DATA_SUFFIX || process.env.TAHAI_RUNTIME_E2E_RUN_ID || '').trim();

// PASS271-R9: Windows/Electron can leave guest webview surfaces white/non-interactive
// when GPU compositing wedges. Disable hardware acceleration for the release-confidence
// lane unless explicitly overridden for local comparison testing.
const PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT = 'PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT';
function installPass271R9WebviewCompositorCloseout(): void {
  if (process.env.TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE !== "1") {
    console.info("[PASS337] PASS271_R9 GPU/compositor disable is opt-in; set TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE=1 to re-enable.");
    return;
  }
  if (process.env.TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR === '0') return;
  try {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  } catch (error) {
    console.warn('[PASS271_R9] unable to apply webview compositor closeout', error);
  }
}
installPass271R9WebviewCompositorCloseout();

function tahaiLogRuntimeDiagnostic(label: string, detail: string): void {
  if (!TAHAI_RUNTIME_DIAGNOSTIC_MODE) return;
  console.info(`[TAHAI_RUNTIME] ${label} ${detail}`.trim());
}


type OpsCheckStatus = 'pass' | 'warn' | 'fail' | 'info';

type OpsHeaderCheck = {
  label: string;
  status: OpsCheckStatus;
  detail: string;
};

type OpsUrlDiagnostics = {
  ok: boolean;
  checkedAt: string;
  inputUrl: string;
  normalizedUrl: string;
  method: string;
  statusCode: number;
  statusMessage: string;
  durationMs: number;
  error: string;
  headers: Record<string, string>;
  checks: OpsHeaderCheck[];
};

type DnsMxRecord = {
  exchange: string;
  priority: number;
};

type ItServiceCardDiagnostics = {
  ok: boolean;
  checkedAt: string;
  inputUrl: string;
  normalizedUrl: string;
  hostname: string;
  dnsEligible: boolean;
  durationMs: number;
  records: {
    a: string[];
    aaaa: string[];
    cname: string[];
    ns: string[];
    mx: DnsMxRecord[];
  };
  errors: Record<string, string>;
  notes: OpsHeaderCheck[];
};

function header(headers: Record<string, string>, name: string): string {
  return headers[name.toLowerCase()] || '';
}

function buildOpsHeaderChecks(url: string, statusCode: number, error: string, headers: Record<string, string>): OpsHeaderCheck[] {
  const checks: OpsHeaderCheck[] = [];
  const isHttps = url.startsWith('https://');
  const csp = header(headers, 'content-security-policy');
  const xfo = header(headers, 'x-frame-options');
  const server = header(headers, 'server');
  const poweredBy = header(headers, 'x-powered-by');
  const cors = header(headers, 'access-control-allow-origin');
  const cache = header(headers, 'cache-control');

  if (error) {
    checks.push({ label: 'Reachability', status: 'fail', detail: error });
  } else if (statusCode >= 500) {
    checks.push({ label: 'HTTP response', status: 'fail', detail: `Server returned ${statusCode}.` });
  } else if (statusCode >= 400) {
    checks.push({ label: 'HTTP response', status: 'warn', detail: `Client/access response ${statusCode}; confirm whether this is expected.` });
  } else if (statusCode >= 300) {
    checks.push({ label: 'HTTP response', status: 'info', detail: `Redirect/alternate response ${statusCode}; review Location if present.` });
  } else {
    checks.push({ label: 'HTTP response', status: 'pass', detail: `Reachable with status ${statusCode}.` });
  }

  checks.push(isHttps
    ? { label: 'Transport', status: 'pass', detail: 'HTTPS transport is in use.' }
    : { label: 'Transport', status: 'warn', detail: 'HTTP transport detected; use HTTPS for production and provider-console workflows.' });

  checks.push(header(headers, 'strict-transport-security')
    ? { label: 'HSTS', status: 'pass', detail: 'Strict-Transport-Security header present.' }
    : { label: 'HSTS', status: isHttps ? 'warn' : 'info', detail: isHttps ? 'No HSTS header detected.' : 'HSTS only applies after HTTPS is enabled.' });

  checks.push(csp
    ? { label: 'Content Security Policy', status: 'pass', detail: 'CSP header present.' }
    : { label: 'Content Security Policy', status: 'warn', detail: 'No CSP header detected; document whether this is acceptable for this app.' });

  checks.push(xfo || /frame-ancestors/i.test(csp)
    ? { label: 'Clickjacking guard', status: 'pass', detail: 'X-Frame-Options or CSP frame-ancestors detected.' }
    : { label: 'Clickjacking guard', status: 'warn', detail: 'No X-Frame-Options or CSP frame-ancestors detected.' });

  checks.push(header(headers, 'referrer-policy')
    ? { label: 'Referrer policy', status: 'pass', detail: 'Referrer-Policy header present.' }
    : { label: 'Referrer policy', status: 'info', detail: 'No Referrer-Policy header detected.' });

  checks.push(cache
    ? { label: 'Cache policy', status: 'info', detail: `Cache-Control: ${cache}` }
    : { label: 'Cache policy', status: 'info', detail: 'No Cache-Control header detected.' });

  checks.push(server || poweredBy
    ? { label: 'Technology disclosure', status: 'warn', detail: `Server/X-Powered-By disclosure detected${server ? `: ${server}` : ''}${poweredBy ? ` / ${poweredBy}` : ''}.` }
    : { label: 'Technology disclosure', status: 'pass', detail: 'No Server or X-Powered-By disclosure captured.' });

  checks.push(cors === '*'
    ? { label: 'CORS exposure', status: 'warn', detail: 'Wildcard Access-Control-Allow-Origin detected.' }
    : { label: 'CORS exposure', status: cors ? 'info' : 'pass', detail: cors ? `CORS header detected: ${cors}` : 'No broad CORS header captured.' });

  return checks;
}

function safeDiagnosticRequestUrl(inputUrl: string): string {
  return safeDiagnosticsRequestUrl(inputUrl, SOURCE_DEFAULT_HOME_URL);
}

async function resolvePublicDiagnosticsTarget(hostname: string): Promise<{ ok: boolean; addresses: string[]; error: string }> {
  const initial = evaluateDiagnosticsHostScope(hostname);
  if (!initial.ok) return { ok: false, addresses: [], error: initial.reason };
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    const addresses = records.map((record) => record.address).filter(Boolean).slice(0, 32);
    const scoped = evaluateDiagnosticsHostScope(hostname, addresses);
    return { ok: scoped.ok, addresses: scoped.resolvedAddresses, error: scoped.ok ? '' : scoped.reason };
  } catch (error) {
    return { ok: false, addresses: [], error: `DNS preflight failed before diagnostics request: ${dnsErrorMessage(error)}` };
  }
}

async function runUrlDiagnostics(inputUrl: string): Promise<OpsUrlDiagnostics> {
  const normalizedUrl = safeDiagnosticRequestUrl(inputUrl);
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const base: OpsUrlDiagnostics = {
    ok: false,
    checkedAt,
    inputUrl: sanitizeActiveCaptureUrl(inputUrl, '', 'operational-handoff') || '',
    normalizedUrl,
    method: 'HEAD',
    statusCode: 0,
    statusMessage: '',
    durationMs: 0,
    error: '',
    headers: {},
    checks: []
  };

  const decision = evaluateDiagnosticsRequestUrl(inputUrl, SOURCE_DEFAULT_HOME_URL);
  const failFast = (error: string): OpsUrlDiagnostics => ({
    ...base,
    durationMs: Date.now() - started,
    error: safeDiagnosticText(error, 260),
    checks: buildOpsHeaderChecks(normalizedUrl, 0, safeDiagnosticText(error, 260), {})
  });

  if (!decision.ok || !safeExternalUrl(normalizedUrl)) {
    return failFast(decision.reason || 'Only http:// and https:// URLs can be checked.');
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(normalizedUrl);
  } catch {
    return failFast('Diagnostic target could not be parsed after normalization.');
  }

  const publicTarget = await resolvePublicDiagnosticsTarget(requestUrl.hostname);
  if (!publicTarget.ok) {
    return failFast(publicTarget.error || 'Diagnostic target is not public-routable.');
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (patch: Partial<OpsUrlDiagnostics>) => {
      if (settled) return;
      settled = true;
      const durationMs = Date.now() - started;
      const result: OpsUrlDiagnostics = { ...base, ...patch, durationMs };
      result.statusMessage = safeDiagnosticText(result.statusMessage, 220);
      result.error = safeDiagnosticText(result.error, 260);
      result.headers = sanitizeDiagnosticHeaderMap(result.headers as Record<string, string | string[]>);
      result.ok = !result.error && result.statusCode >= 200 && result.statusCode < 400;
      result.checks = buildOpsHeaderChecks(result.normalizedUrl, result.statusCode, result.error, result.headers);
      result.checks.unshift({ label: 'Network boundary', status: 'pass', detail: `DNS preflight allowed ${publicTarget.addresses.length || 1} public-routable address target(s); redirects are not followed by diagnostics.` });
      resolve(result);
    };

    const transport = requestUrl.protocol === 'https:' ? https : http;
    const request = transport.request(requestUrl, {
      method: 'HEAD',
      timeout: DIAGNOSTIC_TIMEOUT_MS,
      headers: {
        'user-agent': `${PRODUCT_NAME} OpsDiagnostics/${TAHAI_RELEASE_VERSION}`,
        'accept': '*/*',
        'cache-control': 'no-cache'
      }
    }, (response) => {
      const headers = sanitizeDiagnosticHeaderMap(response.headers as Record<string, string | string[]>, normalizedUrl);
      response.resume();
      response.on('end', () => {
        finish({ statusCode: response.statusCode || 0, statusMessage: response.statusMessage || '', headers });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Timed out after ${Math.round(DIAGNOSTIC_TIMEOUT_MS / 1000)} seconds.`));
    });
    request.on('error', (error) => {
      finish({ error: error.message || 'Cookie-free network diagnostic failed.' });
    });
    request.end();
  });
}

function dnsErrorMessage(error: unknown): string {
  if (!error) return '';
  const err = error as NodeJS.ErrnoException;
  return String(err.code || err.message || 'lookup failed').slice(0, 180);
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, 18);
}

function isPublicDnsEligibleHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.local')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(':')) return false;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host);
}

async function safeResolve<T>(kind: string, resolver: () => Promise<T[]>): Promise<{ values: T[]; error: string }> {
  try {
    const values = await resolver();
    return { values: Array.isArray(values) ? values.slice(0, 24) : [], error: '' };
  } catch (error) {
    const detail = dnsErrorMessage(error);
    if (/^(ENODATA|ENOTFOUND|ENOTIMP|ESERVFAIL)$/i.test(detail)) return { values: [], error: detail };
    return { values: [], error: `${kind}: ${detail}` };
  }
}

async function runItServiceCardDiagnostics(inputUrl: string): Promise<ItServiceCardDiagnostics> {
  const normalizedUrl = safeDiagnosticRequestUrl(inputUrl);
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const base: ItServiceCardDiagnostics = {
    ok: false,
    checkedAt,
    inputUrl: sanitizeActiveCaptureUrl(inputUrl, '', 'operational-handoff') || '',
    normalizedUrl,
    hostname: '',
    dnsEligible: false,
    durationMs: 0,
    records: { a: [], aaaa: [], cname: [], ns: [], mx: [] },
    errors: {},
    notes: []
  };

  if (!safeExternalUrl(normalizedUrl)) {
    const error = 'Only http:// and https:// URLs can be profiled for an IT Service Card.';
    return { ...base, durationMs: Date.now() - started, errors: { url: error }, notes: [{ label: 'URL scope', status: 'fail', detail: error }] };
  }

  let hostname = '';
  try {
    hostname = new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    const error = 'URL could not be parsed.';
    return { ...base, durationMs: Date.now() - started, errors: { url: error }, notes: [{ label: 'URL scope', status: 'fail', detail: error }] };
  }

  const dnsEligible = isPublicDnsEligibleHost(hostname);
  const hostScope = evaluateDiagnosticsHostScope(hostname);
  if (!dnsEligible || !hostScope.ok) {
    const detail = !hostScope.ok ? hostScope.reason : 'Public DNS lookup skipped for localhost, IP literals, or non-public hostnames.';
    return {
      ...base,
      hostname,
      dnsEligible: false,
      durationMs: Date.now() - started,
      errors: !hostScope.ok ? { dnsBoundary: hostScope.reason } : {},
      notes: [
        { label: 'DNS boundary', status: !hostScope.ok ? 'fail' : 'info', detail },
        { label: 'IT documentation', status: 'warn', detail: 'Fill owner, environment, access path, recovery, and monitoring fields before storing this service card.' }
      ]
    };
  }

  const [a, aaaa, cname, ns, mx] = await Promise.all([
    safeResolve('A', () => dns.resolve4(hostname)),
    safeResolve('AAAA', () => dns.resolve6(hostname)),
    safeResolve('CNAME', () => dns.resolveCname(hostname)),
    safeResolve('NS', () => dns.resolveNs(hostname)),
    safeResolve<DnsMxRecord>('MX', () => dns.resolveMx(hostname) as Promise<DnsMxRecord[]>)
  ]);

  const records = {
    a: sortedUnique(a.values as string[]),
    aaaa: sortedUnique(aaaa.values as string[]),
    cname: sortedUnique(cname.values as string[]),
    ns: sortedUnique(ns.values as string[]),
    mx: (mx.values as DnsMxRecord[])
      .map((record) => ({ exchange: String(record.exchange || '').trim(), priority: Number(record.priority || 0) }))
      .filter((record) => record.exchange)
      .sort((left, right) => left.priority - right.priority || left.exchange.localeCompare(right.exchange))
      .slice(0, 18)
  };

  const errors: Record<string, string> = {};
  for (const [kind, result] of Object.entries({ a, aaaa, cname, ns, mx })) {
    if (result.error) errors[kind] = result.error;
  }

  const dnsScope = evaluateDiagnosticsHostScope(hostname, [...records.a, ...records.aaaa]);
  if (!dnsScope.ok) {
    return {
      ...base,
      ok: false,
      hostname,
      dnsEligible: false,
      durationMs: Date.now() - started,
      records,
      errors: { dnsBoundary: dnsScope.reason },
      notes: [
        { label: 'DNS boundary', status: 'fail', detail: dnsScope.reason },
        { label: 'Public DNS snapshot', status: 'info', detail: 'A/AAAA output was withheld from approval because it resolved into non-public address space.' }
      ]
    };
  }

  const hasAddress = records.a.length > 0 || records.aaaa.length > 0 || records.cname.length > 0;
  const notes: OpsHeaderCheck[] = [
    hasAddress
      ? { label: 'DNS route', status: 'pass', detail: 'A/AAAA/CNAME route data captured for documentation.' }
      : { label: 'DNS route', status: 'warn', detail: 'No A/AAAA/CNAME records captured; confirm proxy, split DNS, or provider routing manually.' },
    records.ns.length
      ? { label: 'Nameservers', status: 'pass', detail: `${records.ns.length} nameserver record(s) captured.` }
      : { label: 'Nameservers', status: 'info', detail: 'No NS records captured for this host lookup.' },
    records.mx.length
      ? { label: 'Mail routing', status: 'info', detail: `${records.mx.length} MX record(s) captured; document whether this host/domain is mail-enabled.` }
      : { label: 'Mail routing', status: 'info', detail: 'No MX records captured for this host lookup.' },
    { label: 'Documentation completeness', status: 'warn', detail: 'Service owner, support path, renewal owner, backup/recovery notes, and monitoring checks still need human confirmation.' }
  ];

  return {
    ...base,
    ok: hasAddress,
    hostname,
    dnsEligible,
    durationMs: Date.now() - started,
    records,
    errors,
    notes
  };
}


function markdownSafe(value: unknown): string {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function mainProcessExportMarkdownSafe(value: unknown): string {
  const normalized = markdownSafe(value).slice(0, MAX_MAIN_PROCESS_CAPTURE_CHARS);
  if (!normalized) return '';
  const sanitized = sanitizeEvidenceMarkdown(normalized, 'operational-handoff').markdown;
  return markdownSafe(sanitized).slice(0, MAX_MAIN_PROCESS_CAPTURE_CHARS);
}

function captureSlug(value: string): string {
  return mainProcessExportMarkdownSafe(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'tahai-devops-capture';
}

function defaultCapturePath(sourceUrl: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(app.getPath('documents'), `tahai-devops-capture-${captureSlug(sourceUrl)}-${stamp}.md`);
}


function distPath(...parts: string[]): string {
  return path.join(__dirname, '..', ...parts);
}

function resourcePath(...parts: string[]): string {
  if (app.isPackaged) return path.join(process.resourcesPath, ...parts);
  return distPath(...parts);
}

function localFileUrl(...parts: string[]): string {
  return pathToFileURL(resourcePath(...parts)).toString();
}

function safeExternalUrl(url: string): boolean {
  return isSafeExternalUrl(url);
}

function trustedShellUrls(): string[] {
  const pages = localPages();
  return [
    pathToFileURL(distPath('renderer', 'index.html')).toString(),
    pages.newTabUrl,
    pages.settingsUrl,
    pages.aboutUrl,
    pages.errorPageUrl,
    pages.onboardingUrl
  ];
}

function assertTrustedBrowserShellIpc(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL() || '';
  assertTrustedShellOrigin(senderUrl, trustedShellUrls());
}

function assertTrustedIpcChannel(channel: string): void {
  if (!isTrustedTahaiIpcChannel(channel)) {
    throw new Error(`Blocked unregistered TAHAI Browser IPC channel: ${channel}`);
  }
}

function sendTrustedRendererEvent(window: BrowserWindow, channel: TahaiTrustedRendererEventChannel, ...args: unknown[]): void {
  if (!isTrustedTahaiRendererEventChannel(channel)) return;
  window.webContents.send(channel, ...args);
}


let pass188InputBoundaryInstallSequence = 0;

function pass188WindowForInputBoundary(sourceContents: WebContents): BrowserWindow | undefined {
  const directWindow = BrowserWindow.fromWebContents(sourceContents);
  if (directWindow && !directWindow.isDestroyed()) return directWindow;
  const hostContents = 'hostWebContents' in sourceContents ? (sourceContents as WebContents & { hostWebContents?: WebContents }).hostWebContents : undefined;
  const hostWindow = hostContents ? BrowserWindow.fromWebContents(hostContents) : undefined;
  if (hostWindow && !hostWindow.isDestroyed()) return hostWindow;
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && !focusedWindow.isDestroyed()) return focusedWindow;
  const candidates = BrowserWindow.getAllWindows().filter((candidate) => !candidate.isDestroyed());
  return candidates.length === 1 ? candidates[0] : undefined;
}

function pass188InputBoundarySource(sourceContents: WebContents): Pass188InputBoundarySource {
  const hostContents = 'hostWebContents' in sourceContents ? (sourceContents as WebContents & { hostWebContents?: WebContents }).hostWebContents : undefined;
  if (hostContents) return 'webview-guest';
  const type = typeof sourceContents.getType === 'function' ? sourceContents.getType() : '';
  if (type === 'window') return 'browser-window';
  return 'unknown';
}

function pass188ForwardInputBoundaryCommand(sourceContents: WebContents, command: Pass188InputBoundaryCommand, input: Pass188BeforeInputLike): boolean {
  const targetWindow = pass188WindowForInputBoundary(sourceContents);
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  const source = pass188InputBoundarySource(sourceContents);
  const payload: Pass188InputBoundaryPayload = {
    version: PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION,
    command,
    source,
    fromGuest: source === 'webview-guest',
    key: String(input.key || ''),
    code: String(input.code || ''),
    createdAt: new Date().toISOString()
  };
  sendTrustedRendererEvent(targetWindow, 'tahai-browser:pass188-input-boundary', payload);
  return true;
}

function installPass188WebContentsInputBoundary(contents: WebContents): void {
  const marker = contents as WebContents & { __tahaiPass188InputBoundaryInstalled?: number };
  if (marker.__tahaiPass188InputBoundaryInstalled) return;
  marker.__tahaiPass188InputBoundaryInstalled = ++pass188InputBoundaryInstallSequence;
  contents.on('before-input-event', (event, input) => {
    const command = pass188NormalizeBeforeInputCommand(input as Pass188BeforeInputLike);
    if (!command) return;
    if (pass188ForwardInputBoundaryCommand(contents, command, input as Pass188BeforeInputLike)) {
      event.preventDefault();
    }
  });
}


const PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE = 'PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE';

function pass271R6PopupsAsTabsEnabled(): boolean {
  try {
    return readBrowserSettings().ui.allowPopupsAsTabs !== false;
  } catch {
    return true;
  }
}

function pass271R6RoutePopupAsTab(sourceContents: WebContents, safeUrl: string, source: string): boolean {
  if (!safeUrl) return false;
  if (!pass271R6PopupsAsTabsEnabled()) return false;
  const targetWindow = pass185WindowForHistoryAppCommand(undefined, sourceContents);
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  sendTrustedRendererEvent(targetWindow, 'tahai-browser:open-in-tab', safeUrl);
  void source;
  void PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE;
  return true;
}

let pass153WebContentsPopupBoundaryInstalled = false;

function installPass153WebContentsPopupBoundary(): void {
  if (pass153WebContentsPopupBoundaryInstalled) return;
  pass153WebContentsPopupBoundaryInstalled = true;
  app.on('web-contents-created', (_event, contents) => {
    installPass188WebContentsInputBoundary(contents);
    // PASS153 continuity token for legacy verifiers: contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.setWindowOpenHandler(({ url }) => {
      const safeUrl = normalizeSafeExternalWindowUrl(url);
      pass271R6RoutePopupAsTab(contents, safeUrl, 'webview-guest');
      return { action: 'deny' };
    });
    // PASS185: hardware mouse Button 4/5 can surface as an app-command on
    // guest webContents when focus lives inside an Electron <webview>. Route it
    // through the trusted renderer command bridge so active Mission pane targeting
    // remains identical to Alt+Left/Alt+Right and toolbar Back/Forward.
    (contents as unknown as { on(channel: 'app-command', listener: (event: { preventDefault?: () => void }, command: string) => void): void }).on('app-command', (event, command) => {
      pass185RouteBrowserHistoryAppCommand(event, command, undefined, contents);
    });
  });
}

function enforcePass153WebviewAttachBoundary(window: BrowserWindow): void {
  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const decision = hardenWebviewAttachOptions(
      webPreferences as TahaiWebviewAttachRecord,
      params as TahaiWebviewAttachRecord,
      trustedShellUrls()
    );
    if (!decision.ok) {
      event.preventDefault();
      console.warn(`[${TAHAI_WEBVIEW_ATTACH_SECURITY_PASS}] blocked webview attach: ${decision.blockedReasons.join(',') || 'unknown-reason'} src=${String((params as TahaiWebviewAttachRecord).src || '').slice(0, 240)}`);
    }
  });
}


function localPages() {
  return {
    newTabUrl: localFileUrl('browser', 'new-tab', 'index.html'),
    settingsUrl: localFileUrl('browser', 'settings', 'index.html'),
    aboutUrl: localFileUrl('browser', 'about', 'index.html'),
    errorPageUrl: localFileUrl('browser', 'error-page', 'index.html'),
    onboardingUrl: localFileUrl('browser', 'onboarding', 'index.html'),
    bookmarksUrl: localFileUrl('browser', 'bookmarks', 'bookmarks.json')
  };
}


function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rendererShellFailureHtml(detail: string, rendererPath: string): string {
  const safeDetail = escapeHtml(detail).slice(0, 1800);
  const safePath = escapeHtml(rendererPath).slice(0, 1800);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TAHAI Browser Shell Load Diagnostic</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #02050b; color: #f5f8ff; font-family: Inter, Segoe UI, sans-serif; }
    main { width: min(840px, calc(100vw - 40px)); border: 1px solid rgba(119,219,255,.26); border-radius: 24px; padding: 28px; background: linear-gradient(180deg, rgba(7,16,31,.98), rgba(2,5,11,.98)); box-shadow: 0 24px 120px rgba(0,0,0,.72), 0 0 70px rgba(47,143,255,.16); }
    h1 { margin: 0 0 12px; color: #77dbff; letter-spacing: .02em; }
    p { color: #9db1c8; line-height: 1.55; }
    code, pre { color: #f5f8ff; background: rgba(255,255,255,.055); border: 1px solid rgba(119,219,255,.14); border-radius: 14px; }
    code { padding: 2px 6px; }
    pre { padding: 14px; overflow: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <p style="margin:0 0 8px;color:#77dbff;text-transform:uppercase;letter-spacing:.14em;font-weight:900;font-size:.72rem;">TAHAI Browser Runtime Diagnostic</p>
    <h1>Renderer shell did not load</h1>
    <p>The browser opened, but the Chromium shell HTML failed to load or the renderer process exited. This screen is intentionally shown instead of a blank black window.</p>
    <p><strong>Renderer path:</strong></p>
    <pre>${safePath}</pre>
    <p><strong>Diagnostic:</strong></p>
    <pre>${safeDetail}</pre>
    <p>Run <code>npm run verify:release</code>, then rebuild the local Windows test package with <code>npm run package:win:unpacked-zip</code>.</p>
  </main>
</body>
</html>`;
}

function rendererShellFailureFile(detail: string, rendererPath: string): string {
  const diagnosticsDir = path.join(app.getPath('userData'), 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  const failurePath = path.join(diagnosticsDir, 'renderer-shell-failure.html');
  fs.writeFileSync(failurePath, rendererShellFailureHtml(detail, rendererPath), 'utf8');
  return failurePath;
}

type RendererAssetPreflight = {
  ok: boolean;
  detail: string;
};

function rendererAssetPreflight(rendererPath: string): RendererAssetPreflight {
  const requiredFiles = [
    rendererPath,
    distPath('renderer', 'boot.js'),
    distPath('renderer', 'app.js'),
    distPath('renderer', 'styles', 'browser.css'),
    path.join(__dirname, '..', 'preload', 'preload.js')
  ];
  const missing = requiredFiles.filter((candidate) => !fs.existsSync(candidate));
  if (!missing.length) return { ok: true, detail: 'renderer asset preflight passed' };
  return {
    ok: false,
    detail: `renderer asset preflight failed; missing generated runtime files:\n${missing.join('\n')}\nRun npm run build from the repo root before npm run dev or packaging.`
  };
}


let pass158RuntimeE2eStarted = false;
let pass158RuntimeE2eReadyPollTimer: NodeJS.Timeout | undefined;

async function pass158RuntimeE2eHarnessInstalled(window: BrowserWindow): Promise<boolean> {
  if (window.isDestroyed()) return false;
  try {
    return Boolean(await window.webContents.executeJavaScript(
      "typeof window.__TAHAI_RUNTIME_E2E__?.run === 'function'",
      true
    ));
  } catch {
    return false;
  }
}

async function maybeRunPass158RuntimeE2e(window: BrowserWindow, reason: string): Promise<void> {
  if (process.env.TAHAI_RUNTIME_E2E !== '1' || pass158RuntimeE2eStarted || window.isDestroyed()) return;
  if (!await pass158RuntimeE2eHarnessInstalled(window)) {
    tahaiLogRuntimeDiagnostic('runtime-e2e-wait', `${reason} harness-not-ready`);
    return;
  }
  pass158RuntimeE2eStarted = true;
  tahaiLogRuntimeDiagnostic('runtime-e2e-start', reason);
  const resultPath = process.env.TAHAI_RUNTIME_E2E_RESULT || path.join(app.getPath('temp'), `tahai-pass158-runtime-e2e-${Date.now()}.json`);
  const startedAt = new Date().toISOString();
  let payload: unknown;
  try {
    tahaiLogRuntimeDiagnostic('runtime-e2e-execute', 'begin');
    payload = await window.webContents.executeJavaScript(`Promise.resolve(window.__TAHAI_RUNTIME_E2E__?.run?.()).then((result) => result || { ok: false, pass: 'PASS158', error: 'renderer runtime E2E harness was not installed' })`, true);
    tahaiLogRuntimeDiagnostic('runtime-e2e-execute', 'resolved');
  } catch (error) {
    tahaiLogRuntimeDiagnostic('runtime-e2e-execute', `error=${error instanceof Error ? error.message : String(error || 'unknown runtime E2E error')}`);
    payload = { ok: false, pass: RUNTIME_E2E_HARNESS_PASS, error: error instanceof Error ? error.stack || error.message : String(error || 'unknown runtime E2E error') };
  }
  const wrapped = { pass: RUNTIME_E2E_HARNESS_PASS, reason, startedAt, finishedAt: new Date().toISOString(), result: payload };
  try {
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(wrapped, null, 2));
  } catch (error) {
    console.error(`[${RUNTIME_E2E_HARNESS_PASS}] failed to write runtime E2E result`, error);
  }
  if (process.env.TAHAI_RUNTIME_E2E_QUIT !== '0') {
    setTimeout(() => app.quit(), 80);
  }
}

function schedulePass158RuntimeE2e(window: BrowserWindow, reason: string): void {
  if (process.env.TAHAI_RUNTIME_E2E !== '1') return;
  if (pass158RuntimeE2eStarted || window.isDestroyed()) {
    tahaiLogRuntimeDiagnostic('runtime-e2e-schedule-skip', `reason=${reason} started=${pass158RuntimeE2eStarted} destroyed=${window.isDestroyed()}`);
    return;
  }
  if (pass158RuntimeE2eReadyPollTimer) {
    clearTimeout(pass158RuntimeE2eReadyPollTimer);
    tahaiLogRuntimeDiagnostic('runtime-e2e-schedule-reset', reason);
  } else {
    tahaiLogRuntimeDiagnostic('runtime-e2e-schedule', reason);
  }
  pass158RuntimeE2eReadyPollTimer = setTimeout(() => {
    pass158RuntimeE2eReadyPollTimer = undefined;
    tahaiLogRuntimeDiagnostic('runtime-e2e-schedule-fire', reason);
    void maybeRunPass158RuntimeE2e(window, reason);
  }, 120);
}

/* PASS271_R4_MAIN_DESTROYED_WINDOW_GUARD_START */
function pass271R4BrowserWindowAlive(window: BrowserWindow): boolean {
  try {
    return Boolean(window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed());
  } catch {
    return false;
  }
}
/* PASS271_R4_MAIN_DESTROYED_WINDOW_GUARD_END */

async function checkRendererBootHeartbeat(window: BrowserWindow): Promise<boolean> {
  if (window.isDestroyed()) return false;
  try {
    return Boolean(await window.webContents.executeJavaScript(
      "document.documentElement.dataset.tahaiShellReady === '1'",
      true
    ));
  } catch {
    return false;
  }
}

function loadRendererShell(window: BrowserWindow): void {
  const rendererPath = distPath('renderer', 'index.html');
  let fallbackShown = false;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  const assetPreflight = rendererAssetPreflight(rendererPath);
  tahaiLogRuntimeDiagnostic('loadRendererShell', `rendererPath=${rendererPath}`);

  const showFailure = (detail: string) => {
    if (fallbackShown || !pass271R4BrowserWindowAlive(window)) return;
    fallbackShown = true;
    tahaiLogRuntimeDiagnostic('renderer-failure', detail.replace(/\s+/g, ' ').slice(0, 900));
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    const html = rendererShellFailureHtml(detail, rendererPath);
    const writeInlineFallback = () => {
      if (!pass271R4BrowserWindowAlive(window)) return;
      try {
        void window.webContents.loadURL('about:blank').then(() => {
          if (!pass271R4BrowserWindowAlive(window)) return undefined;
          return window.webContents.executeJavaScript(`document.open();document.write(${JSON.stringify(html)});document.close();`, true);
        }).catch(() => undefined);
      } catch {
        // Window was destroyed between the liveness check and the fallback write. Ignore cleanly.
      }
    };
    try {
      const failurePath = rendererShellFailureFile(detail, rendererPath);
      if (!pass271R4BrowserWindowAlive(window)) return;
      try {
        void window.loadFile(failurePath).catch(() => writeInlineFallback());
      } catch {
        writeInlineFallback();
      }
    } catch {
      writeInlineFallback();
    }
  };

  const scheduleHeartbeatCheck = (reason: string) => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    tahaiLogRuntimeDiagnostic('heartbeat-scheduled', reason);
    heartbeatTimer = setTimeout(() => {
      void checkRendererBootHeartbeat(window).then((ready) => {
        if (!ready) {
          showFailure(`${reason}: renderer shell loaded but did not report the strict ready marker within 12 seconds. The source tree may contain stale dist output, a preload failure, a CSP/script load issue, or a renderer runtime exception.`);
        } else {
          tahaiLogRuntimeDiagnostic('heartbeat-ready', reason);
        }
      });
    }, 12000);
  };

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || fallbackShown) return;
    showFailure(`did-fail-load ${errorCode}: ${errorDescription || 'Unknown load failure'}\nURL: ${validatedURL || 'unavailable'}`);
  });

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    showFailure(`preload-error: ${preloadPath}\n${error?.stack || error?.message || String(error || 'unknown preload error')}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    showFailure(`render-process-gone: ${details.reason || 'unknown'} exitCode=${details.exitCode}`);
  });

  window.webContents.on('dom-ready', () => {
    scheduleHeartbeatCheck('dom-ready');
  });

  window.webContents.on('did-finish-load', () => {
    scheduleHeartbeatCheck('did-finish-load');
  });

  if (!assetPreflight.ok) {
    showFailure(assetPreflight.detail);
    return;
  }

  // Some Electron/webview combinations can execute renderer code while the usual
  // BrowserWindow did-finish-load/loadFile resolution path stalls. Keep a fallback
  // heartbeat alive so runtime-ready detection and PASS158 are not skipped.
  scheduleHeartbeatCheck('startup-fallback');

  window.loadFile(rendererPath).then(() => {
    scheduleHeartbeatCheck('loadFile');
  }).catch((error: unknown) => {
    showFailure(error instanceof Error ? error.stack || error.message : String(error));
  });
}

function startupUrl(): string {
  const settings = readBrowserSettings();
  return settings.startup === 'launchpad' ? localPages().newTabUrl : settings.homeUrl || SOURCE_DEFAULT_HOME_URL;
}

function sendMenuCommand(window: BrowserWindow, command: string): void {
  if (!window.isDestroyed()) sendTrustedRendererEvent(window, 'tahai-browser:menu-command', command);
}

type Pass185BrowserHistoryCommand = 'back' | 'forward';
let pass185LastMainMouseHistoryRouteAt = 0;
let pass185LastMainMouseHistoryDirection: Pass185BrowserHistoryCommand | undefined;

function pass185NormalizeBrowserHistoryAppCommand(command: unknown): Pass185BrowserHistoryCommand | undefined {
  const normalized = String(command || '').toLowerCase();
  if (normalized === 'browser-backward' || normalized === 'back' || normalized === 'mouse-back') return 'back';
  if (normalized === 'browser-forward' || normalized === 'forward' || normalized === 'mouse-forward') return 'forward';
  return undefined;
}

function pass185WindowForHistoryAppCommand(sourceWindow?: BrowserWindow, sourceContents?: WebContents): BrowserWindow | undefined {
  if (sourceWindow && !sourceWindow.isDestroyed()) return sourceWindow;
  const directWindow = sourceContents ? BrowserWindow.fromWebContents(sourceContents) : undefined;
  if (directWindow && !directWindow.isDestroyed()) return directWindow;
  const hostContents = sourceContents && 'hostWebContents' in sourceContents ? (sourceContents as WebContents & { hostWebContents?: WebContents }).hostWebContents : undefined;
  const hostWindow = hostContents ? BrowserWindow.fromWebContents(hostContents) : undefined;
  if (hostWindow && !hostWindow.isDestroyed()) return hostWindow;
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && !focusedWindow.isDestroyed()) return focusedWindow;
  const candidates = BrowserWindow.getAllWindows().filter((candidate) => !candidate.isDestroyed());
  return candidates.length === 1 ? candidates[0] : undefined;
}

function pass185RouteBrowserHistoryAppCommand(event: { preventDefault?: () => void } | undefined, command: unknown, sourceWindow?: BrowserWindow, sourceContents?: WebContents): boolean {
  const direction = pass185NormalizeBrowserHistoryAppCommand(command);
  if (!direction) return false;
  if (typeof event?.preventDefault === 'function') event.preventDefault();
  const now = Date.now();
  if (direction === pass185LastMainMouseHistoryDirection && now - pass185LastMainMouseHistoryRouteAt < 80) return true;
  pass185LastMainMouseHistoryDirection = direction;
  pass185LastMainMouseHistoryRouteAt = now;
  const targetWindow = pass185WindowForHistoryAppCommand(sourceWindow, sourceContents);
  if (!targetWindow) return false;
  sendMenuCommand(targetWindow, direction);
  return true;
}

function installApplicationMenu(window: BrowserWindow): void {
  const exitItem: Electron.MenuItemConstructorOptions = process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' };
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => sendMenuCommand(window, 'new-tab') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendMenuCommand(window, 'close-tab') },
        { type: 'separator' },
        { label: 'Open Location…', accelerator: 'CmdOrCtrl+L', click: () => sendMenuCommand(window, 'focus-address') },
        { label: 'Copy Active Page URL', accelerator: 'CmdOrCtrl+Shift+U', click: () => sendMenuCommand(window, 'copy-url') },
        { label: 'Open Active Page Externally', accelerator: 'Alt+Enter', click: () => sendMenuCommand(window, 'open-external') },
        { label: 'Save Page Evidence…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuCommand(window, 'capture') },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => sendMenuCommand(window, 'print') },
        { type: 'separator' },
        exitItem
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Page…', accelerator: 'CmdOrCtrl+F', click: () => sendMenuCommand(window, 'find-page') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload This Page', accelerator: 'CmdOrCtrl+R', click: () => sendMenuCommand(window, 'reload') },
        { role: 'forceReload', label: 'Force Reload' },
        { type: 'separator' },
        { label: 'Reset Page Zoom', accelerator: 'CmdOrCtrl+0', click: () => sendMenuCommand(window, 'zoom-reset') },
        { label: 'Zoom In Page', accelerator: 'CmdOrCtrl+Plus', click: () => sendMenuCommand(window, 'zoom-in') },
        { label: 'Zoom Out Page', accelerator: 'CmdOrCtrl+-', click: () => sendMenuCommand(window, 'zoom-out') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: () => sendMenuCommand(window, 'command-palette') },
        { label: 'Right-side Ops Panel', accelerator: 'CmdOrCtrl+Alt+H', click: () => sendMenuCommand(window, 'ops-hub') },
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => sendMenuCommand(window, 'shortcuts') },
        { type: 'separator' },
        { label: 'Developer Tools', accelerator: 'F12', click: () => sendTrustedRendererEvent(window, 'tahai-browser:toggle-devtools') },
        { label: 'Chromium DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => sendTrustedRendererEvent(window, 'tahai-browser:toggle-devtools') }
      ]
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => sendMenuCommand(window, 'back') },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => sendMenuCommand(window, 'forward') },
        { label: 'Next Tab', accelerator: 'CmdOrCtrl+Tab', click: () => sendMenuCommand(window, 'next-tab') },
        { label: 'Previous Tab', accelerator: 'CmdOrCtrl+Shift+Tab', click: () => sendMenuCommand(window, 'previous-tab') },
        { label: 'Pin / Unpin Active Tab', accelerator: 'CmdOrCtrl+Alt+Shift+F', click: () => sendMenuCommand(window, 'pin-tab') },
        { type: 'separator' },
        { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: () => sendMenuCommand(window, 'reopen-closed-tab') },
        { label: 'Duplicate Current Tab', accelerator: 'CmdOrCtrl+Alt+Shift+T', click: () => sendMenuCommand(window, 'duplicate-tab') },
        { label: 'Restore Last Session', click: () => sendMenuCommand(window, 'restore-session') },
        { type: 'separator' },
        { label: 'Home', accelerator: 'Alt+Home', click: () => sendMenuCommand(window, 'home') },
        { label: 'TAHAI Launchpad', click: () => sendMenuCommand(window, 'launchpad') }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'TAHAI Launchpad', click: () => sendMenuCommand(window, 'launchpad') },
        { label: 'TAHAI Portal', click: () => sendMenuCommand(window, 'home') },
        { label: 'Guide / Knowledge Base', click: () => sendMenuCommand(window, 'guide') },
        { type: 'separator' },
        { label: 'Open Bookmarks Workspace', click: () => sendMenuCommand(window, 'bookmarks') }
      ]
    },
    {
      label: 'Profiles',
      submenu: [
        { label: 'Manage Profiles…', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendMenuCommand(window, 'profiles') },
        { label: 'New Google-labeled Profile…', click: () => sendMenuCommand(window, 'new-google-profile') },
        { label: 'New Microsoft-labeled Profile…', click: () => sendMenuCommand(window, 'new-microsoft-profile') },
        { type: 'separator' },
        { label: 'Open Profile Data Folder', click: () => sendMenuCommand(window, 'open-active-profile-folder') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Open DevOps Tool Panel', accelerator: 'CmdOrCtrl+Alt+O', click: () => sendMenuCommand(window, 'open-devops-menu') },
        { label: 'Open IT Tools Panel', accelerator: 'CmdOrCtrl+Alt+I', click: () => sendMenuCommand(window, 'open-it-menu') },
        { label: 'Open Browser Kit', accelerator: 'CmdOrCtrl+Alt+.', click: () => sendMenuCommand(window, 'open-browser-kit') },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click: () => sendMenuCommand(window, 'command-palette') },
        { label: 'Right-side Ops Panel', accelerator: 'CmdOrCtrl+Alt+H', click: () => sendMenuCommand(window, 'ops-hub') },
        { type: 'separator' },
        { label: 'Save Workspace Snapshot', click: () => sendMenuCommand(window, 'save-workspace') },
        { label: 'Pin Latest Evidence', click: () => sendMenuCommand(window, 'pin-evidence') },
        { label: 'Focus Download Artifacts', click: () => sendMenuCommand(window, 'downloads') },
        { label: 'Build Evidence / Change Bundle', accelerator: 'CmdOrCtrl+Alt+B', click: () => sendMenuCommand(window, 'bundle') },
        { label: 'IT Docs / PSA Handoff Center', accelerator: 'CmdOrCtrl+Alt+Y', click: () => sendMenuCommand(window, 'handoff') },
        { label: 'Ops Guard / Redaction Review', accelerator: 'CmdOrCtrl+Alt+G', click: () => sendMenuCommand(window, 'ops-guard') },
        { type: 'separator' },
        {
          label: 'TAHAI DevOps Tools',
          submenu: [
            { label: 'Capture Evidence Note', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuCommand(window, 'capture') },
            { label: 'Run URL Ops Check', accelerator: 'CmdOrCtrl+Shift+D', click: () => sendMenuCommand(window, 'ops-check') },
            { label: 'Create Deploy Readiness Report', accelerator: 'CmdOrCtrl+Alt+R', click: () => sendMenuCommand(window, 'deploy') },
            { label: 'Create Route Map', accelerator: 'CmdOrCtrl+Alt+P', click: () => sendMenuCommand(window, 'route-map') },
            { label: 'Run Developer Audit', accelerator: 'CmdOrCtrl+Alt+A', click: () => sendMenuCommand(window, 'dev-audit') }
          ]
        },
        {
          label: 'TAHAI IT Tools',
          submenu: [
            { label: 'Create IT Service Card', accelerator: 'CmdOrCtrl+Shift+M', click: () => sendMenuCommand(window, 'it-card') },
            { label: 'Create Endpoint Snapshot', accelerator: 'CmdOrCtrl+Alt+E', click: () => sendMenuCommand(window, 'endpoint') },
            { label: 'Create Support Triage Packet', accelerator: 'CmdOrCtrl+Alt+T', click: () => sendMenuCommand(window, 'triage') },
            { label: 'Open Secret Boundary', accelerator: 'CmdOrCtrl+Alt+K', click: () => sendMenuCommand(window, 'secret-boundary') }
          ]
        },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => sendMenuCommand(window, 'settings') }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'TAHAI Launchpad', click: () => sendMenuCommand(window, 'launchpad') },
        { label: 'Guide / Knowledge Base', click: () => sendMenuCommand(window, 'guide') },
        { label: 'Runtime Settings', click: () => sendMenuCommand(window, 'settings') },
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => sendMenuCommand(window, 'shortcuts') },
        { type: 'separator' },
        { label: 'About TAHAI Web Services Browser', click: () => sendMenuCommand(window, 'about') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}



function getTahaiBrowserIconPath() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, iconFile),
        path.join(process.resourcesPath, "build", iconFile),
        path.join(process.resourcesPath, "app.asar.unpacked", "build", iconFile),
        path.join(process.resourcesPath, "app", "build", iconFile)
      ]
    : [
        path.join(app.getAppPath(), "build", iconFile),
        path.join(process.cwd(), "build", iconFile),
        path.join(__dirname, "..", "..", "build", iconFile),
        path.join(__dirname, "..", "build", iconFile)
      ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function titleBarChromeOptions() {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 14 }
    };
  }

  if (process.platform === 'win32') {
    return {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: '#06101d',
        symbolColor: '#dff7ff',
        height: WINDOWS_TITLEBAR_CHROME_HEIGHT_PX // height: 44
      }
    };
  }

  return {
    titleBarStyle: 'default' as const
  };
}

function createWindow(): BrowserWindow {
  const startupSettings = readBrowserSettings();
  const window = new BrowserWindow({
    icon: getTahaiBrowserIconPath(),
    width: 1460,
    height: 940,
    minWidth: 1020,
    minHeight: 700,
    title: PRODUCT_NAME,
    backgroundColor: '#02050b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      // PASS142/PASS51 invariant mirror: contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false.
      ...TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES,
      spellcheck: true,
      devTools: true
    },
    ...titleBarChromeOptions()
  });

  tahaiLogRuntimeDiagnostic('createWindow', `platform=${process.platform} titleBarStyle=${String((titleBarChromeOptions() as { titleBarStyle?: string }).titleBarStyle || 'default')} userData=${app.getPath('userData')}`);

  if (TAHAI_RUNTIME_DIAGNOSTIC_MODE) {
    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const safeMessage = String(message || '').replace(/\s+/g, ' ').slice(0, 900);
      const safeSource = String(sourceId || '').slice(0, 260);
      console.info(`[TAHAI_RENDERER_CONSOLE] level=${level} line=${line || 0} source=${safeSource} message=${safeMessage}`);
    });
    window.webContents.on('did-start-loading', () => tahaiLogRuntimeDiagnostic('renderer', 'did-start-loading'));
    window.webContents.on('did-stop-loading', () => tahaiLogRuntimeDiagnostic('renderer', 'did-stop-loading'));
  }

  enforcePass153WebviewAttachBoundary(window);
  // PASS338_WEBVIEW_ATTACH_LOAD_DIAGNOSTIC: make webview guest attach/load state visible in dev logs without GPU teardown.
  window.webContents.on('did-attach-webview', (_event, guest) => {
    try {
      guest.setUserAgent((guest.getUserAgent() || '').replace(/\sElectron\/[0-9A-Za-z_.-]+/g, '').trim());
      console.info('[PASS338] did-attach-webview url=' + (guest.getURL() || 'about:blank'));
      guest.on('did-fail-load', (_failEvent, errorCode, errorDescription, validatedURL) => {
        console.warn('[PASS338] guest did-fail-load ' + errorCode + ' ' + (errorDescription || '') + ' ' + (validatedURL || ''));
      });
      guest.on('did-finish-load', () => console.info('[PASS338] guest did-finish-load url=' + (guest.getURL() || 'unknown')));
    } catch (error) {
      console.warn('[PASS338] guest attach diagnostic failed', error);
    }
  });

  installPass188WebContentsInputBoundary(window.webContents);
  loadRendererShell(window);
  installApplicationMenu(window);
  if (process.platform !== 'darwin') {
    window.setAutoHideMenuBar(true);
    window.setMenuBarVisibility(false);
  }
  if (startupSettings.ui.launchToMaximized) {
    window.maximize();
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = normalizeSafeExternalWindowUrl(url);
    if (safeUrl) pass271R6RoutePopupAsTab(window.webContents, safeUrl, 'browser-window');
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedShellOrigin(url, trustedShellUrls())) event.preventDefault();
  });

  // PASS88: Route OS/browser mouse back-forward app commands through the
  // same renderer menu-command channel used by Alt+Left/Alt+Right, preserving
  // active-pane targeting whether focus is in the shell or inside a webview.
  window.on('app-command', (event, command) => {
    pass185RouteBrowserHistoryAppCommand(event, command, window, window.webContents);
  });

  return window;
}

assertTrustedIpcChannel('tahai-browser:get-config');
ipcMain.handle('tahai-browser:get-config', (event) => {
  assertTrustedBrowserShellIpc(event);
  const settings = readBrowserSettings();
  const rendererSettings = settingsForRenderer(settings);
  return {
    productName: PRODUCT_NAME,
    bundleName: BUNDLE_NAME,
    homeUrl: settings.homeUrl || SOURCE_DEFAULT_HOME_URL,
    itDocsUrl: ITDOCS_HOME_URL,
    startupUrl: startupUrl(),
    settings: rendererSettings,
    adminPolicy: getEnterpriseAdminPolicyForRenderer(),
    adminPolicySummary: getEnterpriseAdminPolicySummary(),
    enterpriseSupportBundlePass: ENTERPRISE_SUPPORT_BUNDLE_PASS,
    runtimeControl: {
      runtimeE2e: process.env.TAHAI_RUNTIME_E2E === '1',
      runtimeE2eQuit: process.env.TAHAI_RUNTIME_E2E_QUIT !== '0',
      diagnostics: TAHAI_RUNTIME_DIAGNOSTIC_MODE,
      resultPath: process.env.TAHAI_RUNTIME_E2E_RESULT || path.join(app.getPath('temp'), `tahai-pass158-runtime-e2e-${process.pid}.json`),
      runId: String(process.env.TAHAI_RUNTIME_E2E_RUN_ID || '')
    },
    settingsLabel: localFilesystemHandoffLabel('browser-config'),
    profiles: listBrowserProfiles(),
    ...localPages(),
    version: app.getVersion(),
    releaseChannel: RELEASE_CHANNEL,
    releasePass: TAHAI_RELEASE_PASS,
    updateChannel: releaseTruthForRenderer().updateChannel,
    updatePolicy: releaseTruthForRenderer().updatePolicy,
    signingStatus: releaseTruthForRenderer().signingStatus,
    releaseTruth: releaseTruthForRenderer(),
    firstLaunch: runFirstLaunchChecks(),
    userDataLabel: localFilesystemHandoffLabel('browser-config')
  };
});

assertTrustedIpcChannel('tahai-browser:renderer-ready');
ipcMain.handle('tahai-browser:renderer-ready', async (event) => {
  assertTrustedBrowserShellIpc(event);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return false;
  tahaiLogRuntimeDiagnostic('renderer-ready-ipc', event.senderFrame?.url || event.sender.getURL() || 'unknown');
  return true;
});

assertTrustedIpcChannel('tahai-browser:get-runtime-control');
ipcMain.handle('tahai-browser:get-runtime-control', (event) => {
  assertTrustedBrowserShellIpc(event);
  return {
    runtimeE2e: process.env.TAHAI_RUNTIME_E2E === '1',
    runtimeE2eQuit: process.env.TAHAI_RUNTIME_E2E_QUIT !== '0',
    diagnostics: TAHAI_RUNTIME_DIAGNOSTIC_MODE,
    resultPath: process.env.TAHAI_RUNTIME_E2E_RESULT || path.join(app.getPath('temp'), `tahai-pass158-runtime-e2e-${process.pid}.json`),
    runId: String(process.env.TAHAI_RUNTIME_E2E_RUN_ID || '')
  };
});

assertTrustedIpcChannel('tahai-browser:report-runtime-e2e-result');
ipcMain.handle('tahai-browser:report-runtime-e2e-result', async (event, report) => {
  assertTrustedBrowserShellIpc(event);
  const resultPath = process.env.TAHAI_RUNTIME_E2E_RESULT || path.join(app.getPath('temp'), `tahai-pass158-runtime-e2e-${process.pid}.json`);
  const wrapped = {
    pass: RUNTIME_E2E_HARNESS_PASS,
    reason: String(report?.reason || 'renderer-runtime-e2e-report'),
    startedAt: String(report?.startedAt || new Date().toISOString()),
    finishedAt: new Date().toISOString(),
    result: report?.result || { ok: false, pass: RUNTIME_E2E_HARNESS_PASS, error: 'Renderer runtime E2E report payload was empty.' }
  };
  try {
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(wrapped, null, 2));
    tahaiLogRuntimeDiagnostic('runtime-e2e-report', `written path=${resultPath}`);
  } catch (error) {
    console.error(`[${RUNTIME_E2E_HARNESS_PASS}] failed to persist renderer-owned runtime E2E report`, error);
    return false;
  }
  if (process.env.TAHAI_RUNTIME_E2E_QUIT !== '0') {
    setTimeout(() => app.quit(), 80);
  }
  return true;
});

assertTrustedIpcChannel('tahai-browser:get-admin-policy');
ipcMain.handle('tahai-browser:get-admin-policy', (event) => { assertTrustedBrowserShellIpc(event); return getEnterpriseAdminPolicyForRenderer(); });
assertTrustedIpcChannel('tahai-browser:preview-enterprise-support-bundle');
ipcMain.handle('tahai-browser:preview-enterprise-support-bundle', (event) => { assertTrustedBrowserShellIpc(event); return previewEnterpriseSupportBundle(); });
assertTrustedIpcChannel('tahai-browser:copy-enterprise-support-bundle');
ipcMain.handle('tahai-browser:copy-enterprise-support-bundle', (event) => { assertTrustedBrowserShellIpc(event); return copyEnterpriseSupportBundle(); });
assertTrustedIpcChannel('tahai-browser:save-enterprise-support-bundle');
ipcMain.handle('tahai-browser:save-enterprise-support-bundle', async (event) => { assertTrustedBrowserShellIpc(event); return saveEnterpriseSupportBundle(); });

assertTrustedIpcChannel('tahai-browser:get-settings');
ipcMain.handle('tahai-browser:get-settings', (event) => { assertTrustedBrowserShellIpc(event); return settingsForRenderer(readBrowserSettings()); });
assertTrustedIpcChannel('tahai-browser:update-settings');
ipcMain.handle('tahai-browser:update-settings', (event, next) => { assertTrustedBrowserShellIpc(event); return settingsForRenderer(writeBrowserSettings(next)); });
assertTrustedIpcChannel('tahai-browser:reset-settings');
ipcMain.handle('tahai-browser:reset-settings', (event) => { assertTrustedBrowserShellIpc(event); return settingsForRenderer(resetBrowserSettings()); });
assertTrustedIpcChannel('tahai-browser:choose-download-directory');
ipcMain.handle('tahai-browser:choose-download-directory', async (event) => {
  assertTrustedBrowserShellIpc(event);
  const owner = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = owner
    ? await dialog.showOpenDialog(owner, { title: 'Choose default download folder', properties: ['openDirectory', 'createDirectory'] })
    : await dialog.showOpenDialog({ title: 'Choose default download folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths?.[0]) return settingsForRenderer(readBrowserSettings());
  return settingsForRenderer(setBrowserDownloadDirectory(result.filePaths[0]));
});
assertTrustedIpcChannel('tahai-browser:reset-download-directory');
ipcMain.handle('tahai-browser:reset-download-directory', (event) => {
  assertTrustedBrowserShellIpc(event);
  return settingsForRenderer(setBrowserDownloadDirectory(''));
});
assertTrustedIpcChannel('tahai-browser:export-settings-file');
ipcMain.handle('tahai-browser:export-settings-file', async (event) => {
  assertTrustedBrowserShellIpc(event);
  const owner = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const saveOptions: Electron.SaveDialogOptions = {
    title: 'Export TAHAI Browser settings',
    defaultPath: 'tahai-browser-settings.json',
    buttonLabel: 'Export Settings',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const result = owner ? await dialog.showSaveDialog(owner, saveOptions) : await dialog.showSaveDialog(saveOptions);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true, message: 'Settings export canceled.' };
  fs.writeFileSync(result.filePath, `${JSON.stringify(readBrowserSettings(), null, 2)}\n`, 'utf8');
  return { ok: true, canceled: false, message: localFilesystemHandoffLabel('browser-config') };
});
assertTrustedIpcChannel('tahai-browser:import-settings-file');
ipcMain.handle('tahai-browser:import-settings-file', async (event) => {
  assertTrustedBrowserShellIpc(event);
  const owner = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = owner
    ? await dialog.showOpenDialog(owner, { title: 'Import TAHAI Browser settings', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    : await dialog.showOpenDialog({ title: 'Import TAHAI Browser settings', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  const targetPath = result.canceled ? '' : String(result.filePaths?.[0] || '');
  if (!targetPath) return { ok: false, canceled: true, message: 'Settings import canceled.' };
  try {
    const stat = fs.statSync(targetPath);
    if (shouldRejectSettingsFileSize(stat.size)) return { ok: false, canceled: false, message: 'Settings file was invalid or too large.' };
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const next = settingsForRenderer(writeBrowserSettingsWithOptions(parsed, { preserveDownloadDirectory: false }));
    return { ok: true, canceled: false, message: localFilesystemHandoffLabel('browser-config'), settings: next };
  } catch (error) {
    return { ok: false, canceled: false, message: error instanceof Error ? error.message : 'Settings import failed.' };
  }
});
assertTrustedIpcChannel('tahai-browser:reveal-download-artifact');
ipcMain.handle('tahai-browser:reveal-download-artifact', async (event, artifactId: string) => { assertTrustedBrowserShellIpc(event); return revealDownloadArtifact(artifactId); });
type ClearBrowsingDataScope = 'active-profile' | 'selected-profile' | 'all-profiles';

type ClearBrowsingDataOptions = {
  scope?: ClearBrowsingDataScope;
  profileId?: string;
};

type ClearBrowsingDataResult = {
  ok: boolean;
  scope: ClearBrowsingDataScope;
  clearedProfileIds: string[];
  clearedPartitions: string[];
  error: string;
};

const PROFILE_STORAGE_TYPES: NonNullable<Electron.ClearStorageDataOptions['storages']> = ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'];

function clearScope(value: unknown): ClearBrowsingDataScope {
  return value === 'selected-profile' || value === 'all-profiles' || value === 'active-profile' ? value : 'active-profile';
}

async function clearProfileStorage(partition: string): Promise<void> {
  const targetSession = session.fromPartition(partition);
  await targetSession.clearCache();
  await targetSession.clearStorageData({ storages: PROFILE_STORAGE_TYPES });
  await targetSession.clearAuthCache();
}

async function clearBrowsingDataForProfiles(options?: ClearBrowsingDataOptions): Promise<ClearBrowsingDataResult> {
  const scope = clearScope(options?.scope);
  const profileState = listBrowserProfiles();
  const selectedProfileId = String(options?.profileId || '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 80);
  const selectedProfiles = scope === 'all-profiles'
    ? profileState.profiles
    : scope === 'selected-profile'
      ? profileState.profiles.filter((profile) => profile.id === selectedProfileId)
      : [profileState.activeProfile];
  const targets = selectedProfiles.length ? selectedProfiles : [profileState.activeProfile];
  try {
    for (const profile of targets) await clearProfileStorage(profile.partition);
    if (scope === 'all-profiles') await clearProfileStorage('persist:tahai-browser');
    return { ok: true, scope, clearedProfileIds: targets.map((profile) => profile.id), clearedPartitions: targets.map((profile) => profile.partition), error: '' };
  } catch (error) {
    return { ok: false, scope, clearedProfileIds: [], clearedPartitions: [], error: error instanceof Error ? error.message : 'Profile data clear failed.' };
  }
}

async function clearOnExitIfEnabled(): Promise<void> {
  if (!readBrowserSettings().privacy.clearProfileDataOnExit) return;
  await clearBrowsingDataForProfiles({ scope: 'all-profiles' });
}

assertTrustedIpcChannel('tahai-browser:clear-browsing-data');
ipcMain.handle('tahai-browser:clear-browsing-data', async (event, options?: ClearBrowsingDataOptions) => { assertTrustedBrowserShellIpc(event); return clearBrowsingDataForProfiles(options); });
assertTrustedIpcChannel('tahai-browser:open-user-data');
ipcMain.handle('tahai-browser:open-user-data', async (event) => { assertTrustedBrowserShellIpc(event); await shell.openPath(app.getPath('userData')); return true; });
assertTrustedIpcChannel('tahai-browser:open-external');
ipcMain.handle('tahai-browser:open-external', async (event, url: string) => { assertTrustedBrowserShellIpc(event); return safeOpenExternal(url); });
assertTrustedIpcChannel('tahai-browser:open-itdocs');
ipcMain.handle('tahai-browser:open-itdocs', async (event) => { assertTrustedBrowserShellIpc(event); return safeOpenExternal(ITDOCS_HOME_URL); });
assertTrustedIpcChannel('tahai-browser:get-itdocs-capabilities');
ipcMain.handle('tahai-browser:get-itdocs-capabilities', async (event) => { assertTrustedBrowserShellIpc(event); return getItDocsMissionCapabilities(ITDOCS_HOME_URL); });
assertTrustedIpcChannel('tahai-browser:copy-itdocs-capabilities');
ipcMain.handle('tahai-browser:copy-itdocs-capabilities', async (event) => {
  assertTrustedBrowserShellIpc(event);
  const capabilities = await getItDocsMissionCapabilities(ITDOCS_HOME_URL);
  clipboard.writeText(itDocsCapabilitiesMarkdown(capabilities));
  return true;
});

assertTrustedIpcChannel('tahai-browser:copy-psa-reference-contract');
ipcMain.handle('tahai-browser:copy-psa-reference-contract', async (event) => {
  assertTrustedBrowserShellIpc(event);
  clipboard.writeText(psaReferenceMarkdown(null, localOnlyPsaReferenceContractState()));
  return true;
});

assertTrustedIpcChannel('tahai-browser:copy-devops-capture');
ipcMain.handle('tahai-browser:copy-devops-capture', (event, markdown: string) => {
  assertTrustedBrowserShellIpc(event);
  const clean = mainProcessExportMarkdownSafe(markdown);
  if (!clean) return false;
  clipboard.writeText(clean);
  return true;
});

assertTrustedIpcChannel('tahai-browser:save-devops-capture');
ipcMain.handle('tahai-browser:save-devops-capture', async (event, markdown: string, sourceUrl: string) => {
  assertTrustedBrowserShellIpc(event);
  const clean = mainProcessExportMarkdownSafe(markdown);
  if (!clean) return { saved: false, canceled: false, savedLabel: '' };
  const owner = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const options: Electron.SaveDialogOptions = {
    title: 'Save TAHAI DevOps evidence note',
    defaultPath: defaultCapturePath(typeof sourceUrl === 'string' ? sourceUrl : 'capture'),
    buttonLabel: 'Save Redacted Markdown',
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
  };
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false, canceled: true, savedLabel: '' };
  fs.writeFileSync(result.filePath, `${clean.trim()}\n`, 'utf8');
  return { saved: true, canceled: false, savedLabel: localFilesystemHandoffLabel('devops-capture') };
});

assertTrustedIpcChannel('tahai-browser:run-url-diagnostics');
ipcMain.handle('tahai-browser:run-url-diagnostics', async (event, sourceUrl: string) => { assertTrustedBrowserShellIpc(event); return runUrlDiagnostics(sourceUrl); });
assertTrustedIpcChannel('tahai-browser:run-it-service-card-diagnostics');
ipcMain.handle('tahai-browser:run-it-service-card-diagnostics', async (event, sourceUrl: string) => { assertTrustedBrowserShellIpc(event); return runItServiceCardDiagnostics(sourceUrl); });
assertTrustedIpcChannel('tahai-browser:list-profiles');
ipcMain.handle('tahai-browser:list-profiles', (event) => { assertTrustedBrowserShellIpc(event); return listBrowserProfiles(); });
assertTrustedIpcChannel('tahai-browser:create-profile');
ipcMain.handle('tahai-browser:create-profile', async (event, input) => {
  assertTrustedBrowserShellIpc(event);
  const state = createBrowserProfile(input);
  await hardenSession(session.fromPartition(state.activeProfile.partition));
  return state;
});
assertTrustedIpcChannel('tahai-browser:update-profile');
ipcMain.handle('tahai-browser:update-profile', (event, input) => { assertTrustedBrowserShellIpc(event); return updateBrowserProfile(input); });
assertTrustedIpcChannel('tahai-browser:set-active-profile');
ipcMain.handle('tahai-browser:set-active-profile', async (event, id: string) => {
  assertTrustedBrowserShellIpc(event);
  const state = setActiveBrowserProfile(id);
  await hardenSession(session.fromPartition(state.activeProfile.partition));
  return state;
});
assertTrustedIpcChannel('tahai-browser:delete-profile');
ipcMain.handle('tahai-browser:delete-profile', (event, id: string) => { assertTrustedBrowserShellIpc(event); return deleteBrowserProfile(id); });
assertTrustedIpcChannel('tahai-browser:open-profile-data');
ipcMain.handle('tahai-browser:open-profile-data', async (event, id: string) => {
  assertTrustedBrowserShellIpc(event);
  const target = profileDataPath(id);
  fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
  return true;
});
assertTrustedIpcChannel('tahai-browser:list-missions');
ipcMain.handle('tahai-browser:list-missions', (event) => {
  assertTrustedBrowserShellIpc(event);
  tahaiLogRuntimeDiagnostic('list-missions', 'invoke');
  const result = listMissions();
  tahaiLogRuntimeDiagnostic('list-missions', `return ok=${result.ok ? '1' : '0'} count=${result.missions.length}`);
  return result;
});
assertTrustedIpcChannel('tahai-browser:load-mission');
ipcMain.handle('tahai-browser:load-mission', (event, missionId: string) => { assertTrustedBrowserShellIpc(event); return loadMission(missionId); });
assertTrustedIpcChannel('tahai-browser:save-mission');
ipcMain.handle('tahai-browser:save-mission', (event, mission) => { assertTrustedBrowserShellIpc(event); return saveMission(mission); });
assertTrustedIpcChannel('tahai-browser:delete-mission');
ipcMain.handle('tahai-browser:delete-mission', (event, missionId: string) => { assertTrustedBrowserShellIpc(event); return deleteMission(missionId); });
assertTrustedIpcChannel('tahai-browser:preview-mission-export');
ipcMain.handle('tahai-browser:preview-mission-export', (event, mission) => { assertTrustedBrowserShellIpc(event); return previewMissionExport(mission); });
assertTrustedIpcChannel('tahai-browser:copy-mission-export');
ipcMain.handle('tahai-browser:copy-mission-export', (event, mission) => { assertTrustedBrowserShellIpc(event); return copyMissionExport(mission); });
assertTrustedIpcChannel('tahai-browser:save-mission-export');
ipcMain.handle('tahai-browser:save-mission-export', async (event, mission) => { assertTrustedBrowserShellIpc(event); return saveMissionExport(mission); });
const tahaiUserDataRoot = path.join(app.getPath('appData'), 'TAHAI Web Services Browser');
const tahaiUserDataPath = TAHAI_USER_DATA_SUFFIX ? path.join(tahaiUserDataRoot, TAHAI_USER_DATA_SUFFIX) : tahaiUserDataRoot;
app.setPath('userData', tahaiUserDataPath);
tahaiLogRuntimeDiagnostic('userData', tahaiUserDataPath);

const gotLock = TAHAI_SINGLE_INSTANCE_LOCK_DISABLED ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  tahaiLogRuntimeDiagnostic('single-instance-lock', 'lock-denied');
  app.quit();
} else {
  if (TAHAI_SINGLE_INSTANCE_LOCK_DISABLED) tahaiLogRuntimeDiagnostic('single-instance-lock', 'disabled-for-runtime-diagnostics');
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  
const TAHAI_BROWSER_APP_NAME = "TAHAI Web Services Browser";


// PASS33_WINDOWS_TASKBAR_ICON_HELPERS_START
const TAHAI_WINDOWS_APP_ID = "com.tahai.webservices.browser";
const TAHAI_WINDOWS_APP_NAME = "TAHAI Web Services Browser";

function tahaiResolveWindowIcon(): string {
  return getTahaiBrowserIconPath();
}

app.setName(TAHAI_WINDOWS_APP_NAME);

if (process.platform === "win32") {
  app.setAppUserModelId(TAHAI_WINDOWS_APP_ID);
  app.setLoginItemSettings({ openAtLogin: false, path: process.execPath });
}
// PASS33_WINDOWS_TASKBAR_ICON_HELPERS_END

app.whenReady().then(async () => {
    installPass153WebContentsPopupBoundary();
    runFirstLaunchChecks();
    webviewAttachSecuritySummary();
    await hardenSession(session.defaultSession);
    await hardenSession(session.fromPartition('persist:tahai-browser'));
    for (const partition of profileSessionPartitions()) {
      await hardenSession(session.fromPartition(partition));
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch(() => app.quit());
}

app.on('before-quit', (event) => {
  if (!readBrowserSettings().privacy.clearProfileDataOnExit) return;
  event.preventDefault();
  void clearOnExitIfEnabled().finally(() => {
    app.removeAllListeners('before-quit');
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
