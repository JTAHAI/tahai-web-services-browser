$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$pkgPath = Join-Path $repo "package.json"
if (!(Test-Path $pkgPath)) { throw "package.json not found. Run from D:\dev\browser\app" }
if ($repo -notmatch '^[Dd]:\\dev\\browser\\app$') {
  Write-Warning "Expected repo path D:\dev\browser\app. Current path: $repo"
}

$scriptDir = Join-Path $repo "scripts"
$rendererDir = Join-Path $repo "src\renderer"
$qaDir = Join-Path $repo "docs\qa"
$generatedDir = Join-Path $repo "release-candidate\generated"
$bugHuntDir = Join-Path $repo "release-candidate\bug-hunt"
New-Item -ItemType Directory -Force -Path $scriptDir, $rendererDir, $qaDir, $generatedDir, $bugHuntDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $repo ".pass332-backup\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Get-RepoRelativePath([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return $path }
  $repoFull = [System.IO.Path]::GetFullPath($repo).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $pathFull = [System.IO.Path]::GetFullPath($path)
  if ($pathFull.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    $relative = $pathFull.Substring($repoFull.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    if ([string]::IsNullOrWhiteSpace($relative)) { return "." }
    return $relative
  }
  return $pathFull
}

function Backup-File([string]$path) {
  if (!(Test-Path $path)) { return }
  $relative = Get-RepoRelativePath $path
  $dest = Join-Path $backupDir $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -Force $path $dest
}

function Write-Utf8NoBom([string]$path, [string]$content) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $encoding)
}

function Read-Text([string]$path) {
  if (!(Test-Path $path)) { return "" }
  return [System.IO.File]::ReadAllText($path)
}

function Replace-Text([string]$path, [string]$content) {
  Backup-File $path
  Write-Utf8NoBom $path $content
}

$actions = [System.Collections.Generic.List[string]]::new()

$pass331ReportPath = Join-Path $generatedDir "pass331-webview-load-visibility-reconciler-report.json"
$pass331Summary = [ordered]@{
  present = (Test-Path $pass331ReportPath)
  reportPath = if (Test-Path $pass331ReportPath) { Get-RepoRelativePath $pass331ReportPath } else { $null }
  result = $null
  releaseBlockingFindingCount = $null
}
if (Test-Path $pass331ReportPath) {
  try {
    $p331 = Get-Content -Raw -Path $pass331ReportPath | ConvertFrom-Json
    $pass331Summary.result = $p331.result
    $pass331Summary.releaseBlockingFindingCount = $p331.releaseBlockingFindingCount
    $actions.Add("reviewed PASS331 webview visibility reconciler report")
  } catch {
    $actions.Add("PASS331 report existed but could not be parsed: $($_.Exception.Message)")
  }
} else {
  $actions.Add("PASS331 report not found; PASS332 still installed navigation-owner recovery")
}

$sentryPath = Join-Path $rendererDir "pass332-webview-navigation-owner-truth.ts"
$sentry = @'
type Pass332Severity = "info" | "warn" | "critical";

type Pass332Finding = {
  kind: string;
  severity: Pass332Severity;
  detail: string;
  recovered?: boolean;
  src?: string | null;
  desiredUrl?: string | null;
  selector?: string | null;
  at: string;
};

type Pass332WebviewInfo = {
  index: number;
  src: string;
  url: string;
  isBlank: boolean;
  isVisible: boolean;
  activeLike: boolean;
  primary: boolean;
  ownerScore: number;
  area: number;
  selector: string | null;
  rect: Record<string, number>;
  recoveredUrl: string | null;
};

type Pass332Sample = {
  reason: string;
  at: string;
  desiredUrl: string | null;
  desiredUrlSource: string | null;
  viewport: { width: number; height: number; dpr: number };
  probe: { x: number; y: number } | null;
  topSelector: string | null;
  topWebviewSrc: string | null;
  primaryWebview: Pass332WebviewInfo | null;
  webviews: Pass332WebviewInfo[];
  findings: Pass332Finding[];
};

declare global {
  interface Window {
    __TAHAI_PASS332_NAV_OWNER__?: {
      samples: Pass332Sample[];
      lastSample?: Pass332Sample;
      lastCritical?: Pass332Finding[];
      reconcile: (reason?: string) => Pass332Sample;
      recoverPrimary: (url?: string) => Pass332Sample;
      disableAutoRecovery: () => void;
      enableAutoRecovery: () => void;
    };
  }
}

const PASS332_STYLE_ID = "pass332-webview-navigation-owner-truth";
const PASS332_DISABLE_FLAG = "TAHAI_BROWSER_DISABLE_PASS332_NAV_OWNER_RECOVERY";
const PASS332_MIN_STAGE_AREA = 50000;
const PASS332_RECOVERY_COOLDOWN_MS = 3500;
const PASS332_MAX_SAMPLES = 120;

const PASS332_SHELL_URL_SELECTORS = [
  "input[type='url']",
  "input[aria-label*='address' i]",
  "input[aria-label*='url' i]",
  "input[placeholder*='address' i]",
  "input[placeholder*='url' i]",
  ".address-bar input",
  ".omnibox input",
  "[data-address-input]",
  "[data-url-input]",
  "[data-active-url]",
  "[data-current-url]",
  "[data-requested-url]",
  "[data-tab-url]",
];

const PASS332_CHROME_SELECTORS = [
  "header",
  "nav",
  "[role='toolbar']",
  ".titlebar",
  ".toolbar",
  ".browser-toolbar",
  ".tab-strip",
  ".statusbar",
  ".status-bar",
  ".address-bar",
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
];

const PASS332_STAGE_SELECTORS = [
  "[data-browser-stage]",
  "[data-browser-content-stage]",
  "[data-webview-stage]",
  "[data-tab-stage]",
  "[data-mission-stage]",
  ".browser-stage",
  ".browser-content",
  ".browser-viewport",
  ".webview-stage",
  ".browser-webview-stage",
  ".tahai-webview-stage",
  ".tab-webview-stage",
  ".webview-container",
  ".mission-stage",
  ".mission-pane-body",
  ".pane-content",
];

let pass332AutoRecoveryEnabled = true;
let pass332MutationObserver: MutationObserver | null = null;
let pass332Raf = 0;
let pass332BoundWebviews = new WeakSet<Element>();
let pass332LastRecoveryAt = 0;
let pass332LastRecoveryUrl = "";

function envDisablesRecovery(): boolean {
  try {
    const maybeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
    return maybeProcess?.env?.[PASS332_DISABLE_FLAG] === "1";
  } catch {
    return false;
  }
}

function cssEscapeForSelector(value: string): string {
  try {
    const maybeCss = (globalThis as unknown as { CSS?: { escape?: (input: string) => string } }).CSS;
    if (typeof maybeCss?.escape === "function") return maybeCss.escape(value);
  } catch {
    // Fall through.
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function installPass332Style(): void {
  if (document.getElementById(PASS332_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PASS332_STYLE_ID;
  style.textContent = `
/* PASS332: source-owned webview navigation owner truth/recovery contract. */
webview[data-pass332-primary-owner="true"] {
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
webview[data-pass332-non-owner-blank="true"],
webview[data-pass332-stale-owner="true"] {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
html[data-pass332-navigation-health="critical"]::after {
  content: "PASS332 navigation-owner recovery found a blank/non-owner webview surface";
  position: fixed;
  right: 10px;
  bottom: 78px;
  z-index: 2147483647;
  max-width: min(620px, calc(100vw - 20px));
  padding: 8px 10px;
  border: 1px solid rgba(96, 255, 218, 0.92);
  border-radius: 10px;
  color: rgba(96, 255, 218, 0.92);
  background: rgba(3, 10, 18, 0.92);
  font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  pointer-events: none;
}
`;
  document.head.appendChild(style);
}

function rectToRecord(rect: DOMRect): Record<string, number> {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
  };
}

function areaOf(rect: DOMRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function selectorFor(el: Element | null): string | null {
  if (!el) return null;
  const id = el.getAttribute("id");
  if (id) return `${el.tagName.toLowerCase()}#${cssEscapeForSelector(id)}`;
  const dataId = el.getAttribute("data-tab-id") || el.getAttribute("data-pane-id") || el.getAttribute("data-webview-id");
  if (dataId) return `${el.tagName.toLowerCase()}[data-id="${cssEscapeForSelector(dataId)}"]`;
  const cls = String(el.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(cssEscapeForSelector)
    .join(".");
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}

function isVisible(el: Element): boolean {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0.02 && areaOf(rect) > 100;
}

function isBlankUrl(url: string | null | undefined): boolean {
  const value = String(url || "").trim().toLowerCase();
  return !value || value === "about:blank" || value.startsWith("about:blank#") || value.startsWith("data:text/html") || value === "chrome-error://chromewebdata/";
}

function normalizeShellUrl(raw: string | null | undefined): string | null {
  let value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("view-source:")) value = value.slice("view-source:".length);
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      return null;
    }
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function findDesiredUrl(): { url: string | null; source: string | null } {
  const seen = new Set<Element>();
  for (const selector of PASS332_SHELL_URL_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      if (seen.has(node)) continue;
      seen.add(node);
      const element = node as HTMLElement;
      const inputValue = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : null;
      const candidates = [
        inputValue,
        element.getAttribute("data-active-url"),
        element.getAttribute("data-current-url"),
        element.getAttribute("data-requested-url"),
        element.getAttribute("data-tab-url"),
        element.getAttribute("value"),
        element.textContent,
      ];
      for (const candidate of candidates) {
        const normalized = normalizeShellUrl(candidate);
        if (normalized) return { url: normalized, source: selectorFor(element) || selector };
      }
    }
  }
  const activeTab = document.querySelector("[data-active='true'][data-url], .active[data-url], [aria-selected='true'][data-url]");
  if (activeTab instanceof HTMLElement) {
    const normalized = normalizeShellUrl(activeTab.getAttribute("data-url"));
    if (normalized) return { url: normalized, source: selectorFor(activeTab) };
  }
  return { url: null, source: null };
}

function getWebviewCurrentUrl(webview: Element): string {
  try {
    const maybeGetUrl = (webview as unknown as { getURL?: () => string }).getURL;
    if (typeof maybeGetUrl === "function") {
      const value = maybeGetUrl.call(webview);
      if (value) return value;
    }
  } catch {
    // Some webview methods throw before dom-ready.
  }
  return webview.getAttribute("src") || "";
}

function isActiveLike(webview: Element): boolean {
  if (webview.getAttribute("data-active") === "true") return true;
  if (webview.getAttribute("data-active-webview") === "true") return true;
  if (webview.getAttribute("aria-hidden") === "false") return true;
  if (webview.classList.contains("active")) return true;
  const parent = webview.closest("[data-active='true'], [data-active-pane='true'], [aria-selected='true'], .active, .is-active");
  return !!parent;
}

function ownerScore(webview: Element, rect: DOMRect, desiredUrl: string | null): number {
  let score = 0;
  const src = getWebviewCurrentUrl(webview);
  if (isVisible(webview)) score += 10;
  if (isActiveLike(webview)) score += 30;
  if (!isBlankUrl(src)) score += 20;
  if (desiredUrl && src && !isBlankUrl(src)) {
    try {
      const a = new URL(src);
      const b = new URL(desiredUrl);
      if (a.origin === b.origin) score += 20;
      if (a.href === b.href) score += 30;
    } catch {
      // Ignore URL compare failures.
    }
  }
  score += Math.min(30, Math.floor(areaOf(rect) / 10000));
  return score;
}

function collectWebviews(desiredUrl: string | null): Pass332WebviewInfo[] {
  const webviews = Array.from(document.querySelectorAll("webview"));
  const scored = webviews.map((webview, index) => {
    const rect = webview.getBoundingClientRect();
    const src = webview.getAttribute("src") || "";
    const url = getWebviewCurrentUrl(webview);
    const visible = isVisible(webview);
    const activeLike = isActiveLike(webview);
    const score = ownerScore(webview, rect, desiredUrl);
    return {
      index,
      src,
      url,
      isBlank: isBlankUrl(url || src),
      isVisible: visible,
      activeLike,
      primary: false,
      ownerScore: score,
      area: Math.round(areaOf(rect)),
      selector: selectorFor(webview),
      rect: rectToRecord(rect),
      recoveredUrl: webview.getAttribute("data-pass332-recovered-url"),
    } satisfies Pass332WebviewInfo;
  });
  scored.sort((a, b) => b.ownerScore - a.ownerScore || b.area - a.area || a.index - b.index);
  if (scored[0]) scored[0].primary = true;
  scored.sort((a, b) => a.index - b.index);
  return scored;
}

function findContentProbe(): { x: number; y: number } | null {
  const stageCandidates = PASS332_STAGE_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  let best: Element | null = null;
  let bestArea = 0;
  for (const element of stageCandidates) {
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const area = areaOf(rect);
    if (area > bestArea) {
      best = element;
      bestArea = area;
    }
  }
  if (best && bestArea > PASS332_MIN_STAGE_AREA) {
    const rect = best.getBoundingClientRect();
    return {
      x: Math.round(Math.min(window.innerWidth - 8, Math.max(8, rect.left + rect.width / 2))),
      y: Math.round(Math.min(window.innerHeight - 8, Math.max(8, rect.top + rect.height / 2))),
    };
  }
  const y = Math.round(Math.min(window.innerHeight - 8, Math.max(120, window.innerHeight / 2)));
  return { x: Math.round(window.innerWidth / 2), y };
}

function isChromeElement(el: Element | null): boolean {
  if (!el) return false;
  return PASS332_CHROME_SELECTORS.some((selector) => {
    try {
      return !!el.closest(selector);
    } catch {
      return false;
    }
  });
}

function setWebviewOwnerFlags(webviews: Pass332WebviewInfo[]): void {
  const elements = Array.from(document.querySelectorAll("webview"));
  for (const element of elements) {
    element.removeAttribute("data-pass332-primary-owner");
    element.removeAttribute("data-pass332-non-owner-blank");
    element.removeAttribute("data-pass332-stale-owner");
  }
  for (const info of webviews) {
    const element = elements[info.index];
    if (!element) continue;
    if (info.primary) {
      element.setAttribute("data-pass332-primary-owner", "true");
      continue;
    }
    if (info.isBlank && info.isVisible) {
      element.setAttribute("data-pass332-non-owner-blank", "true");
    }
    if (!info.isBlank && info.activeLike && !info.primary) {
      element.setAttribute("data-pass332-stale-owner", "true");
    }
  }
}

function recoverPrimaryIfNeeded(primary: Pass332WebviewInfo | null, desiredUrl: string | null, findings: Pass332Finding[]): void {
  if (!primary || !desiredUrl || !primary.isBlank || !pass332AutoRecoveryEnabled || envDisablesRecovery()) return;
  const now = Date.now();
  if (pass332LastRecoveryUrl === desiredUrl && now - pass332LastRecoveryAt < PASS332_RECOVERY_COOLDOWN_MS) return;
  const element = Array.from(document.querySelectorAll("webview"))[primary.index] as Element | undefined;
  if (!element) return;
  pass332LastRecoveryAt = now;
  pass332LastRecoveryUrl = desiredUrl;
  element.setAttribute("data-pass332-recovered-url", desiredUrl);
  element.setAttribute("data-pass332-primary-owner", "true");
  element.setAttribute("src", desiredUrl);
  try {
    const maybeLoadUrl = (element as unknown as { loadURL?: (url: string) => void }).loadURL;
    if (typeof maybeLoadUrl === "function") maybeLoadUrl.call(element, desiredUrl);
  } catch {
    // setAttribute('src') is the safe fallback.
  }
  findings.push({
    kind: "primary-blank-with-shell-url-recovered",
    severity: "critical",
    detail: "Primary webview was blank while shell/address bar held a safe URL; PASS332 re-applied the URL to the primary owner.",
    recovered: true,
    src: primary.src || primary.url || null,
    desiredUrl,
    selector: primary.selector,
    at: new Date().toISOString(),
  });
}

function buildFindings(webviews: Pass332WebviewInfo[], desiredUrl: string | null, probe: { x: number; y: number } | null, top: Element | null): Pass332Finding[] {
  const now = new Date().toISOString();
  const findings: Pass332Finding[] = [];
  const primary = webviews.find((item) => item.primary) || null;
  const visible = webviews.filter((item) => item.isVisible);
  const visibleBlank = visible.filter((item) => item.isBlank);
  if (desiredUrl && webviews.length === 0) {
    findings.push({
      kind: "no-webview-for-shell-url",
      severity: "critical",
      detail: "Shell/address bar contains a safe URL but no webview exists to own it.",
      desiredUrl,
      at: now,
    });
  }
  if (desiredUrl && primary?.isBlank) {
    findings.push({
      kind: "primary-blank-with-shell-url",
      severity: "critical",
      detail: "Primary webview is blank while the shell/address bar contains a safe URL.",
      src: primary.src || primary.url || null,
      desiredUrl,
      selector: primary.selector,
      at: now,
    });
  }
  if (visible.length > 1) {
    findings.push({
      kind: "multiple-visible-webview-owners",
      severity: "warn",
      detail: `${visible.length} visible webviews exist; PASS332 selected the highest-scoring owner and marked stale/blank non-owners.`,
      desiredUrl,
      at: now,
    });
  }
  if (visibleBlank.some((item) => !item.primary)) {
    findings.push({
      kind: "visible-blank-non-owner-webview",
      severity: "warn",
      detail: "A visible blank webview is not the selected primary owner and was marked non-owner blank.",
      desiredUrl,
      at: now,
    });
  }
  if (probe && top && top.tagName.toLowerCase() !== "webview" && !isChromeElement(top)) {
    findings.push({
      kind: "content-probe-not-webview",
      severity: "critical",
      detail: "The content-stage probe point does not hit a webview or expected browser chrome.",
      selector: selectorFor(top),
      desiredUrl,
      at: now,
    });
  }
  return findings;
}

function reconcile(reason = "manual"): Pass332Sample {
  installPass332Style();
  bindWebviewEvents();
  const desired = findDesiredUrl();
  let webviews = collectWebviews(desired.url);
  setWebviewOwnerFlags(webviews);
  const probe = findContentProbe();
  const top = probe ? document.elementFromPoint(probe.x, probe.y) : null;
  const findings = buildFindings(webviews, desired.url, probe, top);
  const primary = webviews.find((item) => item.primary) || null;
  recoverPrimaryIfNeeded(primary, desired.url, findings);
  webviews = collectWebviews(desired.url);
  setWebviewOwnerFlags(webviews);
  const topAfter = probe ? document.elementFromPoint(probe.x, probe.y) : null;
  const sample: Pass332Sample = {
    reason,
    at: new Date().toISOString(),
    desiredUrl: desired.url,
    desiredUrlSource: desired.source,
    viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    probe,
    topSelector: selectorFor(topAfter),
    topWebviewSrc: topAfter?.tagName.toLowerCase() === "webview" ? ((topAfter as Element).getAttribute("src") || null) : null,
    primaryWebview: webviews.find((item) => item.primary) || null,
    webviews,
    findings,
  };
  const state = window.__TAHAI_PASS332_NAV_OWNER__;
  if (state) {
    state.samples.push(sample);
    while (state.samples.length > PASS332_MAX_SAMPLES) state.samples.shift();
    state.lastSample = sample;
    state.lastCritical = findings.filter((finding) => finding.severity === "critical");
  }
  const hasCritical = findings.some((finding) => finding.severity === "critical" && !finding.recovered);
  const hasWarn = findings.some((finding) => finding.severity === "warn") || findings.some((finding) => finding.recovered);
  document.documentElement.dataset.pass332NavigationHealth = hasCritical ? "critical" : hasWarn ? "warn" : "ok";
  return sample;
}

function scheduleReconcile(reason: string): void {
  if (pass332Raf) cancelAnimationFrame(pass332Raf);
  pass332Raf = requestAnimationFrame(() => {
    pass332Raf = 0;
    reconcile(reason);
    window.setTimeout(() => reconcile(`${reason}:settled`), 180);
  });
}

function bindWebviewEvents(): void {
  const webviews = Array.from(document.querySelectorAll("webview"));
  for (const webview of webviews) {
    if (pass332BoundWebviews.has(webview)) continue;
    pass332BoundWebviews.add(webview);
    const events = [
      "dom-ready",
      "did-start-loading",
      "did-stop-loading",
      "did-finish-load",
      "did-fail-load",
      "did-navigate",
      "did-navigate-in-page",
      "load-commit",
      "ipc-message",
    ];
    for (const event of events) {
      webview.addEventListener(event, () => scheduleReconcile(`webview:${event}`));
    }
  }
}

function installObservers(): void {
  if (pass332MutationObserver) return;
  pass332MutationObserver = new MutationObserver((mutations) => {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element && (node.tagName.toLowerCase() === "webview" || !!node.querySelector("webview"))) relevant = true;
        }
      }
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        const target = mutation.target;
        if (target.tagName.toLowerCase() === "webview" || mutation.attributeName === "src" || mutation.attributeName === "class" || mutation.attributeName?.startsWith("data-")) {
          relevant = true;
        }
      }
    }
    if (relevant) scheduleReconcile("mutation");
  });
  pass332MutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class", "style", "data-active", "data-url", "data-current-url", "data-requested-url", "aria-hidden", "aria-selected"],
  });
  window.addEventListener("resize", () => scheduleReconcile("resize"), { passive: true });
  document.addEventListener("visibilitychange", () => scheduleReconcile("visibilitychange"), { passive: true });
  document.addEventListener("focusin", () => scheduleReconcile("focusin"), { passive: true });
  document.addEventListener("change", () => scheduleReconcile("input-change"), { passive: true });
  document.addEventListener("input", () => scheduleReconcile("input"), { passive: true });
}

function installPass332(): void {
  if (window.__TAHAI_PASS332_NAV_OWNER__) return;
  window.__TAHAI_PASS332_NAV_OWNER__ = {
    samples: [],
    reconcile,
    recoverPrimary(url?: string) {
      if (url) {
        const primary = collectWebviews(normalizeShellUrl(url))[0] || null;
        const findings: Pass332Finding[] = [];
        recoverPrimaryIfNeeded(primary, normalizeShellUrl(url), findings);
      }
      return reconcile("manual-recover-primary");
    },
    disableAutoRecovery() {
      pass332AutoRecoveryEnabled = false;
      return undefined;
    },
    enableAutoRecovery() {
      pass332AutoRecoveryEnabled = true;
      return undefined;
    },
  };
  installPass332Style();
  installObservers();
  bindWebviewEvents();
  scheduleReconcile("install");
  window.setTimeout(() => scheduleReconcile("startup-500ms"), 500);
  window.setTimeout(() => scheduleReconcile("startup-1500ms"), 1500);
  window.setTimeout(() => scheduleReconcile("startup-3000ms"), 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installPass332, { once: true });
} else {
  installPass332();
}

export {};
'@
Replace-Text $sentryPath $sentry
$actions.Add("installed PASS332 renderer webview navigation-owner truth/recovery sentry")

# Import the PASS332 module into the active renderer entrypoint.
$entryCandidates = @(
  (Join-Path $rendererDir "app.ts"),
  (Join-Path $rendererDir "main.ts"),
  (Join-Path $rendererDir "index.ts"),
  (Join-Path $rendererDir "renderer.ts")
)
$entryPath = $entryCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($null -eq $entryPath) { throw "No renderer entrypoint found under src\renderer" }
$entryText = Read-Text $entryPath
$importLine = 'import "./pass332-webview-navigation-owner-truth";'
if ($entryText -notmatch [regex]::Escape($importLine)) {
  if ($entryText -match '(?m)^(import\s+[^\r\n]+;\s*)+') {
    $entryText = [regex]::Replace($entryText, '(?m)^(import\s+[^\r\n]+;\s*)+', { param($m) $m.Value + $importLine + "`r`n" }, 1)
  } else {
    $entryText = $importLine + "`r`n" + $entryText
  }
  Replace-Text $entryPath $entryText
  $actions.Add("imported PASS332 sentry into $(Get-RepoRelativePath $entryPath)")
} else {
  $actions.Add("PASS332 sentry import already present in $(Get-RepoRelativePath $entryPath)")
}

$verifierPath = Join-Path $scriptDir "verify-pass-332-webview-navigation-owner-truth.mjs"
$verifier = @'
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const rel = (...parts) => path.join(repo, ...parts);
const exists = (...parts) => fs.existsSync(rel(...parts));
const read = (...parts) => fs.readFileSync(rel(...parts), "utf8");
const findings = [];
const actions = [];

function fail(kind, detail) {
  findings.push({ kind, severity: "critical", detail });
}
function warn(kind, detail) {
  findings.push({ kind, severity: "warn", detail });
}

const sentryRel = path.join("src", "renderer", "pass332-webview-navigation-owner-truth.ts");
if (!exists(...sentryRel.split(path.sep))) {
  fail("missing-pass332-sentry", `${sentryRel} missing`);
} else {
  const sentry = read(...sentryRel.split(path.sep));
  actions.push("PASS332 renderer sentry exists");
  for (const token of [
    "__TAHAI_PASS332_NAV_OWNER__",
    "primary-blank-with-shell-url",
    "recoverPrimaryIfNeeded",
    "visible-blank-non-owner-webview",
    "TAHAI_BROWSER_DISABLE_PASS332_NAV_OWNER_RECOVERY",
    "data-pass332-navigation-health",
  ]) {
    if (!sentry.includes(token)) fail("missing-sentry-token", `PASS332 sentry missing token: ${token}`);
  }
  for (const blockedProtocol of ["javascript:", "data:", "file:"]) {
    if (sentry.includes(`return new URL(\`${blockedProtocol}`)`) || sentry.includes(`return "${blockedProtocol}`)) {
      fail("unsafe-recovery-protocol", `PASS332 recovery appears to return blocked protocol ${blockedProtocol}`);
    }
  }
  if (!sentry.includes("url.protocol === \"http:\" || url.protocol === \"https:\"")) {
    fail("missing-http-https-only-recovery", "PASS332 recovery must only auto-recover http/https shell URLs");
  }
}

const entryCandidates = [
  path.join("src", "renderer", "app.ts"),
  path.join("src", "renderer", "main.ts"),
  path.join("src", "renderer", "index.ts"),
  path.join("src", "renderer", "renderer.ts"),
].filter((entry) => fs.existsSync(rel(...entry.split(path.sep))));
if (!entryCandidates.length) {
  fail("missing-renderer-entrypoint", "No renderer entrypoint found");
} else {
  const imported = entryCandidates.some((entry) => read(...entry.split(path.sep)).includes('import "./pass332-webview-navigation-owner-truth";'));
  if (!imported) fail("pass332-not-imported", "PASS332 sentry is not imported by a renderer entrypoint");
  else actions.push("PASS332 sentry import is wired into renderer entrypoint");
}

const pkg = JSON.parse(read("package.json"));
if (!pkg.scripts?.["verify:pass-332-webview-navigation-owner-truth"]) {
  fail("missing-package-script", "package.json missing verify:pass-332-webview-navigation-owner-truth");
} else {
  actions.push("package script verify:pass-332-webview-navigation-owner-truth exists");
}

const verifierText = fs.readFileSync(new URL(import.meta.url), "utf8");
if (verifierText.includes("require(")) {
  fail("verifier-commonjs-in-mjs", "Verifier is .mjs and must not use require()");
}

const report = {
  pass: "PASS332",
  name: "WebView Navigation Owner Truth + Blank Final-Load Recovery",
  result: findings.some((finding) => finding.severity === "critical") ? "FAIL" : "PASS",
  releaseBlockingFindingCount: findings.filter((finding) => finding.severity === "critical").length,
  warningCount: findings.filter((finding) => finding.severity === "warn").length,
  actions,
  findings,
  generatedAt: new Date().toISOString(),
};
const outDir = rel("release-candidate", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "pass332-webview-navigation-owner-truth-report.json"), JSON.stringify(report, null, 2));

if (report.result !== "PASS") {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log("PASS332_WEBVIEW_NAVIGATION_OWNER_TRUTH=PASS");
console.log(`PASS332_REPORT=${path.join(outDir, "pass332-webview-navigation-owner-truth-report.json")}`);
'@
Replace-Text $verifierPath $verifier
$actions.Add("installed PASS332 ESM verifier")

# Update package.json script.
$pkgRaw = Read-Text $pkgPath
$pkg = $pkgRaw | ConvertFrom-Json
if ($null -eq $pkg.scripts) {
  $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{})
}
$scriptName = "verify:pass-332-webview-navigation-owner-truth"
$scriptValue = "node scripts/verify-pass-332-webview-navigation-owner-truth.mjs"
if (-not ($pkg.scripts.PSObject.Properties.Name -contains $scriptName)) {
  $pkg.scripts | Add-Member -MemberType NoteProperty -Name $scriptName -Value $scriptValue
  Backup-File $pkgPath
  $json = $pkg | ConvertTo-Json -Depth 100
  Write-Utf8NoBom $pkgPath ($json + "`r`n")
  $actions.Add("added package script $scriptName")
} elseif ($pkg.scripts.$scriptName -ne $scriptValue) {
  $pkg.scripts.$scriptName = $scriptValue
  Backup-File $pkgPath
  $json = $pkg | ConvertTo-Json -Depth 100
  Write-Utf8NoBom $pkgPath ($json + "`r`n")
  $actions.Add("updated package script $scriptName")
} else {
  $actions.Add("package script $scriptName already present")
}

$qaPath = Join-Path $qaDir "PASS332-webview-navigation-owner-truth.md"
$qa = @(
  '# PASS332 - WebView Navigation Owner Truth + Blank Final-Load Recovery',
  '',
  '## Purpose',
  '',
  'PASS332 targets the remaining symptom after PASS330/PASS331: the website briefly flashes, then a blank white surface wins. The likely root is navigation ownership drift: an active/visible webview can remain `about:blank` or a blank non-owner can be visually above the webview that actually loaded.',
  '',
  '## Runtime object',
  '',
  'Open DevTools in the renderer shell and run:',
  '',
  '```js',
  "window.__TAHAI_PASS332_NAV_OWNER__.reconcile('manual-after-white')",
  'document.documentElement.dataset.pass332NavigationHealth',
  'window.__TAHAI_PASS332_NAV_OWNER__.lastSample',
  'window.__TAHAI_PASS332_NAV_OWNER__.lastCritical',
  '```',
  '',
  'Expected healthy state: `ok` or a temporary `warn` if PASS332 recovered a blank primary webview.',
  '',
  '## Recovery guardrails',
  '',
  '- Only `http:` and `https:` shell/address URLs are eligible for automatic recovery.',
  '- `javascript:`, `data:`, and `file:` are never auto-recovered into a webview.',
  '- Recovery can be disabled with `TAHAI_BROWSER_DISABLE_PASS332_NAV_OWNER_RECOVERY=1`.',
  '- Blank non-owner webviews are hidden and made inert; the highest scoring owner remains visible.',
  '',
  '## Verification',
  '',
  '```powershell',
  'Set-Location D:\dev\browser\app',
  'npm run verify:pass-332-webview-navigation-owner-truth',
  'npm run build',
  '```'
) -join "`r`n"
Replace-Text $qaPath ($qa + "`r`n")
$actions.Add("wrote PASS332 QA doc")

$bugPath = Join-Path $bugHuntDir "pass332-webview-navigation-owner-truth.md"
$bugEntryPoint = Get-RepoRelativePath $entryPath
$bug = @(
  '# PASS332 Bug-Hunt Report - WebView Navigation Owner Truth',
  '',
  '## Hypothesis',
  '',
  'The upper-left compositor trap has been reduced, but the page still flashes and becomes white. That points to final-load ownership drift:',
  '',
  '1. the shell/address bar owns a non-blank URL,',
  '2. the selected/top webview remains `about:blank`, or',
  '3. a blank non-owner webview is visible above the loaded owner.',
  '',
  '## Source changes',
  '',
  '- Added `src/renderer/pass332-webview-navigation-owner-truth.ts`.',
  ('- Imported it into `' + $bugEntryPoint + '`.'),
  '- Added `npm run verify:pass-332-webview-navigation-owner-truth`.',
  '',
  '## Runtime findings to collect locally',
  '',
  '```js',
  "window.__TAHAI_PASS332_NAV_OWNER__.reconcile('manual-after-white')",
  'window.__TAHAI_PASS332_NAV_OWNER__.lastSample',
  'window.__TAHAI_PASS332_NAV_OWNER__.lastCritical',
  '```',
  '',
  'Important finding kinds:',
  '',
  '- `primary-blank-with-shell-url`',
  '- `primary-blank-with-shell-url-recovered`',
  '- `no-webview-for-shell-url`',
  '- `multiple-visible-webview-owners`',
  '- `visible-blank-non-owner-webview`',
  '- `content-probe-not-webview`'
) -join "`r`n"
Replace-Text $bugPath ($bug + "`r`n")
$actions.Add("wrote PASS332 bug-hunt report")

$reportPath = Join-Path $generatedDir "pass332-webview-navigation-owner-truth-apply-report.json"
$applyReport = [ordered]@{
  pass = "PASS332"
  name = "WebView Navigation Owner Truth + Blank Final-Load Recovery"
  result = "PASS"
  repo = $repo
  actions = @($actions)
  pass331 = $pass331Summary
  sentryFile = Get-RepoRelativePath $sentryPath
  rendererEntrypoint = Get-RepoRelativePath $entryPath
  verifier = Get-RepoRelativePath $verifierPath
  qaDoc = Get-RepoRelativePath $qaPath
  bugHunt = Get-RepoRelativePath $bugPath
  backupDir = $backupDir
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
}
Write-Utf8NoBom $reportPath (($applyReport | ConvertTo-Json -Depth 20) + "`r`n")

npm run verify:pass-332-webview-navigation-owner-truth
if ($LASTEXITCODE -ne 0) { throw "PASS332 verifier failed with exit code $LASTEXITCODE" }

Write-Host "PASS332_APPLIED=PASS"
Write-Host "PASS332_NAV_OWNER_SENTRY=$(Get-RepoRelativePath $sentryPath)"
Write-Host "PASS332_IMPORTED_BY=$(Get-RepoRelativePath $entryPath)"
Write-Host "PASS332_VERIFY_RESULT=PASS"
Write-Host "PASS332_REPORT=$reportPath"
Write-Host "PASS332_BACKUP_DIR=$backupDir"
