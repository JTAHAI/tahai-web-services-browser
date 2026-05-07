import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "TRADEMARKS.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SUPPORT.md",
  "README.md",
  ".github/workflows/validate-source.yml",
  ".github/workflows/windows-preview-package.yml",
  ".github/dependabot.yml",
  "docs/known-issues.md",
  "docs/code-signing-signpath-plan.md",
  "docs/public-release-candidate.md",
  "docs/github-release-notes-1.8.21.md",
  "docs/browser-download-page-copy.md",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing public repo files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.license !== "Apache-2.0") {
  console.error(`package.json license must be Apache-2.0, found: ${pkg.license}`);
  process.exit(1);
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
for (const pattern of ["node_modules/", "dist/", "release/", ".env", "*.pfx", "*.p12", "*.pem"]) {
  if (!gitignore.includes(pattern)) {
    console.error(`.gitignore missing required pattern: ${pattern}`);
    process.exit(1);
  }
}

const blockedPathParts = new Set([".git", "node_modules", "dist", "release", "out", "artifacts"]);
const blockedExts = new Set([".bak", ".orig", ".tmp", ".pfx", ".p12", ".pem", ".key"]);
const secretPatterns = [
  /-----BEGIN (RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9_]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (blockedPathParts.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (blockedExts.has(ext)) {
      console.error(`Forbidden public repo file: ${rel}`);
      process.exit(1);
    }
    if ([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".html", ".css", ".ps1"].includes(ext)) {
      const text = fs.readFileSync(full, "utf8");
      for (const pattern of secretPatterns) {
        if (pattern.test(text)) {
          console.error(`Potential secret pattern found in: ${rel}`);
          process.exit(1);
        }
      }
    }
  }
}

walk(root);
console.log("TAHAI_BROWSER_PUBLIC_REPO_VERIFY=OK");

process.exit(0);