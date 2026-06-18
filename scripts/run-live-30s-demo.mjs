#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const root = process.cwd();
const mainDist = path.join(root, 'dist', 'main', 'main.js');
const args = new Set(process.argv.slice(2));

const demoPlan = {
  name: 'TAHAI Browser 30s Live Tour',
  runCommand: 'npm run demo:live-tour',
  countdownSeconds: 10,
  profile: {
    id: 'demo-1460x940',
    width: 1460,
    height: 940,
  },
  steps: [
    'Open Settings and show runtime controls.',
    'Open Profiles and close cleanly.',
    'Open DevOps and launch Capture.',
    'Open IT Tools and launch Endpoint.',
    'Open Ops Panel and Command Center.',
    'Open Mission Control, create a mission, and switch layouts.',
    'Open Guide / KB, return to Launchpad, and open Browser Kit Find.',
  ],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
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

async function waitFor(page, predicate, message, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await sleep(120);
  }
  throw new Error(message);
}

async function waitForOpenState(page, selector, open, timeoutMs = 5000) {
  return waitFor(
    page,
    () => page.evaluate(({ selector: targetSelector, open: shouldOpen }) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;
      if (element instanceof HTMLDialogElement) return element.open === shouldOpen;
      const style = window.getComputedStyle(element);
      const hidden = element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden';
      return shouldOpen ? !hidden : hidden;
    }, { selector, open }),
    `${selector} did not become ${open ? 'open' : 'closed'}`,
    timeoutMs,
  );
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

async function clickShellControl(page, id) {
  const state = await controlInfo(page, id);
  ensure(state, `missing shell control #${id}`);
  if (state.visible) {
    await page.locator(`#${id}`).click();
    return 'toolbar';
  }
  const overflowToggle = await controlInfo(page, 'toolbar-overflow-toggle');
  ensure(overflowToggle?.visible, `#${id} is hidden and More Tools is unavailable`);
  if (!await overflowMenuOpen(page)) {
    await page.locator('#toolbar-overflow-toggle').click();
    await waitForOpenState(page, '#toolbar-overflow-menu', true, 5000);
  }
  const overflowSelector = `#toolbar-overflow-items > #${id}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (!await overflowMenuOpen(page)) {
      await page.locator('#toolbar-overflow-toggle').click();
      await waitForOpenState(page, '#toolbar-overflow-menu', true, 5000);
    }
    await page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return !element.hidden && element.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Boolean(element.getClientRects().length);
    }, overflowSelector, { timeout: 5000 });
    await page.locator(overflowSelector).click();
    try {
      await waitForOverflowActionDispatch(page, id, 5000);
      return 'more-tools';
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`More Tools action ${id} did not settle`);
}

async function launchDemoWindow(profile, runId) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-live-demo-'));
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
  return { electronApp, page, config };
}

async function renderDemoOverlay(page, payload) {
  await page.evaluate(({ mode, title, detail }) => {
    let overlay = document.getElementById('codex-live-demo-overlay');
    if (!(overlay instanceof HTMLElement)) {
      overlay = document.createElement('section');
      overlay.id = 'codex-live-demo-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.position = 'fixed';
      overlay.style.left = '50%';
      overlay.style.bottom = '22px';
      overlay.style.transform = 'translateX(-50%)';
      overlay.style.zIndex = '999999';
      overlay.style.pointerEvents = 'none';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.gap = '6px';
      document.body.appendChild(overlay);
    }
    if (mode === 'hide') {
      overlay.style.opacity = '0';
      overlay.innerHTML = '';
      return;
    }
    overlay.style.opacity = '1';
    const badgeBackground = mode === 'countdown' ? 'rgba(8, 18, 38, 0.92)' : 'rgba(6, 17, 31, 0.86)';
    const accent = 'rgba(96, 255, 218, 0.92)';
    overlay.innerHTML = `
      <div style="min-width:280px; max-width:720px; padding:12px 18px; border-radius:18px; border:1px solid ${accent}; background:${badgeBackground}; box-shadow:0 18px 40px rgba(0,0,0,0.38); text-align:center; color:#f2fbff; font-family:'Segoe UI',sans-serif;">
        <div style="font-size:${mode === 'countdown' ? '28px' : '20px'}; font-weight:700; letter-spacing:${mode === 'countdown' ? '0.06em' : '0.03em'};">${title}</div>
        ${detail ? `<div style="margin-top:4px; font-size:12px; letter-spacing:0.04em; color:rgba(196, 247, 239, 0.88); text-transform:uppercase;">${detail}</div>` : ''}
      </div>
    `;
  }, payload);
}

async function countdown(page, seconds) {
  for (let remaining = seconds; remaining >= 1; remaining -= 1) {
    await renderDemoOverlay(page, {
      mode: 'countdown',
      title: `Demo starts in ${remaining}`,
      detail: 'Focus your video capture on this window',
    });
    await sleep(1000);
  }
  await renderDemoOverlay(page, {
    mode: 'cue',
    title: 'TAHAI Browser Live Tour',
    detail: 'Settings, tools, mission control, guide, and browser kit',
  });
  await sleep(900);
}

async function cue(page, title, detail, holdMs = 500) {
  await renderDemoOverlay(page, { mode: 'cue', title, detail });
  await sleep(holdMs);
}

async function openSettingsDemo(page) {
  await cue(page, 'Runtime Settings', 'Home, startup, search, privacy, and download controls', 700);
  await clickShellControl(page, 'settings');
  await waitForOpenState(page, '#settings-dialog', true, 6000);
  await page.locator('#setting-search').focus();
  await sleep(1200);
  await page.locator('#close-settings').click();
  await waitForOpenState(page, '#settings-dialog', false, 4000);
}

async function openProfilesDemo(page) {
  await cue(page, 'Profiles', 'Browser profile isolation and management', 500);
  await clickShellControl(page, 'profile-switcher');
  await waitForOpenState(page, '#profile-dialog', true, 5000);
  await sleep(1200);
  await page.locator('#close-profile').click();
  await waitForOpenState(page, '#profile-dialog', false, 4000);
}

async function openDevOpsDemo(page) {
  await cue(page, 'DevOps', 'Capture and operational diagnostics', 450);
  await clickShellControl(page, 'devops-tools');
  await waitForOpenState(page, '#devops-tools-panel', true, 4000);
  await waitForHitTarget(page, '#capture', 'Capture card was not hit-test ready');
  await page.locator('#capture').click();
  await waitForOpenState(page, '#capture-dialog', true, 5000);
  await sleep(1100);
  await page.locator('#close-capture').click();
  await waitForOpenState(page, '#capture-dialog', false, 4000);
}

async function openITDemo(page) {
  await cue(page, 'IT Tools', 'Endpoint and support workflow surfaces', 450);
  await clickShellControl(page, 'it-tools');
  await waitForOpenState(page, '#it-tools-panel', true, 4000);
  await waitForHitTarget(page, '#endpoint', 'Endpoint card was not hit-test ready');
  await page.locator('#endpoint').click();
  await waitForOpenState(page, '#endpoint-dialog', true, 5000);
  await sleep(1000);
  await page.locator('#close-endpoint').click();
  await waitForOpenState(page, '#endpoint-dialog', false, 4000);
}

async function openOpsAndCommandDemo(page) {
  await cue(page, 'Ops Panel + Command Center', 'Launch operational cards and Ctrl+K command search', 450);
  await clickShellControl(page, 'ops-hub-toggle');
  await waitForOpenState(page, '#ops-hub', true, 4000);
  await waitForHitTarget(page, '[data-ops-action="command"]', 'Ops Panel command card was not hit-test ready');
  await page.locator('[data-ops-action="command"]').click();
  await waitForOpenState(page, '#command-palette-dialog', true, 5000);
  await sleep(900);
  await page.keyboard.press('Escape');
  await waitForOpenState(page, '#command-palette-dialog', false, 4000);
  await page.locator('#close-ops-hub').click();
  await waitForOpenState(page, '#ops-hub', false, 4000);
}

async function openMissionDemo(page, profileId) {
  await cue(page, 'Mission Control', 'Create a local mission and switch layouts', 450);
  await clickShellControl(page, 'mission-control-toggle');
  await waitForOpenState(page, '#mission-dialog', true, 5000);
  await page.locator('#mission-name').fill(`Live Demo ${profileId}`);
  await page.locator('#mission-create').click();
  await sleep(450);
  await page.locator('#mission-add-active-tab').click();
  await sleep(450);
  await page.locator('[data-mission-layout="quad"]').click();
  await sleep(900);
  await page.locator('[data-mission-layout="focus"]').click();
  await sleep(900);
  await page.locator('#close-mission').click();
  await waitForOpenState(page, '#mission-dialog', false, 5000);
}

async function openGuideAndReturnDemo(page, config) {
  await cue(page, 'Guide / KB', 'Walkthrough and help surface', 450);
  await clickShellControl(page, 'onboarding');
  await waitForAddress(page, (value) => includesUrl(config.onboardingUrl, value), 'Guide did not route active tab', 16000);
  await waitForActiveWebview(page, 16000);
  await sleep(900);
  await cue(page, 'Normal Browsing', 'Return to Launchpad and show Browser Kit Find', 350);
  await clickShellControl(page, 'launchpad');
  await waitForAddress(page, (value) => sameUrl(config.newTabUrl, value), 'Launchpad did not route active tab', 12000);
  await waitForActiveWebview(page, 12000);
  await clickShellControl(page, 'browser-kit');
  await waitForOpenState(page, '#browser-kit-panel', true, 4000);
  await waitForHitTarget(page, '#browser-find', 'Browser Find card was not hit-test ready');
  await page.locator('#browser-find').click();
  await waitForOpenState(page, '#find-bar', true, 4000);
  await sleep(900);
  await page.locator('#find-close').click();
  await waitForOpenState(page, '#find-bar', false, 4000);
}

async function runDemo() {
  ensure(fs.existsSync(mainDist), `Built app not found at ${mainDist}. Run npm run build first.`);
  const profile = demoPlan.profile;
  const runId = `live-demo-${Date.now()}-${process.pid}`;
  const launched = await launchDemoWindow(profile, runId);
  const { electronApp, page, config } = launched;
  let ok = true;
  try {
    console.log('[LIVE-DEMO] Window ready. Rendering 10-second countdown.');
    await countdown(page, demoPlan.countdownSeconds);
    await openSettingsDemo(page);
    await openProfilesDemo(page);
    await openDevOpsDemo(page);
    await openITDemo(page);
    await openOpsAndCommandDemo(page);
    await openMissionDemo(page, profile.id);
    await openGuideAndReturnDemo(page, config);
    await cue(page, 'Demo Complete', 'TAHAI Browser surfaces stayed interactive end-to-end', 1600);
    await renderDemoOverlay(page, { mode: 'hide', title: '', detail: '' });
  } catch (error) {
    ok = false;
    await renderDemoOverlay(page, {
      mode: 'cue',
      title: 'Demo Interrupted',
      detail: error instanceof Error ? error.message.slice(0, 120) : String(error || 'unknown failure').slice(0, 120),
    });
    await sleep(2200);
    throw error;
  } finally {
    if (ok) {
      console.log('[LIVE-DEMO] Tour complete. Leaving the window open for review.');
    }
    // Intentionally keep the visible window open so the operator can review or continue recording.
    // The process stays attached until the user closes the demo window or terminates the command.
    await electronApp.waitForEvent('close').catch(() => {});
  }
}

if (args.has('--plan') || !args.has('--run')) {
  console.log(JSON.stringify(demoPlan, null, 2));
  process.exit(0);
}

runDemo().catch((error) => {
  console.error(`[LIVE-DEMO][FAIL] ${error instanceof Error ? error.stack || error.message : String(error || 'unknown error')}`);
  process.exit(1);
});
