import fs from "node:fs";
import path from "node:path";
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const required = [
  ".gitignore",
  ".github/dependabot.yml",
  ".github/workflows/validate-source.yml",
  ".github/workflows/windows-preview-package.yml",
  "PASS_25_PUBLIC_REPO_WORKFLOW_REPAIR_SUMMARY.md",
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`PASS25 missing required file: ${rel}`);
    process.exit(1);
  }
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
for (const pattern of ["node_modules/", "dist/", "release/", ".env", "*.pfx", "*.p12", "*.pem", "*.key"]) {
  if (!gitignore.includes(pattern)) {
    console.error(`PASS25 .gitignore missing: ${pattern}`);
    process.exit(1);
  }
}

const validateWorkflow = fs.readFileSync(path.join(root, ".github/workflows/validate-source.yml"), "utf8");
for (const needle of ["npm ci", "npm run verify:public-repo", "npm run verify:release-blockers"]) {
  if (!validateWorkflow.includes(needle)) {
    console.error(`PASS25 validate workflow missing: ${needle}`);
    process.exit(1);
  }
}

const windowsWorkflow = fs.readFileSync(path.join(root, ".github/workflows/windows-preview-package.yml"), "utf8");
for (const needle of ["workflow_dispatch", "CSC_IDENTITY_AUTO_DISCOVERY", "npm run package:win:release", "actions/upload-artifact@v4"]) {
  if (!windowsWorkflow.includes(needle)) {
    console.error(`PASS25 windows workflow missing: ${needle}`);
    process.exit(1);
  }
}

if (/on:\s*\[?push\]?/.test(windowsWorkflow) || /pull_request:/.test(windowsWorkflow)) {
  console.error("PASS25 windows packaging workflow must remain manual-only");
  process.exit(1);
}

console.log("TAHAI_BROWSER_PASS25_PUBLIC_REPO_WORKFLOWS=OK");
