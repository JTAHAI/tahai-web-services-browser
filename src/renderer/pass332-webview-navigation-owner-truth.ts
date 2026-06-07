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
  const scored: Pass332WebviewInfo[] = webviews.map((webview, index) => {
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