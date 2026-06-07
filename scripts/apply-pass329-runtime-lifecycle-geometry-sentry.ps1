$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$pkgPath = Join-Path $repo "package.json"
if (!(Test-Path $pkgPath)) { throw "package.json not found. Run from D:\dev\browser\app" }
if ($repo -notmatch '^[Dd]:\\dev\\browser\\app$') {
  Write-Warning "Expected repo path D:\dev\browser\app. Current path: $repo"
}

$scriptDir = Join-Path $repo "scripts"
$qaDir = Join-Path $repo "docs\qa"
$generatedDir = Join-Path $repo "release-candidate\generated"
$bugHuntDir = Join-Path $repo "release-candidate\bug-hunt"
New-Item -ItemType Directory -Force -Path $scriptDir, $qaDir, $generatedDir, $bugHuntDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $repo ".pass329-backup\$stamp"
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
$pass328ReportPath = Join-Path $generatedDir "pass328-inline-geometry-owner-excision-and-webview-stage-contract-report.json"
$pass328Summary = [ordered]@{
  present = (Test-Path $pass328ReportPath)
  reportPath = if (Test-Path $pass328ReportPath) { Get-RepoRelativePath $pass328ReportPath } else { $null }
  result = $null
  findingCount = $null
  releaseBlockingFindingCount = $null
}
if (Test-Path $pass328ReportPath) {
  try {
    $p328 = Get-Content -Raw -Path $pass328ReportPath | ConvertFrom-Json
    $pass328Summary.result = $p328.result
    $pass328Summary.findingCount = $p328.findingCount
    $pass328Summary.releaseBlockingFindingCount = $p328.releaseBlockingFindingCount
    $actions.Add("reviewed PASS328 inline geometry owner report")
  } catch {
    $actions.Add("PASS328 report existed but could not be parsed: $($_.Exception.Message)")
  }
} else {
  $actions.Add("PASS328 report not found; PASS329 still applied runtime lifecycle sentry and verifier")
}

$srcPath = Join-Path $repo "src"
if (!(Test-Path $srcPath)) { throw "src folder not found. PASS329 expects browser source under src." }

$rendererDir = Join-Path $repo "src\renderer"
if (!(Test-Path $rendererDir)) { New-Item -ItemType Directory -Force -Path $rendererDir | Out-Null }

# PASS329: source-owned runtime lifecycle sentry. This records truth and asserts violations; it does not resize the page.
$sentryPath = Join-Path $rendererDir "pass329-viewport-lifecycle-sentry.ts"
$sentry = @'
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
'@
Write-Utf8NoBom $sentryPath $sentry
$actions.Add("created renderer viewport lifecycle sentry")

# Import the sentry from the active renderer entry when a known entry exists.
$rendererEntryCandidates = @(
  "src\renderer\app.ts",
  "src\renderer\main.ts",
  "src\renderer\index.ts",
  "src\renderer\app.tsx",
  "src\renderer\main.tsx",
  "src\renderer\index.tsx",
  "src\renderer\app.js",
  "src\renderer\main.js",
  "src\renderer\index.js"
)
$rendererEntryPath = $null
foreach ($rel in $rendererEntryCandidates) {
  $candidate = Join-Path $repo $rel
  if (Test-Path $candidate) { $rendererEntryPath = $candidate; break }
}
if ($rendererEntryPath) {
  $entryText = Read-Text $rendererEntryPath
  if ($entryText -notmatch "pass329-viewport-lifecycle-sentry") {
    Replace-Text $rendererEntryPath ("import './pass329-viewport-lifecycle-sentry';`n" + $entryText)
    $actions.Add("imported PASS329 sentry from $(Get-RepoRelativePath $rendererEntryPath)")
  } else {
    $actions.Add("PASS329 sentry import already present in $(Get-RepoRelativePath $rendererEntryPath)")
  }
} else {
  $actions.Add("no known renderer entry found; PASS329 sentry file created but must be imported manually")
}

# Append a tiny non-layout diagnostic style so health state is visible only in dev/diagnostic contexts.
$cssCandidates = Get-ChildItem -Path $srcPath -Recurse -File -Include *.css,*.scss -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(dist|release|node_modules|coverage)\\' }
$preferredCssRel = @(
  "src\renderer\browser.css",
  "src\renderer\styles\browser.css",
  "src\renderer\app.css",
  "src\renderer\index.css",
  "src\renderer\style.css",
  "src\browser.css"
)
$healthCssPath = $null
foreach ($rel in $preferredCssRel) {
  $candidate = Join-Path $repo $rel
  if (Test-Path $candidate) { $healthCssPath = $candidate; break }
}
if (!$healthCssPath -and $cssCandidates.Count -gt 0) { $healthCssPath = ($cssCandidates | Select-Object -First 1).FullName }
if ($healthCssPath) {
  $cssText = Read-Text $healthCssPath
  if ($cssText -notmatch "PASS329_VIEWPORT_LIFECYCLE_HEALTH_BEGIN") {
    $healthCss = @'

/* PASS329_VIEWPORT_LIFECYCLE_HEALTH_BEGIN
   Diagnostic-only health flags. This does not resize the viewport.
*/
:root[data-pass329-viewport-health="critical"] [data-pass329-viewport-health-badge],
:root[data-pass329-viewport-health="critical"] .pass329-viewport-health-badge {
  border-color: rgba(96, 255, 218, 0.92);
  box-shadow: 0 0 0 1px rgba(96, 255, 218, 0.38), 0 0 18px rgba(96, 255, 218, 0.16);
}
/* PASS329_VIEWPORT_LIFECYCLE_HEALTH_END */
'@
    Replace-Text $healthCssPath ($cssText.TrimEnd() + $healthCss)
    $actions.Add("appended PASS329 diagnostic CSS to $(Get-RepoRelativePath $healthCssPath)")
  } else {
    $actions.Add("PASS329 diagnostic CSS already present in $(Get-RepoRelativePath $healthCssPath)")
  }
} else {
  $actions.Add("no CSS file found for optional diagnostic health styling")
}

# Static bug hunt: mark stale lifecycle owners for review; gate the obviously pass-residue ones only.
$sourceFiles = Get-ChildItem -Path $srcPath -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.mjs,*.cjs -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(dist|release|node_modules|coverage)\\' }
$legacyObserverEdits = 0
$observerPattern = '(new\s+(?:ResizeObserver|MutationObserver)\s*\(|addEventListener\s*\(\s*["''](?:resize|load|DOMContentLoaded|visibilitychange)["'']|requestAnimationFrame\s*\(|setInterval\s*\()'
$geometryContextPattern = '(webview|browser[-_ ]?stage|content[-_ ]?stage|viewport|pane|mission[-_ ]?pane|geometry|bounds|resize|layout|PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-8]|upper-left|black space|compositor|scale forensic|root-cause)'
foreach ($file in $sourceFiles) {
  if ($file.FullName -eq $sentryPath) { continue }
  $path = $file.FullName
  $text = Read-Text $path
  if ([string]::IsNullOrWhiteSpace($text)) { continue }
  $lines = $text -split "`r?`n", -1
  $changed = $false
  $out = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $indent = ([regex]::Match($line, '^\s*')).Value
    $contextStart = [Math]::Max(0, $i - 8)
    $contextEnd = [Math]::Min($lines.Count - 1, $i + 8)
    $ctx = ($lines[$contextStart..$contextEnd] -join "`n")
    $isComment = $line.TrimStart().StartsWith("//") -or $line.TrimStart().StartsWith("*") -or $line.TrimStart().StartsWith("/*")
    $alreadyGated = $ctx -match 'TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS|PASS329: legacy viewport lifecycle observer'
    # Only auto-gate one-line pass-residue observers/timers. Multi-line/function-owned observers are reported by the verifier for human review.
    $looksOneLineStatement = $line.TrimEnd() -match ';$'
    $looksPassResidue = $ctx -match '(PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-8]|upper-left|black space|compositor|scale forensic|root-cause)'
    if (!$alreadyGated -and !$isComment -and $looksOneLineStatement -and $looksPassResidue -and $ctx -match $geometryContextPattern -and $line -match $observerPattern) {
      $out.Add("$indent// PASS329: legacy viewport lifecycle observer/timer disabled by default; source lifecycle sentry records geometry truth instead.")
      $out.Add($indent + 'if (typeof process !== "undefined" && process.env && process.env.TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS === "1") {')
      $out.Add("  $line")
      $out.Add("$indent}")
      $changed = $true
      $legacyObserverEdits++
      continue
    }
    $out.Add($line)
  }
  if ($changed) { Replace-Text $path ($out -join "`n") }
}
if ($legacyObserverEdits -gt 0) { $actions.Add("gated $legacyObserverEdits legacy viewport lifecycle observer/timer owner(s)") }
else { $actions.Add("no safe one-line pass-residue viewport observer/timer found for auto-gating; verifier will enumerate remaining lifecycle owners") }

$verifierPath = Join-Path $scriptDir "verify-pass-329-runtime-lifecycle-geometry-sentry.mjs"
$verifier = @'
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const srcDir = path.join(root, "src");
const generatedDir = path.join(root, "release-candidate", "generated");
const bugHuntDir = path.join(root, "release-candidate", "bug-hunt");
fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(bugHuntDir, { recursive: true });

function read(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}
function rel(file) { return path.relative(root, file).replace(/\\/g, "/"); }
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "release", "coverage", ".git"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const findings = [];
function add(f) { findings.push({ releaseBlocking: false, ...f }); }

const files = walk(srcDir);
const pkg = JSON.parse(read(path.join(root, "package.json")) || "{}");
const sentryPath = path.join(root, "src", "renderer", "pass329-viewport-lifecycle-sentry.ts");
const sentryText = read(sentryPath);
if (!sentryText) {
  add({ kind: "missing-sentry", severity: "critical", file: "src/renderer/pass329-viewport-lifecycle-sentry.ts", releaseBlocking: true, why: "PASS329 viewport lifecycle sentry file is missing.", action: "Apply PASS329 or restore the sentry file." });
} else {
  for (const token of ["__TAHAI_PASS329_VIEWPORT_LIFECYCLE__", "root-upper-left-island", "webview-too-small-after-load", "stage-inline-geometry-owner", "webview-transform-owner"]) {
    if (!sentryText.includes(token)) add({ kind: "sentry-token-missing", severity: "critical", file: "src/renderer/pass329-viewport-lifecycle-sentry.ts", releaseBlocking: true, why: `PASS329 sentry missing required token ${token}.`, action: "Restore the complete PASS329 sentry implementation." });
  }
}

const rendererEntries = [
  "src/renderer/app.ts", "src/renderer/main.ts", "src/renderer/index.ts", "src/renderer/app.tsx", "src/renderer/main.tsx", "src/renderer/index.tsx", "src/renderer/app.js", "src/renderer/main.js", "src/renderer/index.js"
];
const importedBy = rendererEntries.filter((p) => read(path.join(root, p)).includes("pass329-viewport-lifecycle-sentry"));
if (!importedBy.length) {
  add({ kind: "sentry-not-imported", severity: "critical", file: "src/renderer/*", releaseBlocking: true, why: "PASS329 sentry exists but is not imported by a known renderer entry.", action: "Import './pass329-viewport-lifecycle-sentry' from the renderer entry that actually boots the browser shell." });
}

if (!pkg.scripts?.["verify:pass-329-runtime-lifecycle-geometry-sentry"]) {
  add({ kind: "missing-package-script", severity: "critical", file: "package.json", releaseBlocking: true, why: "PASS329 verifier script is not registered.", action: "Add verify:pass-329-runtime-lifecycle-geometry-sentry." });
}

const lifecycleOwnerPattern = /(new\s+(ResizeObserver|MutationObserver)\s*\(|addEventListener\s*\(\s*["'](resize|load|DOMContentLoaded|visibilitychange)["']|requestAnimationFrame\s*\(|setInterval\s*\()/;
const geometryContextPattern = /(webview|browser[-_ ]?stage|content[-_ ]?stage|viewport|pane|mission[-_ ]?pane|geometry|bounds|resize|layout|PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-9]|upper-left|black space|compositor|scale forensic|root-cause)/i;
const passResiduePattern = /(PASS271_R9|PASS271_R10|PASS31[7-9]|PASS32[0-8]|upper-left|black space|compositor|scale forensic|root-cause)/i;
const inlineGeometryPattern = /(\.style\.(width|height|top|left|right|bottom|inset|transform|zoom)\s*=|\.style\.setProperty\s*\(\s*["'](width|height|top|left|right|bottom|inset|transform|zoom)["']|setAttribute\s*\(\s*["']style["'])/;
const zoomPattern = /(setZoomFactor\s*\(|webFrame\.setZoomFactor|zoomFactor\s*=)/;
const boundsPattern = /\.(setBounds|setSize|setContentSize)\s*\(/;

const lifecycleCandidates = [];
const stalePassResidue = [];
for (const file of files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f))) {
  if (rel(file) === "src/renderer/pass329-viewport-lifecycle-sentry.ts") continue;
  const lines = read(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const ctx = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 9)).join("\n");
    if (geometryContextPattern.test(ctx) && lifecycleOwnerPattern.test(line)) {
      const gated = /TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS|PASS329: legacy viewport lifecycle observer|pass329-viewport-lifecycle-sentry/.test(ctx);
      lifecycleCandidates.push({ file: rel(file), lineNumber: i + 1, line: line.trim(), gated, passResidue: passResiduePattern.test(ctx) });
      if (!gated && passResiduePattern.test(ctx)) {
        add({ kind: "ungated-stale-viewport-lifecycle-owner", severity: "critical", file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: "A stale pass-residue lifecycle observer/timer can still run after load/resize and rewrite geometry.", action: "Delete it or gate it behind TAHAI_BROWSER_ENABLE_LEGACY_VIEWPORT_OBSERVERS=1.", line: line.trim(), context: ctx });
      } else if (!gated) {
        add({ kind: "active-viewport-lifecycle-owner-review", severity: "warn", file: rel(file), lineNumber: i + 1, why: "A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.", action: "Review this owner against PASS329 sentry output and PASS328 geometry report.", line: line.trim(), context: ctx });
      }
    }
    if (geometryContextPattern.test(ctx) && inlineGeometryPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_INLINE_WEBVIEW_GEOMETRY|PASS328/.test(ctx)) {
      add({ kind: "post-pass328-inline-geometry-owner", severity: "critical", file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: "An active inline geometry writer remains after PASS328.", action: "Move geometry to source CSS/layout or gate as a legacy rollback path.", line: line.trim(), context: ctx });
    }
    if (geometryContextPattern.test(ctx) && zoomPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_SHELL_ZOOM|PASS328/.test(ctx)) {
      add({ kind: "post-pass328-zoom-owner", severity: "critical", file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: "A zoom owner remains active near viewport/webview code.", action: "Remove or gate zoom writes; viewport scale must remain source-default unless explicitly user-controlled.", line: line.trim(), context: ctx });
    }
    if (passResiduePattern.test(ctx) && boundsPattern.test(line) && !/TAHAI_BROWSER_ENABLE_LEGACY_WINDOW_BOUNDS_WRITES|PASS328/.test(ctx)) {
      add({ kind: "post-pass328-window-bounds-owner", severity: "critical", file: rel(file), lineNumber: i + 1, releaseBlocking: true, why: "A pass-residue BrowserWindow bounds/content-size writer remains active.", action: "Remove or gate window bounds writes; BrowserWindow geometry is user/window-manager owned.", line: line.trim(), context: ctx });
    }
  }
}

const releaseBlockingFindings = findings.filter((f) => f.releaseBlocking);
const byKind = findings.reduce((m, f) => { m[f.kind] = (m[f.kind] || 0) + 1; return m; }, {});
const report = {
  pass: "PASS329",
  name: "Runtime Lifecycle Geometry Sentry",
  result: releaseBlockingFindings.length ? "BLOCKED_REVIEW_REQUIRED" : "PASS",
  repo: root,
  expectedRepo: "D:/dev/browser/app",
  scannedFileCount: files.length,
  sentry: {
    file: "src/renderer/pass329-viewport-lifecycle-sentry.ts",
    present: Boolean(sentryText),
    importedBy,
  },
  lifecycleCandidateCount: lifecycleCandidates.length,
  ungatedPassResidueLifecycleCandidateCount: lifecycleCandidates.filter((c) => c.passResidue && !c.gated).length,
  lifecycleCandidates: lifecycleCandidates.slice(0, 220),
  findingCount: findings.length,
  releaseBlockingFindingCount: releaseBlockingFindings.length,
  byKind,
  findings,
  releaseTruth: {
    storeSubmitted: false,
    storeApproved: false,
    signedReleaseClaimAllowed: false,
    publicGaClaimAllowed: false,
    localRuntimeVerificationRequired: true,
  },
  runtimeManualProbe: {
    consoleProbe: "window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')",
    expectedHealthyDataset: "document.documentElement.dataset.pass329ViewportHealth === 'ok'",
    failureDatasetValues: ["warn", "critical"],
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(generatedDir, "pass329-runtime-lifecycle-geometry-sentry-report.json"), JSON.stringify(report, null, 2));
let md = `# PASS329 — Runtime Lifecycle Geometry Sentry\n\n`;
md += `Result: **${report.result}**\n\n`;
md += `Scanned files: ${report.scannedFileCount}\n\n`;
md += `Sentry imported by: ${importedBy.length ? importedBy.map((f) => `\`${f}\``).join(", ") : "none"}\n\n`;
md += `Lifecycle candidates: ${report.lifecycleCandidateCount}\n\n`;
md += `Ungated pass-residue lifecycle candidates: ${report.ungatedPassResidueLifecycleCandidateCount}\n\n`;
md += `## Runtime console probe\n\n`;
md += `\`window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')\`\n\n`;
md += `Expected healthy value: \`document.documentElement.dataset.pass329ViewportHealth === 'ok'\`\n\n`;
md += `## Finding categories\n\n`;
for (const [k, v] of Object.entries(byKind).sort((a,b) => b[1] - a[1])) md += `- ${k}: ${v}\n`;
md += `\n## Lifecycle candidates\n\n`;
for (const c of lifecycleCandidates.slice(0, 120)) md += `- ${c.gated ? "gated" : "active"}${c.passResidue ? ", pass-residue" : ""}: \`${c.file}:${c.lineNumber}\` — ${c.line}\n`;
md += `\n## Findings\n\n`;
for (const f of findings.slice(0, 180)) {
  md += `### ${String(f.severity).toUpperCase()} — ${f.kind}${f.releaseBlocking ? " — RELEASE BLOCKING" : ""}\n\n`;
  md += `File: \`${f.file}${f.lineNumber ? `:${f.lineNumber}` : ""}\`\n\n`;
  md += `Why: ${f.why}\n\nAction: ${f.action}\n\n`;
  if (f.context || f.line) md += `\`\`\`text\n${f.context || f.line}\n\`\`\`\n\n`;
}
fs.writeFileSync(path.join(bugHuntDir, "pass329-runtime-lifecycle-geometry-sentry.md"), md);

console.log(`PASS329_VERIFY_RESULT=${report.result}`);
console.log(`PASS329_SCANNED_FILES=${report.scannedFileCount}`);
console.log(`PASS329_SENTRY_IMPORTED_BY=${importedBy.join(",") || "none"}`);
console.log(`PASS329_LIFECYCLE_CANDIDATES=${report.lifecycleCandidateCount}`);
console.log(`PASS329_UNGATED_PASS_RESIDUE_LIFECYCLE_CANDIDATES=${report.ungatedPassResidueLifecycleCandidateCount}`);
console.log(`PASS329_FINDINGS=${report.findingCount}`);
console.log(`PASS329_RELEASE_BLOCKERS=${report.releaseBlockingFindingCount}`);
console.log(`PASS329_REPORT=${path.relative(root, path.join(generatedDir, "pass329-runtime-lifecycle-geometry-sentry-report.json"))}`);
if (releaseBlockingFindings.length) process.exitCode = 1;
'@
Write-Utf8NoBom $verifierPath $verifier
$actions.Add("installed PASS329 runtime lifecycle geometry verifier")

$qaPath = Join-Path $qaDir "PASS329-runtime-lifecycle-geometry-sentry.md"
$qaDoc = @'
# PASS329 — Runtime Lifecycle Geometry Sentry

Purpose: continue bug hunting past PASS328 by proving whether late lifecycle owners still trap the renderer/webview shell in the upper-left corner after attach/load/resize.

This pass adds a source-owned renderer sentry that:

- samples viewport, root, stage, and webview rectangles after install, DOMContentLoaded, load, resize, visibility changes, and webview insertion
- records samples at `window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__`
- sets `document.documentElement.dataset.pass329ViewportHealth` to `ok`, `warn`, or `critical`
- flags root/stage/webview upper-left island failures
- flags inline geometry owners on stage/webview elements
- flags active webview transforms
- does not resize, reposition, zoom, or patch webview geometry at runtime

Verification:

```powershell
Set-Location D:\dev\browser\app
npm run verify:pass-329-runtime-lifecycle-geometry-sentry
npm run build
```

Manual runtime probe:

1. Launch restored, not maximized.
2. Load `https://tahaiportal.com/`.
3. Open DevTools for the shell if needed.
4. Run:

```js
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')
document.documentElement.dataset.pass329ViewportHealth
```

Acceptance:

- Expected healthy value is `ok`.
- `warn` means stale inline geometry remains but the app may still be usable.
- `critical` means the upper-left/black-space failure is observable and should be correlated with `lastCritical`.
- Any PASS271/PASS317-PASS328 observer/timer still controlling viewport geometry must be removed or gated.

Release truth:

- Microsoft Store submission remains not submitted.
- Microsoft Store approval remains false.
- No GA claim.
- No signed-release claim.
'@
Write-Utf8NoBom $qaPath $qaDoc

$cursorPromptPath = Join-Path $qaDir "PASS329-CURSOR-RUNTIME-LIFECYCLE-GEOMETRY-SENTRY-REVIEW-PROMPT.md"
$cursorPrompt = @'
# PASS329 Cursor Review Prompt — Runtime Lifecycle Geometry Sentry

Repo: `D:\dev\browser\app`

Review these first:

1. `release-candidate/generated/pass329-runtime-lifecycle-geometry-sentry-report.json`
2. `release-candidate/bug-hunt/pass329-runtime-lifecycle-geometry-sentry.md`
3. `src/renderer/pass329-viewport-lifecycle-sentry.ts`
4. PASS327/PASS328 generated reports

Primary question:

What active lifecycle owner still runs after webview attach/load/resize and can leave the shell/webview trapped as a small upper-left island with black unused space?

Do not add another viewport fixer. Use the PASS329 sentry as evidence and remove the owner.

Runtime probe:

```js
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')
window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.lastCritical
document.documentElement.dataset.pass329ViewportHealth
```

Review priority:

- ResizeObserver / MutationObserver paths near webview/stage/pane geometry
- requestAnimationFrame / setInterval / resize listeners near viewport recompute logic
- any owner with PASS271_R9/R10 or PASS317-PASS328 tags
- webview/stage inline geometry at runtime
- CSS transforms or zoom on webview/stage/root
- Electron security guardrails must remain intact

Target outcome: source-owned layout + diagnostic sentry, no late runtime geometry writers.
'@
Write-Utf8NoBom $cursorPromptPath $cursorPrompt

$snippetDir = Join-Path $repo "package-json-snippets"
New-Item -ItemType Directory -Force -Path $snippetDir | Out-Null
$snippetPath = Join-Path $snippetDir "pass329-package-scripts.json"
$snippet = @'
{
  "scripts": {
    "verify:pass-329-runtime-lifecycle-geometry-sentry": "node scripts/verify-pass-329-runtime-lifecycle-geometry-sentry.mjs"
  }
}
'@
Write-Utf8NoBom $snippetPath $snippet.TrimStart()

Backup-File $pkgPath
$pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
if (-not $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{}) }
$pkg.scripts | Add-Member -Force -MemberType NoteProperty -Name "verify:pass-329-runtime-lifecycle-geometry-sentry" -Value "node scripts/verify-pass-329-runtime-lifecycle-geometry-sentry.mjs"
$pkg | ConvertTo-Json -Depth 100 | Set-Content -Path $pkgPath -Encoding UTF8
$actions.Add("registered PASS329 npm verifier script")

$applyReport = [ordered]@{
  pass = "PASS329"
  name = "Runtime Lifecycle Geometry Sentry"
  result = "APPLIED"
  repo = $repo
  expectedRepo = "D:\dev\browser\app"
  pass328 = $pass328Summary
  sourceCleanupActions = @($actions)
  legacyViewportObserverEdits = $legacyObserverEdits
  sentryFile = "src/renderer/pass329-viewport-lifecycle-sentry.ts"
  sentryImportedBy = if ($rendererEntryPath) { Get-RepoRelativePath $rendererEntryPath } else { $null }
  generated = @(
    "src/renderer/pass329-viewport-lifecycle-sentry.ts",
    "scripts/verify-pass-329-runtime-lifecycle-geometry-sentry.mjs",
    "docs/qa/PASS329-runtime-lifecycle-geometry-sentry.md",
    "docs/qa/PASS329-CURSOR-RUNTIME-LIFECYCLE-GEOMETRY-SENTRY-REVIEW-PROMPT.md",
    "package-json-snippets/pass329-package-scripts.json",
    "release-candidate/generated/pass329-runtime-lifecycle-geometry-sentry-report.json",
    "release-candidate/bug-hunt/pass329-runtime-lifecycle-geometry-sentry.md"
  )
  backupDir = Get-RepoRelativePath $backupDir
  releaseTruth = [ordered]@{
    storeSubmitted = $false
    storeApproved = $false
    signedReleaseClaimAllowed = $false
    publicGaClaimAllowed = $false
    localRuntimeVerificationRequired = $true
  }
}
$applyReport | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $generatedDir "pass329-apply-report.json") -Encoding UTF8

$verifyResult = "NOT_RUN"
try {
  npm run verify:pass-329-runtime-lifecycle-geometry-sentry
  $verifyResult = "PASS"
} catch {
  $verifyResult = "BLOCKED_REVIEW_REQUIRED"
  Write-Warning "PASS329 verifier reported review blockers. See release-candidate\generated\pass329-runtime-lifecycle-geometry-sentry-report.json"
}

Write-Host "PASS329_APPLIED=PASS"
Write-Host "PASS329_LEGACY_VIEWPORT_OBSERVER_EDITS=$legacyObserverEdits"
Write-Host "PASS329_SENTRY_FILE=src/renderer/pass329-viewport-lifecycle-sentry.ts"
Write-Host "PASS329_SENTRY_IMPORTED_BY=$(if ($rendererEntryPath) { Get-RepoRelativePath $rendererEntryPath } else { 'MANUAL_IMPORT_REQUIRED' })"
Write-Host "PASS329_VERIFY_RESULT=$verifyResult"
Write-Host "PASS329_REPORT=$(Join-Path $generatedDir 'pass329-runtime-lifecycle-geometry-sentry-report.json')"
Write-Host "PASS329_BACKUP_DIR=$backupDir"
