import { app, BrowserWindow, dialog, Session, WebContents } from 'electron';
import path from 'node:path';
import { readBrowserSettings } from './settings';

function safeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim() || 'download';
}

function defaultDownloadPath(filename: string): string {
  const settings = readBrowserSettings();
  const base = settings.downloads.defaultDirectory || app.getPath('downloads');
  return path.join(base, safeFilename(filename));
}

function ownerWindowFrom(webContents: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(webContents) || BrowserWindow.getFocusedWindow() || undefined;
}

function allowedPermission(permission: string): boolean {
  const settings = readBrowserSettings();
  const allowed = new Set<string>();
  if (settings.permissions.allowClipboardRead) allowed.add('clipboard-read');
  if (settings.permissions.allowMedia) allowed.add('media');
  if (settings.permissions.allowGeolocation) allowed.add('geolocation');
  if (settings.permissions.allowNotifications) allowed.add('notifications');
  allowed.add('fullscreen');
  return allowed.has(permission);
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
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowedPermission(permission));
  });

  ses.setPermissionCheckHandler((_webContents, permission) => allowedPermission(permission));

  ses.webRequest.onBeforeRequest((details, callback) => {
    const blockedProtocols = ['ftp:', 'gopher:', 'javascript:', 'data:', 'vbscript:'];
    try {
      const protocol = new URL(details.url).protocol;
      callback({ cancel: blockedProtocols.includes(protocol) });
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

  ses.on('will-download', (event, item, webContents) => {
    const settings = readBrowserSettings();
    const filename = safeFilename(item.getFilename());
    if (!settings.downloads.askEveryTime) {
      item.setSavePath(defaultDownloadPath(filename));
      return;
    }

    item.pause();
    const saveOptions = {
      title: 'Save download',
      defaultPath: defaultDownloadPath(filename),
      buttonLabel: 'Save'
    };
    const ownerWindow = ownerWindowFrom(webContents);
    const saveDialog = ownerWindow ? dialog.showSaveDialog(ownerWindow, saveOptions) : dialog.showSaveDialog(saveOptions);
    void saveDialog.then((result) => {
      if (result.canceled || !result.filePath) {
        item.cancel();
        webContents.send('tahai-browser:download-state', { state: 'cancelled', filename });
        return;
      }
      item.setSavePath(result.filePath);
      item.resume();
      webContents.send('tahai-browser:download-state', { state: 'started', filename, path: result.filePath });
    }).catch(() => {
      item.cancel();
      webContents.send('tahai-browser:download-state', { state: 'cancelled', filename });
    });

    item.once('done', (_event, state) => {
      webContents.send('tahai-browser:download-state', { state, filename, path: item.getSavePath() });
    });
  });

  await ses.setSpellCheckerLanguages(['en-US']);
}
