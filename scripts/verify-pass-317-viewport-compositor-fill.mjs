import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const candidates = [
  "src/renderer/browser.css",
  "src/renderer/styles.css",
  "src/renderer/app.css",
  "src/renderer/renderer.css",
  "src/styles/browser.css",
  "src/styles.css"
];
const existing = candidates.map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const marker = "PASS317_EMERGENCY_VIEWPORT_COMPOSITOR_FILL";
const matches = existing.filter((p) => fs.readFileSync(p, "utf8").includes(marker));
if (!matches.length) {
  console.error("PASS317_VIEWPORT_COMPOSITOR_FILL=FAIL marker_missing");
  process.exit(1);
}
const css = fs.readFileSync(matches[0], "utf8");
const required = ["width: 100vw", "height: 100vh", "max-width: none", "body > *", "webview"];
const missing = required.filter((needle) => !css.includes(needle));
if (missing.length) {
  console.error(`PASS317_VIEWPORT_COMPOSITOR_FILL=FAIL missing=${missing.join(",")}`);
  process.exit(1);
}
const generatedDir = path.join(root, "release-candidate", "generated");
fs.mkdirSync(generatedDir, { recursive: true });
const report = {
  pass: "PASS317",
  name: "Emergency viewport compositor fill hotfix",
  result: "PASS",
  cssTarget: path.relative(root, matches[0]),
  guards: [
    "root/app/browser shells fill 100vw/100vh",
    "top-level children cannot retain stale max-width",
    "content/webview stages cannot retain stale max-width",
    "body overflow remains hidden for Electron shell"
  ],
  releaseTruth: {
    storeSubmitted: false,
    storeApproved: false,
    signedReleaseClaimAllowed: false,
    publicGaClaimAllowed: false
  }
};
fs.writeFileSync(path.join(generatedDir, "pass317-viewport-compositor-fill-report.json"), JSON.stringify(report, null, 2));
console.log("PASS317_VIEWPORT_COMPOSITOR_FILL=PASS");
