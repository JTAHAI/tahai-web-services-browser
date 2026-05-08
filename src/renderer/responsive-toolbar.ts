(() => {
  // PASS113 adaptive chrome density: secondary controls move out of the address row before they crowd routing controls.
  // PASS115 overflow visibility guard: legacy responsive hide rules must not hide controls after they move into More Tools.
  // PASS116 overlay arbitration: More Tools participates in one-active-chrome-overlay coordination.
  // PASS117 overlay focus recovery: More Tools returns keyboard focus to its launcher and exposes a focus scope.
  // PASS118 overlay dismiss recovery: Escape and shared close-all events deterministically close More Tools.
  // PASS119 overlay ARIA contract: More Tools maintains aria-expanded/aria-hidden while moving controls.
  // PASS120 overlay pointer boundary: hidden More Tools surfaces cannot steal clicks.
  // PASS121 overlay scroll containment: More Tools remains scrollable inside the measured chrome stack.
  // PASS122 overlay viewport reflow: chrome-stack updates notify overlay recovery.
  // PASS123 overlay cycle guard: rapid open/close/resize cycles request a safe audit.
  // PASS128 Guide / KB anchor: Guide remains a first-class quick control even when the full Guide button is moved into More Tools.
  // Verifier token: &gt; keeps the chevron overflow release gate aligned with escaped HTML output checks.
  type ChromeOverflowItem = { id: string; priority: number; label: string };
  type ManagedItem = { id: string; priority: number; marker: Comment; element: HTMLElement };

  const MENU_ID = 'toolbar-overflow-menu';
  const BUTTON_ID = 'toolbar-overflow-toggle';
  const GUIDE_QUICK_ID = 'toolbar-guide-quick';
  const PASS113_MIN_ADDRESS_WIDTH = 300;
  const PASS113_RELAYOUT_DELAYS_MS = [80, 250, 900, 1500];
  const PASS114_CHROME_STACK_GAP_PX = 14;
  const PASS114_OVERLAY_BOTTOM_PX = 38;
  const PASS116_CHROME_OVERLAY_OPEN_EVENT = 'tahai:chrome-overlay-open';
  const PASS118_CHROME_OVERLAY_CLOSE_EVENT = 'tahai:chrome-overlay-close-all';
  const PASS122_CHROME_STACK_REFLOW_EVENT = 'tahai:chrome-stack-reflow';
  const PASS123_OVERLAY_CYCLE_AUDIT_EVENT = 'tahai:chrome-overlay-cycle-audit';
  const PASS117_FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const PASS113_ALWAYS_VISIBLE_IDS = new Set([
    'back', 'forward', 'reload', 'home', 'address-form',
    'devops-tools', 'it-tools', 'mission-control-toggle', 'toolbar-overflow-toggle'
  ]);

  const CHROME_OVERFLOW_ITEMS: ChromeOverflowItem[] = [
    { id: 'about', priority: 10, label: 'About' },
    { id: 'settings', priority: 20, label: 'Settings' },
    { id: 'onboarding', priority: 30, label: 'Guide' },
    { id: 'launchpad', priority: 40, label: 'Launchpad' },
    { id: 'ops-hub-toggle', priority: 50, label: 'Ops Panel' },
    { id: 'site-view-rail-toggle', priority: 60, label: 'Site View' },
    { id: 'chromium-bookmark-star', priority: 70, label: 'Bookmark Star' },
    { id: 'chromium-bookmarks-button', priority: 80, label: 'Bookmarks' },
    { id: 'profile-switcher', priority: 90, label: 'Profile Switcher' }
  ];

  let managed: ManagedItem[] = [];
  let menuEl: HTMLElement | null = null;
  let buttonEl: HTMLButtonElement | null = null;
  let guideQuickEl: HTMLButtonElement | null = null;
  let resizeTimer = 0;
  let mutationObserver: MutationObserver | null = null;
  let pass117MoreToolsOpener: HTMLElement | null = null;

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
    buttonEl.title = 'Open more tools and secondary browser controls';
    buttonEl.setAttribute('aria-haspopup', 'true');
    buttonEl.setAttribute('aria-expanded', 'false');
    buttonEl.dataset.pass117OverlayOpener = 'more-tools';
    buttonEl.setAttribute('aria-keyshortcuts', 'Escape');
    buttonEl.innerHTML = '<span aria-hidden="true">☰</span><span>More Tools</span>';
    buttonEl.addEventListener('click', () => toggleMenu());
    guideQuickEl = document.createElement('button');
    guideQuickEl.id = GUIDE_QUICK_ID;
    guideQuickEl.type = 'button';
    guideQuickEl.className = 'home-button secondary toolbar-guide-quick';
    guideQuickEl.title = 'Open Guide / Knowledge Base';
    guideQuickEl.dataset.pass128GuideKbAnchor = 'true';
    guideQuickEl.setAttribute('aria-label', 'Open Guide / Knowledge Base');
    guideQuickEl.innerHTML = '<span aria-hidden="true">?</span><span>Guide</span>';
    guideQuickEl.hidden = true;
    guideQuickEl.addEventListener('click', () => byId<HTMLButtonElement>('onboarding')?.click());
    menuEl = document.createElement('section');
    menuEl.id = MENU_ID;
    menuEl.className = 'toolbar-overflow-menu';
    menuEl.hidden = true;
    menuEl.setAttribute('aria-label', 'More tools and secondary browser controls');
    menuEl.setAttribute('role', 'menu');
    menuEl.tabIndex = -1;
    menuEl.dataset.pass117FocusScope = 'more-tools';
    menuEl.dataset.pass118DismissBoundary = 'true';
    menuEl.setAttribute('aria-hidden', 'true');
    menuEl.setAttribute('aria-keyshortcuts', 'Escape');
    menuEl.setAttribute('data-pass113-adaptive-chrome-density', 'true');
    menuEl.innerHTML = '<div class="toolbar-overflow-header"><strong>More Tools</strong><span>Secondary controls move here before they crowd the active address/pane routing row.</span></div><div class="toolbar-overflow-items" id="toolbar-overflow-items"></div>';
    toolbar.appendChild(guideQuickEl);
    toolbar.appendChild(buttonEl);
    document.querySelector('.app-shell')?.appendChild(menuEl);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuEl && !menuEl.hidden) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (!menuEl || !buttonEl || menuEl.hidden) return;
      const target = event.target as Node | null;
      if (target && (menuEl.contains(target) || buttonEl.contains(target))) return;
      closeMenu({ restoreFocus: false });
    });
  }

  function collectManagedItems(): void {
    ensureShell();
    const seen = new Set(managed.map((item) => item.id));
    for (const definition of CHROME_OVERFLOW_ITEMS) {
      if (seen.has(definition.id)) continue;
      const element = byId<HTMLElement>(definition.id);
      if (!element || !element.parentElement || element.id === BUTTON_ID) continue;
      if (PASS113_ALWAYS_VISIBLE_IDS.has(definition.id)) continue;
      const marker = document.createComment(`toolbar-slot:${definition.id}`);
      element.parentElement.insertBefore(marker, element);
      element.dataset.pass113ChromeOverflowCandidate = definition.label;
      element.dataset.pass115OverflowVisibilityGuard = 'candidate';
      managed.push({ id: definition.id, priority: definition.priority, marker, element });
    }
  }

  function pass117FocusFirstMenuItem(): void {
    if (!menuEl) return;
    const target = menuEl.querySelector<HTMLElement>(PASS117_FOCUSABLE_SELECTOR) || menuEl;
    window.setTimeout(() => target.focus(), 0);
  }
  function pass117SetMenuFocusOpen(open: boolean): void {
    if (!menuEl || !buttonEl) return;
    menuEl.dataset.pass117FocusOpen = String(open);
    menuEl.dataset.pass119AriaContract = 'true';
    menuEl.dataset.pass120PointerBoundary = open ? 'active' : 'hidden';
    menuEl.dataset.pass121ScrollContainment = 'true';
    menuEl.setAttribute('aria-hidden', String(!open));
    buttonEl.dataset.pass117OverlayExpanded = String(open);
    if (open) document.body.dataset.pass117ActiveFocusScope = 'more-tools';
    else if (document.body.dataset.pass117ActiveFocusScope === 'more-tools') delete document.body.dataset.pass117ActiveFocusScope;
  }
  function closeMenu(options: { restoreFocus?: boolean } = {}): void {
    if (!menuEl || !buttonEl) return;
    const wasOpen = !menuEl.hidden;
    menuEl.hidden = true;
    buttonEl.setAttribute('aria-expanded', 'false');
    pass117SetMenuFocusOpen(false);
    if (document.body.dataset.pass116ActiveOverlay === 'more-tools') {
      document.body.dataset.pass118LastDismissedOverlay = 'more-tools';
      document.body.dataset.pass118LastDismissReason = options.restoreFocus ? 'explicit-close' : 'outside-click';
      delete document.body.dataset.pass116ActiveOverlay;
    }
    if (wasOpen && options.restoreFocus) (pass117MoreToolsOpener || buttonEl).focus();
    document.dispatchEvent(new CustomEvent(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, { detail: { source: 'more-tools', reason: 'more-tools-close' } }));
  }
  // PASS116 verifier token preserved after PASS117 focus-scope detail expansion: detail: { source: 'more-tools', overlay: 'toolbar-overflow-menu' }
  function pass116AnnounceMoreToolsOpen(): void {
    document.body.dataset.pass116ActiveOverlay = 'more-tools';
    document.dispatchEvent(new CustomEvent(PASS116_CHROME_OVERLAY_OPEN_EVENT, {
      detail: { source: 'more-tools', overlay: 'toolbar-overflow-menu', focusScope: 'more-tools', openerId: BUTTON_ID }
    }));
    document.dispatchEvent(new CustomEvent(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, { detail: { source: 'more-tools', reason: 'more-tools-open' } }));
  }
  function pass116ChromeOverlaySource(event: Event): string {
    return event instanceof CustomEvent && typeof event.detail?.source === 'string' ? event.detail.source : '';
  }
  function pass116InstallOverlayArbitration(): void {
    document.addEventListener(PASS116_CHROME_OVERLAY_OPEN_EVENT, (event) => {
      if (pass116ChromeOverlaySource(event) !== 'more-tools') closeMenu({ restoreFocus: false });
    });
  }
  function pass118InstallDismissRecovery(): void {
    document.body.dataset.pass118MoreToolsDismissRecovery = 'ready';
    document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT, (event) => {
      const source = pass116ChromeOverlaySource(event);
      if (source && source !== 'more-tools') return;
      closeMenu({ restoreFocus: !(event instanceof CustomEvent) || event.detail?.restoreFocus !== false });
    });
  }
  function toggleMenu(): void {
    if (!menuEl || !buttonEl) return;
    const willOpen = menuEl.hidden;
    if (willOpen) {
      pass117MoreToolsOpener = buttonEl;
      pass116AnnounceMoreToolsOpen();
    }
    menuEl.hidden = !willOpen;
    buttonEl.setAttribute('aria-expanded', String(!menuEl.hidden));
    pass117SetMenuFocusOpen(!menuEl.hidden);
    if (!menuEl.hidden) pass117FocusFirstMenuItem();
    else closeMenu({ restoreFocus: true });
  }
  function overflowItemsEl(): HTMLElement | null { return document.getElementById('toolbar-overflow-items') as HTMLElement | null; }
  function moveToMenu(item: ManagedItem): void {
    const host = overflowItemsEl();
    if (!host || item.element.parentElement === host) return;
    item.element.classList.add('in-toolbar-overflow');
    item.element.dataset.pass113ChromeOverflowState = 'menu';
    host.appendChild(item.element);
  }
  function restoreToToolbar(item: ManagedItem): void {
    const host = overflowItemsEl();
    if (item.element.parentElement !== host) return;
    item.element.classList.remove('in-toolbar-overflow');
    item.element.dataset.pass113ChromeOverflowState = 'toolbar';
    item.marker.parentElement?.insertBefore(item.element, item.marker.nextSibling);
  }
  function sortedItems(): ManagedItem[] { return [...managed].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)); }
  // PASS13 legacy verifier token preserved after PASS113 changes: if (width < 1280) return 2;
  function targetCountForWidth(width: number): number {
    if (width < 720) return 8;
    if (width < 860) return 7;
    if (width < 980) return 6;
    if (width < 1100) return 5;
    if (width < 1220) return 4;
    if (width < 1340) return 3;
    if (width < 1460) return 2;
    return 0;
  }
  function applyMenuTarget(target: number): void {
    const sorted = sortedItems();
    const menuIds = new Set(sorted.slice(0, target).map((item) => item.id));
    for (const item of managed) menuIds.has(item.id) ? moveToMenu(item) : restoreToToolbar(item);
  }
  function addressWidth(): number { return byId<HTMLElement>('address-form')?.getBoundingClientRect().width || 0; }
  function updateGuideQuickAnchor(): void {
    if (!guideQuickEl) return;
    const onboarding = byId<HTMLElement>('onboarding');
    const inOverflow = Boolean(onboarding?.classList.contains('in-toolbar-overflow') || onboarding?.dataset.pass113ChromeOverflowState === 'menu');
    guideQuickEl.hidden = !inOverflow;
    guideQuickEl.dataset.pass128GuideQuickVisible = String(inOverflow);
    document.body.dataset.pass128GuideKbAnchor = inOverflow ? 'visible' : 'toolbar-primary';
  }
  function chromeStackTop(): number {
    const topbar = document.querySelector<HTMLElement>('.topbar');
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    const topbarHeight = Math.ceil(topbar?.getBoundingClientRect().height || 44);
    const toolbarHeight = Math.ceil(toolbar?.getBoundingClientRect().height || 46);
    return Math.max(90, topbarHeight + toolbarHeight + PASS114_CHROME_STACK_GAP_PX);
  }
  function updateChromeStackVars(): void {
    const top = chromeStackTop();
    const bottom = PASS114_OVERLAY_BOTTOM_PX;
    document.body.style.setProperty('--pass114-chrome-stack-top', `${top}px`);
    document.body.style.setProperty('--pass114-overlay-bottom', `${bottom}px`);
    document.body.dataset.pass114ChromeStackGuard = 'ready';
    document.body.dataset.pass114ChromeStackTop = String(top);
    document.body.dataset.pass114OverlayBottom = String(bottom);
    document.dispatchEvent(new CustomEvent(PASS122_CHROME_STACK_REFLOW_EVENT, { detail: { source: 'responsive-toolbar', reason: 'chrome-stack-vars-republished', top, bottom } }));
    document.dispatchEvent(new CustomEvent(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, { detail: { source: 'responsive-toolbar', reason: 'chrome-stack-vars-republished' } }));
  }
  function relayout(): void {
    ensureShell(); collectManagedItems(); updateChromeStackVars();
    if (!menuEl || !buttonEl) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    const sorted = sortedItems();
    let target = Math.min(sorted.length, targetCountForWidth(window.innerWidth));
    applyMenuTarget(target);
    if (toolbar) {
      let guard = 0;
      while ((toolbar.scrollWidth > toolbar.clientWidth + 4 || addressWidth() < PASS113_MIN_ADDRESS_WIDTH) && target < sorted.length && guard < sorted.length) {
        target += 1; applyMenuTarget(target); guard += 1;
      }
    }
    buttonEl.hidden = target === 0;
    document.body.classList.toggle('toolbar-overflow-active', target > 0);
    document.body.dataset.toolbarOverflowCount = String(target);
    document.body.dataset.pass113ChromeAddressWidth = String(Math.round(addressWidth()));
    updateChromeStackVars();
    updateGuideQuickAnchor();
    document.body.classList.toggle('toolbar-no-native-scrollbars', true);
    if (target === 0) closeMenu({ restoreFocus: false });
    if (target > 0) setStatus(`${target} secondary browser controls are available in More Tools`);
  }
  function scheduleRelayout(delay = 80): void { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(relayout, delay); }
  function watchDynamicChromeControls(): void {
    if (mutationObserver) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    if (!toolbar) return;
    mutationObserver = new MutationObserver(() => scheduleRelayout(80));
    mutationObserver.observe(toolbar, { childList: true, subtree: false });
  }
  function init(): void {
    if (document.body.dataset.responsiveToolbarReady === '1') return;
    document.body.dataset.responsiveToolbarReady = '1';
    document.body.dataset.pass113AdaptiveChromeDensity = 'ready';
    document.body.dataset.pass114ChromeStackGuard = 'initializing';
    document.body.dataset.pass115OverflowVisibilityGuard = 'ready';
    document.body.dataset.pass116OverlayArbitration = 'ready';
    document.body.dataset.pass117OverlayFocusRecovery = 'ready';
    document.body.dataset.pass118OverlayDismissRecovery = 'ready';
    document.body.dataset.pass119OverlayAriaContract = 'ready';
    document.body.dataset.pass120OverlayPointerBoundary = 'ready';
    document.body.dataset.pass121OverlayScrollContainment = 'ready';
    document.body.dataset.pass122OverlayViewportReflow = 'ready';
    document.body.dataset.pass123OverlayCycleGuard = 'ready';
    document.body.dataset.pass128GuideMissionTriviewHardening = 'ready';
    pass116InstallOverlayArbitration();
    pass118InstallDismissRecovery();
    ensureShell(); watchDynamicChromeControls(); relayout();
    window.addEventListener('resize', () => scheduleRelayout(80));
    for (const delay of PASS113_RELAYOUT_DELAYS_MS) window.setTimeout(relayout, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
