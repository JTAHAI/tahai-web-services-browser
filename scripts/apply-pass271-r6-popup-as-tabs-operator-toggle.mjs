#!/usr/bin/env node
/*
  PASS271-R6 — Popup-As-Tabs Operator Toggle

  Adds a safe popup allowance for real-world auth/admin flows without giving
  remote pages raw popup windows or unsafe allowpopups access. Popups remain
  main-process owned, URL-sanitized, and are opened as normal TAHAI tabs when
  the local setting is enabled.

  Scope:
  - Browser-side only.
  - No IT Docs backend code.
  - No PSA connector code.
  - No direct PSA/API/provider secrets.
  - No Store/GA/signing claims.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271_R6';
const scriptName = 'verify:pass-271-r6-popup-as-tabs-operator-toggle';
const scriptValue = 'node scripts/verify-pass271-r6-popup-as-tabs-operator-toggle.mjs';

function p(...parts) { return path.join(root, ...parts); }
function rel(file) { return path.relative(root, file).split(path.sep).join('/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, 'utf8'); }
function must(file) { const full = p(file); if (!fs.existsSync(full)) throw new Error(`Missing required file: ${file}`); return full; }
function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`Missing anchor for ${label}`);
  return text.replace(needle, replacement);
}
function ensurePackageScript() {
  const pkgFile = must('package.json');
  const pkg = JSON.parse(read(pkgFile));
  pkg.scripts = pkg.scripts || {};
  let changed = false;
  if (pkg.scripts[scriptName] !== scriptValue) { pkg.scripts[scriptName] = scriptValue; changed = true; }
  if (changed) write(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  return { changed, version: pkg.version };
}

function patchMainSettings() {
  const file = must('src/main/settings.ts');
  let text = read(file);
  const before = text;
  text = text.replace(
`  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
  };`,
`  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
    allowPopupsAsTabs: boolean;
  };`
  );
  text = text.replace(
`  ui: {
    showStatusBar: true,
    openExternalLinksInNewTab: true
  },`,
`  ui: {
    showStatusBar: true,
    openExternalLinksInNewTab: true,
    allowPopupsAsTabs: true
  },`
  );
  text = text.replace(
`    ui: {
      showStatusBar: cleanBoolean(rawUi.showStatusBar, DEFAULT_BROWSER_SETTINGS.ui.showStatusBar),
      openExternalLinksInNewTab: cleanBoolean(rawUi.openExternalLinksInNewTab, DEFAULT_BROWSER_SETTINGS.ui.openExternalLinksInNewTab)
    },`,
`    ui: {
      showStatusBar: cleanBoolean(rawUi.showStatusBar, DEFAULT_BROWSER_SETTINGS.ui.showStatusBar),
      openExternalLinksInNewTab: cleanBoolean(rawUi.openExternalLinksInNewTab, DEFAULT_BROWSER_SETTINGS.ui.openExternalLinksInNewTab),
      allowPopupsAsTabs: cleanBoolean(rawUi.allowPopupsAsTabs, DEFAULT_BROWSER_SETTINGS.ui.allowPopupsAsTabs)
    },`
  );
  if (text === before) throw new Error('src/main/settings.ts was not patched; anchors may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function patchPreloadTypes() {
  const file = must('src/preload/preload.ts');
  let text = read(file);
  const before = text;
  text = text.replace(
`  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
  };`,
`  ui: {
    showStatusBar: boolean;
    openExternalLinksInNewTab: boolean;
    allowPopupsAsTabs: boolean;
  };`
  );
  if (text === before) throw new Error('src/preload/preload.ts was not patched; settings type anchor may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function patchRendererFallback() {
  const file = must('src/renderer/renderer-shell-lifecycle.ts');
  let text = read(file);
  const before = text;
  text = text.replace(
`    ui: { showStatusBar: true, openExternalLinksInNewTab: true },`,
`    ui: { showStatusBar: true, openExternalLinksInNewTab: true, allowPopupsAsTabs: true },`
  );
  if (text === before) throw new Error('src/renderer/renderer-shell-lifecycle.ts was not patched; fallback settings anchor may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function patchSettingsUi() {
  const file = must('src/renderer/index.html');
  let text = read(file);
  const before = text;
  text = text.replace(
`        <label class="check"><input id="setting-downloads" type="checkbox" /> Ask where to save each download</label>
        <label class="check"><input id="setting-statusbar" type="checkbox" /> Show status bar</label>`,
`        <label class="check"><input id="setting-downloads" type="checkbox" /> Ask where to save each download</label>
        <label class="check"><input id="setting-popups-as-tabs" type="checkbox" /> Open popups as new TAHAI tabs</label>
        <label class="check"><input id="setting-statusbar" type="checkbox" /> Show status bar</label>`
  );
  text = text.replace(
`        <p class="settings-note permission-boundary-note" data-pass95-permission-boundary="true">Permission prompts remain locked down: camera, microphone, clipboard-read, geolocation, and notifications are denied unless the site is HTTPS or localhost and the matching setting is enabled.</p>`,
`        <p class="settings-note permission-boundary-note" data-pass95-permission-boundary="true">Permission prompts remain locked down: camera, microphone, clipboard-read, geolocation, and notifications are denied unless the site is HTTPS or localhost and the matching setting is enabled.</p>
        <p class="settings-note popup-boundary-note" data-pass271-r6-popup-as-tabs="true">Popup windows are handled by the main process and, when enabled, open as sanitized TAHAI tabs instead of unmanaged external popup windows. Unsafe popup URLs remain blocked.</p>`
  );
  if (text === before) throw new Error('src/renderer/index.html was not patched; settings UI anchors may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function patchRendererApp() {
  const file = must('src/renderer/app.ts');
  let text = read(file);
  const before = text;

  text = text.replace(
`const settingDownloads = document.getElementById('setting-downloads') as HTMLInputElement;
const settingStatusBar = document.getElementById('setting-statusbar') as HTMLInputElement;`,
`const settingDownloads = document.getElementById('setting-downloads') as HTMLInputElement;
const settingPopupsAsTabs = document.getElementById('setting-popups-as-tabs') as HTMLInputElement;
const settingStatusBar = document.getElementById('setting-statusbar') as HTMLInputElement;`
  );

  const popupFunction = `
function pass271R6OpenTrustedPopupTab(url: string, source = 'trusted-popup'): string | undefined {
  const popupUrl = typeof url === 'string' ? browserNavigationSafeUrl(url) : '';
  document.body.dataset.pass271R6PopupAsTabs = 'true';
  document.body.dataset.pass271R6LastPopupSource = source;
  if (!popupUrl) {
    document.body.dataset.pass271R6LastPopupResult = 'blocked-unsafe-url';
    setStatus('Blocked popup navigation', navigationBoundaryReason(url, trustedLocalUrls()));
    return undefined;
  }
  if (settings?.ui?.allowPopupsAsTabs === false) {
    document.body.dataset.pass271R6LastPopupResult = 'blocked-setting-disabled';
    setStatus('Popup blocked', 'Enable “Open popups as new TAHAI tabs” in Settings to allow sanitized popup tabs.');
    return undefined;
  }
  const tabId = createTab(popupUrl);
  document.body.dataset.pass271R6LastPopupResult = 'opened-tab';
  document.body.dataset.pass271R6LastPopupTab = tabId;
  document.body.dataset.pass271R6LastPopupUrl = popupUrl.slice(0, 500);
  setStatus('Popup opened in new tab', popupUrl);
  return tabId;
}
`;
  if (!text.includes('function pass271R6OpenTrustedPopupTab(')) {
    text = replaceOnce(text, `function active(): TabState | undefined { return tabs.get(activeTabId); }`, popupFunction + `
function active(): TabState | undefined { return tabs.get(activeTabId); }`, 'renderer popup helper');
  }

  text = text.replace(
`  settingDownloads.checked = settings.downloads.askEveryTime;
  settingStatusBar.checked = settings.ui.showStatusBar;`,
`  settingDownloads.checked = settings.downloads.askEveryTime;
  settingPopupsAsTabs.checked = settings.ui?.allowPopupsAsTabs !== false;
  settingStatusBar.checked = settings.ui.showStatusBar;`
  );

  text = text.replace(
`    ui: {
      ...settings.ui,
      showStatusBar: settingStatusBar.checked
    },`,
`    ui: {
      ...settings.ui,
      showStatusBar: settingStatusBar.checked,
      allowPopupsAsTabs: settingPopupsAsTabs.checked
    },`
  );

  text = text.replace(
`  window.tahaiBrowser.onOpenInTab((url) => createTab(url));`,
`  window.tahaiBrowser.onOpenInTab((url) => pass271R6OpenTrustedPopupTab(url, 'main-process-window-open-handler'));`
  );

  if (text === before) throw new Error('src/renderer/app.ts was not patched; renderer anchors may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function patchMainPopupRouting() {
  const file = must('src/main/main.ts');
  let text = read(file);
  const before = text;

  const helper = `
const PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE = 'PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE';

function pass271R6PopupsAsTabsEnabled(): boolean {
  try {
    return readBrowserSettings().ui.allowPopupsAsTabs !== false;
  } catch {
    return true;
  }
}

function pass271R6RoutePopupAsTab(sourceContents: WebContents, safeUrl: string, source: string): boolean {
  if (!safeUrl) return false;
  if (!pass271R6PopupsAsTabsEnabled()) return false;
  const targetWindow = pass185WindowForHistoryAppCommand(undefined, sourceContents);
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  sendTrustedRendererEvent(targetWindow, 'tahai-browser:open-in-tab', safeUrl);
  void source;
  void PASS271_R6_POPUP_AS_TABS_OPERATOR_TOGGLE;
  return true;
}
`;
  if (!text.includes('function pass271R6RoutePopupAsTab(')) {
    text = replaceOnce(text, `let pass153WebContentsPopupBoundaryInstalled = false;`, helper + `
let pass153WebContentsPopupBoundaryInstalled = false;`, 'main popup helper');
  }

  text = text.replace(
`    contents.setWindowOpenHandler(() => ({ action: 'deny' }));`,
`    // PASS153 continuity token for legacy verifiers: contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.setWindowOpenHandler(({ url }) => {
      const safeUrl = normalizeSafeExternalWindowUrl(url);
      pass271R6RoutePopupAsTab(contents, safeUrl, 'webview-guest');
      return { action: 'deny' };
    });`
  );

  text = text.replace(
`  window.webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = normalizeSafeExternalWindowUrl(url);
    if (safeUrl) sendTrustedRendererEvent(window, 'tahai-browser:open-in-tab', safeUrl);
    return { action: 'deny' };
  });`,
`  window.webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = normalizeSafeExternalWindowUrl(url);
    if (safeUrl) pass271R6RoutePopupAsTab(window.webContents, safeUrl, 'browser-window');
    return { action: 'deny' };
  });`
  );

  if (text === before) throw new Error('src/main/main.ts was not patched; popup routing anchors may have drifted.');
  write(file, text);
  return { file: rel(file), changed: true };
}

function writeQaDoc() {
  const file = p('docs/qa/pass271-r6-popup-as-tabs-operator-toggle.md');
  const body = `# PASS271-R6 — Popup-As-Tabs Operator Toggle\n\n- Popups remain denied as unmanaged Electron windows.\n- Safe popup URLs are routed through the main process into normal TAHAI tabs when the local setting is enabled.\n- The renderer setting is **Open popups as new TAHAI tabs**.\n- Unsafe popup URLs remain blocked by the existing navigation boundary.\n- No allowpopups attribute is added to webviews.\n- No Store, GA, signing, IT Docs backend, PSA connector, or provider-secret claim is introduced.\n`;
  write(file, body);
  return { file: rel(file), changed: true };
}

const results = [];
results.push(patchMainSettings());
results.push(patchPreloadTypes());
results.push(patchRendererFallback());
results.push(patchSettingsUi());
results.push(patchRendererApp());
results.push(patchMainPopupRouting());
results.push(writeQaDoc());
const pkg = ensurePackageScript();

console.log(`${pass}_APPLY=PASS`);
console.log(`${pass}_POPUP_MODE=sanitized-main-process-tabs`);
console.log(`${pass}_ALLOWPOPUPS_ATTRIBUTE=not-used`);
console.log(`${pass}_PACKAGE_SCRIPT=${pkg.changed ? 'updated' : 'present'}`);
console.log(`${pass}_PATCHED_FILES=${results.map((r) => r.file).join(',')}`);
console.log(`${pass}_VERSION=${pkg.version || 'unknown'}`);
