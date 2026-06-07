type Pass333Severity = "info" | "warn" | "critical";

type Pass333Finding = {
  kind: string;
  severity: Pass333Severity;
  detail: string;
  selector?: string | null;
  webviewSelector?: string | null;
  rect?: Record<string, number> | null;
  at: string;
};

type Pass333ElementInfo = {
  selector: string | null;
  tag: string;
  rect: Record<string, number>;
  center: { x: number; y: number };
  pointerEvents: string;
  visibility: string;
  display: string;
  opacity: string;
};

type Pass333Sample = {
  reason: string;
  at: string;
  viewport: { width: number; height: number; dpr: number };
  topChromeBandBottom: number;
  chromeControls: Pass333ElementInfo[];
  webviews: Pass333ElementInfo[];
  findings: Pass333Finding[];
};

declare global {
  interface Window {
    __TAHAI_PASS333_CHROME_HITTEST__?: {
      samples: Pass333Sample[];
      lastSample?: Pass333Sample;
      lastCritical?: Pass333Finding[];
      sample: (reason?: string) => Pass333Sample;
    };
  }
}

const PASS333_MAX_SAMPLES = 80;
const PASS333_CHROME_SELECTORS = [
  "header",
  "nav",
  "[role='toolbar']",
  "[role='tablist']",
  ".titlebar",
  ".title-bar",
  ".toolbar",
  ".browser-toolbar",
  ".tab-strip",
  ".tabs",
  ".address-bar",
  ".omnibox",
  "[data-toolbar]",
  "[data-browser-toolbar]",
  "[data-tab-strip]",
  "[data-address-bar]",
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
];

function rectRecord(rect: DOMRect): Record<string, number> {
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

function selectorFor(element: Element | null): string | null {
  if (!element) return null;
  const html = element as HTMLElement;
  if (element.id) return `#${element.id}`;
  const dataName = Array.from(element.attributes || []).find((a) => a.name.startsWith("data-") && /toolbar|tab|address|webview|stage|pane|browser|root|content/i.test(a.name));
  if (dataName) return `[${dataName.name}${dataName.value ? `="${dataName.value.slice(0, 80)}"` : ""}]`;
  const className = String(html.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 4).join(".");
  return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
}

function isVisibleElement(element: Element): boolean {
  const html = element as HTMLElement;
  const rect = html.getBoundingClientRect();
  const style = window.getComputedStyle(html);
  return rect.width > 2 && rect.height > 2 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0.01;
}

function toInfo(element: Element): Pass333ElementInfo {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element as HTMLElement);
  return {
    selector: selectorFor(element),
    tag: element.tagName.toLowerCase(),
    rect: rectRecord(rect),
    center: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
    pointerEvents: style.pointerEvents,
    visibility: style.visibility,
    display: style.display,
    opacity: style.opacity,
  };
}

function uniqueElements(selectors: string[]): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      if (seen.has(element)) continue;
      seen.add(element);
      result.push(element);
    }
  }
  return result;
}

function isWebviewElement(element: Element | null): boolean {
  if (!element) return false;
  if (element.tagName.toLowerCase() === "webview") return true;
  return Boolean(element.closest?.("webview"));
}

function elementAt(x: number, y: number): Element | null {
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  return document.elementFromPoint(x, y);
}

function chromeBandBottom(chromeControls: Pass333ElementInfo[]): number {
  let bottom = 0;
  for (const item of chromeControls) {
    if (item.rect.top <= 160 && item.rect.bottom <= Math.max(240, window.innerHeight * 0.35)) {
      bottom = Math.max(bottom, item.rect.bottom);
    }
  }
  return Math.min(Math.max(bottom, 0), Math.round(window.innerHeight * 0.4));
}

function sample(reason = "manual"): Pass333Sample {
  const now = new Date().toISOString();
  const chromeElements = uniqueElements(PASS333_CHROME_SELECTORS).filter(isVisibleElement).filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < Math.max(220, window.innerHeight * 0.35);
  });
  const chromeControls = chromeElements.map(toInfo).slice(0, 120);
  const webviewElements = Array.from(document.querySelectorAll("webview")).filter(isVisibleElement);
  const webviews = webviewElements.map(toInfo);
  const bandBottom = chromeBandBottom(chromeControls);
  const findings: Pass333Finding[] = [];

  for (const element of chromeElements) {
    const info = toInfo(element);
    const top = elementAt(info.center.x, info.center.y);
    if (isWebviewElement(top)) {
      findings.push({
        kind: "webview-occludes-browser-chrome",
        severity: "critical",
        detail: "A webview is the hit-test winner at a visible browser chrome/control point. This explains dead buttons/address bar while the page surface is white.",
        selector: info.selector,
        webviewSelector: selectorFor(top?.closest?.("webview") || top),
        rect: info.rect,
        at: now,
      });
    }
  }

  for (const webview of webviewElements) {
    const info = toInfo(webview);
    if (bandBottom > 0 && info.rect.top < bandBottom - 4 && info.pointerEvents !== "none") {
      findings.push({
        kind: "webview-enters-browser-chrome-band",
        severity: "critical",
        detail: "A visible pointer-active webview overlaps the top browser chrome band. Webview content must be clipped to the content stage, not the whole Electron window.",
        selector: info.selector,
        rect: info.rect,
        at: now,
      });
    }
    if (info.rect.width >= Math.round(window.innerWidth * 0.98) && info.rect.height >= Math.round(window.innerHeight * 0.96) && info.rect.top <= 2) {
      findings.push({
        kind: "webview-full-window-surface",
        severity: "critical",
        detail: "A webview is effectively full-window and starts at the top edge; that can cover the toolbar and produce dead shell controls.",
        selector: info.selector,
        rect: info.rect,
        at: now,
      });
    }
  }

  if (webviews.length === 0) {
    findings.push({
      kind: "no-visible-webview",
      severity: "warn",
      detail: "No visible webview was found during chrome hit-test sampling.",
      at: now,
    });
  }

  const sampleValue: Pass333Sample = {
    reason,
    at: now,
    viewport: { width: Math.round(window.innerWidth), height: Math.round(window.innerHeight), dpr: Number((window.devicePixelRatio || 1).toFixed(3)) },
    topChromeBandBottom: bandBottom,
    chromeControls,
    webviews,
    findings,
  };
  const state = window.__TAHAI_PASS333_CHROME_HITTEST__;
  if (state) {
    state.samples.push(sampleValue);
    while (state.samples.length > PASS333_MAX_SAMPLES) state.samples.shift();
    state.lastSample = sampleValue;
    state.lastCritical = findings.filter((finding) => finding.severity === "critical");
  }
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasWarn = findings.some((finding) => finding.severity === "warn");
  document.documentElement.dataset.pass333ChromeHitTestHealth = hasCritical ? "critical" : hasWarn ? "warn" : "ok";
  return sampleValue;
}

function schedule(reason: string, delay = 120): void {
  window.setTimeout(() => sample(reason), delay);
}

function install(): void {
  if (window.__TAHAI_PASS333_CHROME_HITTEST__) return;
  window.__TAHAI_PASS333_CHROME_HITTEST__ = { samples: [], sample };
  document.documentElement.dataset.pass333ChromeHitTestHealth = "pending";
  schedule("install", 120);
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}

export {};
