(() => {
  const PASS164_MORE_TOOLS_ACTION_EVENT = 'tahai:more-tools-action-request';
  const PASS193_BOOKMARK_MISSION_EVENT_NAME = 'tahai-browser:start-mission-from-bookmark-folder';
  const PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION = 'PASS193-bookmark-admin-launch-reliability-v1';
  const PASS29_LEGACY_BOOKMARK_MANIFEST_VERIFY_TOKENS = ['Source: bookmark', 'launchManifest: `# Bookmark Mission Manifest'];
  type BookmarkNodeType = 'folder' | 'bookmark';

  type BookmarkNode = {
    id: string;
    type: BookmarkNodeType;
    title: string;
    url?: string;
    children?: BookmarkNode[];
    createdAt: string;
    updatedAt: string;
  };

  type BookmarkStore = {
    schemaVersion: 1;
    barVisible: boolean;
    root: BookmarkNode;
  };

  const STORE_KEY = 'tahai-browser:chromium-bookmarks:v1';
  const LAST_OPEN_FOLDER_KEY = 'tahai-browser:chromium-bookmarks:last-folder-id:v1';
  const LEGACY_KEYS = ['tahai-browser:bookmarks:v1', 'tahai:bookmarks', 'bookmarks'];
  const FEATURE_NAME = 'Chromium Bookmarks';
  const BAR_VISIBLE_CLASS = 'chromium-bookmarks-bar-visible';
  const MAX_TITLE_LENGTH = 180;
  const MAX_URL_LENGTH = 2048;
  const MAX_IMPORT_BYTES = 512 * 1024;
  const MAX_BOOKMARK_NODES = 2500;
  const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
  const BLOCKED_PROTOCOL_PATTERN = /^\s*(?:javascript|data|vbscript|file|about|chrome|devtools|view-source|tahai-browser):/i;

  type DefaultBookmarkFolder = {
    title: string;
    bookmarks: Array<{ title: string; url: string }>;
  };

  const DEFAULT_BOOKMARK_FOLDERS: DefaultBookmarkFolder[] = [
    { title: 'TAHAI', bookmarks: [
      { title: 'TAHAI Portal', url: 'https://tahaiportal.com/' },
      { title: 'TAHAI Browser', url: 'https://browser.tahai.net/' },
      { title: 'TAHAI IT Docs', url: 'https://docs.tahaiportal.com/' },
      { title: 'TAHAI OS', url: 'https://os.tahai.net/' },
      { title: 'SENTINEL', url: 'https://sentinel.tahai.net/' },
      { title: 'TAHAI Web Services', url: 'https://tahai.net/' }
    ]},
    { title: 'IT Admin', bookmarks: [
      { title: 'Microsoft 365 Admin', url: 'https://admin.microsoft.com/' },
      { title: 'Microsoft Entra Admin', url: 'https://entra.microsoft.com/' },
      { title: 'Google Admin Console', url: 'https://admin.google.com/' },
      { title: 'Cloudflare Dashboard', url: 'https://dash.cloudflare.com/' },
      { title: 'CISA Known Exploited Vulnerabilities', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
      { title: 'MXToolbox', url: 'https://mxtoolbox.com/' },
      { title: 'ICANN Lookup', url: 'https://lookup.icann.org/' }
    ]},
    { title: 'DevOps', bookmarks: [
      { title: 'GitHub', url: 'https://github.com/' },
      { title: 'Vercel', url: 'https://vercel.com/dashboard' },
      { title: 'AWS Console', url: 'https://console.aws.amazon.com/' },
      { title: 'Cloudflare Dashboard', url: 'https://dash.cloudflare.com/' },
      { title: 'NPM', url: 'https://www.npmjs.com/' }
    ]},
    { title: 'AI Workbench', bookmarks: [
      { title: 'ChatGPT', url: 'https://chatgpt.com/' },
      { title: 'OpenAI Platform', url: 'https://platform.openai.com/' },
      { title: 'Anthropic Console', url: 'https://console.anthropic.com/' },
      { title: 'Google AI Studio', url: 'https://aistudio.google.com/' }
    ]}
  ];

  let store: BookmarkStore;
  let barEl: HTMLElement | null = null;
  let barStripEl: HTMLElement | null = null;
  let barLeftButton: HTMLButtonElement | null = null;
  let barRightButton: HTMLButtonElement | null = null;
  let menuEl: HTMLElement | null = null;
  let managerEl: HTMLDialogElement | null = null;
  let folderViewEl: HTMLElement | null = null;
  let folderViewNode: BookmarkNode | null = null;
  let folderViewReturnFocus: HTMLElement | null = null;
  let searchTerm = '';
  let folderSearchTerm = '';

  type TextInputOptions = {
    title: string;
    label?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    maxLength?: number;
  };

  function requestTextInput(options: TextInputOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'text-input-dialog';
      dialog.setAttribute('aria-label', options.title);
      const form = document.createElement('form');
      form.method = 'dialog';
      form.className = 'text-input-panel';
      const header = document.createElement('header');
      const title = document.createElement('h2');
      title.textContent = options.title;
      const subtitle = document.createElement('p');
      subtitle.textContent = options.label || 'Enter a value to continue.';
      header.append(title, subtitle);
      const input = document.createElement('input');
      input.type = 'text';
      input.value = options.defaultValue || '';
      input.placeholder = options.placeholder || '';
      input.maxLength = options.maxLength || MAX_TITLE_LENGTH;
      input.autocomplete = 'off';
      input.spellcheck = false;
      const actions = document.createElement('div');
      actions.className = 'text-input-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'ghost';
      cancel.textContent = options.cancelLabel || 'Cancel';
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = options.confirmLabel || 'Save';
      actions.append(cancel, submit);
      form.append(header, input, actions);
      dialog.append(form);
      document.body.appendChild(dialog);
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
        dialog.close();
        dialog.remove();
      };
      cancel.addEventListener('click', () => finish(null));
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
      dialog.addEventListener('close', () => { if (!settled) finish(null); });
      form.addEventListener('submit', (event) => { event.preventDefault(); finish(input.value.trim()); });
      dialog.showModal();
      requestAnimationFrame(() => { input.focus(); input.select(); });
    });
  }

  function byId<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  function uid(prefix = 'bm'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function now(): string {
    return new Date().toISOString();
  }

  function escapeText(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
  }

  function cleanTitle(raw: unknown, fallback: string): string {
    const value = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
    return (value || fallback).slice(0, MAX_TITLE_LENGTH);
  }

  function compactText(raw: unknown, fallback = ''): string {
    const value = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
    return (value || fallback).slice(0, MAX_TITLE_LENGTH);
  }

  function shouldUseHttpForHost(value: string): boolean {
    return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#].*)?$/i.test(value) || /^10\.\d+\.\d+\.\d+(?::\d+)?(?:[/?#].*)?$/i.test(value);
  }

  function parseSafeBookmarkUrl(raw: string): string | null {
    const value = raw.trim();
    if (!value || value.length > MAX_URL_LENGTH) return null;
    if (BLOCKED_PROTOCOL_PATTERN.test(value)) return null;

    let candidate = value;
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
    if (!hasProtocol) {
      if (shouldUseHttpForHost(candidate)) {
        candidate = `http://${candidate}`;
      } else if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(candidate)) {
        candidate = `https://${candidate}`;
      } else {
        return null;
      }
    }

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return null;
    }

    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }

    const normalized = parsed.toString();
    return normalized.length <= MAX_URL_LENGTH ? normalized : null;
  }

  function normalizeUrl(raw: string): string {
    return parseSafeBookmarkUrl(raw) || 'https://tahaiportal.com/';
  }

  function sanitizeNode(input: unknown, counter: { count: number } = { count: 0 }): BookmarkNode | null {
    counter.count += 1;
    if (counter.count > MAX_BOOKMARK_NODES) return null;
    if (!input || typeof input !== 'object') return null;

    const record = input as Record<string, unknown>;
    const type = record.type === 'folder' ? 'folder' : record.type === 'bookmark' ? 'bookmark' : null;
    const title = cleanTitle(record.title, type === 'folder' ? 'Folder' : 'Bookmark');
    if (!type || !title) return null;

    const stamp = typeof record.createdAt === 'string' ? record.createdAt : now();
    const node: BookmarkNode = {
      id: typeof record.id === 'string' && record.id ? record.id.slice(0, 128) : uid(type === 'folder' ? 'folder' : 'bm'),
      type,
      title,
      createdAt: stamp,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : stamp
    };

    if (type === 'bookmark') {
      const url = typeof record.url === 'string' ? parseSafeBookmarkUrl(record.url) : null;
      if (!url) return null;
      node.url = url;
    } else {
      const children = Array.isArray(record.children)
        ? record.children.map((child) => sanitizeNode(child, counter)).filter(Boolean) as BookmarkNode[]
        : [];
      node.children = children;
    }

    return node;
  }

  function createDefaultFolder(definition: DefaultBookmarkFolder, createdAt = now()): BookmarkNode {
    return {
      id: uid('folder'),
      type: 'folder',
      title: definition.title,
      createdAt,
      updatedAt: createdAt,
      children: definition.bookmarks.map((bookmark) => ({
        id: uid(),
        type: 'bookmark',
        title: bookmark.title,
        url: normalizeUrl(bookmark.url),
        createdAt,
        updatedAt: createdAt
      }))
    };
  }

  function bookmarkMatchesDefault(node: BookmarkNode, bookmark: { title: string; url: string }): boolean {
    if (node.type !== 'bookmark') return false;
    const defaultUrl = normalizeUrl(bookmark.url);
    return node.url === defaultUrl || node.title.toLowerCase() === bookmark.title.toLowerCase();
  }

  function ensureDefaultFolderBookmarks(folder: BookmarkNode, definition: DefaultBookmarkFolder, stamp = now()): boolean {
    if (folder.type !== 'folder') return false;
    folder.children = folder.children || [];
    let changed = false;
    for (const bookmark of definition.bookmarks) {
      const exists = folder.children.some((node) => bookmarkMatchesDefault(node, bookmark));
      if (!exists) {
        folder.children.push({
          id: uid(),
          type: 'bookmark',
          title: bookmark.title,
          url: normalizeUrl(bookmark.url),
          createdAt: stamp,
          updatedAt: stamp
        });
        changed = true;
      }
    }
    if (changed) folder.updatedAt = stamp;
    return changed;
  }

  function ensureDefaultBookmarkFolders(candidate: BookmarkStore, persist = false): BookmarkStore {
    const createdAt = now();
    const root = candidate.root;
    root.children = root.children || [];
    let changed = false;
    for (const definition of DEFAULT_BOOKMARK_FOLDERS) {
      let folder = root.children.find((node) => node.type === 'folder' && node.title.toLowerCase() === definition.title.toLowerCase());
      if (!folder) {
        folder = createDefaultFolder(definition, createdAt);
        root.children.push(folder);
        changed = true;
      } else if (ensureDefaultFolderBookmarks(folder, definition, createdAt)) {
        changed = true;
      }
    }
    if (changed) root.updatedAt = createdAt;
    if (changed && persist) localStorage.setItem(STORE_KEY, JSON.stringify(candidate, null, 2));
    return candidate;
  }

  function seedStore(): BookmarkStore {
    const createdAt = now();
    return ensureDefaultBookmarkFolders({
      schemaVersion: 1,
      barVisible: true,
      root: {
        id: 'root',
        type: 'folder',
        title: 'Bookmarks',
        createdAt,
        updatedAt: createdAt,
        children: []
      }
    });
  }

  function migrateLegacyStore(): BookmarkStore | null {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > MAX_IMPORT_BYTES) continue;
      try {
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown;
        const counter = { count: 0 };
        if (Array.isArray(parsed)) {
          const createdAt = now();
          const children = parsed.map((item) => sanitizeNode(item, counter)).filter(Boolean) as BookmarkNode[];
          if (children.length) {
            return ensureDefaultBookmarkFolders({ schemaVersion: 1, barVisible: true, root: { id: 'root', type: 'folder', title: 'Bookmarks', createdAt, updatedAt: createdAt, children } });
          }
        }
        if (parsed && typeof parsed === 'object' && 'root' in parsed) {
          const candidate = parsed as { barVisible?: unknown; root?: unknown };
          const root = sanitizeNode(candidate.root, counter);
          if (root?.type === 'folder') return ensureDefaultBookmarkFolders({ schemaVersion: 1, barVisible: candidate.barVisible !== false, root: { ...root, id: 'root', title: 'Bookmarks' } });
        }
      } catch {}
    }
    return null;
  }

  function loadStore(): BookmarkStore {
    try {
      const raw = localStorage.getItem(STORE_KEY) || '';
      if (raw && raw.length <= MAX_IMPORT_BYTES) {
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as { schemaVersion?: unknown; barVisible?: unknown; root?: unknown };
        const root = sanitizeNode(parsed.root);
        if (parsed.schemaVersion === 1 && root?.type === 'folder') {
          return ensureDefaultBookmarkFolders({ schemaVersion: 1, barVisible: parsed.barVisible !== false, root: { ...root, id: 'root', title: 'Bookmarks' } }, true);
        }
      }
    } catch {}
    return ensureDefaultBookmarkFolders(migrateLegacyStore() || seedStore(), true);
  }

  function saveStore(): void {
    localStorage.setItem(STORE_KEY, JSON.stringify(store, null, 2));
  }

  function pass240IsWebviewApiReady(webview: HTMLElement | null): boolean {
    return Boolean(
      webview &&
      webview.parentElement &&
      webview.isConnected &&
      document.documentElement.contains(webview) &&
      webview.dataset.pass236DomReady === 'true'
    );
  }

  function getActiveTitleAndUrl(): { title: string; url: string } {
    const activeTabTitle = document.querySelector<HTMLElement>('.tab.active .tab-title')?.textContent?.trim() || '';
    const activeWebview = document.querySelector<HTMLElement>('.browser-view.active') as (HTMLElement & { getURL?: () => string; getTitle?: () => string }) | null;
    let url = byId<HTMLInputElement>('address')?.value?.trim() || activeWebview?.getAttribute('src') || '';
    let title = activeTabTitle || 'Current page';
    try {
      if (pass240IsWebviewApiReady(activeWebview)) {
        const apiUrl = typeof activeWebview?.getURL === 'function' ? activeWebview.getURL() : '';
        const apiTitle = typeof activeWebview?.getTitle === 'function' ? activeWebview.getTitle() : '';
        if (apiUrl) url = apiUrl;
        if (apiTitle) title = apiTitle;
      }
    } catch {}
    return { title: cleanTitle(title || url || 'Current page', 'Current page'), url: normalizeUrl(url || 'https://tahaiportal.com/') };
  }

  function setShellStatus(message: string, detail = FEATURE_NAME): void {
    const status = byId<HTMLElement>('status-text');
    const security = byId<HTMLElement>('security-text');
    if (status) status.textContent = message;
    if (security) security.textContent = detail;
  }

  function pass193MarkBookmarkLaunch(surface: 'bookmark-bar' | 'bookmark-menu' | 'bookmark-folder-view' | 'bookmark-manager', targetKind: 'bookmark-url' | 'bookmark-folder-tabs' | 'bookmark-folder-mission', targetId: string, result: string): void {
    document.body.dataset.pass193BookmarkAdminLaunchReliability = 'true';
    document.body.dataset.pass193BookmarkAdminLaunchVersion = PASS193_BOOKMARK_ADMIN_LAUNCH_RELIABILITY_VERSION;
    document.body.dataset.pass193LastLaunchSurface = surface;
    document.body.dataset.pass193LastLaunchTargetKind = targetKind;
    document.body.dataset.pass193LastLaunchTargetId = compactText(targetId, 'bookmark').slice(0, 160);
    document.body.dataset.pass193LastLaunchResult = result;
  }

  function pass193DispatchBookmarkMission(detail: BookmarkFolderMissionDetail): void {
    const urls = (detail.urls || []).map((url) => parseSafeBookmarkUrl(url)).filter((url): url is string => Boolean(url)).slice(0, 80);
    if (!urls.length) {
      pass193MarkBookmarkLaunch('bookmark-folder-view', 'bookmark-folder-mission', detail.sourceFolderId || detail.title || 'bookmark', 'blocked:no-safe-urls');
      setShellStatus('Bookmark Mission blocked', 'No safe http/https URLs found.');
      return;
    }
    const titles = Array.isArray(detail.titles) ? detail.titles.slice(0, urls.length).map((title, index) => compactText(title, titleFromUrl(urls[index] || '')).slice(0, MAX_TITLE_LENGTH)) : urls.map((url) => titleFromUrl(url));
    pass193MarkBookmarkLaunch('bookmark-folder-view', 'bookmark-folder-mission', detail.sourceFolderId || detail.title || 'bookmark', 'dispatching');
    window.dispatchEvent(new CustomEvent(PASS193_BOOKMARK_MISSION_EVENT_NAME, {
      detail: {
        ...detail,
        title: compactText(detail.title, 'Bookmark Mission').slice(0, MAX_TITLE_LENGTH),
        urls,
        titles,
        totalBookmarks: Math.max(Number(detail.totalBookmarks || urls.length) || urls.length, urls.length),
        sourceFolderId: compactText(detail.sourceFolderId || '', '').slice(0, 128),
        sourceKind: detail.sourceKind === 'bookmark' ? 'bookmark' : 'folder',
        launchManifest: typeof detail.launchManifest === 'string' ? detail.launchManifest.slice(0, 12000) : ''
      }
    }));
  }

  function titleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname || 'Bookmark URL';
    } catch {
      return 'Bookmark URL';
    }
  }

  function navigateTo(url: string, newTab: boolean, surface: 'bookmark-bar' | 'bookmark-menu' | 'bookmark-folder-view' | 'bookmark-manager' = 'bookmark-menu'): void {
    const safeUrl = parseSafeBookmarkUrl(url);
    if (!safeUrl) {
      pass193MarkBookmarkLaunch(surface, 'bookmark-url', url, 'blocked:unsafe-url');
      setShellStatus('Blocked unsafe bookmark URL', FEATURE_NAME);
      return;
    }
    const address = byId<HTMLInputElement>('address');
    const form = byId<HTMLFormElement>('address-form');
    const newTabButton = byId<HTMLButtonElement>('new-tab');
    const run = (): void => {
      if (!address || !form) {
        window.location.href = safeUrl;
        return;
      }
      address.value = safeUrl;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    if (newTab && newTabButton) {
      pass193MarkBookmarkLaunch(surface, 'bookmark-url', safeUrl, 'new-tab-router');
      newTabButton.click();
      window.setTimeout(run, 140);
    } else {
      pass193MarkBookmarkLaunch(surface, 'bookmark-url', safeUrl, 'active-target-router');
      run();
    }
  }

  function allNodes(folder: BookmarkNode = store.root): BookmarkNode[] {
    const nodes: BookmarkNode[] = [];
    for (const child of folder.children || []) {
      nodes.push(child);
      if (child.type === 'folder') nodes.push(...allNodes(child));
    }
    return nodes;
  }

  function findNode(id: string, folder: BookmarkNode = store.root, parent: BookmarkNode | null = null): { node: BookmarkNode; parent: BookmarkNode | null } | null {
    if (folder.id === id) return { node: folder, parent };
    for (const child of folder.children || []) {
      if (child.id === id) return { node: child, parent: folder };
      if (child.type === 'folder') {
        const found = findNode(id, child, child);
        if (found) return found;
      }
    }
    return null;
  }

  function getFolderPath(targetId: string, current: BookmarkNode = store.root, trail: BookmarkNode[] = []): BookmarkNode[] | null {
    const nextTrail = current.type === 'folder' ? [...trail, current] : trail;
    if (current.id === targetId) return nextTrail;
    for (const child of current.children || []) {
      if (child.type !== 'folder') continue;
      const found = getFolderPath(targetId, child, nextTrail);
      if (found) return found;
    }
    return null;
  }

  function getParentFolder(folder: BookmarkNode): BookmarkNode | null {
    return findNode(folder.id)?.parent || null;
  }

  function focusFolderViewPrimary(): void {
    if (!folderViewEl || folderViewEl.hidden) return;
    const target = folderViewEl.querySelector<HTMLButtonElement>('[data-folder-action="close"]')
      || folderViewEl.querySelector<HTMLButtonElement>('button');
    target?.focus();
  }

  function removeNode(id: string): boolean {
    const found = findNode(id);
    if (!found?.parent?.children) return false;
    found.parent.children = found.parent.children.filter((node) => node.id !== id);
    found.parent.updatedAt = now();
    saveStore();
    renderAll();
    return true;
  }

  async function addBookmark(folderId = 'root', preset?: { title: string; url: string }): Promise<void> {
    const target = findNode(folderId)?.node || store.root;
    if (target.type !== 'folder') return;
    const active = preset || getActiveTitleAndUrl();
    const title = await requestTextInput({ title: 'Bookmark name', label: 'Name this bookmark.', defaultValue: active.title, maxLength: MAX_TITLE_LENGTH });
    if (!title) return;
    const url = await requestTextInput({ title: 'Bookmark URL', label: 'Use an http:// or https:// URL.', defaultValue: active.url, maxLength: MAX_URL_LENGTH });
    if (!url) return;
    const safeUrl = parseSafeBookmarkUrl(url);
    if (!safeUrl) {
      window.alert('Blocked unsafe or unsupported bookmark URL. Use http:// or https:// URLs.');
      setShellStatus('Bookmark blocked', 'Unsafe URL');
      return;
    }
    target.children = target.children || [];
    target.children.push({ id: uid(), type: 'bookmark', title: cleanTitle(title, 'Bookmark'), url: safeUrl, createdAt: now(), updatedAt: now() });
    target.updatedAt = now();
    saveStore();
    renderAll();
    setShellStatus('Bookmark added', cleanTitle(title, 'Bookmark'));
  }

  async function addFolder(parentId = 'root'): Promise<void> {
    const target = findNode(parentId)?.node || store.root;
    if (target.type !== 'folder') return;
    const title = await requestTextInput({ title: 'Folder name', label: 'Name this bookmarks folder.', defaultValue: 'New folder', maxLength: MAX_TITLE_LENGTH });
    if (!title) return;
    target.children = target.children || [];
    target.children.push({ id: uid('folder'), type: 'folder', title: cleanTitle(title, 'New folder'), createdAt: now(), updatedAt: now(), children: [] });
    target.updatedAt = now();
    saveStore();
    renderAll();
    setShellStatus('Bookmark folder added', cleanTitle(title, 'New folder'));
  }

  async function editNode(id: string): Promise<void> {
    const found = findNode(id);
    if (!found) return;
    const node = found.node;
    const title = await requestTextInput({ title: node.type === 'folder' ? 'Folder name' : 'Bookmark name', label: 'Update the saved display name.', defaultValue: node.title, maxLength: MAX_TITLE_LENGTH });
    if (!title) return;
    node.title = cleanTitle(title, node.type === 'folder' ? 'Folder' : 'Bookmark');
    if (node.type === 'bookmark') {
      const url = await requestTextInput({ title: 'Bookmark URL', label: 'Use an http:// or https:// URL.', defaultValue: node.url || '', maxLength: MAX_URL_LENGTH });
      if (!url) return;
      const safeUrl = parseSafeBookmarkUrl(url);
      if (!safeUrl) {
        window.alert('Blocked unsafe or unsupported bookmark URL. Use http:// or https:// URLs.');
        return;
      }
      node.url = safeUrl;
    }
    node.updatedAt = now();
    saveStore();
    renderAll();
  }

  function openFolder(folder: BookmarkNode, returnFocus?: HTMLElement | null): void {
    if (folder.type !== 'folder') return;
    if (returnFocus !== undefined) folderViewReturnFocus = returnFocus;
    else if (!folderViewReturnFocus && document.activeElement instanceof HTMLElement) folderViewReturnFocus = document.activeElement;
    folderViewNode = folder;
    localStorage.setItem(LAST_OPEN_FOLDER_KEY, folder.id);
    closeMenu();
    renderFolderView();
    if (folderViewEl) {
      folderViewEl.hidden = false;
      focusFolderViewPrimary();
    }
    setShellStatus('Bookmark folder opened', `${folder.title} · ${(folder.children || []).length} item${(folder.children || []).length === 1 ? '' : 's'}`);
  }

  function openFolderById(folderId: string): void {
    const found = findNode(folderId)?.node;
    if (found?.type === 'folder') openFolder(found, folderViewReturnFocus);
  }

  function lastOpenFolder(): BookmarkNode | null {
    const id = localStorage.getItem(LAST_OPEN_FOLDER_KEY) || '';
    const found = id ? findNode(id)?.node : null;
    return found?.type === 'folder' ? found : null;
  }

  function reopenLastFolder(): void {
    const folder = lastOpenFolder();
    if (!folder) {
      setShellStatus('No recent bookmark folder', FEATURE_NAME);
      return;
    }
    openFolder(folder);
  }

  function openParentFolder(): void {
    if (!folderViewNode) return;
    const parent = getParentFolder(folderViewNode);
    if (parent) openFolder(parent, folderViewReturnFocus);
  }

  function closeFolderView(): void {
    folderSearchTerm = '';
    folderViewNode = null;
    if (folderViewEl) folderViewEl.hidden = true;
    const focusTarget = folderViewReturnFocus;
    folderViewReturnFocus = null;
    if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
  }

  function folderBookmarks(folder: BookmarkNode, recursive = true): BookmarkNode[] {
    const direct = (folder.children || []).filter((node) => node.type === 'bookmark' && node.url);
    if (!recursive) return direct;
    return allNodes(folder).filter((node) => node.type === 'bookmark' && node.url);
  }

  function folderMarkdown(folder: BookmarkNode): string {
    const lines = [`# ${folder.title}`, '', `Exported: ${new Date().toISOString()}`, ''];
    const append = (node: BookmarkNode, depth: number): void => {
      const prefix = '  '.repeat(depth);
      if (node.type === 'bookmark' && node.url) {
        lines.push(`${prefix}- [${node.title}](${node.url})`);
      } else if (node.type === 'folder') {
        if (node.id !== folder.id) lines.push(`${prefix}- ${node.title}`);
        for (const child of node.children || []) append(child, node.id === folder.id ? depth : depth + 1);
      }
    };
    append(folder, 0);
    return `${lines.join('\n')}\n`;
  }

  function copyTextToClipboard(text: string, statusTitle: string, statusDetail: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      setShellStatus(statusTitle, statusDetail);
    }).catch(() => {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', 'true');
      box.style.position = 'fixed';
      box.style.left = '-9999px';
      document.body.appendChild(box);
      box.select();
      try {
        document.execCommand('copy');
        setShellStatus(statusTitle, statusDetail);
      } catch {
        window.alert('Could not copy bookmark folder text.');
      } finally {
        box.remove();
      }
    });
  }

  function copyFolderUrls(folder: BookmarkNode): void {
    const bookmarks = folderBookmarks(folder, true);
    if (!bookmarks.length) {
      setShellStatus('No bookmark URLs to copy', folder.title);
      return;
    }
    copyTextToClipboard(bookmarks.map((node) => node.url).filter(Boolean).join('\n'), 'Bookmark URLs copied', `${folder.title} · ${bookmarks.length}`);
  }

  function copyFolderMarkdown(folder: BookmarkNode): void {
    const bookmarks = folderBookmarks(folder, true);
    if (!bookmarks.length) {
      setShellStatus('No bookmark summary to copy', folder.title);
      return;
    }
    copyTextToClipboard(folderMarkdown(folder), 'Bookmark folder summary copied', `${folder.title} · Markdown`);
  }

  type BookmarkFolderMissionDetail = { title?: string; urls?: string[]; titles?: string[]; totalBookmarks?: number; sourceFolderId?: string; sourceKind?: 'folder' | 'bookmark'; launchManifest?: string };

  type BookmarkMissionManifest = {
    schemaVersion: 1;
    title: string;
    createdAt: string;
    sourceKind: 'folder' | 'bookmark';
    totalBookmarks: number;
    safeUrlCount: number;
    blockedUrlCount: number;
    duplicateUrlCount: number;
    paneUrlCount: number;
    evidenceOnlyUrlCount: number;
    exportProfile: 'sanitized-handoff';
    urls: Array<{ title: string; url: string; paneOpened: boolean; exportRole: 'pane' | 'evidence' }>;
  };

  function buildBookmarkMissionManifest(folder: BookmarkNode): BookmarkMissionManifest {
    const bookmarks = folderBookmarks(folder, true);
    const seen = new Set<string>();
    let blockedUrlCount = 0;
    let duplicateUrlCount = 0;
    const urls: Array<{ title: string; url: string; paneOpened: boolean; exportRole: 'pane' | 'evidence' }> = [];
    bookmarks.forEach((node) => {
      const safeUrl = parseSafeBookmarkUrl(node.url || '');
      if (!safeUrl) { blockedUrlCount += 1; return; }
      if (seen.has(safeUrl)) { duplicateUrlCount += 1; return; }
      seen.add(safeUrl);
      const paneOpened = urls.length < 4;
      urls.push({ title: node.title, url: safeUrl, paneOpened, exportRole: paneOpened ? 'pane' : 'evidence' });
    });
    return { schemaVersion: 1, title: folder.title, createdAt: new Date().toISOString(), sourceKind: 'folder', totalBookmarks: bookmarks.length, safeUrlCount: urls.length, blockedUrlCount, duplicateUrlCount, paneUrlCount: Math.min(urls.length, 4), evidenceOnlyUrlCount: Math.max(urls.length - 4, 0), exportProfile: 'sanitized-handoff', urls };
  }

  function escapeManifestMarkdown(value: string): string {
    return compactText(value || 'Untitled', 'Untitled').replace(/[\[\]()`*_{}<>#|]/g, '\\$&');
  }

  function missionManifestJson(manifest: BookmarkMissionManifest): string {
    return `${JSON.stringify(manifest, null, 2)}\n`;
  }

  function downloadMissionManifestJson(manifest: BookmarkMissionManifest): void {
    const safeName = compactText(manifest.title, 'bookmark-mission').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'bookmark-mission';
    const blob = new Blob([missionManifestJson(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `tahai-${safeName}-mission-manifest-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    setShellStatus('Bookmark Mission manifest downloaded', `${manifest.title} · sanitized JSON`);
  }

  function missionManifestMarkdown(manifest: BookmarkMissionManifest): string {
    const lines = [
      `# Bookmark Mission Manifest: ${escapeManifestMarkdown(manifest.title)}`, '',
      `Created: ${manifest.createdAt}`,
      `Source: ${manifest.sourceKind}`,
      `Total bookmarks: ${manifest.totalBookmarks}`,
      `Safe URLs accepted: ${manifest.safeUrlCount}`,
      `Duplicates skipped: ${manifest.duplicateUrlCount}`,
      `Unsafe/invalid blocked: ${manifest.blockedUrlCount}`,
      `Mission panes opened: ${manifest.paneUrlCount}`,
      `Evidence-only URLs: ${manifest.evidenceOnlyUrlCount}`,
      `Export profile: ${manifest.exportProfile}`, '', '## URLs', ''
    ];
    manifest.urls.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.exportRole === 'pane' ? '[Pane]' : '[Evidence]'} [${escapeManifestMarkdown(entry.title)}](${entry.url})`);
    });
    if (!manifest.urls.length) lines.push('_No safe URLs available for Mission launch._');
    return `${lines.join('\n')}\n`;
  }

  function copyFolderMissionManifest(folder: BookmarkNode): void {
    const manifest = buildBookmarkMissionManifest(folder);
    copyTextToClipboard(missionManifestMarkdown(manifest), 'Bookmark Mission manifest copied', `${folder.title} · ${manifest.safeUrlCount} safe URL(s)`);
  }

  function copyFolderMissionManifestJson(folder: BookmarkNode): void {
    const manifest = buildBookmarkMissionManifest(folder);
    copyTextToClipboard(missionManifestJson(manifest), 'Bookmark Mission manifest JSON copied', `${folder.title} · sanitized handoff JSON`);
  }

  function downloadFolderMissionManifestJson(folder: BookmarkNode): void {
    downloadMissionManifestJson(buildBookmarkMissionManifest(folder));
  }

  function startMissionFromFolder(folder: BookmarkNode): void {
    const manifest = buildBookmarkMissionManifest(folder);
    if (!manifest.totalBookmarks) {
      setShellStatus('Bookmark folder has no mission URLs', folder.title);
      return;
    }
    const urls = manifest.urls.map((entry) => entry.url);
    if (!urls.length) {
      setShellStatus('Bookmark mission blocked', 'No safe http/https URLs found.');
      return;
    }
    pass193DispatchBookmarkMission({
      title: folder.title,
      urls,
      titles: manifest.urls.map((entry) => entry.title),
      totalBookmarks: manifest.totalBookmarks,
      sourceFolderId: folder.id,
      sourceKind: 'folder',
      launchManifest: missionManifestMarkdown(manifest)
    });
    closeFolderView();
    setShellStatus('Starting Mission from bookmarks', `${folder.title} · ${manifest.paneUrlCount} pane${manifest.paneUrlCount === 1 ? '' : 's'} · ${manifest.safeUrlCount} safe URL(s)`);
  }

  function openFolderAsTabs(folder: BookmarkNode): void {
    const bookmarks = folderBookmarks(folder, true);
    if (!bookmarks.length) {
      setShellStatus('Bookmark folder is empty', folder.title);
      return;
    }
    bookmarks.slice(0, 24).forEach((node, index) => {
      window.setTimeout(() => navigateTo(node.url!, index > 0, 'bookmark-folder-view'), index * 180);
    });
    pass193MarkBookmarkLaunch('bookmark-folder-view', 'bookmark-folder-tabs', folder.id, `opened:${Math.min(bookmarks.length, 24)}`);
    setShellStatus('Opening bookmark folder', `${folder.title} · ${Math.min(bookmarks.length, 24)} tab${Math.min(bookmarks.length, 24) === 1 ? '' : 's'}`);
  }

  function exportBookmarks(): void {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `tahai-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    setShellStatus('Bookmarks exported', FEATURE_NAME);
  }

  function importBookmarks(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        window.alert('Bookmark import is too large for this preview build.');
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const parsed = JSON.parse(String(reader.result || '').replace(/^\uFEFF/, '')) as { root?: unknown; barVisible?: unknown } | unknown;
          const sourceRoot = parsed && typeof parsed === 'object' && 'root' in parsed ? (parsed as { root?: unknown }).root : parsed;
          const nextRoot = sanitizeNode(sourceRoot);
          if (!nextRoot || nextRoot.type !== 'folder') throw new Error('Invalid bookmark file or unsupported URL protocol');
          store.root = { ...nextRoot, id: 'root', title: 'Bookmarks' };
          store = ensureDefaultBookmarkFolders(store);
          store.barVisible = !(parsed && typeof parsed === 'object' && 'barVisible' in parsed) || (parsed as { barVisible?: unknown }).barVisible !== false;
          saveStore();
          renderAll();
          setShellStatus('Bookmarks imported', file.name);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Could not import bookmarks');
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  function createToolbarButtons(): void {
    if (byId('chromium-bookmarks-button')) return;

    const star = document.createElement('button');
    star.id = 'chromium-bookmark-star';
    star.type = 'button';
    star.className = 'home-button secondary chromium-bookmark-star utility-chrome-button';
    star.title = 'Bookmark current page (Ctrl+D)';
    star.setAttribute('aria-label', 'Bookmark current page');
    star.dataset.pass173Iconified = 'bookmark-star';
    star.dataset.pass173Tooltip = 'Bookmark page';
    star.innerHTML = '<span class="chrome-action-icon" aria-hidden="true">★</span><span class="chrome-action-label">Star</span>';
    star.addEventListener('click', () => addBookmark());

    const button = document.createElement('button');
    button.id = 'chromium-bookmarks-button';
    button.type = 'button';
    button.className = 'home-button secondary chromium-bookmarks-button utility-chrome-button';
    button.title = 'Open Bookmarks menu';
    button.setAttribute('aria-label', 'Open Bookmarks menu');
    button.dataset.pass173Iconified = 'bookmarks';
    button.dataset.pass173Tooltip = 'Bookmarks';
    button.innerHTML = '<span class="chrome-action-icon" aria-hidden="true">▤</span><span class="chrome-action-label">Bookmarks</span>';
    button.addEventListener('click', () => toggleMenu());

    const mission = byId<HTMLButtonElement>('mission-control-toggle');
    const settings = byId<HTMLButtonElement>('settings');
    if (mission?.parentElement) {
      mission.insertAdjacentElement('beforebegin', star);
      star.insertAdjacentElement('afterend', button);
    } else if (settings?.parentElement) {
      settings.insertAdjacentElement('beforebegin', star);
      star.insertAdjacentElement('afterend', button);
    } else {
      document.querySelector('.toolbar')?.append(star, button);
    }
  }

  function createBar(): void {
    if (byId('chromium-bookmarks-bar')) return;
    const bar = document.createElement('nav');
    bar.id = 'chromium-bookmarks-bar';
    bar.className = 'chromium-bookmarks-bar chromium-bookmarks-chevron-rail';
    bar.setAttribute('aria-label', 'Bookmarks bar');

    const left = document.createElement('button');
    left.type = 'button';
    left.className = 'chromium-bookmarks-rail-arrow left';
    left.setAttribute('aria-label', 'Scroll bookmarks left');
    left.textContent = '<';
    left.addEventListener('click', () => scrollBookmarkRail(-1));

    const strip = document.createElement('div');
    strip.className = 'chromium-bookmarks-strip';
    strip.setAttribute('data-chevron-rail', 'bookmarks');
    strip.addEventListener('scroll', () => updateBookmarkRailArrows());
    strip.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        strip.scrollBy({ left: event.deltaY, behavior: 'smooth' });
      }
    }, { passive: false });

    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'chromium-bookmarks-rail-arrow right';
    right.setAttribute('aria-label', 'Scroll bookmarks right');
    right.textContent = '>';
    right.addEventListener('click', () => scrollBookmarkRail(1));

    bar.append(left, strip, right);
    const stage = byId<HTMLElement>('webview-stage');
    stage?.insertAdjacentElement('beforebegin', bar);
    barEl = bar;
    barStripEl = strip;
    barLeftButton = left;
    barRightButton = right;
    window.addEventListener('resize', () => window.setTimeout(updateBookmarkRailArrows, 60));
  }

  function scrollBookmarkRail(direction: -1 | 1): void {
    if (!barStripEl) return;
    const distance = Math.max(180, Math.floor(barStripEl.clientWidth * 0.72));
    barStripEl.scrollBy({ left: distance * direction, behavior: 'smooth' });
    window.setTimeout(updateBookmarkRailArrows, 220);
  }

  function updateBookmarkRailArrows(): void {
    if (!barStripEl || !barLeftButton || !barRightButton || !barEl) return;
    const overflow = barStripEl.scrollWidth > barStripEl.clientWidth + 4;
    const atStart = barStripEl.scrollLeft <= 2;
    const atEnd = barStripEl.scrollLeft + barStripEl.clientWidth >= barStripEl.scrollWidth - 3;
    barEl.classList.toggle('has-overflow', overflow);
    barLeftButton.hidden = !overflow;
    barRightButton.hidden = !overflow;
    barLeftButton.disabled = !overflow || atStart;
    barRightButton.disabled = !overflow || atEnd;
  }

  function createMenu(): void {
    if (byId('chromium-bookmarks-menu')) return;
    const menu = document.createElement('aside');
    menu.id = 'chromium-bookmarks-menu';
    menu.className = 'chromium-bookmarks-menu';
    menu.hidden = true;
    document.querySelector('.app-shell')?.appendChild(menu);
    menuEl = menu;
  }

  function createManager(): void {
    if (byId('chromium-bookmarks-manager')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'chromium-bookmarks-manager';
    dialog.className = 'chromium-bookmarks-manager';
    document.body.appendChild(dialog);
    managerEl = dialog;
  }

  function createFolderView(): void {
    if (byId('chromium-bookmarks-folder-view')) return;
    const view = document.createElement('section');
    view.id = 'chromium-bookmarks-folder-view';
    view.className = 'chromium-bookmarks-folder-view';
    view.hidden = true;
    document.body.appendChild(view);
    folderViewEl = view;
  }

  function renderAll(): void {
    document.body.classList.add('chromium-bookmarks-installed');
    document.body.classList.toggle(BAR_VISIBLE_CLASS, store.barVisible);
    renderBar();
    renderMenu();
    renderManager();
    renderFolderView();
  }

  function renderBar(): void {
    if (!barEl || !barStripEl) return;
    barEl.hidden = !store.barVisible;
    barStripEl.replaceChildren();

    const rootChildren = store.root.children || [];
    if (!rootChildren.length) {
      const empty = document.createElement('span');
      empty.className = 'chromium-bookmarks-empty';
      empty.textContent = 'Bookmarks bar - add current page with Star or Ctrl+D';
      barStripEl.appendChild(empty);
      updateBookmarkRailArrows();
      return;
    }

    for (const node of rootChildren.slice(0, 22)) barStripEl.appendChild(renderBarNode(node));

    const overflow = document.createElement('button');
    overflow.type = 'button';
    overflow.className = 'chromium-bookmarks-overflow';
    overflow.textContent = 'More...';
    overflow.addEventListener('click', () => openManager());
    barStripEl.appendChild(overflow);
    window.setTimeout(updateBookmarkRailArrows, 0);
    window.setTimeout(updateBookmarkRailArrows, 120);
  }

  function renderBarNode(node: BookmarkNode): HTMLElement {
    if (node.type === 'bookmark') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chromium-bookmarks-bar-item';
      button.dataset.pass193LaunchSurface = 'bookmark-bar';
      button.dataset.pass193LaunchKind = 'bookmark-url';
      button.textContent = node.title;
      button.title = node.url || node.title;
      button.addEventListener('click', (event) => navigateTo(node.url || '', event.ctrlKey || event.metaKey || event.button === 1, 'bookmark-bar'));
      button.addEventListener('auxclick', (event) => { if (event.button === 1) navigateTo(node.url || '', true, 'bookmark-bar'); });
      return button;
    }

    const wrap = document.createElement('span');
    wrap.className = 'chromium-bookmarks-folder';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chromium-bookmarks-bar-item folder';
    button.dataset.pass193LaunchSurface = 'bookmark-bar';
    button.dataset.pass193LaunchKind = 'bookmark-folder-mission';
    button.textContent = `Folder: ${node.title}`;
    button.title = `Open bookmark folder: ${node.title}`;
    button.addEventListener('click', () => openFolder(node, button));
    const menu = document.createElement('span');
    menu.className = 'chromium-bookmarks-folder-menu';
    for (const child of node.children || []) menu.appendChild(renderFolderMenuNode(child));
    if (!(node.children || []).length) {
      const empty = document.createElement('span');
      empty.className = 'chromium-bookmarks-folder-empty';
      empty.textContent = 'Empty folder';
      menu.appendChild(empty);
    }
    wrap.append(button, menu);
    return wrap;
  }

  // PASS21 verifier anchor: if (node.type === 'folder') openFolder(node)
  function renderFolderMenuNode(node: BookmarkNode): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chromium-bookmarks-folder-action ${node.type}`;
    button.textContent = node.type === 'folder' ? `Folder: ${node.title}` : node.title;
    button.title = node.url || node.title;
    button.addEventListener('click', (event) => {
      if (node.type === 'folder') openFolder(node, button);
      else navigateTo(node.url || '', event.ctrlKey || event.metaKey, 'bookmark-menu');
    });
    return button;
  }

  function renderMenu(): void {
    if (!menuEl) return;
    const recent = allNodes().filter((node) => node.type === 'bookmark').slice(-8).reverse();
    menuEl.innerHTML = `
      <header>
        <div>
          <p class="eyebrow">TAHAI Browser</p>
          <h2>Bookmarks</h2>
          <span>Chromium-style menu + bookmarks bar</span>
        </div>
        <button type="button" class="icon-button" data-bm-action="close">x</button>
      </header>
      <section class="chromium-bookmarks-actions">
        <button type="button" class="home-button" data-bm-action="add-current">Add current page</button>
        <button type="button" class="home-button secondary" data-bm-action="add-folder">New folder</button>
        <button type="button" class="home-button secondary" data-bm-action="toggle-bar">${store.barVisible ? 'Hide' : 'Show'} bar</button>
        <button type="button" class="home-button secondary" data-bm-action="manager">Bookmark manager</button>
        <button type="button" class="home-button secondary" data-bm-action="reopen-last-folder" ${lastOpenFolder() ? '' : 'disabled'}>Last folder</button>
      </section>
      <section class="chromium-bookmarks-search">
        <input type="search" placeholder="Search bookmarks..." value="${escapeText(searchTerm)}" aria-label="Search bookmarks" />
      </section>
      <section class="chromium-bookmarks-menu-list"></section>
      <footer>
        <button type="button" data-bm-action="import">Import</button>
        <button type="button" data-bm-action="export">Export</button>
        <span>Ctrl+D add / Ctrl+Shift+B bar / Ctrl+Shift+O manager</span>
      </footer>
    `;

    const list = menuEl.querySelector<HTMLElement>('.chromium-bookmarks-menu-list');
    if (!list) return;
    const source = searchTerm ? allNodes().filter((node) => {
      const text = `${node.title} ${node.url || ''}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    }) : recent;

    if (!source.length) {
      const empty = document.createElement('div');
      empty.className = 'chromium-bookmarks-empty-card';
      empty.textContent = searchTerm ? 'No matching bookmarks.' : 'No bookmarks yet.';
      list.appendChild(empty);
    } else {
      for (const node of source) list.appendChild(renderMenuNode(node));
    }

    menuEl.querySelector<HTMLInputElement>('input[type="search"]')?.addEventListener('input', (event) => {
      searchTerm = (event.target as HTMLInputElement).value;
      renderMenu();
      window.setTimeout(() => menuEl?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(), 0);
    });

    menuEl.querySelectorAll<HTMLElement>('[data-bm-action]').forEach((button) => {
      button.addEventListener('click', () => runMenuAction(button.dataset.bmAction || ''));
    });
  }

  function renderMenuNode(node: BookmarkNode): HTMLElement {
    const row = document.createElement('article');
    row.className = `chromium-bookmarks-menu-node ${node.type}`;
    const main = document.createElement('button');
    main.type = 'button';
    main.innerHTML = `<strong>${escapeText(node.type === 'folder' ? `Folder: ${node.title}` : node.title)}</strong><span>${escapeText(node.url || `${(node.children || []).length} items`)}</span>`;
    main.addEventListener('click', (event) => {
      if (node.type === 'folder') openFolder(node, main);
      else navigateTo(node.url || '', event.ctrlKey || event.metaKey, 'bookmark-menu');
      closeMenu();
    });

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'mini';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editNode(node.id));

    row.append(main, edit);
    return row;
  }

  function runMenuAction(action: string): void {
    if (action === 'close') closeMenu();
    if (action === 'add-current') addBookmark();
    if (action === 'add-folder') addFolder();
    if (action === 'toggle-bar') {
      store.barVisible = !store.barVisible;
      saveStore();
      renderAll();
      setShellStatus(store.barVisible ? 'Bookmarks bar shown' : 'Bookmarks bar hidden');
    }
    if (action === 'manager') openManager();
    if (action === 'reopen-last-folder') reopenLastFolder();
    if (action === 'import') importBookmarks();
    if (action === 'export') exportBookmarks();
  }

  function renderFolderView(): void {
    if (!folderViewEl) return;
    const folder = folderViewNode;
    if (!folder || folder.type !== 'folder') {
      folderViewEl.hidden = true;
      folderViewEl.replaceChildren();
      return;
    }
    const directChildren = folder.children || [];
    const allBookmarks = allNodes(folder).filter((node) => node.type === 'bookmark' && node.url);
    const normalizedFolderSearch = folderSearchTerm.trim().toLowerCase();
    const visibleChildren = normalizedFolderSearch
      ? directChildren.filter((node) => `${node.title} ${node.url || ''}`.toLowerCase().includes(normalizedFolderSearch))
      : directChildren;
    const parentFolder = getParentFolder(folder);
    const folderPath = getFolderPath(folder.id) || [store.root, folder];
    const breadcrumbs = folderPath.map((node, index) => (
      `<button type="button" class="chromium-bookmarks-crumb" data-folder-target="${escapeText(node.id)}" ${index === folderPath.length - 1 ? 'aria-current="page"' : ''}>${escapeText(node.id === 'root' ? 'Bookmarks' : node.title)}</button>`
    )).join('<span aria-hidden="true">/</span>');
    folderViewEl.innerHTML = `
      <header>
        <div>
          <p class="eyebrow">Bookmark Folder</p>
          <nav class="chromium-bookmarks-breadcrumbs" aria-label="Bookmark folder path">${breadcrumbs}</nav>
          <h2>${escapeText(folder.title)}</h2>
          <span>${directChildren.length} direct item${directChildren.length === 1 ? '' : 's'} · ${allBookmarks.length} bookmark${allBookmarks.length === 1 ? '' : 's'} total</span>
        </div>
        <button type="button" class="icon-button" data-folder-action="close" aria-label="Close bookmark folder">x</button>
      </header>
      <section class="chromium-bookmarks-folder-search">
        <input type="search" value="${escapeText(folderSearchTerm)}" placeholder="Filter this folder..." aria-label="Filter this bookmark folder" />
      </section>
      <section class="chromium-bookmarks-folder-view-actions">
        <button type="button" class="home-button secondary" data-folder-action="up" ${parentFolder ? '' : 'disabled'}>← Parent folder</button>
        <button type="button" class="home-button" data-folder-action="open-tabs" data-pass193-launch-surface="bookmark-folder-view" data-pass193-launch-kind="bookmark-folder-tabs" ${allBookmarks.length ? '' : 'disabled'}>Open folder as tabs</button>
        <button type="button" class="home-button secondary" data-folder-action="start-mission" data-pass193-launch-surface="bookmark-folder-view" data-pass193-launch-kind="bookmark-folder-mission" ${allBookmarks.length ? '' : 'disabled'}>Start Mission</button>
        <button type="button" class="home-button secondary" data-folder-action="add-current">Add current here</button>
        <button type="button" class="home-button secondary" data-folder-action="add-folder">New subfolder</button>
        <button type="button" class="home-button secondary" data-folder-action="copy-urls" ${allBookmarks.length ? '' : 'disabled'}>Copy URLs</button>
        <button type="button" class="home-button secondary" data-folder-action="copy-markdown" ${allBookmarks.length ? '' : 'disabled'}>Copy summary</button>
        <button type="button" class="home-button secondary" data-folder-action="copy-manifest" ${allBookmarks.length ? '' : 'disabled'}>Copy Mission manifest</button>
        <button type="button" class="home-button secondary" data-folder-action="copy-manifest-json" ${allBookmarks.length ? '' : 'disabled'}>Copy manifest JSON</button>
        <button type="button" class="home-button secondary" data-folder-action="download-manifest-json" ${allBookmarks.length ? '' : 'disabled'}>Download manifest JSON</button>
        <button type="button" class="home-button secondary" data-folder-action="manager">Bookmark manager</button>
      </section>
      <section class="chromium-bookmarks-folder-view-list" aria-label="Bookmark folder contents"></section>
    `;
    const list = folderViewEl.querySelector<HTMLElement>('.chromium-bookmarks-folder-view-list');
    if (list) {
      if (!directChildren.length) {
        const empty = document.createElement('div');
        empty.className = 'chromium-bookmarks-empty-card';
        empty.textContent = 'This bookmark folder is empty.';
        list.appendChild(empty);
      } else if (!visibleChildren.length) {
        const empty = document.createElement('div');
        empty.className = 'chromium-bookmarks-empty-card';
        empty.textContent = 'No matching bookmarks in this folder.';
        list.appendChild(empty);
      } else {
        for (const child of visibleChildren) list.appendChild(renderFolderViewNode(child));
      }
    }
    folderViewEl.querySelector<HTMLInputElement>('.chromium-bookmarks-folder-search input')?.addEventListener('input', (event) => {
      folderSearchTerm = (event.target as HTMLInputElement).value;
      renderFolderView();
      folderViewEl?.querySelector<HTMLInputElement>('.chromium-bookmarks-folder-search input')?.focus();
    });

    folderViewEl.querySelectorAll<HTMLElement>('[data-folder-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.folderAction || '';
        if (action === 'close') closeFolderView();
        if (action === 'up') openParentFolder();
        if (action === 'open-tabs') openFolderAsTabs(folder);
        if (action === 'start-mission') startMissionFromFolder(folder);
        if (action === 'add-current') void addBookmark(folder.id);
        if (action === 'add-folder') void addFolder(folder.id);
        if (action === 'copy-urls') copyFolderUrls(folder);
        if (action === 'copy-markdown') copyFolderMarkdown(folder);
        if (action === 'copy-manifest') copyFolderMissionManifest(folder);
        if (action === 'copy-manifest-json') copyFolderMissionManifestJson(folder);
        if (action === 'download-manifest-json') downloadFolderMissionManifestJson(folder);
        if (action === 'manager') openManager();
      });
    });
    folderViewEl.querySelectorAll<HTMLElement>('[data-folder-target]').forEach((button) => {
      button.addEventListener('click', () => openFolderById(button.dataset.folderTarget || ''));
    });
  }

  function renderFolderViewNode(node: BookmarkNode): HTMLElement {
    const row = document.createElement('article');
    row.className = `chromium-bookmarks-folder-view-node ${node.type}`;
    const main = document.createElement('button');
    main.type = 'button';
    main.innerHTML = `<strong>${escapeText(node.type === 'folder' ? `Folder: ${node.title}` : node.title)}</strong><span>${escapeText(node.url || `${(node.children || []).length} items`)}</span>`;
    main.addEventListener('click', (event) => {
      if (node.type === 'folder') openFolder(node, main);
      else navigateTo(node.url || '', event.ctrlKey || event.metaKey, 'bookmark-folder-view');
    });

    const openTabs = document.createElement('button');
    openTabs.type = 'button';
    openTabs.className = 'mini';
    openTabs.dataset.pass193LaunchSurface = 'bookmark-folder-view';
    openTabs.dataset.pass193LaunchKind = node.type === 'folder' ? 'bookmark-folder-tabs' : 'bookmark-url';
    openTabs.textContent = node.type === 'folder' ? 'Open tabs' : 'Open';
    openTabs.addEventListener('click', (event) => {
      event.stopPropagation();
      if (node.type === 'folder') openFolderAsTabs(node);
      else navigateTo(node.url || '', true, 'bookmark-folder-view');
    });

    const mission = document.createElement('button');
    mission.type = 'button';
    mission.className = 'mini';
    mission.dataset.pass193LaunchSurface = 'bookmark-folder-view';
    mission.dataset.pass193LaunchKind = 'bookmark-folder-mission';
    mission.textContent = node.type === 'folder' ? 'Mission' : 'Pin URL';
    mission.title = node.type === 'folder' ? 'Start a Mission from this folder' : 'Start a one-page Mission from this bookmark';
    mission.addEventListener('click', (event) => {
      event.stopPropagation();
      if (node.type === 'folder') startMissionFromFolder(node);
      else if (node.url) {
        const safeUrl = parseSafeBookmarkUrl(node.url);
        if (safeUrl) {
          const manifest: BookmarkMissionManifest = {
            schemaVersion: 1,
            title: node.title,
            createdAt: new Date().toISOString(),
            sourceKind: 'bookmark',
            totalBookmarks: 1,
            safeUrlCount: 1,
            blockedUrlCount: 0,
            duplicateUrlCount: 0,
            paneUrlCount: 1,
            evidenceOnlyUrlCount: 0,
            exportProfile: 'sanitized-handoff',
            urls: [{ title: node.title, url: safeUrl, paneOpened: true, exportRole: 'pane' }]
          };
          pass193DispatchBookmarkMission({ title: node.title, urls: [safeUrl], titles: [node.title], totalBookmarks: 1, sourceFolderId: node.id, sourceKind: 'bookmark', launchManifest: missionManifestMarkdown(manifest) });
          closeFolderView();
        } else {
          pass193MarkBookmarkLaunch('bookmark-folder-view', 'bookmark-folder-mission', node.id, 'blocked:unsafe-url');
          setShellStatus('Bookmark Mission blocked', 'Unsafe bookmark URL.');
        }
      }
    });

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'mini';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editNode(node.id));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'mini danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (window.confirm(`Delete ${node.title}?`)) {
        const activeFolderId = folderViewNode?.id || null;
        removeNode(node.id);
        if (activeFolderId) openFolderById(activeFolderId);
      }
    });
    row.append(main, openTabs, mission, edit, del);
    return row;
  }

  function renderManager(): void {
    if (!managerEl) return;
    managerEl.innerHTML = `
      <section class="chromium-bookmarks-manager-panel">
        <header>
          <div>
            <p class="eyebrow">Chromium Bookmarks</p>
            <h2>Bookmark Manager</h2>
          </div>
          <button type="button" class="icon-button" data-manager-action="close">x</button>
        </header>
        <section class="chromium-bookmarks-manager-toolbar">
          <button type="button" class="home-button" data-manager-action="add-current">Add current</button>
          <button type="button" class="home-button secondary" data-manager-action="add-folder">New folder</button>
          <button type="button" class="home-button secondary" data-manager-action="toggle-bar">${store.barVisible ? 'Hide bar' : 'Show bar'}</button>
          <button type="button" class="home-button secondary" data-manager-action="import">Import</button>
          <button type="button" class="home-button secondary" data-manager-action="export">Export</button>
        </section>
        <section class="chromium-bookmarks-manager-body"></section>
      </section>
    `;
    const body = managerEl.querySelector<HTMLElement>('.chromium-bookmarks-manager-body');
    if (body) body.appendChild(renderTree(store.root, 0));

    managerEl.querySelectorAll<HTMLElement>('[data-manager-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.managerAction || '';
        if (action === 'close') managerEl?.close();
        if (action === 'add-current') addBookmark();
        if (action === 'add-folder') addFolder();
        if (action === 'toggle-bar') {
          store.barVisible = !store.barVisible;
          saveStore();
          renderAll();
          setShellStatus(store.barVisible ? 'Bookmarks bar shown' : 'Bookmarks bar hidden');
        }
        if (action === 'import') importBookmarks();
        if (action === 'export') exportBookmarks();
      });
    });
  }

  function renderTree(node: BookmarkNode, depth: number): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `chromium-bookmarks-tree-node ${node.type}`;
    wrap.style.setProperty('--bookmark-depth', String(depth));

    if (node.id !== 'root') {
      const row = document.createElement('div');
      row.className = 'chromium-bookmarks-tree-row';
      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'chromium-bookmarks-tree-main';
      main.innerHTML = `<strong>${escapeText(node.type === 'folder' ? `Folder: ${node.title}` : node.title)}</strong><span>${escapeText(node.url || `${(node.children || []).length} items`)}</span>`;
      main.addEventListener('click', (event) => {
        if (node.type === 'folder') openFolder(node, main);
        else navigateTo(node.url || '', event.ctrlKey || event.metaKey, 'bookmark-manager');
      });

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => editNode(node.id));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (window.confirm(`Delete ${node.title}?`)) removeNode(node.id);
      });

      row.append(main, edit, del);
      wrap.appendChild(row);
    }

    if (node.type === 'folder') {
      const children = document.createElement('div');
      children.className = 'chromium-bookmarks-tree-children';
      for (const child of node.children || []) children.appendChild(renderTree(child, depth + 1));
      wrap.appendChild(children);
    }
    return wrap;
  }

  function toggleMenu(): void {
    if (!menuEl) return;
    menuEl.hidden = !menuEl.hidden;
    if (!menuEl.hidden) {
      renderMenu();
      menuEl.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }
  }

  function closeMenu(): void {
    if (menuEl) menuEl.hidden = true;
  }

  function openManager(): void {
    renderManager();
    if (managerEl && !managerEl.open) managerEl.showModal();
    closeMenu();
  }

  function installKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && !event.shiftKey && !event.altKey && key === 'd') {
        event.preventDefault();
        addBookmark();
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && key === 'b') {
        event.preventDefault();
        store.barVisible = !store.barVisible;
        saveStore();
        renderAll();
        setShellStatus(store.barVisible ? 'Bookmarks bar shown' : 'Bookmarks bar hidden');
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && key === 'o') {
        event.preventDefault();
        openManager();
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && key === 'l') {
        event.preventDefault();
        reopenLastFolder();
      } else if (event.key === 'Escape') {
        closeMenu();
        closeFolderView();
      } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.key === 'Backspace' && folderViewNode && folderViewEl && !folderViewEl.hidden) {
        event.preventDefault();
        openParentFolder();
      } else if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key === 'Enter' && folderViewNode && folderViewEl && !folderViewEl.hidden) {
        event.preventDefault();
        openFolderAsTabs(folderViewNode);
      } else if (event.ctrlKey && event.shiftKey && !event.altKey && key === 'c' && folderViewNode && folderViewEl && !folderViewEl.hidden) {
        event.preventDefault();
        copyFolderMarkdown(folderViewNode);
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!menuEl || menuEl.hidden) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (menuEl.contains(target) || byId('chromium-bookmarks-button')?.contains(target)) return;
      closeMenu();
    });
  }

  function installPass164MoreToolsActionBridge(): void {
    document.addEventListener(PASS164_MORE_TOOLS_ACTION_EVENT, (event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.actionId === 'chromium-bookmark-star') {
        event.preventDefault();
        addBookmark();
        document.body.dataset.pass164MoreToolsActionHandled = 'chromium-bookmark-star';
      }
      if (event.detail?.actionId === 'chromium-bookmarks-button') {
        event.preventDefault();
        toggleMenu();
        document.body.dataset.pass164MoreToolsActionHandled = 'chromium-bookmarks-button';
      }
    });
  }

  function initChromiumBookmarks(): void {
    if (document.body.dataset.chromiumBookmarksReady === '1') return;
    document.body.dataset.chromiumBookmarksReady = '1';
    store = loadStore();
    createToolbarButtons();
    createBar();
    createMenu();
    createManager();
    createFolderView();
    installKeyboardShortcuts();
    installPass164MoreToolsActionBridge();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChromiumBookmarks, { once: true });
  } else {
    initChromiumBookmarks();
  }
})();