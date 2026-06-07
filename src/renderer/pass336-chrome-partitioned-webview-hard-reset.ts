/*
 * PASS336 — Chrome Partitioned WebView Hard Reset
 *
 * Runtime-only emergency recovery for the current failure mode:
 * the remote page flashes, then a white/webview layer wins and browser chrome stops responding.
 *
 * This module does not use privileged APIs. It only samples DOM geometry and, when a webview/native
 * guest surface covers the browser chrome, partitions that webview below the detected browser chrome.
 */

declare global {
  interface Window {
    __TAHAI_PASS336_CHROME_PARTITION__?: Pass336Api;
  }
}

type Pass336Severity = "ok" | "warning" | "critical";

interface PlainRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Pass336WebviewSample {
  index: number;
  src: string;
  rect: PlainRect;
  style: {
    position: string;
    zIndex: string;
    pointerEvents: string;
    display: string;
    visibility: string;
    opacity: string;
    transform: string;
  };
  parent: string;
  coversChrome: boolean;
  partitioned: boolean;
}

interface Pass336OverlaySample {
  selector: string;
  tag: string;
  summary: string;
  rect: PlainRect;
  zIndex: string;
  pointerEvents: string;
  demoted: boolean;
}

interface Pass336Sample {
  reason: string;
  severity: Pass336Severity;
  timestamp: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  chromeBottom: number;
  chromeTopElement: string;
  webviews: Pass336WebviewSample[];
  overlays: Pass336OverlaySample[];
  actions: string[];
  critical: string[];
  warnings: string[];
}

interface Pass336Api {
  reconcile: (reason?: string) => Pass336Sample;
  sample: (reason?: string) => Pass336Sample;
  lastSample: Pass336Sample | null;
  lastCritical: string[];
}

const API_NAME = "__TAHAI_PASS336_CHROME_PARTITION__";
const BODY_CLASS = "tahai-pass336-chrome-partition-active";
const STYLE_ID = "tahai-pass336-chrome-partition-style";
const PARTITION_ATTR = "data-pass336-chrome-partitioned";
const OVERLAY_ATTR = "data-pass336-overlay-demoted";
const MAX_CHROME_FALLBACK = 132;
const LEGACY_RECOVERY_FLAG = "TAHAI_BROWSER_ENABLE_PASS336_LEGACY_RECOVERY";

const CHROME_SELECTORS = [
  "header",
  "nav",
  "[role='toolbar']",
  "[role='tablist']",
  ".titlebar",
  ".title-bar",
  ".toolbar",
  ".browser-toolbar",
  ".browserChrome",
  ".browser-chrome",
  ".tab-strip",
  ".tabs",
  ".address-bar",
  ".omnibox",
  "#toolbar",
  "#browser-toolbar",
  "#tab-strip",
  "#address-bar",
  "[data-toolbar]",
  "[data-browser-toolbar]",
  "[data-tab-strip]",
  "[data-address-bar]",
  "[data-chrome]",
  "[data-browser-chrome]",
  "[data-ta-hai-browser-chrome]",
];

const FULL_WINDOW_OVERLAY_SELECTORS = [
  "[data-overlay]",
  "[data-modal]",
  "[data-backdrop]",
  "[data-drag-layer]",
  "[data-drop-zone]",
  "[data-pane-drop-zone]",
  "[data-mission-drop-zone]",
  ".overlay",
  ".modal-backdrop",
  ".backdrop",
  ".drag-layer",
  ".drop-zone",
  ".pane-drop-zone",
  ".mission-drop-zone",
];

let lastSample: Pass336Sample | null = null;
let scheduled = false;

function rectToPlain(rect: DOMRect): PlainRect {
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function visible(element: Element): boolean {
  const html = element as HTMLElement;
  const computed = window.getComputedStyle(html);
  const rect = html.getBoundingClientRect();
  return computed.display !== "none" && computed.visibility !== "hidden" && Number(computed.opacity || "1") > 0.01 && rect.width > 2 && rect.height > 2;
}

function summarize(element: Element | null): string {
  if (!element) return "none";
  const html = element as HTMLElement;
  const parts = [element.tagName.toLowerCase()];
  if (html.id) parts.push(`#${html.id}`);
  if (html.className && typeof html.className === "string") {
    const classes = html.className.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (classes.length) parts.push(`.${classes.join(".")}`);
  }
  for (const attr of ["role", "aria-label", "data-testid", "data-route", "data-overlay", "data-chrome", "data-browser-chrome"]) {
    const value = html.getAttribute(attr);
    if (value) parts.push(`[${attr}=${value.slice(0, 60)}]`);
  }
  return parts.join("");
}

function detectChromeBottom(): number {
  let bottom = 0;
  for (const selector of CHROME_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.top < 0 || rect.top > Math.max(220, window.innerHeight * 0.33)) continue;
      if (rect.height > Math.max(220, window.innerHeight * 0.45)) continue;
      bottom = Math.max(bottom, Math.round(rect.bottom));
    }
  }

  if (bottom <= 0) {
    // Conservative fallback: preserve enough room for titlebar + tabs + address bar if selectors drift.
    bottom = Math.min(MAX_CHROME_FALLBACK, Math.max(74, Math.round(window.innerHeight * 0.16)));
  }

  return Math.min(Math.max(bottom, 32), Math.round(window.innerHeight * 0.48));
}

function chromeTopElementSummary(chromeBottom: number): string {
  const x = Math.max(6, Math.round(window.innerWidth / 2));
  const y = Math.max(6, Math.min(window.innerHeight - 6, Math.round(Math.max(24, chromeBottom / 2))));
  return summarize(document.elementFromPoint(x, y));
}

function installStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
body.${BODY_CLASS} header,
body.${BODY_CLASS} nav,
body.${BODY_CLASS} [role="toolbar"],
body.${BODY_CLASS} [role="tablist"],
body.${BODY_CLASS} .titlebar,
body.${BODY_CLASS} .title-bar,
body.${BODY_CLASS} .toolbar,
body.${BODY_CLASS} .browser-toolbar,
body.${BODY_CLASS} .browserChrome,
body.${BODY_CLASS} .browser-chrome,
body.${BODY_CLASS} .tab-strip,
body.${BODY_CLASS} .tabs,
body.${BODY_CLASS} .address-bar,
body.${BODY_CLASS} .omnibox,
body.${BODY_CLASS} #toolbar,
body.${BODY_CLASS} #browser-toolbar,
body.${BODY_CLASS} #tab-strip,
body.${BODY_CLASS} #address-bar,
body.${BODY_CLASS} [data-toolbar],
body.${BODY_CLASS} [data-browser-toolbar],
body.${BODY_CLASS} [data-tab-strip],
body.${BODY_CLASS} [data-address-bar],
body.${BODY_CLASS} [data-chrome],
body.${BODY_CLASS} [data-browser-chrome],
body.${BODY_CLASS} [data-ta-hai-browser-chrome] {
  position: relative;
  z-index: 2147483400 !important;
  pointer-events: auto !important;
}

body.${BODY_CLASS} webview[${PARTITION_ATTR}="true"] {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  max-width: 100vw !important;
  min-width: 0 !important;
  min-height: 0 !important;
  transform: none !important;
  margin: 0 !important;
  z-index: 1 !important;
  display: flex !important;
  pointer-events: auto !important;
  background: #ffffff !important;
}

body.${BODY_CLASS} [${OVERLAY_ATTR}="true"] {
  pointer-events: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
`;
  document.head.appendChild(style);
}

function webviewCoversChrome(webview: HTMLElement, chromeBottom: number): boolean {
  const rect = webview.getBoundingClientRect();
  const computed = window.getComputedStyle(webview);
  if (computed.display === "none" || computed.visibility === "hidden" || Number(computed.opacity || "1") <= 0.01) return false;
  const wide = rect.width >= window.innerWidth * 0.66;
  const tall = rect.height >= window.innerHeight * 0.46;
  const startsTooHigh = rect.top <= Math.max(8, chromeBottom - 8);
  const inline = webview.getAttribute("style") || "";
  const forcedViewport = /\bposition\s*:\s*fixed\b|\binset\s*:\s*0\b|\bheight\s*:\s*(100vh|100%)\b|\bwidth\s*:\s*(100vw|100%)\b/i.test(inline);
  return wide && tall && (startsTooHigh || forcedViewport || computed.position === "fixed");
}

function partitionWebview(webview: HTMLElement, chromeBottom: number, actions: string[], index: number): void {
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
  webview.style.margin = "0";
  webview.style.zIndex = "1";
  webview.style.pointerEvents = "auto";
  webview.style.display = "flex";
  webview.style.visibility = "visible";
  actions.push(`partitioned-webview-${index}-below-chrome-${top}`);
}

function sampleWebview(webview: HTMLElement, index: number, chromeBottom: number): Pass336WebviewSample {
  const computed = window.getComputedStyle(webview);
  return {
    index,
    src: webview.getAttribute("src") || "",
    rect: rectToPlain(webview.getBoundingClientRect()),
    style: {
      position: computed.position,
      zIndex: computed.zIndex,
      pointerEvents: computed.pointerEvents,
      display: computed.display,
      visibility: computed.visibility,
      opacity: computed.opacity,
      transform: computed.transform,
    },
    parent: summarize(webview.parentElement),
    coversChrome: webviewCoversChrome(webview, chromeBottom),
    partitioned: webview.getAttribute(PARTITION_ATTR) === "true",
  };
}

function isLikelyDeadOverlay(element: HTMLElement, chromeBottom: number): boolean {
  if (!visible(element)) return false;
  if (element.matches("html, body, webview, iframe, button, input, textarea, select, a, header, nav, [role='toolbar'], [role='tablist']")) return false;
  if (element.querySelector("button,input,textarea,select,a,header,nav,[role='toolbar'],[role='tablist']")) return false;
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);
  const coversMostWindow = rect.top <= Math.max(2, chromeBottom + 2) && rect.left <= 2 && rect.width >= window.innerWidth * 0.66 && rect.height >= window.innerHeight * 0.50;
  const positioned = computed.position === "fixed" || computed.position === "absolute" || computed.zIndex !== "auto";
  const emptyish = (element.textContent || "").trim().length < 2;
  return coversMostWindow && positioned && emptyish && computed.pointerEvents !== "none";
}

function demoteDeadOverlays(chromeBottom: number, actions: string[]): Pass336OverlaySample[] {
  const overlays: Pass336OverlaySample[] = [];
  const seen = new Set<HTMLElement>();
  for (const selector of FULL_WINDOW_OVERLAY_SELECTORS) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (seen.has(element)) continue;
      seen.add(element);
      const computed = window.getComputedStyle(element);
      const demote = isLikelyDeadOverlay(element, chromeBottom);
      if (demote) {
        element.setAttribute(OVERLAY_ATTR, "true");
        actions.push(`demoted-empty-blocking-overlay:${summarize(element)}`);
      }
      overlays.push({
        selector,
        tag: element.tagName.toLowerCase(),
        summary: summarize(element),
        rect: rectToPlain(element.getBoundingClientRect()),
        zIndex: computed.zIndex,
        pointerEvents: computed.pointerEvents,
        demoted: demote,
      });
    }
  }
  return overlays;
}

function reconcile(reason = "manual"): Pass336Sample {
  document.body.classList.add(BODY_CLASS);
  document.documentElement.dataset.pass336ChromePartitionHealth = "checking";
  installStyle();

  const actions: string[] = [];
  const critical: string[] = [];
  const warnings: string[] = [];
  const chromeBottom = detectChromeBottom();

  const webviews = Array.from(document.querySelectorAll<HTMLElement>("webview"));
  webviews.forEach((webview, index) => {
    if (webviewCoversChrome(webview, chromeBottom)) {
      partitionWebview(webview, chromeBottom, actions, index);
    }
  });

  const overlays = demoteDeadOverlays(chromeBottom, actions);
  const sampledWebviews = webviews.map((webview, index) => sampleWebview(webview, index, chromeBottom));

  const chromeTopElement = chromeTopElementSummary(chromeBottom);
  if (/^webview\b/i.test(chromeTopElement)) {
    critical.push("webview-still-hit-testing-over-browser-chrome");
  }
  if (!sampledWebviews.length) {
    warnings.push("no-webview-elements-present");
  }
  if (sampledWebviews.some((webview) => webview.coversChrome && !webview.partitioned)) {
    critical.push("webview-covering-chrome-not-partitioned");
  }

  const severity: Pass336Severity = critical.length ? "critical" : warnings.length ? "warning" : "ok";
  const sample: Pass336Sample = {
    reason,
    severity,
    timestamp: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 },
    chromeBottom,
    chromeTopElement,
    webviews: sampledWebviews,
    overlays,
    actions,
    critical,
    warnings,
  };
  lastSample = sample;
  document.documentElement.dataset.pass336ChromePartitionHealth = severity;
  document.documentElement.dataset.pass336ChromeBottom = String(chromeBottom);
  if (critical.length) document.documentElement.dataset.pass336ChromePartitionCritical = critical.join(",");
  else delete document.documentElement.dataset.pass336ChromePartitionCritical;
  return sample;
}

function schedule(reason: string): void {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(() => {
    scheduled = false;
    reconcile(reason);
  }, 40);
}

function install(): void {
  if (window[API_NAME]) return;
  const api: Pass336Api = {
    reconcile,
    sample: reconcile,
    get lastSample() {
      return lastSample;
    },
    get lastCritical() {
      return lastSample?.critical || [];
    },
  };
  window[API_NAME] = api;

  const boot = () => {
    reconcile("install");
    window.setTimeout(() => reconcile("install+250ms"), 250);
    window.setTimeout(() => reconcile("install+1000ms"), 1000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.addEventListener("focus", () => schedule("focus"), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
  document.addEventListener("pointerdown", () => schedule("pointerdown"), true);
  document.addEventListener("click", () => schedule("click"), true);

  const observer = new MutationObserver(() => schedule("mutation"));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "src", "hidden", "inert"] });
}

install();

export {};
