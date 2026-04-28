(() => {
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
  const LEGACY_KEYS = ['tahai-browser:bookmarks:v1', 'tahai:bookmarks', 'bookmarks'];
  const FEATURE_NAME = 'Chromium Bookmarks';
  const BAR_VISIBLE_CLASS = 'chromium-bookmarks-bar-visible';

  let store: BookmarkStore;
  let barEl: HTMLElement | null = null;
  let menuEl: HTMLElement | null = null;
  let managerEl: HTMLDialogElement | null = null;
  let searchTerm = '';

  function byId<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  function uid(prefix = 'bm'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function now(): string {
    return new Date().toISOString();
  }

  function escapeText(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
  }

  function normalizeUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return 'https://tahaiportal.com';
    if (/^(https?|file):\/\//i.test(value)) return value;
    if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value) || /^localhost(:\d+)?/i.test(value)) return `https://${value}`;
    return value;
  }

  function seedStore(): BookmarkStore {
    const createdAt = now();
    return {
      schemaVersion: 1,
      barVisible: true,
      root: {
        id: 'root',
        type: 'folder',
        title: 'Bookmarks',
        createdAt,
        updatedAt: createdAt,
        children: [
          { id: uid('folder'), type: 'folder', title: 'TAHAI', createdAt, updatedAt: createdAt, children: [
            { id: uid(), type: 'bookmark', title: 'TAHAI Portal', url: 'https://tahaiportal.com', createdAt, updatedAt: createdAt },
            { id: uid(), type: 'bookmark', title: 'TAHAI Browser', url: 'https://browser.tahai.net', createdAt, updatedAt: createdAt }
          ]},
          { id: uid('folder'), type: 'folder', title: 'DevOps', createdAt, updatedAt: createdAt, children: [
            { id: uid(), type: 'bookmark', title: 'GitHub', url: 'https://github.com', createdAt, updatedAt: createdAt },
            { id: uid(), type: 'bookmark', title: 'Cloudflare', url: 'https://dash.cloudflare.com', createdAt, updatedAt: createdAt }
          ]}
        ]
      }
    };
  }

  function sanitizeNode(input: unknown): BookmarkNode | null {
    if (!input || typeof input !== 'object') return null;
    const record = input as Record<string, unknown>;
    const type = record.type === 'folder' ? 'folder' : record.type === 'bookmark' ? 'bookmark' : null;
    const title = typeof record.title === 'string' ? record.title.slice(0, 180) : '';
    if (!type || !title) return null;
    const stamp = typeof record.createdAt === 'string' ? record.createdAt : now();
    const node: BookmarkNode = {
      id: typeof record.id === 'string' && record.id ? record.id : uid(type === 'folder' ? 'folder' : 'bm'),
      type,
      title,
      createdAt: stamp,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : stamp
    };
    if (type === 'bookmark') {
      const url = typeof record.url === 'string' ? normalizeUrl(record.url) : '';
      if (!url) return null;
      node.url = url;
    } else {
      const children = Array.isArray(record.children) ? record.children.map(sanitizeNode).filter(Boolean) as BookmarkNode[] : [];
      node.children = children;
    }
    return node;
  }

  function migrateLegacyStore(): BookmarkStore | null {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const createdAt = now();
          const children = parsed
            .map((item) => sanitizeNode(item))
            .filter(Boolean) as BookmarkNode[];
          if (children.length) {
            return { schemaVersion: 1, barVisible: true, root: { id: 'root', type: 'folder', title: 'Bookmarks', createdAt, updatedAt: createdAt, children } };
          }
        }
        if (parsed && typeof parsed === 'object' && parsed.root) {
          const root = sanitizeNode(parsed.root);
          if (root?.type === 'folder') return { schemaVersion: 1, barVisible: parsed.barVisible !== false, root: { ...root, id: 'root', title: 'Bookmarks' } };
        }
      } catch {}
    }
    return null;
  }

  function loadStore(): BookmarkStore {
    try {
      const parsed = JSON.parse((localStorage.getItem(STORE_KEY) || '').replace(/^\uFEFF/, ''));
      const root = sanitizeNode(parsed.root);
      if (parsed.schemaVersion === 1 && root?.type === 'folder') {
        return { schemaVersion: 1, barVisible: parsed.barVisible !== false, root: { ...root, id: 'root', title: 'Bookmarks' } };
      }
    } catch {}
    return migrateLegacyStore() || seedStore();
  }

  function saveStore(): void {
    localStorage.setItem(STORE_KEY, JSON.stringify(store, null, 2));
  }

  function getActiveTitleAndUrl(): { title: string; url: string } {
    const activeTabTitle = document.querySelector<HTMLElement>('.tab.active .tab-title')?.textContent?.trim() || '';
    const activeWebview = document.querySelector<HTMLElement>('.browser-view.active') as (HTMLElement & { getURL?: () => string; getTitle?: () => string }) | null;
    let url = byId<HTMLInputElement>('address')?.value?.trim() || '';
    let title = activeTabTitle || 'Current page';
    try {
      const apiUrl = activeWebview?.getURL?.();
      const apiTitle = activeWebview?.getTitle?.();
      if (apiUrl) url = apiUrl;
      if (apiTitle) title = apiTitle;
    } catch {}
    return { title: title || url || 'Current page', url: normalizeUrl(url || 'https://tahaiportal.com') };
  }

  function setShellStatus(message: string, detail = FEATURE_NAME): void {
    const status = byId<HTMLElement>('status-text');
    const security = byId<HTMLElement>('security-text');
    if (status) status.textContent = message;
    if (security) security.textContent = detail;
  }

  function navigateTo(url: string, newTab: boolean): void {
    const address = byId<HTMLInputElement>('address');
    const form = byId<HTMLFormElement>('address-form');
    const newTabButton = byId<HTMLButtonElement>('new-tab');
    const run = (): void => {
      if (!address || !form) {
        window.location.href = url;
        return;
      }
      address.value = url;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    if (newTab && newTabButton) {
      newTabButton.click();
      window.setTimeout(run, 140);
    } else {
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

  function removeNode(id: string): boolean {
    const found = findNode(id);
    if (!found?.parent?.children) return false;
    found.parent.children = found.parent.children.filter((node) => node.id !== id);
    found.parent.updatedAt = now();
    saveStore();
    renderAll();
    return true;
  }

  function addBookmark(folderId = 'root', preset?: { title: string; url: string }): void {
    const target = findNode(folderId)?.node || store.root;
    if (target.type !== 'folder') return;
    const active = preset || getActiveTitleAndUrl();
    const title = prompt('Bookmark name', active.title);
    if (!title) return;
    const url = prompt('Bookmark URL', active.url);
    if (!url) return;
    target.children = target.children || [];
    target.children.push({ id: uid(), type: 'bookmark', title: title.slice(0, 180), url: normalizeUrl(url), createdAt: now(), updatedAt: now() });
    target.updatedAt = now();
    saveStore();
    renderAll();
    setShellStatus('Bookmark added', title);
  }

  function addFolder(parentId = 'root'): void {
    const target = findNode(parentId)?.node || store.root;
    if (target.type !== 'folder') return;
    const title = prompt('Folder name', 'New folder');
    if (!title) return;
    target.children = target.children || [];
    target.children.push({ id: uid('folder'), type: 'folder', title: title.slice(0, 180), createdAt: now(), updatedAt: now(), children: [] });
    target.updatedAt = now();
    saveStore();
    renderAll();
    setShellStatus('Bookmark folder added', title);
  }

  function editNode(id: string): void {
    const found = findNode(id);
    if (!found) return;
    const node = found.node;
    const title = prompt(node.type === 'folder' ? 'Folder name' : 'Bookmark name', node.title);
    if (!title) return;
    node.title = title.slice(0, 180);
    if (node.type === 'bookmark') {
      const url = prompt('Bookmark URL', node.url || '');
      if (!url) return;
      node.url = normalizeUrl(url);
    }
    node.updatedAt = now();
    saveStore();
    renderAll();
  }

  function openFolder(folder: BookmarkNode): void {
    const bookmarks = allNodes(folder).filter((node) => node.type === 'bookmark' && node.url);
    bookmarks.slice(0, 24).forEach((node, index) => {
      window.setTimeout(() => navigateTo(node.url!, index > 0), index * 180);
    });
  }

  function exportBookmarks(): void {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `tahai-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBookmarks(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const parsed = JSON.parse(String(reader.result || '').replace(/^\uFEFF/, ''));
          const nextRoot = sanitizeNode(parsed.root || parsed);
          if (!nextRoot || nextRoot.type !== 'folder') throw new Error('Invalid bookmark file');
          store.root = { ...nextRoot, id: 'root', title: 'Bookmarks' };
          store.barVisible = parsed.barVisible !== false;
          saveStore();
          renderAll();
          setShellStatus('Bookmarks imported', file.name);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Could not import bookmarks');
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
    star.className = 'home-button secondary chromium-bookmark-star';
    star.title = 'Bookmark current page (Ctrl+D)';
    star.textContent = 'â˜…';
    star.addEventListener('click', () => addBookmark());

    const button = document.createElement('button');
    button.id = 'chromium-bookmarks-button';
    button.type = 'button';
    button.className = 'home-button secondary chromium-bookmarks-button';
    button.title = 'Open Bookmarks menu';
    button.textContent = 'Bookmarks';
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
    bar.className = 'chromium-bookmarks-bar';
    bar.setAttribute('aria-label', 'Bookmarks bar');
    const stage = byId<HTMLElement>('webview-stage');
    stage?.insertAdjacentElement('beforebegin', bar);
    barEl = bar;
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

  function renderAll(): void {
    document.body.classList.add('chromium-bookmarks-installed');
    document.body.classList.toggle(BAR_VISIBLE_CLASS, store.barVisible);
    renderBar();
    renderMenu();
    renderManager();
  }

  function renderBar(): void {
    if (!barEl) return;
    barEl.hidden = !store.barVisible;
    barEl.replaceChildren();

    const rootChildren = store.root.children || [];
    if (!rootChildren.length) {
      const empty = document.createElement('span');
      empty.className = 'chromium-bookmarks-empty';
      empty.textContent = 'Bookmarks bar â€” add current page with â˜… or Ctrl+D';
      barEl.appendChild(empty);
      return;
    }

    for (const node of rootChildren.slice(0, 22)) barEl.appendChild(renderBarNode(node));

    const overflow = document.createElement('button');
    overflow.type = 'button';
    overflow.className = 'chromium-bookmarks-overflow';
    overflow.textContent = 'Moreâ€¦';
    overflow.addEventListener('click', () => openManager());
    barEl.appendChild(overflow);
  }

  function renderBarNode(node: BookmarkNode): HTMLElement {
    if (node.type === 'bookmark') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chromium-bookmarks-bar-item';
      button.textContent = node.title;
      button.title = node.url || node.title;
      button.addEventListener('click', (event) => navigateTo(node.url || '', event.ctrlKey || event.metaKey || event.button === 1));
      button.addEventListener('auxclick', (event) => { if (event.button === 1) navigateTo(node.url || '', true); });
      return button;
    }

    const wrap = document.createElement('span');
    wrap.className = 'chromium-bookmarks-folder';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chromium-bookmarks-bar-item folder';
    button.textContent = `â–¸ ${node.title}`;
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

  function renderFolderMenuNode(node: BookmarkNode): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chromium-bookmarks-folder-action ${node.type}`;
    button.textContent = node.type === 'folder' ? `â–¸ ${node.title}` : node.title;
    button.title = node.url || node.title;
    button.addEventListener('click', (event) => {
      if (node.type === 'folder') openFolder(node);
      else navigateTo(node.url || '', event.ctrlKey || event.metaKey);
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
        <button type="button" class="icon-button" data-bm-action="close">Ã—</button>
      </header>
      <section class="chromium-bookmarks-actions">
        <button type="button" class="home-button" data-bm-action="add-current">Add current page</button>
        <button type="button" class="home-button secondary" data-bm-action="add-folder">New folder</button>
        <button type="button" class="home-button secondary" data-bm-action="toggle-bar">${store.barVisible ? 'Hide' : 'Show'} bar</button>
        <button type="button" class="home-button secondary" data-bm-action="manager">Bookmark manager</button>
      </section>
      <section class="chromium-bookmarks-search">
        <input type="search" placeholder="Search bookmarksâ€¦" value="${escapeText(searchTerm)}" aria-label="Search bookmarks" />
      </section>
      <section class="chromium-bookmarks-menu-list"></section>
      <footer>
        <button type="button" data-bm-action="import">Import</button>
        <button type="button" data-bm-action="export">Export</button>
        <span>Ctrl+D add â€¢ Ctrl+Shift+B bar â€¢ Ctrl+Shift+O manager</span>
      </footer>
    `;

    const list = menuEl.querySelector<HTMLElement>('.chromium-bookmarks-menu-list')!;
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
    main.innerHTML = `<strong>${escapeText(node.type === 'folder' ? `â–¸ ${node.title}` : node.title)}</strong><span>${escapeText(node.url || `${(node.children || []).length} items`)}</span>`;
    main.addEventListener('click', (event) => {
      if (node.type === 'folder') openFolder(node);
      else navigateTo(node.url || '', event.ctrlKey || event.metaKey);
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
    }
    if (action === 'manager') openManager();
    if (action === 'import') importBookmarks();
    if (action === 'export') exportBookmarks();
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
          <button type="button" class="icon-button" data-manager-action="close">Ã—</button>
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
    const body = managerEl.querySelector<HTMLElement>('.chromium-bookmarks-manager-body')!;
    body.appendChild(renderTree(store.root, 0));

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
      main.innerHTML = `<strong>${escapeText(node.type === 'folder' ? `â–¸ ${node.title}` : node.title)}</strong><span>${escapeText(node.url || `${(node.children || []).length} items`)}</span>`;
      main.addEventListener('click', (event) => {
        if (node.type === 'folder') openFolder(node);
        else navigateTo(node.url || '', event.ctrlKey || event.metaKey);
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
        if (confirm(`Delete ${node.title}?`)) removeNode(node.id);
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
    managerEl?.showModal();
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
      } else if (event.key === 'Escape') {
        closeMenu();
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
    installKeyboardShortcuts();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChromiumBookmarks, { once: true });
  } else {
    initChromiumBookmarks();
  }
})();
