#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

function isWslRuntime() {
  return process.platform === 'linux'
    && (Boolean(process.env.WSL_DISTRO_NAME) || Boolean(process.env.WSL_INTEROP) || os.release().toLowerCase().includes('microsoft'));
}

function reenterUnderWindowsNodeIfNeeded() {
  if (!isWslRuntime()) return;
  if (process.env.TAHAI_BLACKBOX_E2E_WINDOWS_REENTRY === '1') return;
  const windowsNode = '/mnt/c/Program Files/nodejs/node.exe';
  if (!fs.existsSync(windowsNode)) return;
  const windowsScript = path.relative(process.cwd(), fileURLToPath(import.meta.url));
  const result = spawnSync(windowsNode, [windowsScript, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TAHAI_BLACKBOX_E2E_WINDOWS_REENTRY: '1',
    },
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

reenterUnderWindowsNodeIfNeeded();

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const matrixPath = path.join(root, 'tests', 'runtime', 'pass345-blackbox-electron-release-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8').replace(/^﻿/, ''));
const pass = String(matrix.pass || 'PASS345');
const contractId = String(matrix.contractId || 'pass345-blackbox-electron-release-e2e-v1');
const mainDist = path.join(root, 'dist', 'main', 'main.js');
const evidenceDir = path.join(root, 'release-candidate', 'generated', 'pass345-blackbox-electron-release-e2e');
const resultPath = path.join(evidenceDir, 'pass345-blackbox-electron-release-e2e-result.json');
const summaryPath = path.join(evidenceDir, 'pass345-blackbox-electron-release-e2e-summary.md');

function plan() {
  return {
    pass,
    contractId,
    versionTarget: matrix.versionTarget,
    scenarioCount: Array.isArray(matrix.scenarios) ? matrix.scenarios.length : 0,
    scenarioIds: Array.isArray(matrix.scenarios) ? matrix.scenarios.map((entry) => entry.id) : [],
    windowProfiles: Array.isArray(matrix.windowProfiles) ? matrix.windowProfiles.map((entry) => entry.id) : [],
    runCommand: 'npm run test:blackbox-e2e',
    sourceOnlyPlanCommand: 'npm run test:blackbox-e2e:plan',
    evidencePaths: matrix.requiredEvidencePaths || [],
  };
}

function comparableUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const pathname = decodeURIComponent(parsed.pathname || '').replace(/\/+$/, '') || '/';
    if (parsed.protocol === 'file:' || parsed.protocol === 'tahai-browser:') return `${parsed.protocol}${pathname}`.toLowerCase();
    return `${parsed.origin}${pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

function sameUrl(expected, actual) {
  return comparableUrl(expected) === comparableUrl(actual);
}

function includesUrl(expected, actual) {
  const normalizedExpected = comparableUrl(expected);
  const normalizedActual = comparableUrl(actual);
  return Boolean(normalizedExpected) && (normalizedActual === normalizedExpected || normalizedActual.startsWith(normalizedExpected));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function screenshotName(profileId, scenarioId, suffix = 'ok') {
  return `${profileId}-${scenarioId}-${suffix}.png`.replace(/[^a-z0-9._-]+/gi, '-');
}

async function waitFor(page, predicate, message, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await sleep(120);
  }
  throw new Error(message);
}

async function waitForOpenState(page, selector, open, timeoutMs = 4000) {
  return waitFor(
    page,
    () => page.evaluate(({ selector, open }) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      if (element instanceof HTMLDialogElement) return element.open === open;
      const style = window.getComputedStyle(element);
      const hidden = element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden';
      return open ? !hidden : hidden;
    }, { selector, open }),
    `${selector} did not become ${open ? 'open/visible' : 'closed/hidden'}`,
    timeoutMs,
  );
}

async function controlInfo(page, id) {
  return page.evaluate((targetId) => {
    const element = document.getElementById(targetId);
    if (!(element instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(element);
    return {
      visible: !element.hidden && element.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0 && Boolean(element.getClientRects().length),
      inOverflow: element.classList.contains('in-toolbar-overflow') || element.dataset.pass113ChromeOverflowState === 'menu',
    };
  }, id);
}

async function overflowMenuOpen(page) {
  return page.evaluate(() => {
    const menu = document.getElementById('toolbar-overflow-menu');
    if (!(menu instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(menu);
    return !menu.hidden && menu.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden';
  });
}

async function waitForOverflowActionDispatch(page, id, timeoutMs = 5000) {
  return waitFor(
    page,
    () => page.evaluate((targetId) => {
      const menu = document.getElementById('toolbar-overflow-menu');
      const menuClosed = !menu || !(menu instanceof HTMLElement) || menu.hidden || menu.getAttribute('aria-hidden') === 'true';
      const lastAction = document.body.dataset.pass163LastMoreToolsAction || '';
      const handledAction = document.body.dataset.pass164MoreToolsActionHandled || '';
      const dispatchMode = document.body.dataset.pass165MoreToolsDispatchMode || '';
      if (menuClosed || lastAction === targetId || handledAction === targetId || dispatchMode === 'broker-handled') {
        return { menuClosed, lastAction, handledAction, dispatchMode };
      }
      return null;
    }, id),
    `More Tools action ${id} did not settle`,
    timeoutMs,
  );
}

async function clickShellControl(page, id) {
  const state = await controlInfo(page, id);
  ensure(state, `missing shell control #${id}`);
  if (state.visible) {
    await activateElement(page, `#${id}`, 5000);
    return 'toolbar';
  }
  if (id === 'onboarding') {
    const guideQuick = await controlInfo(page, 'toolbar-guide-quick');
    if (guideQuick?.visible) {
      await activateElement(page, '#toolbar-guide-quick', 5000);
      return 'guide-quick';
    }
  }
  const overflowToggle = await controlInfo(page, 'toolbar-overflow-toggle');
  ensure(overflowToggle?.visible, `#${id} is hidden and More Tools is unavailable`);
  if (!await overflowMenuOpen(page)) {
    await activateElement(page, '#toolbar-overflow-toggle', 5000);
    await waitForOpenState(page, '#toolbar-overflow-menu', true, 5000);
  }
  const refreshed = await controlInfo(page, id);
  if (refreshed?.visible && !refreshed.inOverflow) {
    await activateElement(page, `#${id}`, 5000);
    return 'toolbar-after-overflow';
  }
  if (id === 'onboarding') {
    const guideQuickAfterOpen = await controlInfo(page, 'toolbar-guide-quick');
    if (guideQuickAfterOpen?.visible) {
      await activateElement(page, '#toolbar-guide-quick', 5000);
      return 'guide-quick';
    }
  }
  const overflowSelector = `#toolbar-overflow-items > #${id}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (!await overflowMenuOpen(page)) {
      await activateElement(page, '#toolbar-overflow-toggle', 5000);
      await waitForOpenState(page, '#toolbar-overflow-menu', true, 5000);
    }
    await page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return !element.hidden && element.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Boolean(element.getClientRects().length);
    }, overflowSelector, { timeout: 5000 });
    await activateElement(page, overflowSelector, 5000);
    try {
      await waitForOverflowActionDispatch(page, id, 5000);
      return 'more-tools';
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`More Tools action ${id} did not settle`);
  return 'more-tools';
}

async function waitForAddress(page, predicate, message, timeoutMs = 18000) {
  return waitFor(
    page,
    async () => {
      const value = await page.locator('#address').inputValue();
      return predicate(value) ? value : '';
    },
    message,
    timeoutMs,
  );
}

async function waitForActiveWebview(page, timeoutMs = 18000) {
  return waitFor(
    page,
    () => page.evaluate(() => {
      const webview = document.querySelector('webview.browser-view.active');
      return webview && webview.dataset.pass236DomReady === 'true';
    }),
    'active webview did not reach dom-ready',
    timeoutMs,
  );
}

async function readActiveWebviewMetrics(page) {
  return page.evaluate(async () => {
    const stage = document.getElementById('webview-stage');
    const webview = document.querySelector('webview.browser-view.active');
    if (!stage || !webview) return null;
    const stageRect = stage.getBoundingClientRect();
    const viewRect = webview.getBoundingClientRect();
    let guest = null;
    try {
      if (typeof webview.executeJavaScript === 'function') {
        guest = await webview.executeJavaScript(`(() => {
          const body = document.body;
          const doc = document.documentElement;
          return {
            href: location.href,
            title: document.title,
            innerWidth: Number(window.innerWidth || 0),
            innerHeight: Number(window.innerHeight || 0),
            documentBottom: Math.max(
              Number(doc?.clientHeight || 0),
              Number(doc?.scrollHeight || 0),
              Number(body?.clientHeight || 0),
              Number(body?.scrollHeight || 0)
            )
          };
        })()`, true);
      }
    } catch (error) {
      guest = { error: String(error instanceof Error ? error.message : error || 'unknown') };
    }
    return {
      address: (document.getElementById('address') instanceof HTMLInputElement) ? document.getElementById('address').value : '',
      src: webview.getAttribute('src') || '',
      stageWidth: Math.round(stageRect.width),
      stageHeight: Math.round(stageRect.height),
      viewWidth: Math.round(viewRect.width),
      viewHeight: Math.round(viewRect.height),
      deltaWidth: Math.abs(Math.round(stageRect.width) - Math.round(viewRect.width)),
      deltaHeight: Math.abs(Math.round(stageRect.height) - Math.round(viewRect.height)),
      fit: webview.dataset.pass342ExactStageViewportFit || webview.dataset.pass339StageViewportFit || '',
      domReady: webview.dataset.pass236DomReady || 'false',
      guest,
    };
  });
}

async function installGuestClickCounter(page) {
  return page.evaluate(async () => {
    const webview = document.querySelector('webview.browser-view.active');
    if (!webview || typeof webview.executeJavaScript !== 'function') return false;
    return webview.executeJavaScript(`(() => {
      if (!window.__pass345GuestClickCounterInstalled) {
        window.__pass345GuestClickCounterInstalled = true;
        window.__pass345GuestClickCount = 0;
        window.addEventListener('click', () => {
          window.__pass345GuestClickCount = Number(window.__pass345GuestClickCount || 0) + 1;
        }, true);
      }
      return true;
    })()`, true);
  });
}

async function readGuestClickCount(page) {
  return page.evaluate(async () => {
    const webview = document.querySelector('webview.browser-view.active');
    if (!webview || typeof webview.executeJavaScript !== 'function') return -1;
    return Number(await webview.executeJavaScript('Number(window.__pass345GuestClickCount || 0)', true));
  });
}

async function clickGuestStageCenter(page) {
  const box = await page.locator('#webview-stage').boundingBox();
  ensure(box && box.width > 20 && box.height > 20, 'webview stage does not have usable bounds');
  const x = box.x + (box.width / 2);
  const y = box.y + Math.min(box.height - 24, Math.max(72, box.height * 0.55));
  await page.mouse.click(x, y);
  await sleep(220);
  const point = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return {
      tag: hit?.tagName?.toLowerCase() || 'none',
      id: hit?.id || '',
      className: hit instanceof HTMLElement ? hit.className : '',
    };
  }, { x, y });
  return { x, y, point };
}

async function pressCommandPalette(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
}

async function runtimeTabCount(page) {
  return page.evaluate(() => document.querySelectorAll('#tabs .tab').length);
}

async function runtimeTabStripState(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#tabs .tab[data-browser-tab-id]')).map((tab) => ({
    id: tab.getAttribute('data-browser-tab-id') || '',
    title: tab.querySelector('.tab-title')?.textContent?.trim() || '',
    pinned: tab.getAttribute('data-browser-tab-pinned') === 'true' || tab.classList.contains('pinned'),
    active: tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true'
  })));
}

async function waitForHitTarget(page, selector, message, timeoutMs = 5000) {
  return waitFor(
    page,
    () => page.evaluate((targetSelector) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) return false;
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 16) return false;
      const x = rect.left + Math.max(8, Math.min(rect.width - 8, rect.width / 2));
      const y = rect.top + Math.max(8, Math.min(rect.height - 8, rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return hit instanceof Element && (hit === element || element.contains(hit));
    }, selector),
    message,
    timeoutMs,
  );
}

async function activateElement(page, selector, timeoutMs = 5000) {
  await page.evaluate(async ({ targetSelector, timeoutMs }) => {
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return !element.hidden
        && element.getAttribute('aria-hidden') !== 'true'
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') !== 0
        && Boolean(element.getClientRects().length);
    };
    const hitTargetReady = (element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 16) return false;
      const x = rect.left + Math.max(8, Math.min(rect.width - 8, rect.width / 2));
      const y = rect.top + Math.max(8, Math.min(rect.height - 8, rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return hit instanceof Element && (hit === element || element.contains(hit));
    };
    const detail = (element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + Math.max(8, Math.min(rect.width - 8, rect.width / 2));
      const y = rect.top + Math.max(8, Math.min(rect.height - 8, rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      const hitName = hit instanceof Element ? `${hit.tagName.toLowerCase()}#${hit.id || ''}.${Array.from(hit.classList || []).slice(0, 3).join('.')}` : 'none';
      return `selector=${targetSelector} rect=${Math.round(rect.width)}x${Math.round(rect.height)} at ${Math.round(rect.left)},${Math.round(rect.top)} hit=${hitName}`;
    };

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const element = document.querySelector(targetSelector);
      if (element instanceof HTMLElement && visible(element)) {
        if (element instanceof HTMLButtonElement && element.disabled) {
          throw new Error(`activateElement target is disabled: ${targetSelector}`);
        }
        element.scrollIntoView({ block: 'center', inline: 'center' });
        if ('focus' in element) element.focus({ preventScroll: true });
        await sleep(16);
        if (hitTargetReady(element)) {
          element.click();
          await sleep(80);
          return;
        }
      }
      await sleep(120);
    }

    const current = document.querySelector(targetSelector);
    if (current instanceof HTMLElement) {
      throw new Error(`activateElement timed out: ${detail(current)}`);
    }
    throw new Error(`activateElement timed out: selector missing ${targetSelector}`);
  }, { targetSelector: selector, timeoutMs });
}

async function clickHitTarget(page, selector, message, timeoutMs = 5000) {
  await waitForHitTarget(page, selector, message, timeoutMs);
  await activateElement(page, selector, timeoutMs);
}

async function browserKitVisibleListCount(page, selector) {
  return page.evaluate((targetSelector) => {
    const host = document.querySelector(targetSelector);
    if (!(host instanceof HTMLElement)) return 0;
    return host.querySelectorAll('button[data-browser-kit-action]').length;
  }, selector);
}

async function launchProfile(profile, runId) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-pass345-blackbox-'));
  const electronApp = await electron.launch({
    args: [mainDist],
    cwd: root,
    env: {
      ...process.env,
      TAHAI_BROWSER_USER_DATA_SUFFIX: runId,
      TAHAI_BROWSER_DISABLE_SINGLE_INSTANCE_LOCK: '1',
      TAHAI_BROWSER_RUNTIME_DIAGNOSTICS: '1',
      ELECTRON_ENABLE_LOGGING: '1',
      XDG_CONFIG_HOME: path.join(tempDir, 'xdg-config'),
      XDG_CACHE_HOME: path.join(tempDir, 'xdg-cache'),
    },
  });
  const page = await electronApp.firstWindow();
  const consoleNoise = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') consoleNoise.push(`[${message.type()}] ${message.text()}`.slice(0, 500));
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.stack || error?.message || error || 'unknown page error').slice(0, 900));
  });
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return null;
    if (win.isMinimized()) win.restore();
    if (win.isMaximized()) win.unmaximize();
    win.show();
    win.focus();
    win.setBounds({ width: size.width, height: size.height });
    return win.getBounds();
  }, { width: profile.width, height: profile.height });
  await page.waitForFunction(() => document.documentElement.dataset.tahaiShellReady === '1', undefined, { timeout: 18000 });
  await waitForActiveWebview(page, 18000);
  const config = await page.evaluate(() => window.tahaiBrowser.getConfig());
  return { electronApp, page, config, consoleNoise, pageErrors };
}

async function runScenario(page, config, profile, scenario) {
  if (scenario.id === 'launch-shell-stage-webview') {
    const metrics = await readActiveWebviewMetrics(page);
    ensure(metrics, 'missing stage or active webview metrics');
    ensure(metrics.stageWidth >= 320 && metrics.stageHeight >= 240, `stage too small: ${metrics.stageWidth}x${metrics.stageHeight}`);
    ensure(metrics.deltaWidth <= 4 && metrics.deltaHeight <= 4, `stage/webview drift too large: ${metrics.deltaWidth}px x ${metrics.deltaHeight}px`);
    ensure(metrics.domReady === 'true', 'active webview did not mark dom-ready');
    ensure(metrics.guest && !metrics.guest.error, `guest metrics unavailable: ${metrics.guest?.error || 'missing guest info'}`);
    ensure(Number(metrics.guest.innerHeight || 0) >= 320, `guest innerHeight too small: ${metrics.guest?.innerHeight || 0}`);
    ensure(Number(metrics.guest.documentBottom || 0) + 2 >= Number(metrics.guest.innerHeight || 0), `guest document bottom ${metrics.guest.documentBottom || 0} does not reach viewport ${metrics.guest.innerHeight || 0}`);
    return {
      detail: `stage ${metrics.stageWidth}x${metrics.stageHeight}, guest ${metrics.guest.innerWidth}x${metrics.guest.innerHeight}, url ${metrics.guest.href || metrics.src}`,
      metrics,
    };
  }

  if (scenario.id === 'primary-browser-routing') {
    const launchpadVia = await clickShellControl(page, 'launchpad');
    const launchpad = await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'launchpad did not route active tab');
    await waitForActiveWebview(page, 12000);
    const guideVia = await clickShellControl(page, 'onboarding');
    const guide = await waitForAddress(page, (value) => includesUrl(config.onboardingUrl, value), 'guide did not route active tab');
    await waitForActiveWebview(page, 12000);
    await page.locator('#address').fill(config.newTabUrl);
    await page.locator('#address').press('Enter');
    const entered = await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'address submit did not route active tab');
    await page.locator('#home').click();
    const home = await waitForAddress(page, (value) => includesUrl(config.homeUrl, value), 'home did not route active tab', 22000);
    await waitForActiveWebview(page, 22000);
    await page.locator('#back').click();
    await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'Back did not return to launchpad');
    await waitForActiveWebview(page, 12000);
    await page.locator('#forward').click();
    await waitForAddress(page, (value) => includesUrl(config.homeUrl, value), 'Forward did not return to home', 22000);
    await waitForActiveWebview(page, 22000);
    await page.locator('#reload').click();
    await waitForActiveWebview(page, 22000);
    return {
      detail: `launchpad ${launchpadVia}:${launchpad} -> guide ${guideVia}:${guide} -> address ${entered} -> home ${home}`,
    };
  }

  if (scenario.id === 'chrome-flyouts-and-dialogs') {
    await page.locator('#devops-tools').click();
    await waitForOpenState(page, '#devops-tools-panel', true);
    await page.locator('#devops-tools').click();
    await waitForOpenState(page, '#devops-tools-panel', false);
    await page.locator('#it-tools').click();
    await waitForOpenState(page, '#it-tools-panel', true);
    await page.locator('#it-tools').click();
    await waitForOpenState(page, '#it-tools-panel', false);
    const opsVia = await clickShellControl(page, 'ops-hub-toggle');
    await waitForOpenState(page, '#ops-hub', true);
    ensure(await page.locator('[data-ops-action="command"]').count() >= 1, 'Ops Panel cards are missing');
    await page.locator('#close-ops-hub').click();
    await waitForOpenState(page, '#ops-hub', false);
    const settingsVia = await clickShellControl(page, 'settings');
    await waitForOpenState(page, '#settings-dialog', true, 6000);
    ensure(await page.locator('#setting-home-url').count() >= 1, 'Settings dialog did not render home URL control');
    await page.locator('#close-settings').click();
    await waitForOpenState(page, '#settings-dialog', false, 6000);
    const profileVia = await clickShellControl(page, 'profile-switcher');
    await waitForOpenState(page, '#profile-dialog', true, 5000);
    ensure(await page.locator('#profile-list').count() >= 1, 'Profile dialog did not render list host');
    await sleep(900);
    const profileDialogStillOpen = await page.evaluate(() => {
      const dialog = document.getElementById('profile-dialog');
      return dialog instanceof HTMLDialogElement && dialog.open;
    });
    const profileDismissAction = await page.evaluate(() => document.body.dataset.pass122LastReflowAction || 'unknown');
    ensure(profileDialogStillOpen, `Profile dialog closed during restored-window settle; action=${profileDismissAction}`);
    await page.locator('#close-profile').click();
    await waitForOpenState(page, '#profile-dialog', false, 5000);
    await pressCommandPalette(page);
    await waitForOpenState(page, '#command-palette-dialog', true);
    await page.keyboard.press('Escape');
    await waitForOpenState(page, '#command-palette-dialog', false);
    return {
      detail: `ops ${opsVia}, settings ${settingsVia}, profile ${profileVia} in ${profile.id}`,
    };
  }

  if (scenario.id === 'tool-card-dialog-actions') {
    const devopsVia = await clickShellControl(page, 'devops-tools');
    await waitForOpenState(page, '#devops-tools-panel', true);
    await clickHitTarget(page, '#capture', 'Capture card was not hit-test ready');
    await waitForOpenState(page, '#capture-dialog', true, 6000);
    ensure(await page.locator('#capture-markdown').count() >= 1, 'Capture dialog did not render its markdown surface');
    await page.locator('#close-capture').click();
    await waitForOpenState(page, '#capture-dialog', false, 6000);

    await clickShellControl(page, 'devops-tools');
    await waitForOpenState(page, '#devops-tools-panel', true);
    await clickHitTarget(page, '#ops-check', 'Ops Check card was not hit-test ready');
    await waitForOpenState(page, '#ops-dialog', true, 6000);
    ensure(await page.locator('#ops-markdown').count() >= 1, 'Ops Check dialog did not render its markdown surface');
    await page.locator('#close-ops').click();
    await waitForOpenState(page, '#ops-dialog', false, 6000);

    const itVia = await clickShellControl(page, 'it-tools');
    await waitForOpenState(page, '#it-tools-panel', true);
    await clickHitTarget(page, '#it-card', 'IT Card was not hit-test ready');
    await waitForOpenState(page, '#it-card-dialog', true, 6000);
    ensure(await page.locator('#it-card-markdown').count() >= 1, 'IT Service Card dialog did not render its markdown surface');
    await page.locator('#close-it-card').click();
    await waitForOpenState(page, '#it-card-dialog', false, 6000);

    await clickShellControl(page, 'it-tools');
    await waitForOpenState(page, '#it-tools-panel', true);
    await clickHitTarget(page, '#endpoint', 'Endpoint card was not hit-test ready');
    await waitForOpenState(page, '#endpoint-dialog', true, 6000);
    ensure(await page.locator('#endpoint-markdown').count() >= 1, 'Endpoint Snapshot dialog did not render its markdown surface');
    await page.locator('#close-endpoint').click();
    await waitForOpenState(page, '#endpoint-dialog', false, 6000);

    const opsVia = await clickShellControl(page, 'ops-hub-toggle');
    await waitForOpenState(page, '#ops-hub', true);
    await clickHitTarget(page, '[data-ops-action="command"]', 'Ops Panel Command Palette card was not hit-test ready');
    await waitForOpenState(page, '#command-palette-dialog', true, 6000);
    await page.keyboard.press('Escape');
    await waitForOpenState(page, '#command-palette-dialog', false, 6000);
    await clickHitTarget(page, '[data-ops-action="shortcuts"]', 'Ops Panel Shortcuts card was not hit-test ready');
    await waitForOpenState(page, '#shortcut-dialog', true, 6000);
    await page.locator('#close-shortcuts').click();
    await waitForOpenState(page, '#shortcut-dialog', false, 6000);
    await page.locator('#close-ops-hub').click();
    await waitForOpenState(page, '#ops-hub', false, 6000);

    await clickShellControl(page, 'launchpad');
    await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'normal browsing did not recover after tool-card actions', 12000);
    await waitForActiveWebview(page, 12000);
    return {
      detail: `tool cards via devops ${devopsVia}, it ${itVia}, ops ${opsVia} opened real dialogs and browsing recovered`,
    };
  }

  if (scenario.id === 'browser-kit-find-and-guest-click') {
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    await clickHitTarget(page, '#browser-find', 'Browser Kit Find card was not hit-test ready');
    await waitForOpenState(page, '#find-bar', true);
    await page.locator('#find-close').click();
    await waitForOpenState(page, '#find-bar', false);
    if (await overflowMenuOpen(page) || await page.evaluate(() => {
      const panel = document.getElementById('browser-kit-panel');
      return panel instanceof HTMLElement && !panel.hidden;
    })) {
      await page.locator('#browser-kit').click();
      await waitForOpenState(page, '#browser-kit-panel', false);
    }
    ensure(await installGuestClickCounter(page), 'unable to install guest click counter');
    const before = await readGuestClickCount(page);
    const hit = await clickGuestStageCenter(page);
    const after = await readGuestClickCount(page);
    ensure(after > before, `guest click count did not increase (${before} -> ${after}); hit ${hit.point.tag}#${hit.point.id}`);
    return {
      detail: `guest click count ${before} -> ${after}; hit ${hit.point.tag}${hit.point.id ? '#' + hit.point.id : ''}`,
      hit,
    };
  }

  if (scenario.id === 'browser-history-session-recovery') {
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    const beforeCount = await runtimeTabCount(page);
    const originalUrl = await page.locator('#address').inputValue();
    await clickHitTarget(page, '#browser-duplicate-tab', 'duplicate tab card was not hit-test ready');
    await waitFor(page, async () => (await runtimeTabCount(page)) === beforeCount + 1, 'duplicate tab did not increase tab count', 6000);
    await waitForOpenState(page, '#browser-kit-panel', false);
    const duplicatedUrl = await waitForAddress(page, (value) => sameUrl(originalUrl, value), 'duplicated tab did not keep the active URL', 12000);
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    await clickHitTarget(page, '#browser-close-tab', 'close tab card was not hit-test ready');
    await waitFor(page, async () => (await runtimeTabCount(page)) === beforeCount, 'close tab did not reduce tab count', 6000);
    await waitForOpenState(page, '#browser-kit-panel', false);
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    await waitFor(page, async () => (await browserKitVisibleListCount(page, '#browser-kit-closed-list')) >= 1, 'recently closed list did not populate', 4000);
    await clickHitTarget(page, '#browser-reopen-closed-tab', 'reopen closed card was not hit-test ready');
    await waitFor(page, async () => (await runtimeTabCount(page)) === beforeCount + 1, 'reopen closed did not restore tab count', 6000);
    await waitForOpenState(page, '#browser-kit-panel', false);
    const reopenedUrl = await waitForAddress(page, (value) => sameUrl(originalUrl, value), 'reopened closed tab did not restore the original URL', 12000);
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    const recentCount = await browserKitVisibleListCount(page, '#browser-kit-history-list');
    ensure(recentCount >= 1, 'recent page list did not populate');
    const sessionRestoreReady = await page.evaluate(() => {
      const button = document.getElementById('browser-restore-session');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    ensure(sessionRestoreReady, 'restore session was not available after normal browsing activity');
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', false);
    return {
      detail: `tab count ${beforeCount} -> ${beforeCount + 1} -> ${beforeCount} -> ${beforeCount + 1}; recent=${recentCount}; url=${reopenedUrl || duplicatedUrl}`,
    };
  }

  if (scenario.id === 'browser-tab-pinning-and-switching') {
    const beforeCount = await runtimeTabCount(page);
    await page.locator('#new-tab').click();
    await waitFor(page, async () => (await runtimeTabCount(page)) === beforeCount + 1, 'new tab did not increase tab count for pinning flow', 6000);
    const pinCandidate = await page.evaluate(() => {
      const activeTab = document.querySelector('#tabs .tab[aria-selected="true"], #tabs .tab.active');
      return activeTab instanceof HTMLElement ? activeTab.getAttribute('data-browser-tab-id') || '' : '';
    });
    ensure(pinCandidate, 'active tab id was unavailable before pinning');
    await page.locator('#browser-kit').click();
    await waitForOpenState(page, '#browser-kit-panel', true);
    await clickHitTarget(page, '#browser-pin-tab', 'pin tab card was not hit-test ready');
    await waitFor(page, async () => {
      const tabs = await runtimeTabStripState(page);
      return tabs[0]?.id === pinCandidate && tabs[0]?.pinned === true;
    }, 'pinned tab did not move to the front of the strip', 6000);
    if (await page.evaluate(() => {
      const panel = document.getElementById('browser-kit-panel');
      return panel instanceof HTMLElement && !panel.hidden;
    })) {
      await page.keyboard.press('Escape');
      if (await page.evaluate(() => {
        const panel = document.getElementById('browser-kit-panel');
        return panel instanceof HTMLElement && !panel.hidden;
      })) {
        await page.locator('#browser-kit').click();
      }
      await waitForOpenState(page, '#browser-kit-panel', false);
    }
    const pinnedState = await runtimeTabStripState(page);
    ensure(pinnedState[0]?.id === pinCandidate && pinnedState[0]?.pinned === true, 'pinned tab state was not preserved');
    await page.keyboard.press('Control+Tab');
    const cycled = await waitFor(page, async () => {
      const tabs = await runtimeTabStripState(page);
      return tabs.find((tab) => tab.active && tab.id !== pinCandidate) || null;
    }, 'Ctrl+Tab did not advance to the next visible tab', 4000);
    await page.keyboard.press('Control+Shift+Tab');
    await waitFor(page, async () => {
      const tabs = await runtimeTabStripState(page);
      return tabs[0]?.id === pinCandidate && tabs[0]?.active === true;
    }, 'Ctrl+Shift+Tab did not return focus to the pinned tab', 4000);
    await page.keyboard.press('Control+1');
    await waitFor(page, async () => {
      const tabs = await runtimeTabStripState(page);
      return tabs[0]?.id === pinCandidate && tabs[0]?.active === true;
    }, 'Ctrl+1 did not focus the first visible tab', 4000);
    return {
      detail: `pinned ${pinCandidate} at strip index 0; Ctrl+Tab reached ${cycled.id}`,
    };
  }

  if (scenario.id === 'mission-control-layout-and-export') {
    await page.locator('#mission-control-toggle').click();
    await waitForOpenState(page, '#mission-dialog', true);
    await page.locator('#mission-name').fill(`PASS345 ${profile.id}`);
    await page.locator('#mission-create').click();
    await waitFor(
      page,
      () => page.evaluate(() => {
        const status = document.getElementById('mission-status');
        return Boolean(status && !/No active mission/i.test(status.textContent || ''));
      }),
      'mission create did not update mission status',
      6000,
    );
    await page.locator('#mission-add-active-tab').click();
    await waitFor(
      page,
      () => page.evaluate(() => document.querySelectorAll('#mission-tabs-list .mission-tab-row').length >= 1),
      'active tab was not added to Mission Control',
      6000,
    );
    await page.locator('[data-mission-layout="quad"]').click();
    await waitFor(
      page,
      () => page.evaluate(() => document.getElementById('webview-stage')?.classList.contains('mission-layout-quad')),
      'quad layout did not become active',
      6000,
    );
    await page.locator('[data-mission-layout="focus"]').click();
    await waitFor(
      page,
      () => page.evaluate(() => document.getElementById('webview-stage')?.classList.contains('mission-layout-focus')),
      'focus layout did not become active',
      6000,
    );
    await page.locator('#mission-pin-active-page').click();
    const exportPreview = await waitFor(
      page,
      () => page.evaluate(() => {
        const preview = document.getElementById('mission-export-preview');
        if (!(preview instanceof HTMLTextAreaElement)) return '';
        return preview.value.trim();
      }),
      'mission export preview did not populate',
      6000,
    );
    const exportBoundary = await page.evaluate(() => document.getElementById('mission-export-preview')?.getAttribute('data-export-redaction-boundary') || '');
    ensure(exportBoundary === 'redaction-required-before-copy-save', 'mission export preview lost the redaction boundary');
    await page.locator('#close-mission').click();
    await waitForOpenState(page, '#mission-dialog', false);
    await clickShellControl(page, 'launchpad');
    await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'normal browsing did not recover after closing Mission Control');
    await waitForActiveWebview(page, 12000);
    return {
      detail: `mission export preview length ${exportPreview.length}`,
    };
  }

  throw new Error(`Unknown PASS345 scenario ${scenario.id}`);
}

function summaryMarkdown(report) {
  const lines = [
    `# ${pass} Black-Box Electron Release E2E`,
    '',
    `- Result: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Contract: ${contractId}`,
    `- Version: ${report.versionTarget}`,
    `- Generated At: ${report.generatedAt}`,
    '',
  ];
  for (const profile of report.profiles) {
    lines.push(`## ${profile.id}`);
    lines.push('');
    lines.push(`- Window: ${profile.width}x${profile.height}`);
    lines.push(`- Result: ${profile.ok ? 'PASS' : 'FAIL'}`);
    lines.push(`- Console noise: ${profile.consoleNoise.length}`);
    lines.push(`- Page errors: ${profile.pageErrors.length}`);
    lines.push('');
    for (const scenario of profile.scenarios) {
      lines.push(`- ${scenario.id}: ${scenario.ok ? 'PASS' : 'FAIL'}${scenario.detail ? ` - ${scenario.detail}` : ''}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

if (args.has('--plan-json')) {
  process.stdout.write(JSON.stringify(plan(), null, 2));
  process.exit(0);
}

if (!args.has('--run')) {
  console.log(`[${pass}][PLAN] Black-box Electron release scenarios:`);
  for (const scenario of matrix.scenarios || []) console.log(` - ${scenario.id}`);
  console.log(`[${pass}][PLAN] Window profiles:`);
  for (const profile of matrix.windowProfiles || []) console.log(` - ${profile.id} ${profile.width}x${profile.height}`);
  console.log(`[${pass}][PLAN] Live execution: npm run test:blackbox-e2e`);
  process.exit(0);
}

if (!fs.existsSync(mainDist)) {
  console.error(`[${pass}][FAIL] dist/main/main.js missing. Run npm run build before npm run test:blackbox-e2e.`);
  process.exit(1);
}

fs.mkdirSync(evidenceDir, { recursive: true });

const report = {
  pass,
  contractId,
  versionTarget: matrix.versionTarget,
  generatedAt: new Date().toISOString(),
  ok: true,
  profiles: [],
};

async function executeProfile(profile, attempt) {
  const runId = `pass345-${profile.id}-attempt${attempt}-${Date.now()}-${process.pid}`;
  let electronApp;
  let page;
  let config = null;
  const profileReport = {
    id: profile.id,
    width: profile.width,
    height: profile.height,
    attempts: attempt,
    ok: true,
    consoleNoise: [],
    pageErrors: [],
    scenarios: [],
  };
  try {
    const launched = await launchProfile(profile, runId);
    electronApp = launched.electronApp;
    page = launched.page;
    config = launched.config;
    profileReport.consoleNoise = launched.consoleNoise;
    profileReport.pageErrors = launched.pageErrors;
    for (const scenario of matrix.scenarios || []) {
      const scenarioReport = { id: scenario.id, ok: true, detail: '', screenshot: '' };
      try {
        const outcome = await runScenario(page, config, profile, scenario);
        scenarioReport.detail = String(outcome?.detail || 'ok');
        scenarioReport.screenshot = path.relative(root, path.join(evidenceDir, screenshotName(profile.id, scenario.id))).replace(/\\/g, '/');
        await page.screenshot({ path: path.join(root, scenarioReport.screenshot), fullPage: false });
      } catch (error) {
        scenarioReport.ok = false;
        scenarioReport.detail = error instanceof Error ? error.message : String(error || 'unknown scenario failure');
        scenarioReport.screenshot = path.relative(root, path.join(evidenceDir, screenshotName(profile.id, scenario.id, 'fail'))).replace(/\\/g, '/');
        try {
          await page.screenshot({ path: path.join(root, scenarioReport.screenshot), fullPage: false });
        } catch {
          /* best-effort failure evidence */
        }
        profileReport.ok = false;
      }
      profileReport.scenarios.push(scenarioReport);
    }
  } catch (error) {
    profileReport.ok = false;
    profileReport.pageErrors.push(error instanceof Error ? error.stack || error.message : String(error || 'unknown launch failure'));
  } finally {
    if (electronApp) {
      try {
        await electronApp.close();
      } catch {
        /* best-effort close */
      }
    }
  }
  return profileReport;
}

for (const profile of matrix.windowProfiles || []) {
  let finalProfileReport = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const profileReport = await executeProfile(profile, attempt);
    finalProfileReport = profileReport;
    if (profileReport.ok) break;
    const failedScenario = profileReport.scenarios.find((entry) => !entry.ok)?.id || 'launch';
    console.warn(`[${pass}][WARN] Retrying profile ${profile.id} after attempt ${attempt} failed on ${failedScenario}.`);
  }
  if (!finalProfileReport?.ok) report.ok = false;
  report.profiles.push(finalProfileReport);
}

report.ok = report.profiles.every((profile) => Boolean(profile && profile.ok));

fs.writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(summaryPath, summaryMarkdown(report), 'utf8');

console.log(`[${pass}] RESULT=${report.ok ? 'PASS' : 'FAIL'}`);
console.log(`${pass}_RESULT=${path.relative(root, resultPath).replace(/\\/g, '/')}`);
console.log(`${pass}_SUMMARY=${path.relative(root, summaryPath).replace(/\\/g, '/')}`);

if (!report.ok) process.exit(1);
