import { app, BrowserWindow, dialog, Session, WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { readBrowserSettings } from './settings';
import { evaluateBrowserPermissionRequest } from '../shared/permission-boundary';
import type { BrowserDownloadState } from '../shared/download-boundary';
import { createDownloadStatePayload, downloadRiskWarning, sanitizeDownloadFilename } from '../shared/download-boundary';
import { TAHAI_BLOCKED_RUNTIME_PROTOCOLS, isTrustedTahaiRendererEventChannel } from '../shared/electron-security-contract';

function safeDownloadDirectory(value: unknown): string {
  const fallback = app.getPath('downloads');
  const candidate = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!candidate || !path.isAbsolute(candidate)) return fallback;
  try {
    if (!fsExistsDirectory(candidate)) return fallback;
    return candidate;
  } catch {
    return fallback;
  }
}

function fsExistsDirectory(candidate: string): boolean {
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
}

function defaultDownloadPath(filename: string): string {
  const settings = readBrowserSettings();
  const base = safeDownloadDirectory(settings.downloads.defaultDirectory);
  return path.join(base, sanitizeDownloadFilename(filename));
}

function sanitizeSelectedDownloadPath(selectedPath: string, fallbackFilename: string): string {
  const dir = path.dirname(selectedPath);
  const chosenName = path.basename(selectedPath) || fallbackFilename;
  return path.join(dir, sanitizeDownloadFilename(chosenName, fallbackFilename));
}

function sendDownloadState(target: WebContents, payload: BrowserDownloadState): void {
  const ownerWindow = ownerWindowFrom(target);
  const windows = ownerWindow ? [ownerWindow] : BrowserWindow.getAllWindows();
  const channel = 'tahai-browser:download-state';
  if (!isTrustedTahaiRendererEventChannel(channel)) return;
  for (const window of windows) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

function ownerWindowFrom(webContents: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(webContents) || BrowserWindow.getFocusedWindow() || undefined;
}

function permissionDetailValue(details: unknown, key: string): unknown {
  if (!details || typeof details !== 'object') return undefined;
  return (details as Record<string, unknown>)[key];
}

function permissionRequestOrigin(webContents: WebContents | null | undefined, details?: unknown): string {
  const candidates = [
    permissionDetailValue(details, 'requestingUrl'),
    permissionDetailValue(details, 'requestingOrigin'),
    permissionDetailValue(details, 'securityOrigin'),
    permissionDetailValue(details, 'embeddingOrigin'),
    permissionDetailValue(details, 'origin'),
    permissionDetailValue(details, 'url')
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value;
  }
  try {
    if (webContents && !webContents.isDestroyed()) return webContents.getURL();
  } catch {
    return '';
  }
  return '';
}

function allowedPermission(permission: string, origin: string): boolean {
  const settings = readBrowserSettings();
  return evaluateBrowserPermissionRequest(permission, origin, settings.permissions).ok;
}

function originHostname(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw).hostname.toLowerCase(); } catch { return ''; }
}

function requestHostname(value: unknown): string {
  try { return new URL(String(value || '')).hostname.toLowerCase(); } catch { return ''; }
}

function isThirdPartyRequest(details: Electron.OnBeforeSendHeadersListenerDetails): boolean {
  const targetHost = requestHostname(details.url);
  const firstPartyHost = originHostname((details as any).firstPartyUrl || (details as any).initiator || (details as any).referrer || '');
  if (!targetHost || !firstPartyHost) return false;
  return targetHost !== firstPartyHost && !targetHost.endsWith(`.${firstPartyHost}`) && !firstPartyHost.endsWith(`.${targetHost}`);
}

export async function hardenSession(ses: Session): Promise<void> {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = permissionRequestOrigin(webContents, details);
    callback(allowedPermission(permission, origin));
  });

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const origin = permissionRequestOrigin(webContents, { ...(details && typeof details === 'object' ? details : {}), requestingOrigin });
    return allowedPermission(permission, origin);
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    try {
      const protocol = new URL(details.url).protocol;
      callback({ cancel: (TAHAI_BLOCKED_RUNTIME_PROTOCOLS as readonly string[]).includes(protocol) });
    } catch {
      callback({ cancel: true });
    }
  });

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const settings = readBrowserSettings();
    const requestHeaders = { ...(details.requestHeaders || {}) };
    if (settings.privacy.sendDoNotTrack) {
      requestHeaders.DNT = '1';
      requestHeaders['Sec-GPC'] = '1';
    }
    if (settings.privacy.reduceCrossSiteReferrers && isThirdPartyRequest(details)) {
      delete requestHeaders.Referer;
      delete requestHeaders.referer;
    }
    if (settings.privacy.blockThirdPartyCookies && isThirdPartyRequest(details)) {
      delete requestHeaders.Cookie;
      delete requestHeaders.cookie;
    }
    callback({ requestHeaders });
  });

  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    responseHeaders['X-TAHAI-Browser'] = ['TAHAI Web Services Browser'];
    callback({ responseHeaders });
  });

  ses.on('will-download', (_event, item, webContents) => {
    const settings = readBrowserSettings();
    const filename = sanitizeDownloadFilename(item.getFilename());
    const sourceUrl = item.getURL();
    const warning = downloadRiskWarning(filename, item.getMimeType());
    if (!settings.downloads.askEveryTime) {
      item.setSavePath(defaultDownloadPath(filename));
      sendDownloadState(webContents, createDownloadStatePayload({ state: 'started', filename, sourceUrl, warning, detail: 'Saving to configured downloads folder. Local path hidden from renderer.' }));
    } else {
      item.pause();
      const saveOptions = {
        title: 'Save download',
        defaultPath: defaultDownloadPath(filename),
        buttonLabel: 'Save',
        message: warning || 'TAHAI Browser hides local filesystem paths from remote download state events.'
      };
      const ownerWindow = ownerWindowFrom(webContents);
      const saveDialog = ownerWindow ? dialog.showSaveDialog(ownerWindow, saveOptions) : dialog.showSaveDialog(saveOptions);
      void saveDialog.then((result) => {
        if (result.canceled || !result.filePath) {
          item.cancel();
          sendDownloadState(webContents, createDownloadStatePayload({ state: 'cancelled', filename, sourceUrl, warning }));
          return;
        }
        item.setSavePath(sanitizeSelectedDownloadPath(result.filePath, filename));
        item.resume();
        sendDownloadState(webContents, createDownloadStatePayload({ state: 'started', filename, sourceUrl, warning, detail: 'Saved to selected location. Local path hidden from renderer.' }));
      }).catch(() => {
        item.cancel();
        sendDownloadState(webContents, createDownloadStatePayload({ state: 'cancelled', filename, sourceUrl, warning }));
      });
    }

    item.once('done', (_event, state) => {
      sendDownloadState(webContents, createDownloadStatePayload({ state, filename, sourceUrl, warning, detail: state === 'completed' ? 'Download completed. Local path hidden from renderer.' : 'Download ended without exposing local path.' }));
    });
  });

  await ses.setSpellCheckerLanguages(['en-US']);
}
