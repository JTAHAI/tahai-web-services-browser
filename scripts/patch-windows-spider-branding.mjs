#!/usr/bin/env node
/*
  TAHAI Web Services Browser - Windows spider branding patch

  PASS28-safe version:
  - Replaces Electron branding.
  - Sets Windows AppUserModelID.
  - Configures electron-builder icons and installer targets.
  - Avoids inserting duplicate BrowserWindow icon properties.

  Run from repository root:
    node scripts/patch-windows-spider-branding.mjs
*/

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const productName = "TAHAI Web Services Browser";
const appId = "com.tahai.webservices.browser";
const publisherName = "TAHAI Web Services";

function fail(message) {
  console.error(`TAHAI_BROWSER_SPIDER_BRANDING_ERROR=${message}`);
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeTextIfChanged(filePath, next) {
  const current = fs.existsSync(filePath) ? readText(filePath) : "";
  if (current !== next) {
    fs.writeFileSync(filePath, next, "utf8");
    return true;
  }
  return false;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureUniqueResource(resources, from, to) {
  const normalizedFrom = from.replaceAll("\\\\", "/");
  const normalizedTo = to.replaceAll("\\\\", "/");
  const exists = resources.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return String(entry.from || "").replaceAll("\\\\", "/") === normalizedFrom &&
      String(entry.to || "").replaceAll("\\\\", "/") === normalizedTo;
  });
  if (!exists) resources.push({ from, to });
}

function patchPackageJson() {
  const packagePath = path.join(root, "package.json");
  if (!fs.existsSync(packagePath)) fail("package.json_not_found_run_from_repo_root");

  const pkg = JSON.parse(readText(packagePath));
  pkg.productName = productName;
  pkg.description = pkg.description && pkg.description !== "Electron" ? pkg.description : productName;

  pkg.scripts = pkg.scripts || {};
  pkg.scripts["patch:windows:branding"] = "node scripts/patch-windows-spider-branding.mjs";
  pkg.scripts["package:win:installer"] = pkg.scripts["package:win:installer"] || "npm run build && electron-builder --win nsis --x64";
  pkg.scripts["package:win:msi"] = pkg.scripts["package:win:msi"] || "npm run build && electron-builder --win msi --x64";
  pkg.scripts["package:win:release"] = pkg.scripts["package:win:release"] || "npm run build && electron-builder --win nsis msi --x64";

  pkg.build = pkg.build || {};
  pkg.build.appId = appId;
  pkg.build.productName = productName;
  pkg.build.executableName = productName;
  pkg.build.copyright = pkg.build.copyright || "Copyright © 2026 TAHAI Web Services";

  pkg.build.directories = pkg.build.directories || {};
  pkg.build.directories.buildResources = "build";
  pkg.build.directories.output = pkg.build.directories.output || "release";

  pkg.build.win = pkg.build.win || {};
  pkg.build.win.icon = "build/icon.ico";
  pkg.build.win.publisherName = pkg.build.win.publisherName || publisherName;
  pkg.build.win.artifactName = pkg.build.win.artifactName || "TAHAI-Web-Services-Browser-${version}-${arch}.${ext}";
  pkg.build.win.target = pkg.build.win.target || ["nsis", "msi"];

  pkg.build.nsis = pkg.build.nsis || {};
  pkg.build.nsis.oneClick = pkg.build.nsis.oneClick ?? false;
  pkg.build.nsis.perMachine = pkg.build.nsis.perMachine ?? false;
  pkg.build.nsis.allowElevation = pkg.build.nsis.allowElevation ?? true;
  pkg.build.nsis.allowToChangeInstallationDirectory = pkg.build.nsis.allowToChangeInstallationDirectory ?? true;
  pkg.build.nsis.createDesktopShortcut = pkg.build.nsis.createDesktopShortcut ?? true;
  pkg.build.nsis.createStartMenuShortcut = pkg.build.nsis.createStartMenuShortcut ?? true;
  pkg.build.nsis.shortcutName = productName;
  pkg.build.nsis.deleteAppDataOnUninstall = pkg.build.nsis.deleteAppDataOnUninstall ?? false;

  pkg.build.msi = pkg.build.msi || {};
  pkg.build.msi.oneClick = pkg.build.msi.oneClick ?? false;
  pkg.build.msi.perMachine = pkg.build.msi.perMachine ?? false;
  pkg.build.msi.createDesktopShortcut = pkg.build.msi.createDesktopShortcut ?? true;
  pkg.build.msi.createStartMenuShortcut = pkg.build.msi.createStartMenuShortcut ?? true;
  pkg.build.msi.shortcutName = productName;

  pkg.build.extraResources = ensureArray(pkg.build.extraResources);
  ensureUniqueResource(pkg.build.extraResources, "build/icon.ico", "build/icon.ico");
  ensureUniqueResource(pkg.build.extraResources, "build/icon.png", "build/icon.png");
  ensureUniqueResource(pkg.build.extraResources, "assets/brand/tahai-spider-icon.ico", "assets/brand/tahai-spider-icon.ico");
  ensureUniqueResource(pkg.build.extraResources, "assets/brand/tahai-spider-icon.png", "assets/brand/tahai-spider-icon.png");

  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  const changed = writeTextIfChanged(packagePath, next);
  console.log(`TAHAI_BROWSER_PACKAGE_JSON_BRANDING=${changed ? "PATCHED" : "UNCHANGED"}`);
}

const ignoredDirs = new Set(["node_modules", ".git", "release", "dist", "out", "build", ".vite", ".next", "coverage"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(p, out);
    } else if (/\.(cjs|mjs|js|jsx|ts|tsx)$/i.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

function getMainCandidates() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(readText(pkgPath));
  const direct = [
    "src/main/main.ts",
    "src/main.ts",
    "src/main/index.ts",
    "src/electron/main.ts",
    "electron/main.ts",
    "main.ts",
    "app/main.ts",
    "src/main/main.js",
    "src/main.js",
    "src/main/index.js",
    "src/electron/main.js",
    "electron/main.js",
    "main.js",
    "app/main.js",
  ];

  const candidates = [];
  if (pkg.main && typeof pkg.main === "string") {
    const mainSourceGuess = pkg.main.replace(/^dist[\\/]/, "src/").replace(/\.js$/, ".ts");
    candidates.push(path.join(root, mainSourceGuess));
    candidates.push(path.join(root, pkg.main));
  }
  candidates.push(...direct.map((p) => path.join(root, p)));

  const existingDirect = [...new Set(candidates)].filter((p) => fs.existsSync(p));
  if (existingDirect.length) return existingDirect;

  return walk(root).filter((p) => {
    const text = readText(p);
    return /BrowserWindow/.test(text) && /\bapp\b/.test(text) && /(from\s+["']electron["']|require\(["']electron["']\))/.test(text);
  });
}

function insertAfterImports(text, line) {
  if (text.includes(line.trim())) return text;
  const lines = text.split(/\r?\n/);
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("import ") || (l.startsWith("const ") && l.includes("require(")) || (l.startsWith("let ") && l.includes("require(")) || (l.startsWith("var ") && l.includes("require("))) {
      insertAt = i + 1;
      continue;
    }
    if (l === "" || l.startsWith("//")) continue;
    break;
  }
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

function ensurePathImport(text, filePath) {
  if (/(import\s+(?:\*\s+as\s+)?path\s+from\s+["'](?:node:)?path["']|require\(["'](?:node:)?path["']\))/.test(text)) {
    return text;
  }
  const isModule = /^\s*import\s+/m.test(text) || /\.(ts|tsx|mjs)$/i.test(filePath);
  return insertAfterImports(text, isModule ? 'import * as path from "path";' : 'const path = require("path");');
}

function ensureIconHelper(text) {
  if (text.includes("getTahaiBrowserIconPath")) return text;
  const helperBlock = `\nfunction getTahaiBrowserIconPath() {\n  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";\n  return app.isPackaged\n    ? path.join(process.resourcesPath, "build", iconFile)\n    : path.join(app.getAppPath(), "build", iconFile);\n}\n`;
  const marker = text.search(/\bfunction\s+createWindow\b|\bconst\s+createWindow\b|\blet\s+createWindow\b|\bapp\.whenReady\b|\bapp\.on\s*\(\s*["']ready["']/);
  return marker >= 0 ? `${text.slice(0, marker)}${helperBlock}\n${text.slice(marker)}` : `${text}\n${helperBlock}`;
}

function ensureBrandingBlock(text) {
  const brandingBlock = `\nconst TAHAI_BROWSER_APP_NAME = "TAHAI Web Services Browser";\n\napp.setName(TAHAI_BROWSER_APP_NAME);\nif (process.platform === "win32") {\n  app.setAppUserModelId("com.tahai.webservices.browser");\n}\n`;

  if (!text.includes("TAHAI_BROWSER_APP_NAME")) {
    const marker = text.search(/\bapp\.whenReady\b|\bapp\.on\s*\(\s*["']ready["']/);
    text = marker >= 0 ? `${text.slice(0, marker)}${brandingBlock}\n${text.slice(marker)}` : `${text}\n${brandingBlock}`;
  }

  return text
    .replace(/app\.setAppUserModelId\s*\(\s*[^)]*\)\s*;?/g, 'app.setAppUserModelId("com.tahai.webservices.browser");')
    .replace(/title\s*:\s*["']Electron["']/g, 'title: "TAHAI Web Services Browser"')
    .replace(/app\.name\s*=\s*["']Electron["']/g, 'app.name = "TAHAI Web Services Browser"');
}

function patchBrowserWindowIcon(text) {
  text = text.replace(
    /\n\s*icon\s*:\s*resourcePath\(\s*["']browser["']\s*,\s*["']new-tab["']\s*,\s*["']assets["']\s*,\s*["']tws["']\s*,\s*["']tws-square-logo\.png["']\s*\)\s*,?/g,
    ""
  );

  if (/new\s+BrowserWindow\s*\(\s*\{/.test(text) && !/icon\s*:\s*getTahaiBrowserIconPath\s*\(/.test(text)) {
    text = text.replace(/new\s+BrowserWindow\s*\(\s*\{/, (match) => `${match}\n    icon: getTahaiBrowserIconPath(),`);
  }

  let seen = false;
  return text.replace(/\n(\s*)icon\s*:\s*getTahaiBrowserIconPath\s*\(\s*\)\s*,/g, (match) => {
    if (seen) return "";
    seen = true;
    return match;
  });
}

function patchMainFile(filePath) {
  const original = readText(filePath);
  let text = original;
  text = ensurePathImport(text, filePath);
  text = ensureIconHelper(text);
  text = ensureBrandingBlock(text);
  text = patchBrowserWindowIcon(text);

  const changed = writeTextIfChanged(filePath, text);
  console.log(`TAHAI_BROWSER_MAIN_BRANDING=${changed ? "PATCHED" : "UNCHANGED"} file=${path.relative(root, filePath)}`);
  if (changed) {
    const backupPath = `${filePath}.pre-tahai-spider-branding.bak`;
    if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, original, "utf8");
  }
}

function patchMainProcess() {
  const candidates = getMainCandidates();
  if (!candidates.length) {
    console.warn("TAHAI_BROWSER_MAIN_BRANDING=SKIPPED no_electron_main_file_detected");
    return;
  }
  patchMainFile(candidates[0]);
}

function verifyAssets() {
  const required = ["build/icon.ico", "build/icon.png", "assets/brand/tahai-spider-icon.ico", "assets/brand/tahai-spider-icon.png"];
  for (const rel of required) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) fail(`missing_asset_${rel}`);
  }
  console.log("TAHAI_BROWSER_SPIDER_ASSETS=OK");
}

verifyAssets();
patchPackageJson();
patchMainProcess();
console.log("TAHAI_BROWSER_WINDOWS_SPIDER_BRANDING_PATCH=OK");
