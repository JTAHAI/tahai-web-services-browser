#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const root = process.cwd();
const mainDist = path.join(root, 'dist', 'main', 'main.js');
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const appPath = root;

function fail(message) {
  console.error(`BROWSER_CORE_HOTFIX_FAIL: ${message}`);
  process.exit(1);
}

async function readState(page) {
  return page.evaluate(() => ({
    shellReady: document.documentElement.dataset.tahaiShellReady || '',
    findHidden: document.getElementById('find-bar')?.hidden ?? true,
    findStatus: document.getElementById('find-status')?.textContent || '',
    missionOpen: document.getElementById('mission-dialog') instanceof HTMLDialogElement && document.getElementById('mission-dialog').open,
    activeOverlay: document.body.dataset.pass116ActiveOverlay || '',
  }));
}

async function activeWebviewHandle(page) {
  const handle = await page.evaluateHandle(() => {
    const views = Array.from(document.querySelectorAll('webview.browser-view'));
    const active = views.find((view) => view.classList.contains('active') || view.getAttribute('data-active') === 'true');
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

async function installClickCounter(page, key = '__tahaiCoreHotfixClickCount') {
  await webviewEval(page, `(() => {
    if (!window.${key}Installed) {
      window.${key}Installed = true;
      window.${key} = 0;
      window.addEventListener('click', () => { window.${key} += 1; }, true);
    }
    return true;
  })()`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-core-hotfix-'));
const app = await electron.launch({
  executablePath: electronExe,
  args: [appPath],
  cwd: root,
  env: {
    TAHAI_BROWSER_USER_DATA_SUFFIX: `core-hotfix-${Date.now()}`,
    TAHAI_BROWSER_DISABLE_SINGLE_INSTANCE_LOCK: '1',
    TAHAI_BROWSER_RUNTIME_DIAGNOSTICS: '1',
    ELECTRON_ENABLE_LOGGING: '1',
    XDG_CONFIG_HOME: path.join(tempDir, 'xdg-config'),
    XDG_CACHE_HOME: path.join(tempDir, 'xdg-cache'),
  },
});

let page;
try {
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded', { timeoutMs: 20000 });
  await page.waitForLoadState('load', { timeoutMs: 20000 });
  const shell = await readState(page);
  if (shell.shellReady !== '1') fail('renderer shell did not report ready');

  await page.locator('#address').fill('https://example.com');
  await page.locator('#address').press('Enter');
  await page.waitForTimeout(2500);
  const pageUrl = await webviewEval(page, 'location.href');
  if (!String(pageUrl || '').includes('example.com')) fail(`expected example.com, got ${pageUrl || 'empty'}`);

  await installClickCounter(page);
  const clickBefore = await webviewEval(page, 'Number(window.__tahaiCoreHotfixClickCount || 0)');
  const stageBox = await page.locator('#webview-stage').boundingBox();
  if (!stageBox) fail('webview stage is missing');
  await page.mouse.click(stageBox.x + (stageBox.width / 2), stageBox.y + (stageBox.height / 2));
  await page.waitForTimeout(350);
  const clickAfter = await webviewEval(page, 'Number(window.__tahaiCoreHotfixClickCount || 0)');
  if (!(Number(clickAfter) > Number(clickBefore))) fail('active page did not receive a click');

  await page.keyboard.press('Control+F');
  await page.waitForTimeout(300);
  let findState = await readState(page);
  if (findState.findHidden) fail('Ctrl+F did not open the find bar');
  await page.locator('#find-input').fill('Example');
  await page.waitForTimeout(600);
  findState = await readState(page);
  if (!/next|1\/\d+/i.test(findState.findStatus)) fail(`find bar did not search the page (${findState.findStatus || 'empty'})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  findState = await readState(page);
  if (!/^\d+\/\d+$/.test(findState.findStatus) && !/^\d+\s*\/\s*\d+$/.test(findState.findStatus)) fail(`Enter did not advance find results (${findState.findStatus || 'empty'})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  findState = await readState(page);
  if (!findState.findHidden || findState.findStatus !== 'Ready') fail('Escape did not close and reset find bar');

  await page.locator('#address').fill('https://browser.tahai.net');
  await page.locator('#address').press('Enter');
  await page.waitForTimeout(2500);
  const forwardUrl = await webviewEval(page, 'location.href');
  if (!String(forwardUrl || '').includes('browser.tahai.net')) fail(`expected browser.tahai.net, got ${forwardUrl || 'empty'}`);
  await page.locator('#back').click();
  await page.waitForTimeout(1000);
  const backUrl = await webviewEval(page, 'location.href');
  if (!String(backUrl || '').includes('example.com')) fail(`toolbar back failed (${backUrl || 'empty'})`);
  await page.locator('#forward').click();
  await page.waitForTimeout(1000);
  const forwardUrl2 = await webviewEval(page, 'location.href');
  if (!String(forwardUrl2 || '').includes('browser.tahai.net')) fail(`toolbar forward failed (${forwardUrl2 || 'empty'})`);

  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no BrowserWindow available');
    win.emit('app-command', { preventDefault() {} }, 'browser-backward');
  });
  await page.waitForTimeout(800);
  const mouseBackUrl = await webviewEval(page, 'location.href');
  if (!String(mouseBackUrl || '').includes('example.com')) fail(`mouse back route failed (${mouseBackUrl || 'empty'})`);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('no BrowserWindow available');
    win.emit('app-command', { preventDefault() {} }, 'browser-forward');
  });
  await page.waitForTimeout(800);
  const mouseForwardUrl = await webviewEval(page, 'location.href');
  if (!String(mouseForwardUrl || '').includes('browser.tahai.net')) fail(`mouse forward route failed (${mouseForwardUrl || 'empty'})`);

  await page.locator('#mission-control-toggle').click();
  await page.waitForTimeout(400);
  findState = await readState(page);
  if (!findState.missionOpen || findState.activeOverlay !== 'mission-control') fail('Mission Control did not open cleanly');
  await page.locator('#mission-name').click();
  await page.locator('#mission-name').fill('Core hotfix smoke mission');
  await page.locator('#close-mission').click();
  await page.waitForTimeout(700);
  findState = await readState(page);
  if (findState.missionOpen || findState.activeOverlay) fail('Mission Control did not close cleanly');
  await installClickCounter(page);
  await webviewEval(page, 'window.__tahaiCoreHotfixClickCount = 0; true');
  const clickBeforeMission = await webviewEval(page, 'Number(window.__tahaiCoreHotfixClickCount || 0)');
  const stageBox2 = await page.locator('#webview-stage').boundingBox();
  if (!stageBox2) fail('webview stage missing after Mission Control close');
  await page.mouse.click(stageBox2.x + (stageBox2.width / 2), stageBox2.y + (stageBox2.height / 2));
  await page.waitForTimeout(350);
  await page.bringToFront();
  await page.waitForTimeout(100);
  const clickAfterMission = await webviewEval(page, 'Number(window.__tahaiCoreHotfixClickCount || 0)');
  if (!(Number(clickAfterMission) > Number(clickBeforeMission))) fail('page clicks were blocked after Mission Control closed');

  await page.locator('#address').click();
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+F');
  await page.waitForTimeout(300);
  findState = await readState(page);
  if (findState.findHidden) fail('Ctrl+F did not still work after Mission Control close');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  console.log('BROWSER_CORE_HOTFIX=PASS');
} catch (error) {
  fail(error instanceof Error ? error.stack || error.message : String(error || 'unknown error'));
} finally {
  try { await app.close(); } catch {}
}
