#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const root = process.cwd();
const mainDist = path.join(root, 'dist', 'main', 'main.js');
const outDir = path.join(root, 'release-candidate', 'generated');
const resultPath = path.join(outDir, 'pass244-mission-control-overlap-closeout-report.json');
const summaryPath = path.join(outDir, 'pass244-mission-control-overlap-closeout-summary.md');

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function fail(message, details = []) {
  console.error('PASS244_MISSION_CONTROL_OVERLAP_CLOSEOUT=FAIL');
  console.error(message);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  }));
}

async function waitFor(page, predicate, message, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await sleep(120);
  }
  throw new Error(message);
}

async function waitForDialog(page, selector, open, timeoutMs = 5000) {
  return waitFor(
    page,
    () => page.evaluate(({ targetSelector, shouldBeOpen }) => {
      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLDialogElement)) return false;
      return element.open === shouldBeOpen;
    }, { targetSelector: selector, shouldBeOpen: open }),
    `${selector} did not become ${open ? 'open' : 'closed'}`,
    timeoutMs,
  );
}

async function setWindowState(electronApp, state) {
  return electronApp.evaluate(({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return null;
    if (win.isMinimized()) win.restore();
    if (payload.maximized) {
      if (!win.isMaximized()) win.maximize();
    } else {
      if (win.isMaximized()) win.unmaximize();
      if (payload.bounds) win.setBounds(payload.bounds);
    }
    win.show();
    win.focus();
    return {
      bounds: win.getBounds(),
      maximized: win.isMaximized(),
      minimized: win.isMinimized(),
    };
  }, state);
}

async function openMissionControl(page) {
  const missionDialogOpen = await page.evaluate(() => {
    const dialog = document.getElementById('mission-dialog');
    return dialog instanceof HTMLDialogElement && dialog.open;
  });
  if (!missionDialogOpen) {
    await page.locator('#mission-control-toggle').click();
    await waitForDialog(page, '#mission-dialog', true, 8000);
  }
  await settle(page);
}

async function ensureSelectedRecipe(page) {
  const selectedCount = await page.locator('#mission-recipes .mission-recipe-card.pass254-selected-recipe, #mission-recipes .mission-recipe-card[aria-selected="true"]').count();
  if (selectedCount > 0) return;
  await page.evaluate(() => {
    const card = document.querySelector('#mission-recipes .mission-recipe-card');
    if (card instanceof HTMLElement) card.click();
  });
  await waitFor(page, () => page.evaluate(() => Boolean(document.querySelector('#mission-recipes .mission-recipe-card.pass254-selected-recipe, #mission-recipes .mission-recipe-card[aria-selected="true"]'))), 'Mission recipe did not become selected', 6000);
  await settle(page);
}

async function measureMissionRecipes(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#mission-recipes');
    if (!(container instanceof HTMLElement)) return { error: 'missing mission-recipes container' };

    container.scrollTop = 0;
    container.scrollLeft = 0;

    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 1000) / 1000,
        top: Math.round(rect.top * 1000) / 1000,
        right: Math.round(rect.right * 1000) / 1000,
        bottom: Math.round(rect.bottom * 1000) / 1000,
        width: Math.round(rect.width * 1000) / 1000,
        height: Math.round(rect.height * 1000) / 1000,
      };
    };

    const cards = Array.from(container.querySelectorAll('.mission-recipe-card')).map((card, index) => {
      const actionRow = card.querySelector('.pass254-recipe-actions');
      const actionRect = actionRow instanceof HTMLElement ? rectOf(actionRow) : null;
      const buttons = actionRow
        ? Array.from(actionRow.querySelectorAll('button')).map((button) => ({
            text: (button.textContent || '').trim(),
            disabled: button instanceof HTMLButtonElement ? button.disabled : false,
            rect: rectOf(button),
          }))
        : [];

      return {
        index,
        id: card.getAttribute('data-mission-recipe-id') || card.getAttribute('data-recipe-id') || '',
        selected: card.classList.contains('pass254-selected-recipe') || card.getAttribute('aria-selected') === 'true',
        text: (card.querySelector('.ops-hub-recipe-title')?.textContent || card.textContent || '').trim().slice(0, 160),
        rect: rectOf(card),
        actionRect,
        buttons,
      };
    });

    return {
      viewport: {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      },
      containerRect: rectOf(container),
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      cards,
    };
  });
}

function within(outer, inner, tolerance = 1) {
  return inner.left >= outer.left - tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.bottom <= outer.bottom + tolerance;
}

function analyzeGeometry(snapshot) {
  const errors = [];
  const visibleCards = snapshot.cards.filter((card) => card.rect.width > 0 && card.rect.height > 0);
  const sorted = visibleCards.slice().sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  if (!sorted.length) errors.push('no visible mission recipe cards were measured');

  for (const card of sorted) {
    if (card.actionRect && !within(card.rect, card.actionRect)) {
      errors.push(`action row escapes card ${card.id || card.index}: card=${JSON.stringify(card.rect)} actions=${JSON.stringify(card.actionRect)}`);
    }
    for (const button of card.buttons) {
      if (!within(card.rect, button.rect)) {
        errors.push(`button escapes card ${card.id || card.index}: "${button.text}" card=${JSON.stringify(card.rect)} button=${JSON.stringify(button.rect)}`);
      }
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const overlapX = Math.min(prev.rect.right, curr.rect.right) - Math.max(prev.rect.left, curr.rect.left);
    const overlapY = Math.min(prev.rect.bottom, curr.rect.bottom) - Math.max(prev.rect.top, curr.rect.top);
    if (overlapX > 1 && overlapY > 1) {
      errors.push(`cards overlap: ${prev.id || prev.index} ${JSON.stringify(prev.rect)} vs ${curr.id || curr.index} ${JSON.stringify(curr.rect)}`);
    }
  }

  return { errors, visibleCards: sorted };
}

async function runViewportCase(electronApp, page, caseDef) {
  const windowState = await setWindowState(electronApp, caseDef);
  await settle(page);
  await openMissionControl(page);
  await ensureSelectedRecipe(page);
  await page.evaluate(() => {
    const container = document.querySelector('#mission-recipes');
    if (container instanceof HTMLElement) container.scrollTop = 0;
  });
  await settle(page);
  const snapshot = await measureMissionRecipes(page);
  const analysis = analyzeGeometry(snapshot);
  return {
    case: caseDef.name,
    windowState,
    snapshot,
    analysis,
  };
}

function summaryMarkdown(report) {
  const lines = [
    '# PASS244 Mission Recipes Geometry Closeout',
    '',
    `- Result: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- Generated At: ${report.generatedAt}`,
    '',
  ];
  for (const entry of report.cases) {
    lines.push(`## ${entry.case}`);
    lines.push('');
    lines.push(`- Viewport: ${entry.snapshot.viewport.width}x${entry.snapshot.viewport.height}`);
    lines.push(`- Result: ${entry.analysis.errors.length ? 'FAIL' : 'PASS'}`);
    lines.push(`- Visible recipe cards: ${entry.analysis.visibleCards.length}`);
    lines.push(`- Scroll: ${entry.snapshot.scrollTop} / ${entry.snapshot.scrollHeight}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(outDir, { recursive: true });

const pkg = JSON.parse(readText(path.join(root, 'package.json')));
const css = readText(path.join(root, 'src/renderer/styles/mission-control.css'));

const staticChecks = [
  ['pass357_marker', css.includes('PASS357 — Mission Recipes structural bleed elimination')],
  ['flex_column_container', css.includes('#mission-recipes {\n  display: flex !important;') && css.includes('flex-direction: column !important;')],
  ['static_actions_row', css.includes('#mission-recipes .pass254-recipe-actions {') && css.includes('position: static !important;') && css.includes('margin-top: auto !important;')],
  ['buttons_wrap_inside_card', css.includes('#mission-recipes .pass254-recipe-actions > button {') && css.includes('flex: 1 1 160px !important;')],
  ['package_script_present', typeof pkg.scripts?.['verify:pass-244-mission-control-overlap-closeout'] === 'string'],
];

for (const [name, ok] of staticChecks) {
  console.log(`PASS244_STATIC_${String(name).toUpperCase()}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) {
    fail('PASS244 static contract failed before runtime geometry checks.', [name]);
  }
}

if (!fs.existsSync(mainDist)) {
  fail('dist/main/main.js missing. Run npm run build before PASS244.', [mainDist]);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-pass244-mission-recipes-'));
const runId = `pass244-${Date.now()}-${process.pid}`;
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

try {
  await waitFor(page, () => page.evaluate(() => document.documentElement.dataset.tahaiShellReady === '1'), 'TAHAI shell did not initialize', 18000);
  const defaultBounds = await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win ? win.getBounds() : null;
  });
  ensure(defaultBounds && Number(defaultBounds.width) > 0 && Number(defaultBounds.height) > 0, 'Could not determine the default window bounds.');

  const cases = [
    { name: 'restored-default', bounds: { width: defaultBounds.width, height: defaultBounds.height } },
    { name: 'maximized', maximized: true },
    { name: '1366x768', bounds: { width: 1366, height: 768 } },
  ];

  const results = [];
  for (const caseDef of cases) {
    results.push(await runViewportCase(electronApp, page, caseDef));
  }

  const failingCase = results.find((entry) => entry.analysis.errors.length > 0);
  const report = {
    pass: 'PASS244',
    name: 'Mission Recipes Geometry Closeout',
    generatedAt: new Date().toISOString(),
    ok: !failingCase,
    consoleNoise,
    pageErrors,
    cases: results,
  };

  fs.writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(summaryPath, summaryMarkdown(report), 'utf8');

  if (failingCase) {
    console.error('PASS244_MISSION_CONTROL_OVERLAP_CLOSEOUT=FAIL');
    console.error(`Viewport ${failingCase.case} failed geometry checks.`);
    for (const error of failingCase.analysis.errors) console.error(`- ${error}`);
    console.error(`PASS244_RESULT=${rel(resultPath)}`);
    console.error(`PASS244_SUMMARY=${rel(summaryPath)}`);
    process.exit(1);
  }

  console.log('PASS244_MISSION_CONTROL_OVERLAP_CLOSEOUT=PASS');
  for (const entry of results) {
    console.log(`PASS244_${entry.case.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_VISIBLE_CARDS=${entry.analysis.visibleCards.length}`);
    console.log(`PASS244_${entry.case.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_VIEWPORT=${entry.snapshot.viewport.width}x${entry.snapshot.viewport.height}`);
  }
  console.log(`PASS244_RESULT=${rel(resultPath)}`);
  console.log(`PASS244_SUMMARY=${rel(summaryPath)}`);
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error || 'unknown PASS244 failure');
  try {
    const failureReport = {
      pass: 'PASS244',
      name: 'Mission Recipes Geometry Closeout',
      generatedAt: new Date().toISOString(),
      ok: false,
      consoleNoise,
      pageErrors,
      error: message,
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(failureReport, null, 2)}\n`, 'utf8');
    fs.writeFileSync(summaryPath, summaryMarkdown({ ok: false, generatedAt: failureReport.generatedAt, cases: [] }), 'utf8');
  } catch {
    /* best-effort evidence */
  }
  fail(message, [resultPath, summaryPath]);
} finally {
  try {
    await electronApp.close();
  } catch {
    /* best-effort close */
  }
}
