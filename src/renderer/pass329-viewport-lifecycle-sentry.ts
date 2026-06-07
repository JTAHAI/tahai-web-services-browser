type Pass329Finding = {
  kind: string;
  severity: "info" | "warn" | "critical";
  detail: string;
  selector?: string;
  rect?: Record<string, number>;
  viewport?: Record<string, number>;
  inlineStyle?: string;
  at: string;
};

type Pass329Sample = {
  reason: string;
  at: string;
  viewport: { width: number; height: number; dpr: number };
  findings: Pass329Finding[];
  stageCount: number;
  webviewCount: number;
};

declare global {
  interface Window {
    __TAHAI_PASS329_VIEWPORT_LIFECYCLE__?: {
      samples: Pass329Sample[];
      lastSample?: Pass329Sample;
      lastCritical?: Pass329Finding[];
      assert: (reason?: string) => Pass329Sample;
    };
  }
}

const PASS329_STAGE_SELECTORS = [
  "[data-browser-stage]",
  "[data-browser-content-stage]",
  "[data-webview-stage]",
  "[data-mission-stage]",
  ".browser-stage",
  ".browser-content",
  ".webview-stage",
  ".browser-webview-stage",
  ".tahai-webview-stage",
  ".tab-webview-stage",
  ".webview-container",
  ".mission-stage",
  ".mission-pane-body",
];

const PASS329_ROOT_SELECTORS = [
  "#root",
  "#app",
  "[data-app-root]",
  ".app-shell",
  ".browser-shell",
  ".tahai-browser-shell",
  "main",
];

const PASS329_INLINE_GEOMETRY_PATTERN = /(?:^|;)\s*(?:width|height|top|left|right|bottom|inset|transform|zoom|scale)\s*:/i;
const PASS329_SMALL_RATIO = 0.72;
const PASS329_GAP_ALLOWANCE_PX = 24;

function rectToPlain(rect: DOMRect): Record<string, number> {
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

function getFirstElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const found = document.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function getElements(selectors: string[]): Element[] {
  const found = new Set<Element>();
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll(selector))) found.add(element);
  }
  return Array.from(found);
}

function selectorFor(element: Element): string {
  if (element.id) return `#${element.id}`;
  const dataName = Array.from(element.attributes).find((a) => a.name.startsWith("data-") && /stage|webview|pane|root/i.test(a.name));
  if (dataName) return `[${dataName.name}]`;
  const className = String((element as HTMLElement).className || "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
  return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
}

function getViewport() {
  return {
    width: Math.round(window.innerWidth || document.documentElement.clientWidth || 0),
    height: Math.round(window.innerHeight || document.documentElement.clientHeight || 0),
    dpr: Number((window.devicePixelRatio || 1).toFixed(3)),
  };
}

function assertViewportLifecycle(reason = "manual"): Pass329Sample {
  const viewport = getViewport();
  const findings: Pass329Finding[] = [];
  const now = new Date().toISOString();
  const root = getFirstElement(PASS329_ROOT_SELECTORS) || document.body || document.documentElement;
  const rootRect = root.getBoundingClientRect();
  const rootPlain = rectToPlain(rootRect);

  if (viewport.width > 0 && viewport.height > 0) {
    const rootTooSmall = rootRect.width < viewport.width * PASS329_SMALL_RATIO || rootRect.height < viewport.height * PASS329_SMALL_RATIO;
    const rootOffsetIsland = rootRect.left > PASS329_GAP_ALLOWANCE_PX || rootRect.top > PASS329_GAP_ALLOWANCE_PX;
    if (rootTooSmall || rootOffsetIsland) {
      findings.push({
        kind: "root-upper-left-island",
        severity: "critical",
        detail: "Renderer root is materially smaller than the Electron viewport or offset away from the viewport origin.",
        selector: selectorFor(root),
        rect: rootPlain,
        viewport,
        at: now,
      });
    }
  }

  const stageElements = getElements(PASS329_STAGE_SELECTORS);
  for (const stage of stageElements) {
    const rect = stage.getBoundingClientRect();
    const inlineStyle = (stage.getAttribute("style") || "").trim();
    if (inlineStyle && PASS329_INLINE_GEOMETRY_PATTERN.test(inlineStyle)) {
      findings.push({
        kind: "stage-inline-geometry-owner",
        severity: "warn",
        detail: "A stage/container still has inline geometry style. Source CSS should own stage geometry.",
        selector: selectorFor(stage),
        rect: rectToPlain(rect),
        viewport,
        inlineStyle,
        at: now,
      });
    }
    if (rect.width > 0 && rect.height > 0 && viewport.width > 0 && viewport.height > 0) {
      const looksIsland = rect.width < viewport.width * PASS329_SMALL_RATIO && rect.height < viewport.height * PASS329_SMALL_RATIO && rect.left <= PASS329_GAP_ALLOWANCE_PX && rect.top <= PASS329_GAP_ALLOWANCE_PX;
      if (looksIsland) {
        findings.push({
          kind: "stage-upper-left-island",
          severity: "critical",
          detail: "A visible browser/webview stage is trapped as a small upper-left island inside the Electron viewport.",
          selector: selectorFor(stage),
          rect: rectToPlain(rect),
          viewport,
          at: now,
        });
      }
    }
  }

  const webviews = Array.from(document.querySelectorAll("webview"));
  for (const webview of webviews) {
    const rect = webview.getBoundingClientRect();
    const inlineStyle = (webview.getAttribute("style") || "").trim();
    const computed = window.getComputedStyle(webview as HTMLElement);
    if (inlineStyle && PASS329_INLINE_GEOMETRY_PATTERN.test(inlineStyle)) {
      findings.push({
        kind: "webview-inline-geometry-owner",
        severity: "warn",
        detail: "A webview still has inline geometry style. Source CSS/layout should own webview geometry.",
        selector: selectorFor(webview),
        rect: rectToPlain(rect),
        viewport,
        inlineStyle,
        at: now,
      });
    }
    if (computed.transform && computed.transform !== "none") {
      findings.push({
        kind: "webview-transform-owner",
        severity: "critical",
        detail: "A webview has an active CSS transform. This can cause compositor upper-left / black-space failures.",
        selector: selectorFor(webview),
        rect: rectToPlain(rect),
        viewport,
        inlineStyle,
        at: now,
      });
    }
    if (rect.width > 0 && rect.height > 0 && viewport.width > 0 && viewport.height > 0) {
      const webviewTooSmall = rect.width < viewport.width * 0.5 || rect.height < viewport.height * 0.5;
      if (webviewTooSmall) {
        findings.push({
          kind: "webview-too-small-after-load",
          severity: "critical",
          detail: "A loaded webview is materially smaller than the Electron viewport. This is consistent with the trapped upper-left shell failure.",
          selector: selectorFor(webview),
          rect: rectToPlain(rect),
          viewport,
          at: now,
        });
      }
    }
  }

  const sample: Pass329Sample = {
    reason,
    at: now,
    viewport,
    findings,
    stageCount: stageElements.length,
    webviewCount: webviews.length,
  };

  const state = window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__ || { samples: [], assert: assertViewportLifecycle };
  state.samples.push(sample);
  if (state.samples.length > 60) state.samples.splice(0, state.samples.length - 60);
  state.lastSample = sample;
  state.lastCritical = findings.filter((f) => f.severity === "critical");
  state.assert = assertViewportLifecycle;
  window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__ = state;

  const criticals = findings.filter((f) => f.severity === "critical");
  const warnings = findings.filter((f) => f.severity === "warn");
  document.documentElement.dataset.pass329ViewportHealth = criticals.length ? "critical" : warnings.length ? "warn" : "ok";
  document.documentElement.dataset.pass329ViewportLastReason = reason;
  document.documentElement.dataset.pass329ViewportLastAt = now;

  if (criticals.length) {
    console.error("[PASS329] viewport_lifecycle_violation", sample);
  } else if (warnings.length) {
    console.warn("[PASS329] viewport_lifecycle_warning", sample);
  }
  return sample;
}

let scheduled = 0;
function scheduleAssert(reason: string, delay = 0) {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => assertViewportLifecycle(reason), delay);
}

function installPass329Sentry() {
  if (window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__?.assert) return;
  window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__ = { samples: [], assert: assertViewportLifecycle };
  scheduleAssert("install", 0);
  scheduleAssert("install-settle", 250);
  window.addEventListener("resize", () => scheduleAssert("window-resize", 120), { passive: true });
  window.addEventListener("load", () => scheduleAssert("window-load", 150), { once: true });
  document.addEventListener("visibilitychange", () => scheduleAssert(`visibility-${document.visibilityState}`, 120));
  document.addEventListener("DOMContentLoaded", () => scheduleAssert("dom-content-loaded", 80), { once: true });

  const observer = new MutationObserver((records) => {
    if (records.some((r) => Array.from(r.addedNodes).some((n) => n.nodeType === Node.ELEMENT_NODE && ((n as Element).tagName?.toLowerCase() === "webview" || (n as Element).querySelector?.("webview"))))) {
      scheduleAssert("webview-added", 160);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  for (let i = 1; i <= 5; i += 1) {
    window.setTimeout(() => assertViewportLifecycle(`startup-soak-${i}`), i * 500);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installPass329Sentry, { once: true });
} else {
  installPass329Sentry();
}

export {};