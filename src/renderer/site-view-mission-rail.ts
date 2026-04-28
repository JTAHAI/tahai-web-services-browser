(() => {
  type CaptureImage = {
    toDataURL: () => string;
    getSize?: () => { width: number; height: number };
  };

  type CaptureCapableWebview = HTMLElement & {
    capturePage?: () => Promise<CaptureImage>;
    getURL?: () => string;
    getTitle?: () => string;
    reload?: () => void;
  };

  type RailMode = 'all' | 'mission' | 'active';
  type RailDensity = 'comfortable' | 'compact' | 'large';
  type RailSide = 'left' | 'right';
  type RailPrivacyMode = 'visual' | 'safe';

  type RailSnapshot = {
    index: number;
    title: string;
    url: string;
    host: string;
    active: boolean;
    role: string;
    group: string;
    status: 'secure' | 'http' | 'local' | 'private' | 'unknown';
    button: HTMLButtonElement;
    webview: CaptureCapableWebview | null;
  };

  type ThumbnailCacheEntry = {
    dataUrl: string;
    capturedAt: number;
    width: number;
    height: number;
  };

  const FEATURE_NAME = 'Site View Mission Rail';
  const RAIL_ID = 'site-view-mission-rail';
  const RAIL_OPEN_CLASS = 'site-view-rail-enabled';
  const RAIL_RIGHT_CLASS = 'site-view-rail-right';
  const RAIL_STORAGE_KEY = 'tahai-browser:site-view-mission-rail:open:v1';
  const RAIL_MODE_KEY = 'tahai-browser:site-view-mission-rail:mode:v2';
  const RAIL_DENSITY_KEY = 'tahai-browser:site-view-mission-rail:density:v2';
  const RAIL_SIDE_KEY = 'tahai-browser:site-view-mission-rail:side:v2';
  const RAIL_PRIVACY_KEY = 'tahai-browser:site-view-mission-rail:privacy:v3';
  const RAIL_PAUSED_KEY = 'tahai-browser:site-view-mission-rail:paused:v3';
  const CAPTURE_MIN_AGE_MS = 12_000;
  const CAPTURE_DELAY_MS = 450;

  const thumbnailCache = new WeakMap<CaptureCapableWebview, ThumbnailCacheEntry>();
  const pendingCaptures = new WeakSet<CaptureCapableWebview>();
  const wiredWebviews = new WeakSet<CaptureCapableWebview>();
  let listEl: HTMLElement | null = null;
  let countEl: HTMLElement | null = null;
  let filterInput: HTMLInputElement | null = null;
  let pauseButton: HTMLButtonElement | null = null;
  let privacyModeButton: HTMLButtonElement | null = null;
  let toggleButton: HTMLButtonElement | null = null;
  let renderTimer = 0;
  let selectedIndex = 0;
  let draggedIndex: number | null = null;
  let railMode: RailMode = readMode();
  let railDensity: RailDensity = readDensity();
  let railSide: RailSide = readSide();
  let railPrivacyMode: RailPrivacyMode = readPrivacyMode();
  let railPaused = readPaused();

  function byId<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  function readMode(): RailMode {
    const value = localStorage.getItem(RAIL_MODE_KEY);
    return value === 'mission' || value === 'active' ? value : 'all';
  }

  function readDensity(): RailDensity {
    const value = localStorage.getItem(RAIL_DENSITY_KEY);
    return value === 'compact' || value === 'large' ? value : 'comfortable';
  }

  function readSide(): RailSide {
    return localStorage.getItem(RAIL_SIDE_KEY) === 'right' ? 'right' : 'left';
  }

  function readPrivacyMode(): RailPrivacyMode {
    return localStorage.getItem(RAIL_PRIVACY_KEY) === 'safe' ? 'safe' : 'visual';
  }

  function readPaused(): boolean {
    return localStorage.getItem(RAIL_PAUSED_KEY) === '1';
  }

  function injectStylesheet(): void {
    const href = './styles/site-view-mission-rail.css';
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function setShellStatus(message: string, detail = FEATURE_NAME): void {
    const status = byId<HTMLElement>('status-text');
    const security = byId<HTMLElement>('security-text');
    if (status) status.textContent = message;
    if (security) security.textContent = detail;
  }

  function getUrlFromWebview(webview: CaptureCapableWebview | null): string {
    if (!webview) return '';
    try {
      const apiUrl = typeof webview.getURL === 'function' ? webview.getURL() : '';
      if (apiUrl) return apiUrl;
    } catch {
      // Webview can be detached during tab close/reorder.
    }
    return webview.getAttribute('src') || '';
  }

  function getTitleFromWebview(webview: CaptureCapableWebview | null): string {
    if (!webview) return '';
    try {
      const apiTitle = typeof webview.getTitle === 'function' ? webview.getTitle() : '';
      if (apiTitle) return apiTitle;
    } catch {
      // Webview can be detached during tab close/reorder.
    }
    return '';
  }

  function hostLabel(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'file:') return 'TAHAI local page';
      return parsed.hostname.replace(/^www\./i, '');
    } catch {
      return 'Local / pending';
    }
  }

  function isPrivacySensitiveUrl(url: string): boolean {
    const normalized = url.toLowerCase();
    if (!normalized) return false;
    const sensitiveMarkers = [
      'login',
      'signin',
      'sign-in',
      'auth',
      'oauth',
      'saml',
      'password',
      'checkout',
      'billing',
      'accounts.google.com',
      'login.microsoftonline.com',
      'account.live.com',
      'cognito',
      'okta',
      'duosecurity'
    ];
    return sensitiveMarkers.some((marker) => normalized.includes(marker));
  }

  function previewStatus(url: string): RailSnapshot['status'] {
    if (!url) return 'unknown';
    if (isPrivacySensitiveUrl(url)) return 'private';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') return 'secure';
      if (parsed.protocol === 'http:') return 'http';
      if (parsed.protocol === 'file:') return 'local';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function statusLabel(status: RailSnapshot['status']): string {
    if (status === 'secure') return 'HTTPS';
    if (status === 'http') return 'HTTP';
    if (status === 'local') return 'LOCAL';
    if (status === 'private') return 'SAFE';
    return 'PENDING';
  }

  function inferRole(title: string, url: string): string {
    const value = `${title} ${url}`.toLowerCase();
    if (/github|actions|pipeline|build|deploy|vercel|firebase|netlify|ci|cd/.test(value)) return 'logs';
    if (/docs|documentation|learn|developer|runbook|wiki|confluence/.test(value)) return 'docs';
    if (/admin|console|portal|dashboard|cloudflare|aws|azure|entra|m365|google admin|workspace/.test(value)) return 'console';
    if (/ticket|incident|case|issue|jira|zendesk|freshservice|halo|connectwise|autotask/.test(value)) return 'ticket';
    if (/status|monitor|uptime|grafana|datadog|cloudwatch|sentry|log/.test(value)) return 'monitoring';
    return 'site';
  }

  function roleGroup(role: string): string {
    if (role === 'logs') return 'Logs / CI';
    if (role === 'docs') return 'Docs / Runbooks';
    if (role === 'console') return 'Admin / Console';
    if (role === 'ticket') return 'Tickets';
    if (role === 'monitoring') return 'Monitoring';
    return 'Sites';
  }

  function createToggleButton(): HTMLButtonElement {
    const existing = byId<HTMLButtonElement>('site-view-rail-toggle');
    if (existing) return existing;

    const button = document.createElement('button');
    button.id = 'site-view-rail-toggle';
    button.type = 'button';
    button.className = 'home-button secondary site-view-rail-toggle';
    button.title = 'Toggle Site View Mission Rail (Ctrl+Alt+V)';
    button.textContent = 'Site View';
    button.addEventListener('click', () => setRailOpen(!isRailOpen(), true));

    const missionButton = byId<HTMLButtonElement>('mission-control-toggle');
    const settingsButton = byId<HTMLButtonElement>('settings');
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    if (missionButton?.parentElement) {
      missionButton.insertAdjacentElement('afterend', button);
    } else if (settingsButton?.parentElement) {
      settingsButton.insertAdjacentElement('beforebegin', button);
    } else {
      toolbar?.appendChild(button);
    }
    return button;
  }

  function createRail(): HTMLElement {
    const existing = byId<HTMLElement>(RAIL_ID);
    if (existing) return existing;

    const rail = document.createElement('aside');
    rail.id = RAIL_ID;
    rail.className = 'site-view-mission-rail';
    rail.setAttribute('aria-label', FEATURE_NAME);

    const header = document.createElement('header');
    header.className = 'site-view-rail-header';

    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'TAHAI Mission Control';
    const title = document.createElement('h2');
    title.textContent = 'Site View Mission Rail';
    const subtitle = document.createElement('span');
    subtitle.textContent = 'PDF-style live site thumbnails';
    titleWrap.append(eyebrow, title, subtitle);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button site-view-rail-close';
    close.title = 'Close Site View Mission Rail';
    close.textContent = '×';
    close.addEventListener('click', () => setRailOpen(false, true));

    header.append(titleWrap, close);

    const tools = document.createElement('section');
    tools.className = 'site-view-rail-tools';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'home-button secondary';
    refresh.textContent = 'Refresh';
    refresh.addEventListener('click', () => refreshAllThumbnails(true));
    const side = document.createElement('button');
    side.type = 'button';
    side.className = 'home-button secondary';
    side.textContent = 'Dock';
    side.title = 'Move rail left/right';
    side.addEventListener('click', () => toggleSide());
    const density = document.createElement('button');
    density.type = 'button';
    density.className = 'home-button secondary';
    density.textContent = 'Size';
    density.title = 'Cycle thumbnail density';
    density.addEventListener('click', () => cycleDensity());
    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'home-button secondary';
    pause.title = 'Pause or resume automatic thumbnail capture';
    pause.addEventListener('click', () => togglePaused());
    pauseButton = pause;
    const privacy = document.createElement('button');
    privacy.type = 'button';
    privacy.className = 'home-button secondary';
    privacy.title = 'Toggle visual thumbnails or safe title-only cards';
    privacy.addEventListener('click', () => togglePrivacyMode());
    privacyModeButton = privacy;
    const count = document.createElement('span');
    count.className = 'site-view-rail-count';
    count.textContent = '0 sites';
    tools.append(refresh, side, density, pause, privacy, count);

    const filter = document.createElement('label');
    filter.className = 'site-view-rail-filter';
    const filterText = document.createElement('span');
    filterText.textContent = 'Filter open sites';
    const filterField = document.createElement('input');
    filterField.type = 'search';
    filterField.placeholder = 'Filter sites, hosts, docs, logs…';
    filterField.autocomplete = 'off';
    filterField.spellcheck = false;
    filterField.addEventListener('input', () => scheduleRender(0));
    filter.append(filterText, filterField);
    filterInput = filterField;

    const modes = document.createElement('section');
    modes.className = 'site-view-rail-modes';
    for (const [mode, label] of [['all', 'All'], ['mission', 'Mission'], ['active', 'Active']] as Array<[RailMode, string]>) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.railMode = mode;
      button.textContent = label;
      button.addEventListener('click', () => setMode(mode));
      modes.appendChild(button);
    }

    const list = document.createElement('div');
    list.className = 'site-view-rail-list';
    list.tabIndex = 0;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Open site thumbnails');
    list.addEventListener('keydown', handleRailKeydown);

    const footer = document.createElement('footer');
    footer.className = 'site-view-rail-footer';
    footer.textContent = 'Wheel scroll • Click select • Ctrl+Alt+J/K next-prev • Ctrl+Alt+Shift+V refresh • C copy URL • P privacy';

    rail.append(header, tools, filter, modes, list, footer);
    document.querySelector('.app-shell')?.appendChild(rail);

    listEl = list;
    countEl = count;
    return rail;
  }

  function isRailOpen(): boolean {
    return document.body.classList.contains(RAIL_OPEN_CLASS);
  }

  function applyRailPresentationState(): void {
    document.body.classList.toggle(RAIL_RIGHT_CLASS, railSide === 'right');
    document.body.dataset.siteViewRailDensity = railDensity;
    document.body.dataset.siteViewRailPrivacy = railPrivacyMode;
    document.body.classList.toggle('site-view-rail-paused', railPaused);
    if (pauseButton) {
      pauseButton.textContent = railPaused ? 'Resume' : 'Pause';
      pauseButton.classList.toggle('active', railPaused);
      pauseButton.setAttribute('aria-pressed', String(railPaused));
    }
    if (privacyModeButton) {
      privacyModeButton.textContent = railPrivacyMode === 'safe' ? 'Safe' : 'Visual';
      privacyModeButton.classList.toggle('active', railPrivacyMode === 'safe');
      privacyModeButton.setAttribute('aria-pressed', String(railPrivacyMode === 'safe'));
    }
    document.querySelectorAll<HTMLButtonElement>('[data-rail-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.railMode === railMode);
    });
  }

  function setRailOpen(open: boolean, persist: boolean): void {
    document.body.classList.toggle(RAIL_OPEN_CLASS, open);
    toggleButton?.classList.toggle('active', open);
    toggleButton?.setAttribute('aria-pressed', String(open));
    applyRailPresentationState();
    if (persist) localStorage.setItem(RAIL_STORAGE_KEY, open ? '1' : '0');
    if (open) {
      scheduleRender(0);
      setShellStatus('Site View Mission Rail open', 'Visual tab navigation active');
      window.setTimeout(() => listEl?.focus(), 80);
    } else {
      setShellStatus('Site View Mission Rail closed', 'Normal tab view active');
    }
  }

  function setMode(mode: RailMode): void {
    railMode = mode;
    localStorage.setItem(RAIL_MODE_KEY, railMode);
    applyRailPresentationState();
    scheduleRender(0);
  }

  function toggleSide(): void {
    railSide = railSide === 'left' ? 'right' : 'left';
    localStorage.setItem(RAIL_SIDE_KEY, railSide);
    applyRailPresentationState();
    setShellStatus(`Site View Mission Rail docked ${railSide}`, 'Dock side saved locally');
  }

  function cycleDensity(): void {
    railDensity = railDensity === 'comfortable' ? 'compact' : railDensity === 'compact' ? 'large' : 'comfortable';
    localStorage.setItem(RAIL_DENSITY_KEY, railDensity);
    applyRailPresentationState();
    scheduleRender(0);
  }

  function togglePaused(): void {
    railPaused = !railPaused;
    localStorage.setItem(RAIL_PAUSED_KEY, railPaused ? '1' : '0');
    applyRailPresentationState();
    setShellStatus(railPaused ? 'Site View previews paused' : 'Site View previews resumed', 'Thumbnail capture control saved locally');
    if (!railPaused) refreshAllThumbnails(true);
  }

  function togglePrivacyMode(): void {
    railPrivacyMode = railPrivacyMode === 'visual' ? 'safe' : 'visual';
    localStorage.setItem(RAIL_PRIVACY_KEY, railPrivacyMode);
    // WeakMap thumbnails expire with webviews; safe mode suppresses visual rendering immediately.
    applyRailPresentationState();
    setShellStatus(railPrivacyMode === 'safe' ? 'Safe title-only Site View enabled' : 'Visual Site View thumbnails enabled', 'Privacy mode saved locally');
    scheduleRender(0);
  }

  function cycleActive(offset: number): void {
    const snapshots = collectSnapshots();
    if (!snapshots.length) return;
    const activeIndex = snapshots.findIndex((snapshot) => snapshot.active);
    const base = activeIndex >= 0 ? activeIndex : selectedIndex;
    const next = (base + offset + snapshots.length) % snapshots.length;
    selectedIndex = next;
    activateSnapshot(snapshots[next]);
  }

  function collectSnapshots(): RailSnapshot[] {
    const tabsEl = byId<HTMLElement>('tabs');
    const stageEl = byId<HTMLElement>('webview-stage');
    if (!tabsEl || !stageEl) return [];

    const buttons = Array.from(tabsEl.querySelectorAll<HTMLButtonElement>('.tab'));
    const webviews = Array.from(stageEl.querySelectorAll<CaptureCapableWebview>('.browser-view'));
    const filter = filterInput?.value.trim().toLowerCase() || '';

    let snapshots = buttons.map((button, index) => {
      const webview = webviews[index] || null;
      const url = getUrlFromWebview(webview);
      const explicitTitle = button.querySelector<HTMLElement>('.tab-title')?.textContent?.trim() || '';
      const title = explicitTitle || getTitleFromWebview(webview) || hostLabel(url) || `Site ${index + 1}`;
      const role = inferRole(title, url);
      const host = hostLabel(url);
      return {
        index,
        title,
        url,
        host,
        role,
        group: roleGroup(role),
        status: previewStatus(url),
        active: button.classList.contains('active') || webview?.classList.contains('active') === true,
        button,
        webview
      } as RailSnapshot;
    });

    if (railMode === 'active') snapshots = snapshots.filter((snapshot) => snapshot.active);
    if (railMode === 'mission') snapshots = snapshots.filter((snapshot) => snapshot.role !== 'site' || snapshot.active);
    if (filter) {
      snapshots = snapshots.filter((snapshot) => `${snapshot.title} ${snapshot.url} ${snapshot.host} ${snapshot.group}`.toLowerCase().includes(filter));
    }
    return snapshots;
  }

  function scheduleRender(delay = 90): void {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      wireWebviewEvents();
      renderRail();
    }, delay);
  }

  function activateSnapshot(snapshot: RailSnapshot): void {
    selectedIndex = snapshot.index;
    snapshot.button.click();
    window.setTimeout(() => {
      requestThumbnailCapture(snapshot.webview, true);
      scheduleRender(0);
    }, 120);
  }

  function focusSnapshot(snapshot: RailSnapshot): void {
    activateSnapshot(snapshot);
    setRailOpen(false, true);
    setShellStatus(`Focused ${snapshot.title}`, 'Site View Mission Rail focus selection');
  }

  function closeSnapshot(snapshot: RailSnapshot): void {
    const closeButton = snapshot.button.querySelector<HTMLButtonElement>('.tab-close');
    if (closeButton) closeButton.click();
    scheduleRender(180);
  }

  async function copySnapshotUrl(snapshot: RailSnapshot): Promise<void> {
    activateSnapshot(snapshot);
    try {
      await navigator.clipboard.writeText(snapshot.url || snapshot.title);
      setShellStatus('Copied site URL', snapshot.host || FEATURE_NAME);
    } catch {
      const address = byId<HTMLInputElement>('address');
      if (address) {
        address.focus();
        address.select();
      }
      setShellStatus('Could not access clipboard', 'URL is selected in the address bar when available');
    }
  }

  function refreshSnapshot(snapshot: RailSnapshot): void {
    activateSnapshot(snapshot);
    try {
      snapshot.webview?.reload?.();
      setShellStatus(`Reloading ${snapshot.title}`, 'Refresh requested from Site View Mission Rail');
    } catch {
      byId<HTMLButtonElement>('reload')?.click();
    }
    requestThumbnailCapture(snapshot.webview, true);
  }

  function captureEvidence(snapshot: RailSnapshot): void {
    activateSnapshot(snapshot);
    window.setTimeout(() => byId<HTMLButtonElement>('capture')?.click(), 160);
  }

  function sendToPane(snapshot: RailSnapshot, paneId: string): void {
    activateSnapshot(snapshot);
    window.setTimeout(() => {
      const button = document.querySelector<HTMLButtonElement>(`[data-send-active-pane="${paneId}"]`);
      if (button) {
        button.click();
        setShellStatus(`${snapshot.title} sent to ${paneId.replace('-', ' ')}`, 'Mission pane routing requested');
      } else {
        setShellStatus('Mission pane controls unavailable', 'Open Mission Control and create a mission first');
      }
    }, 160);
  }

  function moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const tabsEl = byId<HTMLElement>('tabs');
    const stageEl = byId<HTMLElement>('webview-stage');
    if (!tabsEl || !stageEl) return;

    const buttons = Array.from(tabsEl.querySelectorAll<HTMLElement>('.tab'));
    const webviews = Array.from(stageEl.querySelectorAll<HTMLElement>('.browser-view'));
    const movingButton = buttons[fromIndex];
    const movingWebview = webviews[fromIndex];
    if (!movingButton || !movingWebview) return;

    const buttonReference = toIndex > fromIndex ? buttons[toIndex]?.nextSibling : buttons[toIndex];
    tabsEl.insertBefore(movingButton, buttonReference || null);

    const webviewReference = toIndex > fromIndex ? webviews[toIndex]?.nextSibling : webviews[toIndex];
    stageEl.insertBefore(movingWebview, webviewReference || null);
    selectedIndex = toIndex;
    scheduleRender(0);
    setShellStatus('Site order updated', 'Dragged site order follows tab order');
  }

  function renderRail(): void {
    if (!listEl || !countEl) return;
    applyRailPresentationState();
    const snapshots = collectSnapshots();
    countEl.textContent = `${snapshots.length} ${snapshots.length === 1 ? 'site' : 'sites'}`;
    listEl.replaceChildren();

    if (!snapshots.length) {
      const empty = document.createElement('div');
      empty.className = 'site-view-rail-empty';
      empty.textContent = railMode === 'active' ? 'No active site found.' : 'Open a site to populate the Mission Rail.';
      listEl.appendChild(empty);
      return;
    }

    selectedIndex = Math.min(selectedIndex, Math.max(0, snapshots.length - 1));
    let currentGroup = '';
    for (const snapshot of snapshots) {
      if (railMode === 'mission' && snapshot.group !== currentGroup) {
        currentGroup = snapshot.group;
        const group = document.createElement('div');
        group.className = 'site-view-rail-group';
        group.textContent = currentGroup;
        listEl.appendChild(group);
      }
      listEl.appendChild(renderCard(snapshot));
    }
  }

  function renderCard(snapshot: RailSnapshot): HTMLElement {
    const card = document.createElement('article');
    card.className = 'site-view-rail-card';
    card.classList.toggle('active', snapshot.active);
    card.classList.toggle('selected', snapshot.index === selectedIndex);
    card.dataset.previewStatus = snapshot.status;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(snapshot.active));
    card.draggable = true;
    card.addEventListener('dragstart', (event) => {
      draggedIndex = snapshot.index;
      event.dataTransfer?.setData('text/plain', String(snapshot.index));
      event.dataTransfer!.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const from = draggedIndex ?? Number(event.dataTransfer?.getData('text/plain'));
      draggedIndex = null;
      if (Number.isInteger(from)) moveTab(from, snapshot.index);
    });

    const pageButton = document.createElement('button');
    pageButton.type = 'button';
    pageButton.className = 'site-view-rail-page';
    pageButton.title = `Open ${snapshot.title}`;
    pageButton.addEventListener('click', () => activateSnapshot(snapshot));
    pageButton.addEventListener('dblclick', () => focusSnapshot(snapshot));
    pageButton.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      card.classList.toggle('show-actions');
      activateSnapshot(snapshot);
    });

    const preview = document.createElement('div');
    preview.className = 'site-view-rail-preview';
    renderPreview(preview, snapshot);

    const meta = document.createElement('div');
    meta.className = 'site-view-rail-meta';
    const number = document.createElement('span');
    number.className = 'site-view-rail-number';
    number.textContent = `${snapshot.index + 1}`.padStart(2, '0');
    const chip = document.createElement('span');
    chip.className = `site-view-rail-status ${snapshot.status}`;
    chip.textContent = statusLabel(snapshot.status);
    const title = document.createElement('strong');
    title.textContent = snapshot.title;
    const url = document.createElement('span');
    url.textContent = `${snapshot.group} · ${snapshot.host}`;
    meta.append(number, chip, title, url);

    pageButton.append(preview, meta);

    const actions = document.createElement('div');
    actions.className = 'site-view-rail-actions';
    actions.append(
      createActionButton('Copy', 'Copy this site URL', () => copySnapshotUrl(snapshot)),
      createActionButton('↻', 'Reload this site', () => refreshSnapshot(snapshot)),
      createActionButton('Cap', 'Capture this site as evidence', () => captureEvidence(snapshot)),
      createActionButton('P1', 'Send to Mission pane 1', () => sendToPane(snapshot, 'pane-1')),
      createActionButton('P2', 'Send to Mission pane 2', () => sendToPane(snapshot, 'pane-2')),
      createActionButton('P3', 'Send to Mission pane 3', () => sendToPane(snapshot, 'pane-3')),
      createActionButton('P4', 'Send to Mission pane 4', () => sendToPane(snapshot, 'pane-4')),
      createActionButton('×', 'Close this site', () => closeSnapshot(snapshot), 'danger')
    );

    card.append(pageButton, actions);
    return card;
  }

  function createActionButton(label: string, title: string, handler: () => void, tone = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `site-view-rail-action ${tone}`.trim();
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  }

  function renderPreview(preview: HTMLElement, snapshot: RailSnapshot): void {
    const url = snapshot.url;
    if (!url) {
      preview.appendChild(createPreviewFallback('Pending', 'No loaded URL yet.'));
      return;
    }

    if (railPrivacyMode === 'safe') {
      preview.classList.add('privacy');
      preview.appendChild(createPreviewFallback('Safe', 'Title-only mode keeps visual thumbnails hidden.'));
      return;
    }

    if (isPrivacySensitiveUrl(url)) {
      preview.classList.add('privacy');
      preview.appendChild(createPreviewFallback('Private', 'Title-only preview for sign-in or billing surface.'));
      return;
    }

    const cached = snapshot.webview ? thumbnailCache.get(snapshot.webview) : undefined;
    if (cached?.dataUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = cached.dataUrl;
      img.loading = 'lazy';
      img.decoding = 'async';
      const aspect = cached.width > 0 && cached.height > 0 ? cached.width / cached.height : 16 / 10;
      preview.style.setProperty('--site-aspect', aspect.toFixed(4));
      preview.appendChild(img);
      return;
    }

    preview.appendChild(createPreviewFallback(railPaused ? 'Paused' : 'Live', railPaused ? 'Automatic thumbnail capture is paused.' : 'Preview updates after the page is visible.'));
    requestThumbnailCapture(snapshot.webview, snapshot.active);
  }

  function createPreviewFallback(label: string, detail: string): HTMLElement {
    const fallback = document.createElement('div');
    fallback.className = 'site-view-rail-fallback';
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = detail;
    fallback.append(strong, span);
    return fallback;
  }

  function requestThumbnailCapture(webview: CaptureCapableWebview | null, force: boolean, allowWhenPaused = false): void {
    if (!webview || typeof webview.capturePage !== 'function') return;
    if (railPrivacyMode === 'safe') return;
    if (railPaused && !allowWhenPaused) return;
    const url = getUrlFromWebview(webview);
    if (isPrivacySensitiveUrl(url)) return;
    const cached = thumbnailCache.get(webview);
    if (!force && cached && Date.now() - cached.capturedAt < CAPTURE_MIN_AGE_MS) return;
    if (pendingCaptures.has(webview)) return;

    pendingCaptures.add(webview);
    window.setTimeout(() => {
      void (async () => {
        try {
          const image = await webview.capturePage!();
          const dataUrl = image.toDataURL();
          if (!dataUrl || dataUrl.length < 128) return;
          const size = image.getSize?.() || { width: 16, height: 10 };
          thumbnailCache.set(webview, {
            dataUrl,
            capturedAt: Date.now(),
            width: Math.max(1, size.width),
            height: Math.max(1, size.height)
          });
        } catch {
          // Optional visual navigation must not break ordinary browsing.
        } finally {
          pendingCaptures.delete(webview);
          if (isRailOpen()) scheduleRender(0);
        }
      })();
    }, force ? 60 : CAPTURE_DELAY_MS);
  }

  function refreshAllThumbnails(force: boolean): void {
    if (railPrivacyMode === 'safe') {
      setShellStatus('Safe title-only mode is enabled', 'Switch to Visual mode to refresh thumbnails');
      scheduleRender(0);
      return;
    }
    for (const snapshot of collectSnapshots()) requestThumbnailCapture(snapshot.webview, force || snapshot.active, true);
    setShellStatus('Refreshing Site View thumbnails', 'Aspect-ratio-safe local previews');
    scheduleRender(350);
  }

  function wireWebviewEvents(): void {
    const stageEl = byId<HTMLElement>('webview-stage');
    if (!stageEl) return;
    const webviews = Array.from(stageEl.querySelectorAll<CaptureCapableWebview>('.browser-view'));
    for (const webview of webviews) {
      if (wiredWebviews.has(webview)) continue;
      wiredWebviews.add(webview);
      const update = (): void => {
        thumbnailCache.delete(webview);
        if (webview.classList.contains('active')) requestThumbnailCapture(webview, true);
        scheduleRender(160);
      };
      webview.addEventListener('did-finish-load', update);
      webview.addEventListener('page-title-updated', () => scheduleRender(80));
      webview.addEventListener('did-stop-loading', update);
      webview.addEventListener('dom-ready', () => requestThumbnailCapture(webview, webview.classList.contains('active')));
    }
  }

  function handleRailKeydown(event: KeyboardEvent): void {
    const snapshots = collectSnapshots();
    if (!snapshots.length) return;
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      selectedIndex = Math.min(snapshots.length - 1, selectedIndex + 1);
      activateSnapshot(snapshots[selectedIndex]);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      activateSnapshot(snapshots[selectedIndex]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectedIndex = 0;
      activateSnapshot(snapshots[selectedIndex]);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectedIndex = snapshots.length - 1;
      activateSnapshot(snapshots[selectedIndex]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activateSnapshot(snapshots[selectedIndex]);
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void copySnapshotUrl(snapshots[selectedIndex]);
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      refreshSnapshot(snapshots[selectedIndex]);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      focusSnapshot(snapshots[selectedIndex]);
    } else if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      togglePrivacyMode();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setRailOpen(false, true);
    }
  }

  function installObservers(): void {
    const tabsEl = byId<HTMLElement>('tabs');
    const stageEl = byId<HTMLElement>('webview-stage');
    const observer = new MutationObserver(() => scheduleRender(90));
    if (tabsEl) observer.observe(tabsEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title'] });
    if (stageEl) observer.observe(stageEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src'] });

    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.altKey && event.shiftKey && key === 'v') {
        event.preventDefault();
        refreshAllThumbnails(true);
      } else if (event.ctrlKey && event.altKey && event.shiftKey && key === 'p') {
        event.preventDefault();
        togglePrivacyMode();
      } else if (event.ctrlKey && event.altKey && key === 'v') {
        event.preventDefault();
        setRailOpen(!isRailOpen(), true);
      } else if (event.ctrlKey && event.altKey && key === 'j') {
        event.preventDefault();
        cycleActive(1);
      } else if (event.ctrlKey && event.altKey && key === 'k') {
        event.preventDefault();
        cycleActive(-1);
      }
    });
  }

  function initSiteViewMissionRail(): void {
    injectStylesheet();
    toggleButton = createToggleButton();
    createRail();
    toggleButton.setAttribute('aria-controls', RAIL_ID);
    toggleButton.setAttribute('aria-pressed', 'false');
    installObservers();
    wireWebviewEvents();
    applyRailPresentationState();
    const shouldOpen = localStorage.getItem(RAIL_STORAGE_KEY) === '1';
    setRailOpen(shouldOpen, false);
    scheduleRender(0);
    window.setInterval(() => {
      if (!isRailOpen()) return;
      const active = collectSnapshots().find((snapshot) => snapshot.active);
      if (active) requestThumbnailCapture(active.webview, false);
    }, CAPTURE_MIN_AGE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteViewMissionRail, { once: true });
  } else {
    initSiteViewMissionRail();
  }
})();
