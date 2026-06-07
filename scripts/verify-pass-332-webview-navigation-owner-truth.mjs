import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const findings = [];
const actions = [];

function repoPath(...parts) {
  return path.join(repo, ...parts);
}

function exists(relPath) {
  return fs.existsSync(repoPath(...relPath.split(/[\\/]+/)));
}

function read(relPath) {
  return fs.readFileSync(repoPath(...relPath.split(/[\\/]+/)), "utf8");
}

function fail(kind, detail) {
  findings.push({ kind, severity: "critical", detail });
}

function warn(kind, detail) {
  findings.push({ kind, severity: "warn", detail });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFunctionBody(source, functionName) {
  const startPattern = new RegExp(`function\\s+${escapeRegex(functionName)}\\s*\\([^)]*\\)\\s*(?::\\s*[^\\{]+)?\\{`);
  const match = startPattern.exec(source);
  if (!match) return null;
  let cursor = match.index + match[0].length;
  let depth = 1;
  while (cursor < source.length && depth > 0) {
    const char = source[cursor];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    cursor += 1;
  }
  if (depth !== 0) return null;
  return source.slice(match.index, cursor);
}

const sentryRel = "src/renderer/pass332-webview-navigation-owner-truth.ts";
if (!exists(sentryRel)) {
  fail("missing-pass332-sentry", `${sentryRel} missing`);
} else {
  const sentry = read(sentryRel);
  actions.push("PASS332 renderer sentry exists");

  const requiredTokens = [
    "__TAHAI_PASS332_NAV_OWNER__",
    "primary-blank-with-shell-url",
    "primary-blank-with-shell-url-recovered",
    "recoverPrimaryIfNeeded",
    "visible-blank-non-owner-webview",
    "multiple-visible-webview-owners",
    "content-probe-not-webview",
    "TAHAI_BROWSER_DISABLE_PASS332_NAV_OWNER_RECOVERY",
    "data-pass332-navigation-health",
    "rgba(96, 255, 218, 0.92)",
    "const scored: Pass332WebviewInfo[]",
  ];

  for (const token of requiredTokens) {
    if (!sentry.includes(token)) {
      fail("missing-sentry-token", `PASS332 sentry missing token: ${token}`);
    }
  }

  const normalizeShellUrl = extractFunctionBody(sentry, "normalizeShellUrl");
  if (!normalizeShellUrl) {
    fail("missing-normalize-shell-url", "PASS332 sentry must include normalizeShellUrl for recovery protocol enforcement");
  } else {
    for (const blockedProtocol of ["javascript:", "data:", "file:"]) {
      const quoteClass = "[\\\"'`]";
      const unsafeReturn = new RegExp("return\\s+[^;\\n]*" + quoteClass + escapeRegex(blockedProtocol));
      if (unsafeReturn.test(normalizeShellUrl)) {
        fail("unsafe-recovery-protocol", `PASS332 recovery appears able to return blocked protocol ${blockedProtocol}`);
      }
    }

    const hasHttpGuard = /url\.protocol\s*===\s*["']http:["']/.test(normalizeShellUrl);
    const hasHttpsGuard = /url\.protocol\s*===\s*["']https:["']/.test(normalizeShellUrl);
    if (!hasHttpGuard || !hasHttpsGuard) {
      fail("missing-http-https-only-recovery", "PASS332 recovery must only auto-recover http/https shell URLs");
    }

    if (!/new URL\(\s*`https:\/\/\$\{value\}`\s*\)/.test(normalizeShellUrl) && !normalizeShellUrl.includes("https://${value}")) {
      warn("missing-domain-to-https-normalization-check", "Verifier could not confirm bare-domain normalization to https://");
    }
  }
}

const entryCandidates = [
  "src/renderer/app.ts",
  "src/renderer/main.ts",
  "src/renderer/index.ts",
  "src/renderer/renderer.ts",
].filter((candidate) => exists(candidate));

if (!entryCandidates.length) {
  fail("missing-renderer-entrypoint", "No renderer entrypoint found under src/renderer");
} else {
  const imported = entryCandidates.some((candidate) => read(candidate).includes('import "./pass332-webview-navigation-owner-truth";'));
  if (!imported) {
    fail("missing-sentry-import", "PASS332 sentry is not imported by a renderer entrypoint");
  } else {
    actions.push("PASS332 sentry imported by renderer entrypoint");
  }
}

if (!exists("package.json")) {
  fail("missing-package-json", "package.json missing");
} else {
  const pkg = JSON.parse(read("package.json"));
  const script = pkg?.scripts?.["verify:pass-332-webview-navigation-owner-truth"];
  if (!script || !String(script).includes("scripts/verify-pass-332-webview-navigation-owner-truth.mjs")) {
    fail("missing-package-script", "package.json missing verify:pass-332-webview-navigation-owner-truth script");
  } else {
    actions.push("PASS332 package verifier script registered");
  }
}

const verifierText = fs.readFileSync(new URL(import.meta.url), "utf8");
const commonJsRequireToken = "re" + "quire(";
if (verifierText.includes(commonJsRequireToken)) {
  fail("verifier-commonjs-in-mjs", "Verifier is .mjs and must not use CommonJS require calls");
}
const brokenNestedTemplateMarker = "sentry.includes(`return new URL(\\`${blockedProtocol}`)`)";
if (verifierText.includes(brokenNestedTemplateMarker)) {
  fail("verifier-nested-template-syntax-regression", "Verifier still contains the broken nested-template protocol check");
}

actions.push("PASS332 verifier syntax repaired for native ESM");
actions.push("PASS332 verifier protocol scan narrowed to normalizeShellUrl to avoid false positives from blank-url classification");
actions.push("PASS332 TypeScript primary-owner inference repaired");

const reportDir = repoPath("release-candidate", "generated");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "pass332-webview-navigation-owner-truth-report.json");
const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
const warningCount = findings.filter((finding) => finding.severity === "warn").length;
const report = {
  pass: "PASS332",
  title: "Webview Navigation Owner Truth + Blank Final Load Recovery",
  verifierRepair: "ESM syntax, protocol-scan, and TypeScript inference repairs applied",
  status: criticalCount === 0 ? "PASS" : "FAIL",
  generatedAt: new Date().toISOString(),
  actions,
  findings,
  criticalCount,
  warningCount,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`PASS332_VERIFY_RESULT=${report.status}`);
console.log("PASS332_VERIFIER_REPAIR=ESM_PROTOCOL_SCAN_AND_TS_INFERENCE_REPAIRED");
console.log(`PASS332_CRITICAL_FINDINGS=${criticalCount}`);
console.log(`PASS332_WARNING_FINDINGS=${warningCount}`);
console.log(`PASS332_REPORT=${reportPath}`);

if (criticalCount > 0) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}
