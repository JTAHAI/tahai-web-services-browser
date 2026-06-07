#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/^\uFEFF/, "");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const failures = [];
const warnings = [];

function fail(id, message) {
  failures.push({ id, message });
}

function warn(id, message) {
  warnings.push({ id, message });
}

function activeImportLines(source) {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1, trimmed: line.trim() }))
    .filter((entry) => /^import\s+/.test(entry.trimmed));
}

function cssBlocks(source) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/gms;
  let match;
  while ((match = re.exec(source))) {
    blocks.push({ selector: match[1], body: match[2], index: match.index });
  }
  return blocks;
}

const required = [
  "src/main/main.ts",
  "src/renderer/app.ts",
  "src/renderer/index.html",
  "src/renderer/styles/browser.css",
  "package.json"
];

for (const rel of required) {
  if (!exists(rel)) fail("missing-file", `Missing required file: ${rel}`);
}

let main = "";
let app = "";
let indexHtml = "";
let css = "";
let pkg = "";

if (!failures.length) {
  main = read("src/main/main.ts");
  app = read("src/renderer/app.ts");
  indexHtml = read("src/renderer/index.html");
  css = read("src/renderer/styles/browser.css");
  pkg = read("package.json");
}

if (main && !main.includes("TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE")) {
  fail("gpu-disable-not-opt-in", "PASS271_R9 GPU/compositor disable must be opt-in only.");
}

if (app && !app.includes("TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR")) {
  fail("pass271-r4-env-gate-missing", "PASS271_R4 normal webview repair env gate is missing.");
}

if (app && /if\s*\(\s*document\.readyState\s*===\s*['"]loading['"]\s*\)\s*document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*pass271R4Mount\s*,\s*\{\s*once\s*:\s*true\s*\}\s*\)\s*;\s*else\s*pass271R4Mount\s*\(\s*\)\s*;/s.test(app) && !/if\s*\(\s*pass271R4NormalWebviewRepairEnabled\s*\(\s*\)\s*\)\s*\{[\s\S]{0,300}pass271R4Mount/.test(app)) {
  fail("pass271-r4-repair-not-gated", "Unconditional PASS271_R4 auto-mount still exists.");
}

if (app && !app.includes("PASS338_NORMAL_WEBVIEW_REPAIR_OFF")) {
  fail("pass271-r4-inline-writers-not-fail-closed", "pass271R4NormalizeWebview must fail closed unless PASS271_R4 repair is explicitly enabled.");
}

if (app && /\.style\.background\s*=\s*['"]#(?:fff|ffffff)['"]/i.test(app)) {
  const nearby = app.match(/pass271R4NormalizeWebview[\s\S]{0,1800}\.style\.background\s*=\s*['"]#(?:fff|ffffff)['"]/i);
  if (nearby && !app.includes("PASS338_NORMAL_WEBVIEW_REPAIR_OFF")) {
    fail("pass271-r4-inline-white-still-active", "PASS271_R4 inline white background writer is not guarded.");
  }
}

if (app && /webview\.dataset\.pass271R9WebviewWhiteScreenCloseout\s*=/.test(app) && !app.includes("TAHAI_BROWSER_ENABLE_PASS271_R9_WHITE_SCREEN_CLOSEOUT_DATASET")) {
  fail("pass271-r9-white-dataset-not-gated", "PASS271_R9 white-screen dataset must be opt-in only.");
}

if (app && /pass271R9ArmWebviewBlankSurfaceRecovery\s*\(/.test(app) && !app.includes("TAHAI_BROWSER_ENABLE_PASS271_R9_BLANK_SURFACE_RECOVERY")) {
  fail("pass271-r9-blank-recovery-not-gated", "PASS271_R9 blank-surface recovery must be opt-in only.");
}

if (app) {
  const imports = activeImportLines(app);
  const forbiddenEmergencyImports = imports.filter((entry) => /pass(?:329|330|331|332|334|335|336)[^"']*['"]/.test(entry.line));
  if (forbiddenEmergencyImports.length) {
    fail("emergency-pass-import-active", `Emergency PASS329-PASS336 import active: ${forbiddenEmergencyImports.map((e) => `line ${e.index}`).join(", ")}`);
  }
}

if (indexHtml && !/href\s*=\s*["']\.\/styles\/browser\.css["']/.test(indexHtml)) {
  fail("runtime-stylesheet-not-loaded", "Runtime stylesheet truth must be src/renderer/styles/browser.css.");
}

if (indexHtml && /href\s*=\s*["']\.\/browser\.css["']/.test(indexHtml)) {
  fail("orphan-browser-css-linked", "src/renderer/browser.css is orphan CSS and must not be the runtime stylesheet.");
}

if (css && !css.includes("PASS338_CURSOR_RUNTIME_ROOT_CAUSE_CLOSEOUT")) {
  fail("pass338-css-contract-missing", "Loaded stylesheet is missing the PASS338 chrome-safe webview contract.");
}

if (css && !/\.topbar[\s\S]{0,300}z-index\s*:\s*1000/.test(css)) {
  fail("topbar-z-index-contract-missing", "PASS338 contract must include .topbar above webview stage.");
}

if (css) {
  for (const block of cssBlocks(css)) {
    const selector = block.selector;
    const body = block.body;
    if (/pass271-r[489]/i.test(selector) && /webview/i.test(selector)) {
      if (/background\s*:\s*#(?:fff|ffffff)\s*!important/i.test(body)) {
        fail("loaded-pass271-white-css", `Loaded PASS271 webview CSS still forces white background near byte ${block.index}.`);
      }
      if (/z-index\s*:\s*(?:10|50)\s*!important/i.test(body)) {
        fail("loaded-pass271-high-z-css", `Loaded PASS271 webview CSS still forces high z-index near byte ${block.index}.`);
      }
    }
  }
}

if (pkg) {
  try {
    const parsed = JSON.parse(pkg);
    if (!parsed.scripts || parsed.scripts["verify:pass-338-cursor-runtime-root-cause-closeout"] !== "node scripts/verify-pass-338-cursor-runtime-root-cause-closeout.mjs") {
      fail("package-script-missing", "package.json must expose verify:pass-338-cursor-runtime-root-cause-closeout.");
    }
  } catch (error) {
    fail("package-json-invalid", `package.json is not valid JSON: ${error.message}`);
  }
}

const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "release") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|html)$/i.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "src"));

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (/(?:setAttribute\s*\(\s*["']allowpopups["']|<webview[^>]*\sallowpopups(?:\s|=|>))/i.test(text)) fail("unsafe-allowpopups", `Active allowpopups usage found in ${rel}.`);
  if (/nodeIntegration\s*:\s*true/.test(text)) fail("node-integration-true", `nodeIntegration true found in ${rel}.`);
  if (/contextIsolation\s*:\s*false/.test(text)) fail("context-isolation-false", `contextIsolation false found in ${rel}.`);
  if (/webSecurity\s*:\s*false/.test(text)) fail("websecurity-false", `webSecurity false found in ${rel}.`);
}

if (app && !/rgba\(96,\s*255,\s*218,\s*0\.92\)/.test(css)) {
  warn("browser-accent-not-found", "Loaded stylesheet does not expose the TAHAI Browser accent rgba(96, 255, 218, 0.92). The apply script appends it unless source shape blocked the write.");
}

const outDir = path.join(root, "release-candidate", "generated");
fs.mkdirSync(outDir, { recursive: true });
const report = {
  pass: "PASS338 - Cursor Runtime Root-Cause Remediation Closeout",
  result: failures.length ? "FAIL" : "PASS",
  checkedAt: new Date().toISOString(),
  failures,
  warnings,
  assertions: {
    gpuDisableOptIn: main.includes("TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE"),
    pass271R4OptIn: app.includes("TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR"),
    pass271R4InlineWritersFailClosed: app.includes("PASS338_NORMAL_WEBVIEW_REPAIR_OFF"),
    pass271R9WhiteDatasetOptIn: app.includes("TAHAI_BROWSER_ENABLE_PASS271_R9_WHITE_SCREEN_CLOSEOUT_DATASET"),
    runtimeStylesheetTruth: /href\s*=\s*["']\.\/styles\/browser\.css["']/.test(indexHtml),
    pass338CssContract: css.includes("PASS338_CURSOR_RUNTIME_ROOT_CAUSE_CLOSEOUT"),
    emergencyImportsQuarantined: !failures.some((f) => f.id === "emergency-pass-import-active")
  }
};
const reportPath = path.join(outDir, "pass338-cursor-runtime-root-cause-closeout-report.json");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  console.error("PASS338_VERIFY_RESULT=FAIL");
  for (const failure of failures) console.error(`FAIL ${failure.id}: ${failure.message}`);
  console.error(`PASS338_REPORT=${path.relative(root, reportPath).replace(/\\/g, "/")}`);
  process.exit(1);
}

console.log("PASS338_VERIFY_RESULT=PASS");
if (warnings.length) for (const warning of warnings) console.log(`WARN ${warning.id}: ${warning.message}`);
console.log(`PASS338_REPORT=${path.relative(root, reportPath).replace(/\\/g, "/")}`);
