import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "release-candidate", "generated");
fs.mkdirSync(outDir, { recursive: true });

const findings = [];
const actions = [];
const rel = (p) => path.relative(root, p).replace(/\\/g, "/");
const read = (...parts) => {
  const p = path.join(root, ...parts);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
};
const add = (finding) => findings.push({ severity: "critical", releaseBlocking: true, ...finding });

const sentry = read("src", "renderer", "pass333-chrome-hit-test-webview-layer-truth.ts");
if (!sentry) {
  add({ kind: "missing-pass333-sentry", detail: "PASS333 chrome hit-test sentry file is missing." });
} else {
  for (const token of ["__TAHAI_PASS333_CHROME_HITTEST__", "webview-occludes-browser-chrome", "webview-full-window-surface", "pass333ChromeHitTestHealth"]) {
    if (!sentry.includes(token)) add({ kind: "pass333-token-missing", detail: `PASS333 sentry missing required token ${token}.` });
  }
  if (/\.style\.(?:position|inset|top|left|width|height|zIndex|pointerEvents)\s*=/.test(sentry)) {
    add({ kind: "pass333-mutates-runtime-geometry", detail: "PASS333 must be diagnostic-only and must not mutate runtime geometry or pointer events." });
  }
}

const entryCandidates = [
  path.join(root, "src", "renderer", "app.ts"),
  path.join(root, "src", "renderer", "main.ts"),
  path.join(root, "src", "renderer", "index.ts"),
  path.join(root, "src", "renderer", "app.tsx"),
  path.join(root, "src", "renderer", "main.tsx"),
  path.join(root, "src", "renderer", "index.tsx"),
].filter((p) => fs.existsSync(p));

const activeLegacyImports = [];
let pass333Imported = false;
for (const entry of entryCandidates) {
  const text = fs.readFileSync(entry, "utf8");
  if (/^\s*import\s+["']\.\/pass333-chrome-hit-test-webview-layer-truth["'];/m.test(text)) {
    pass333Imported = true;
    actions.push(`PASS333 imported by ${rel(entry)}`);
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*import\s+["']\.\/pass32[9]/.test(line) || /^\s*import\s+["']\.\/pass33[0-2]/.test(line)) {
      activeLegacyImports.push({ file: rel(entry), lineNumber: index + 1, line: line.trim() });
    }
  });
}
if (!pass333Imported) add({ kind: "pass333-not-imported", detail: "PASS333 sentry is not imported by an active renderer entry." });
if (activeLegacyImports.length > 0) {
  add({ kind: "active-pass329-332-recovery-imports", detail: "PASS329-PASS332 runtime recovery imports must be quarantined because the browser chrome is dead/white after those passes.", activeLegacyImports });
} else {
  actions.push("PASS329-PASS332 runtime recovery imports quarantined from renderer entry points");
}

const pkgText = read("package.json");
if (!pkgText) {
  add({ kind: "missing-package-json", detail: "package.json missing." });
} else {
  const pkg = JSON.parse(pkgText);
  if (!pkg.scripts?.["verify:pass-333-chrome-hit-test-webview-layer-truth"]) {
    add({ kind: "missing-pass333-package-script", detail: "package.json missing verify:pass-333-chrome-hit-test-webview-layer-truth." });
  } else {
    actions.push("package script verify:pass-333-chrome-hit-test-webview-layer-truth exists");
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "release", ".git"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const cssFiles = walk(path.join(root, "src")).filter((p) => /\.(css|scss)$/i.test(p));
let hasPass333Contract = false;
for (const file of cssFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("PASS328_WEBVIEW_STAGE_OWNERSHIP_CONTRACT_BEGIN")) {
    add({ kind: "pass328-broad-stage-contract-still-active", file: rel(file), detail: "The broad PASS328 webview-stage contract is still present and can make webviews full-window or cover chrome." });
  }
  if (text.includes("PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_BEGIN")) hasPass333Contract = true;
}
if (!hasPass333Contract) add({ kind: "missing-pass333-safe-css-contract", detail: "PASS333 safe webview-stage CSS contract was not found in active source CSS." });
else actions.push("PASS333 chrome-safe webview-stage CSS contract present");

const report = {
  pass: "PASS333",
  name: "Chrome Hit-Test + WebView Layer Truth",
  result: findings.some((f) => f.releaseBlocking) ? "FAIL" : "PASS",
  releaseBlockingFindingCount: findings.filter((f) => f.releaseBlocking).length,
  findings,
  actions,
  generatedAt: new Date().toISOString(),
};
const reportPath = path.join(outDir, "pass333-chrome-hit-test-webview-layer-truth-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`PASS333_VERIFY_RESULT=${report.result}`);
console.log(`PASS333_CRITICAL_FINDINGS=${report.releaseBlockingFindingCount}`);
console.log(`PASS333_REPORT=${reportPath}`);
if (report.result !== "PASS") {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(1);
}
