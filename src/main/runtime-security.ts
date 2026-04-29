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

export async function hardenSession(ses: Session): Promise<void> {
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    const settings = readBrowserSettings();
    const allowed = new Set<string>();
    if (settings.permissions.allowClipboardRead) allowed.add('clipboard-read');
    if (settings.permissions.allowMedia) allowed.add('media');
    if (settings.permissions.allowGeolocation) allowed.add('geolocation');
    if (settings.permissions.allowNotifications) allowed.add('notifications');
    allowed.add('fullscreen');
    callback(allowed.has(permission));
  });

  ses.webRequest.onBeforeRequest((details, callback) => {
    const blockedProtocols = ['ftp:', 'gopher:', 'javascript:', 'data:'];
    try {
      const protocol = new URL(details.url).protocol;
      callback({ cancel: blockedProtocols.includes(protocol) });
    } catch {
      callback({ cancel: true });
    }
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
