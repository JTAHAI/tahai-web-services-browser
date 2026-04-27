import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_HOME_URL, readBrowserSettings, writeBrowserSettings } from './settings';

export type FirstLaunchState = {
  product: string;
  defaultHome: string;
  initializedAt: string;
  sourceGuardrails: string[];
};

const SOURCE_GUARDRAILS = [
  'No TAHAI OS source in this repo',
  'No SENTINEL source in this repo',
  'No Prefrontal Node source in this repo',
  'No API keys, provider secrets, runtime memory, build outputs, installers, temp files, or logs in source zips'
];

function markerPath(): string {
  return path.join(app.getPath('userData'), 'first-run.json');
}

export function runFirstLaunchChecks(): FirstLaunchState {
  const current = readBrowserSettings();
  if (!current.homeUrl || current.homeUrl === 'about:blank') {
    writeBrowserSettings({ ...current, homeUrl: DEFAULT_HOME_URL });
  }

  const marker = markerPath();
  if (fs.existsSync(marker)) {
    try {
      const existing = JSON.parse(fs.readFileSync(marker, 'utf8')) as FirstLaunchState;
      if (existing.product === 'TAHAI Web Services Browser') return existing;
    } catch {
      // Rewrite corrupt marker below.
    }
  }

  const state: FirstLaunchState = {
    product: 'TAHAI Web Services Browser',
    defaultHome: DEFAULT_HOME_URL,
    initializedAt: new Date().toISOString(),
    sourceGuardrails: SOURCE_GUARDRAILS
  };
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}
