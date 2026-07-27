#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const root = process.cwd();
const mainDist = path.join(root, 'dist', 'main', 'main.js');
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

function fail(message) {
  console.error(`BROWSER_UX_PARITY_FAIL: ${message}`);
  process.exit(1);
}

async function activeWebviewHandle(page) {
  const handle = await page.evaluateHandle(() => {
    const views = Array.from(document.querySelectorAll('webview.browser-view'));
    const active = views.find((view) => view.classList.contains('active') || view.getAttribute('data-active') === 'true' || view.dataset.pass134Active === 'true');
    return active || null;
  });
  return handle.asElement();
}

async function webviewEval(page, code) {
  const handle = await activeWebviewHandle(page);
  if (!handle) return null;
  return handle.evaluate(async (webview, script) => {
    if (typeof webview.executeJavaScript !== 'function') return null;
    return webview.executeJavaScript(script, true);
  }, code);
}

async function readShellState(page) {
  return page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('#tabs .tab'));
    const address = document.getElementById('address');
    const commandDialog = document.getElementById('command-palette-dialog');
    const settingsDialog = document.getElementById('settings-dialog');
    const profileDialog = document.getElementById('profile-dialog');
    const missionDialog = document.getElementById('mission-dialog');
    const findBar = document.getElementById('find-bar');
    return {
      tabCount: tabs.length,
      activeIndex: tabs.findIndex((tab) => tab.classList.contains('active')),
      activeElementId: document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.tagName : '',
      addressFocused: document.activeElement?.id === 'address',
      addressSelected: address instanceof HTMLInputElement ? (address.selectionStart === 0 && address.selectionEnd === address.value.length) : false,
      commandOpen: commandDialog instanceof HTMLDialogElement && commandDialog.open,
      commandFocused: document.activeElement?.id === 'command-palette-input',
      commandRows: Array.from(document.querySelectorAll('#command-palette-dialog .command-row')).map((row) => ({
        text: (row.textContent || '').replace(/\s+/g, ' ').trim(),
        active: row.classList.contains('active'),
        disabled: row.getAttribute('aria-disabled') === 'true'
      })),
      settingsOpen: settingsDialog instanceof HTMLDialogElement && settingsDialog.open,
      profileOpen: profileDialog instanceof HTMLDialogElement && profileDialog.open,
      missionOpen: missionDialog instanceof HTMLDialogElement && missionDialog.open,
      findHidden: findBar?.hidden ?? true,
      overlay: document.body.dataset.pass116ActiveOverlay || '',
      lastCommand: document.body.dataset.pass204LastCommand || ''
    };
  });
}

async function installReloadCounter(page) {
  await page.evaluate(() => {
    const views = Array.from(document.querySelectorAll('webview.browser-view'));
    const active = views.find((view) => view.classList.contains('active') || view.getAttribute('data-active') === 'true' || view.dataset.pass134Active === 'true');
    if (!active) throw new Error('no active webview found');
    if (!window.__tahaiUxParityReloadCounterInstalled) {
      window.__tahaiUxParityReloadCounterInstalled = true;
      window.__tahaiUxParityReloadCounter = 0;
      active.addEventListener('did-start-loading', () => {
        window.__tahaiUxParityReloadCounter += 1;
      }, true);
    }
    return true;
  });
}

async function readReloadCount(page) {
  return page.evaluate(() => Number(window.__tahaiUxParityReloadCounter || 0));
}

async function clickWebviewStage(page) {
  const box = await page.locator('#webview-stage').boundingBox();
  if (!box) fail('webview stage missing');
  await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.waitForTimeout(100);
}

async function openSettings(page) {
  await page.keyboard.press('Control+,');
  await page.waitForTimeout(250);
  const state = await readShellState(page);
  if (!state.settingsOpen) fail('Ctrl+, did not open settings');
  return state;
}

async function openProfile(page) {
  await page.evaluate(() => {
    const button = document.getElementById('profile-switcher');
    if (button) button.click();
  });
  await page.waitForTimeout(300);
  const state = await readShellState(page);
  if (!state.profileOpen) fail('profile-switcher click did not open profile dialog');
  return state;
}

async function openMission(page) {
  await page.evaluate(() => {
    const button = document.getElementById('mission-control-toggle');
    if (button) button.click();
  });
  await page.waitForTimeout(400);
  const state = await readShellState(page);
  if (!state.missionOpen) fail('mission-control-toggle click did not open Mission Control');
  return state;
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-ux-parity-'));
const app = await electron.launch({
  executablePath: electronExe,
  args: [mainDist],
  cwd: root,
  env: {
    TAHAI_BROWSER_USER_DATA_SUFFIX: `ux-parity-${Date.now()}`,
    TAHAI_BROWSER_DISABLE_SINGLE_INSTANCE_LOCK: '1',
    TAHAI_BROWSER_RUNTIME_DIAGNOSTICS: '1',
    ELECTRON_ENABLE_LOGGING: '1',
    XDG_CONFIG_HOME: path.join(tempDir, 'xdg-config'),
    XDG_CACHE_HOME: path.join(tempDir, 'xdg-cache')
  }
});

let page;
try {
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 20000 });
  const shellReady = await page.evaluate(() => document.documentElement.dataset.tahaiShellReady || '');
  if (shellReady !== '1') fail('renderer shell did not report ready');

  await page.locator('#address').fill('https://example.com');
  await page.locator('#address').press('Enter');
  await page.waitForTimeout(2500);
  const initialUrl = await webviewEval(page, 'location.href');
  if (!String(initialUrl || '').includes('example.com')) fail(`expected example.com, got ${initialUrl || 'empty'}`);

  await installReloadCounter(page);
  const reloadSteps = [
    { label: 'Ctrl+R', key: 'Control+R' },
    { label: 'F5', key: 'F5' },
    { label: 'Ctrl+F5', key: 'Control+F5' },
    { label: 'Ctrl+Shift+R', key: 'Control+Shift+R' }
  ];
  let reloadCount = await readReloadCount(page);
  for (const step of reloadSteps) {
    await clickWebviewStage(page);
    await page.keyboard.press(step.key);
    await page.waitForTimeout(1400);
    const nextCount = await readReloadCount(page);
    if (nextCount <= reloadCount) fail(`${step.label} did not reload the active webview`);
    reloadCount = nextCount;
    const currentUrl = await webviewEval(page, 'location.href');
    if (!String(currentUrl || '').includes('example.com')) fail(`${step.label} changed the page unexpectedly (${currentUrl || 'empty'})`);
  }

  await clickWebviewStage(page);
  await page.keyboard.press('Alt+D');
  await page.waitForTimeout(250);
  let shell = await readShellState(page);
  if (!shell.addressFocused || !shell.addressSelected) fail('Alt+D did not focus and select the address bar');

  await clickWebviewStage(page);
  await page.keyboard.press('Control+L');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (!shell.addressFocused || !shell.addressSelected) fail('Ctrl+L did not focus and select the address bar');

  await page.keyboard.press('Control+T');
  await page.waitForTimeout(450);
  shell = await readShellState(page);
  if (shell.tabCount !== 2 || !shell.addressFocused || !shell.addressSelected) fail('Ctrl+T did not open a new tab and focus the address bar');

  await page.keyboard.press('Control+T');
  await page.waitForTimeout(450);
  shell = await readShellState(page);
  if (shell.tabCount !== 3 || !shell.addressFocused || !shell.addressSelected) fail('second Ctrl+T did not open a second new tab and focus the address bar');

  const cycleBefore = shell.activeIndex;
  await page.keyboard.press('Control+Tab');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.activeIndex === cycleBefore) fail('Ctrl+Tab did not change the active tab');

  await page.keyboard.press('Control+Shift+Tab');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.activeIndex !== cycleBefore) fail('Ctrl+Shift+Tab did not return to the prior tab');

  await page.keyboard.press('Control+1');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.activeIndex !== 0) fail('Ctrl+1 did not activate the first tab');

  await page.keyboard.press('Control+9');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.activeIndex !== shell.tabCount - 1) fail('Ctrl+9 did not activate the last tab');

  await page.keyboard.press('Control+W');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.tabCount !== 2 || shell.activeIndex < 0) fail('Ctrl+W did not close the active tab safely');

  await page.keyboard.press('Control+W');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.tabCount !== 1 || shell.activeIndex !== 0) fail('second Ctrl+W did not leave a sane single-tab state');

  await page.keyboard.press('Control+W');
  await page.waitForTimeout(500);
  shell = await readShellState(page);
  if (shell.tabCount < 1 || shell.activeIndex < 0) fail('final Ctrl+W left the browser with no active tab');

  await page.keyboard.press('Control+K');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (!shell.commandOpen || !shell.commandFocused) fail('Ctrl+K did not open and focus the command palette');
  if (!shell.commandRows.length) fail('command palette rendered no commands');
  const safeCommandIndex = shell.commandRows.findIndex((row) => /next tab|previous tab|new tab/i.test(row.text));
  if (safeCommandIndex < 0) fail('command palette did not expose a safe browser-tab action for the Enter smoke');
  const commandBefore = shell.lastCommand;
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);
  let commandState = await readShellState(page);
  if (!commandState.commandRows.some((row) => row.active)) fail('ArrowDown did not change the selected command');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);
  commandState = await readShellState(page);
  if (!commandState.commandRows.some((row) => row.active)) fail('ArrowUp did not keep a selected command active');
  for (let index = 0; index < safeCommandIndex; index += 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(30);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  shell = await readShellState(page);
  if (shell.commandOpen) fail('Enter did not close the command palette');
  if (shell.lastCommand === commandBefore) fail('Enter did not execute the selected command');
  if (shell.overlay === 'command-palette') fail('Enter left the command palette overlay behind');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  shell = await readShellState(page);
  if (shell.commandOpen || shell.overlay) fail('Escape did not leave the shell clean after command execution');

  shell = await openSettings(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  shell = await readShellState(page);
  if (shell.settingsOpen || shell.overlay) fail('Escape did not close Settings cleanly');

  shell = await openProfile(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  shell = await readShellState(page);
  if (shell.profileOpen || shell.overlay) fail('Escape did not close Profile cleanly');

  shell = await openMission(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  shell = await readShellState(page);
  if (shell.missionOpen || shell.overlay) fail('Escape did not close Mission Control cleanly');

  const activeWebview = await activeWebviewHandle(page);
  if (!activeWebview) fail('missing active webview after modal smoke');
  await activeWebview.evaluate((webview) => webview.executeJavaScript(`(() => {
    window.__uxSmokeClicks = 0;
    window.__uxSmokeClicksInstalled = true;
    window.addEventListener('click', () => { window.__uxSmokeClicks += 1; }, true);
    return window.__uxSmokeClicks;
  })()`, true));
  const beforeClick = await webviewEval(page, 'Number(window.__uxSmokeClicks || 0)');
  const stage = await page.locator('#webview-stage').boundingBox();
  if (!stage) fail('webview stage missing');
  await page.mouse.click(stage.x + (stage.width / 2), stage.y + (stage.height / 2));
  await page.waitForTimeout(300);
  const afterClick = await webviewEval(page, 'Number(window.__uxSmokeClicks || 0)');
  if (!(Number(afterClick) > Number(beforeClick))) fail('active page did not receive a click after overlays closed');

  await page.locator('#address').click();
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+F');
  await page.waitForTimeout(250);
  shell = await readShellState(page);
  if (shell.findHidden) fail('Ctrl+F did not open the find bar');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  shell = await readShellState(page);
  if (!shell.findHidden || shell.overlay) fail('Escape did not close the find bar cleanly');

  await page.keyboard.press('Control+L');
  await page.waitForTimeout(200);
  shell = await readShellState(page);
  if (!shell.addressFocused || !shell.addressSelected) fail('Ctrl+L did not focus/select the address bar after overlay close');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
  const tabAway = await readShellState(page);
  if (tabAway.activeElementId === 'address') fail('Tab did not move focus away from the address bar');
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(100);
  const tabBack = await readShellState(page);
  if (!tabBack.addressFocused) fail('Shift+Tab did not return focus to the address bar');

  console.log('BROWSER_UX_PARITY=PASS');
} catch (error) {
  fail(error instanceof Error ? error.stack || error.message : String(error || 'unknown error'));
} finally {
  try {
    await app.close();
  } catch {
    /* best-effort shutdown */
  }
}
