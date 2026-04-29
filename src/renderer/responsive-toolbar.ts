(() => {
  type ManagedItem = { id: string; priority: number; marker: Comment; element: HTMLElement };
  const MENU_ID = 'toolbar-overflow-menu';
  const BUTTON_ID = 'toolbar-overflow-toggle';
  const ALWAYS_VISIBLE_IDS = new Set(['back','forward','reload','home','address-form','profile-switcher','devops-tools','it-tools','mission-control-toggle']);
  const MANAGED_IDS = ['about','settings','site-view-rail-toggle','chromium-bookmarks-button','chromium-bookmark-star','ops-hub-toggle','onboarding','launchpad'];
  let managed: ManagedItem[] = [];
  let menuEl: HTMLElement | null = null;
  let buttonEl: HTMLButtonElement | null = null;
  let resizeTimer = 0;

  function byId<T extends HTMLElement>(id: string): T | null { return document.getElementById(id) as T | null; }
  function setStatus(message: string): void { const status = byId<HTMLElement>('status-text'); if (status) status.textContent = message; }

  function ensureShell(): void {
    if (buttonEl && menuEl) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    if (!toolbar) return;
    buttonEl = document.createElement('button');
    buttonEl.id = BUTTON_ID;
    buttonEl.type = 'button';
    buttonEl.className = 'home-button secondary toolbar-overflow-toggle';
    buttonEl.title = 'More browser controls';
    buttonEl.setAttribute('aria-haspopup', 'true');
    buttonEl.setAttribute('aria-expanded', 'false');
    buttonEl.innerHTML = '<span aria-hidden="true">&gt;</span><span>More</span>';
    buttonEl.addEventListener('click', () => toggleMenu());
    menuEl = document.createElement('section');
    menuEl.id = MENU_ID;
    menuEl.className = 'toolbar-overflow-menu';
    menuEl.hidden = true;
    menuEl.setAttribute('aria-label', 'More browser controls');
    toolbar.appendChild(buttonEl);
    document.querySelector('.app-shell')?.appendChild(menuEl);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
    document.addEventListener('pointerdown', (event) => {
      if (!menuEl || !buttonEl || menuEl.hidden) return;
      const target = event.target as Node | null;
      if (target && (menuEl.contains(target) || buttonEl.contains(target))) return;
      closeMenu();
    });
  }

  function collectManagedItems(): void {
    const seen = new Set(managed.map((item) => item.id));
    MANAGED_IDS.forEach((id, priority) => {
      if (seen.has(id)) return;
      const element = byId<HTMLElement>(id);
      if (!element || !element.parentElement) return;
      const marker = document.createComment(`toolbar-slot:${id}`);
      element.parentElement.insertBefore(marker, element);
      managed.push({ id, priority, marker, element });
    });
  }

  function closeMenu(): void {
    if (!menuEl || !buttonEl) return;
    menuEl.hidden = true;
    buttonEl.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu(): void {
    if (!menuEl || !buttonEl) return;
    menuEl.hidden = !menuEl.hidden;
    buttonEl.setAttribute('aria-expanded', String(!menuEl.hidden));
    if (!menuEl.hidden) window.setTimeout(() => menuEl?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus(), 0);
  }

  function targetCountForWidth(width: number): number {
    if (width < 760) return 8;
    if (width < 920) return 8;
    if (width < 1080) return 7;
    if (width < 1240) return 6;
    if (width < 1400) return 5;
    if (width < 1560) return 4;
    return 2;
  }

  function moveToMenu(item: ManagedItem): void { if (menuEl && item.element.parentElement !== menuEl) { item.element.classList.add('in-toolbar-overflow'); menuEl.appendChild(item.element); } }
  function restoreToToolbar(item: ManagedItem): void { if (item.element.parentElement === menuEl) { item.element.classList.remove('in-toolbar-overflow'); item.marker.parentElement?.insertBefore(item.element, item.marker.nextSibling); } }

  function relayout(): void {
    ensureShell(); collectManagedItems();
    if (!menuEl || !buttonEl) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    const sorted = [...managed].sort((a, b) => a.priority - b.priority);
    let target = Math.min(sorted.length, targetCountForWidth(window.innerWidth));
    let menuIds = new Set(sorted.slice(0, target).map((item) => item.id));
    for (const item of managed) menuIds.has(item.id) ? moveToMenu(item) : restoreToToolbar(item);

    if (toolbar) {
      let guard = 0;
      while (toolbar.scrollWidth > toolbar.clientWidth + 4 && target < sorted.length && guard < sorted.length) {
        target += 1;
        menuIds = new Set(sorted.slice(0, target).map((item) => item.id));
        for (const item of managed) menuIds.has(item.id) ? moveToMenu(item) : restoreToToolbar(item);
        guard += 1;
      }
    }

    buttonEl.hidden = target === 0;
    document.body.classList.toggle('toolbar-overflow-active', target > 0);
    document.body.dataset.toolbarOverflowCount = String(target);
    document.body.classList.toggle('toolbar-no-native-scrollbars', true);
    if (target === 0) closeMenu();
    if (target > 0) setStatus(`${target} browser controls moved to > overflow for this window size`);
  }

  function scheduleRelayout(): void { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(relayout, 80); }
  function init(): void { if (document.body.dataset.responsiveToolbarReady === '1') return; document.body.dataset.responsiveToolbarReady = '1'; ensureShell(); relayout(); window.addEventListener('resize', scheduleRelayout); window.setTimeout(relayout, 250); window.setTimeout(relayout, 900); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
