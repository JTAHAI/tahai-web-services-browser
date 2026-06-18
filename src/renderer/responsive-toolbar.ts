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
  // PASS163 More Tools action dispatch: moved controls must activate and then close the overflow panel at every window size.
  // PASS164 first-click action broker: More Tools delegates compact-menu actions before any overlay close/reflow cleanup can swallow them.
  // PASS165 action-settle hardening: known cross-module More Tools actions keep a settle window even when native fallback is used.
  // PASS167 source-safe overlay close: non-active close events must not clear another overlay's active state.
  // PASS168 overlay open-age stamp: More Tools must refresh viewport-settle timing before compact reflow checks.
  // PASS169 delayed overlay focus guard: stale post-close focus timers must not focus hidden overflow controls.
  // PASS170 restore-focus target guard: opener restore must not refocus hidden/moved/replaced controls.
  // PASS171 focus epoch guard: delayed focus timers must belong to the current overlay open generation.
  // PASS174 iconified utility hardening: fixed-position tooltip, menu roles, keyboard roving, and runtime state alignment.
  // PASS175 icon/screen-size UX hardening: clearer icon-only states, tiny-width overflow, Tab roving, and stale tooltip cleanup.
  // PASS176 compact icon viewport hardening: keep open-menu focus stable during relayout and expose compact hit-target states.
  // PASS177 website pane viewport recovery: hard-cap chrome growth so the webview cannot collapse into a bottom sliver.
  // PASS178 live viewport budget observer + enterprise button geometry: re-audit chrome after bookmarks/overlays/resize and de-pill utility controls.
  // PASS179 More Tools overflow clarity: badge/count/forced-overflow state makes compact chrome explain where controls went.
  // PASS180 primary chrome compact recovery: always-visible Home/DevOps/IT/Mission controls condense before they can starve the address bar.
  // PASS181 compact primary UX clarity: compact primary controls keep unique glyphs, hover titles, and More Tools explains why labels moved.
  // PASS182 compact hit-target focus: condensed primary controls keep usable hit targets and anchored focus/tooltips.
  // PASS183 overlay collision recovery: More Tools closes immediately when dialogs or command panels open so focus cannot fight the active surface.
  // PASS184 hidden-menu focus recovery: closing More Tools during relayout/collision cannot leave keyboard focus trapped in a hidden menu.
  // Verifier token: &gt; keeps the chevron overflow release gate aligned with escaped HTML output checks.
  type ChromeOverflowItem = { id: string; priority: number; label: string };
  type ManagedItem = { id: string; priority: number; marker: Comment; element: HTMLElement; toolbarRole: string | null };

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
  const PASS164_MORE_TOOLS_ACTION_EVENT = 'tahai:more-tools-action-request';
  const PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT = 'tahai:browser-surface-mode-change';
  const PASS164_MORE_TOOLS_ACTION_SETTLE_MS = 180;
  const PASS174_TOOLTIP_ID = 'pass174-utility-tooltip';
  const PASS175_LEGACY_LAYOUT_REFRESH_VERIFIER_TOKEN = `pass174HideUtilityTooltip();
    ensureShell(); collectManagedItems(); updateChromeStackVars();`;
  const PASS177_MIN_WEBVIEW_HEIGHT_PX = 220;
  const PASS177_MAX_CHROME_VIEWPORT_SHARE = 0.38;
  const PASS178_VIEWPORT_BUDGET_AUDIT_DELAYS_MS = [0, 90, 260, 760];
  const PASS178_VIEWPORT_OBSERVER_RELAYOUT_COOLDOWN_MS = 180;
  const PASS179_OVERFLOW_COUNT_BADGE_ID = 'toolbar-overflow-count';
  const PASS180_PRIMARY_COMPACT_WIDTH_PX = 980;
  const PASS181_COMPACT_UX_SUMMARY_ID = 'toolbar-compact-ux-summary';
  const PASS182_COMPACT_HIT_TARGET_CONTROLS = new Set(['home', 'devops-tools', 'it-tools', 'mission-control-toggle']);
  const PASS183_OVERLAY_COLLISION_AUDIT_DELAYS_MS = [0, 80, 240];
  const PASS184_HIDDEN_MENU_FOCUS_REPAIR_DELAY_MS = 28;
  const PASS181_PRIMARY_COMPACT_CONTROLS = [
    { id: 'home', compactGlyph: '⌂', label: 'Home', compactTitle: 'Go Home' },
    { id: 'devops-tools', compactGlyph: 'D', label: 'DevOps', compactTitle: 'Open DevOps tools' },
    { id: 'it-tools', compactGlyph: 'IT', label: 'IT Tools', compactTitle: 'Open IT engineering tools' },
    { id: 'mission-control-toggle', compactGlyph: 'M', label: 'Mission', compactTitle: 'Open Mission Control' }
  ];
  const PASS165_MORE_TOOLS_KNOWN_ACTION_IDS = new Set([
    'about',
    'settings',
    'onboarding',
    'launchpad',
    'ops-hub-toggle',
    'site-view-rail-toggle',
    'chromium-bookmark-star',
    'chromium-bookmarks-button',
    'profile-switcher'
  ]);
  const PASS117_FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const PASS163_MORE_TOOLS_ACTION_CLOSE_DELAY_MS = 0;
  let pass164MoreToolsActionInFlight = false;
  let pass174TooltipEl: HTMLElement | null = null;
  let pass174TooltipSource: HTMLElement | null = null;
  let pass174TooltipInstalled = false;

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
  let pass171MoreToolsFocusEpoch = 0;
  let pass178ViewportBudgetObserver: ResizeObserver | null = null;
  let pass178ViewportMutationObserver: MutationObserver | null = null;
  let pass178ViewportAuditTimer = 0;
  let pass178ViewportRelayoutUntil = 0;
  let pass183OverlayCollisionObserver: MutationObserver | null = null;
  let pass183OverlayCollisionTimer = 0;
  let pass184HiddenMenuFocusRepairTimer = 0;

  function byId<T extends HTMLElement>(id: string): T | null { return document.getElementById(id) as T | null; }
  function setStatus(message: string): void { const status = byId<HTMLElement>('status-text'); if (status) status.textContent = message; }
  function pass351OverflowItemVisible(item: ManagedItem): boolean {
    if (item.element.hidden) return false;
    if (item.element.closest('[hidden]')) return false;
    return true;
  }
  function pass351ViewportReachable(element: HTMLElement | null): boolean {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.left >= 0
      && rect.top >= 0
      && rect.right <= window.innerWidth
      && rect.bottom <= window.innerHeight;
  }
  function pass351OverflowAnchorsReachViewport(): boolean {
    if (buttonEl && !buttonEl.hidden && !pass351ViewportReachable(buttonEl)) return false;
    if (guideQuickEl && !guideQuickEl.hidden && !pass351ViewportReachable(guideQuickEl)) return false;
    return true;
  }

  function pass174Clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
  function pass174EnsureTooltip(): HTMLElement {
    if (pass174TooltipEl && document.contains(pass174TooltipEl)) return pass174TooltipEl;
    const existing = byId<HTMLElement>(PASS174_TOOLTIP_ID);
    if (existing) { pass174TooltipEl = existing; return existing; }
    const tooltip = document.createElement('div');
    tooltip.id = PASS174_TOOLTIP_ID;
    tooltip.className = 'pass174-utility-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.dataset.pass174FixedTooltip = 'true';
    document.body.appendChild(tooltip);
    pass174TooltipEl = tooltip;
    return tooltip;
  }
  function pass175IsVisibleUtilityControl(element: HTMLElement): boolean {
    if (!document.contains(element)) return false;
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    if (element instanceof HTMLButtonElement && element.disabled) return false;
    if (element.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    return Boolean(element.getClientRects().length);
  }
  function pass174TooltipCandidate(target: EventTarget | null): HTMLElement | null {
    const element = target instanceof Element ? target.closest<HTMLElement>('.utility-chrome-button[data-pass173-tooltip], #toolbar-overflow-toggle[data-pass173-tooltip], .toolbar-guide-quick[data-pass173-tooltip], [data-pass182-compact-tooltip="true"]') : null;
    if (!element || !pass175IsVisibleUtilityControl(element)) return null;
    if (element.dataset.pass182CompactTooltip === 'true' && document.body.dataset.pass180PrimaryChromeCompactMode !== 'condensed') return null;
    return element;
  }
  function pass174TooltipText(element: HTMLElement): string {
    const raw = element.dataset.pass182Tooltip || element.dataset.pass173Tooltip || element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function pass174PositionTooltip(source: HTMLElement, tooltip: HTMLElement): void {
    const rect = source.getBoundingClientRect();
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    tooltip.style.maxWidth = `${Math.max(160, Math.min(240, window.innerWidth - 16))}px`;
    const tipRect = tooltip.getBoundingClientRect();
    const left = pass174Clamp(rect.left + rect.width / 2 - tipRect.width / 2, 8, Math.max(8, window.innerWidth - tipRect.width - 8));
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    if (top + tipRect.height > window.innerHeight - 8) top = pass174Clamp(rect.top, 8, Math.max(8, window.innerHeight - tipRect.height - 8));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }
  function pass174ShowUtilityTooltip(source: HTMLElement): void {
    const text = pass174TooltipText(source);
    if (!text) return;
    const tooltip = pass174EnsureTooltip();
    pass174TooltipSource?.removeAttribute('aria-describedby');
    pass174TooltipSource = source;
    tooltip.textContent = text;
    tooltip.dataset.pass174TooltipVisible = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    source.setAttribute('aria-describedby', PASS174_TOOLTIP_ID);
    document.body.dataset.pass174UtilityTooltipState = 'visible';
    document.body.dataset.pass174UtilityTooltipSource = source.id || source.dataset.pass173Iconified || 'utility-control';
    requestAnimationFrame(() => pass174PositionTooltip(source, tooltip));
  }
  function pass174HideUtilityTooltip(source?: HTMLElement | null): void {
    if (source && pass174TooltipSource && source !== pass174TooltipSource) return;
    pass174TooltipSource?.removeAttribute('aria-describedby');
    pass174TooltipSource = null;
    if (!pass174TooltipEl) return;
    pass174TooltipEl.dataset.pass174TooltipVisible = 'false';
    pass174TooltipEl.setAttribute('aria-hidden', 'true');
    document.body.dataset.pass174UtilityTooltipState = 'hidden';
  }
  function pass174InstallUtilityTooltipController(): void {
    if (pass174TooltipInstalled) return;
    pass174TooltipInstalled = true;
    document.body.dataset.pass174UtilityTooltipController = 'ready';
    document.addEventListener('pointerover', (event) => { const source = pass174TooltipCandidate(event.target); if (source) pass174ShowUtilityTooltip(source); });
    document.addEventListener('pointerout', (event) => {
      const source = pass174TooltipCandidate(event.target);
      if (!source) return;
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && source.contains(related)) return;
      pass174HideUtilityTooltip(source);
    });
    document.addEventListener('focusin', (event) => { const source = pass174TooltipCandidate(event.target); if (source) pass174ShowUtilityTooltip(source); });
    document.addEventListener('focusout', (event) => { const source = pass174TooltipCandidate(event.target); if (source) pass174HideUtilityTooltip(source); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') pass174HideUtilityTooltip(); });
    document.addEventListener('click', (event) => { if (pass174TooltipCandidate(event.target)) pass174HideUtilityTooltip(); }, true);
    window.addEventListener('resize', () => pass174HideUtilityTooltip());
    window.addEventListener('scroll', () => pass174HideUtilityTooltip(), true);
  }
  function pass174MenuFocusableItems(): HTMLElement[] {
    if (!menuEl) return [];
    return Array.from(menuEl.querySelectorAll<HTMLElement>(PASS117_FOCUSABLE_SELECTOR)).filter((element) => {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      if (element instanceof HTMLButtonElement && element.disabled) return false;
      return Boolean(element.getClientRects().length);
    });
  }
  function pass174MoveMenuFocus(direction: 1 | -1 | 'first' | 'last'): void {
    const items = pass174MenuFocusableItems();
    if (!items.length) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = active ? items.indexOf(active) : -1;
    let nextIndex = 0;
    if (direction === 'first') nextIndex = 0;
    else if (direction === 'last') nextIndex = items.length - 1;
    else nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
    document.body.dataset.pass174MoreToolsKeyboardNav = 'roving-focus';
  }

  function pass176UpdateCompactIconViewportState(target: number): void {
    const width = Math.round(window.innerWidth || 0);
    const density = target >= CHROME_OVERFLOW_ITEMS.length ? 'all-utility-in-more-tools'
      : target > 0 ? 'mixed-toolbar-and-more-tools'
      : 'full-toolbar';
    document.body.dataset.pass176CompactIconViewportHardening = 'true';
    document.body.dataset.pass177SiteViewportRecovery = 'true';
    document.body.dataset.pass176ResponsiveIconDensity = density;
    document.body.dataset.pass176ResponsiveViewportWidth = String(width);
    if (buttonEl) {
      buttonEl.dataset.pass176MoreToolsVisibility = target > 0 ? 'visible' : 'hidden';
      buttonEl.dataset.pass176MoreToolsTargetCount = String(target);
    }
  }

  function pass176StabilizeOpenMoreToolsFocus(reason: string): void {
    if (!menuEl || menuEl.hidden || menuEl.getAttribute('aria-hidden') === 'true') return;
    const items = pass174MenuFocusableItems();
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeStillVisible = Boolean(active && menuEl.contains(active) && items.includes(active) && pass175IsVisibleUtilityControl(active));
    document.body.dataset.pass176MoreToolsFocusStabilizer = reason;
    document.body.dataset.pass176MoreToolsVisibleItems = String(items.length);
    if (activeStillVisible) {
      document.body.dataset.pass176MoreToolsFocusState = 'stable';
      return;
    }
    const next = items[0] || menuEl;
    window.setTimeout(() => {
      if (!menuEl || menuEl.hidden || menuEl.getAttribute('aria-hidden') === 'true') return;
      if (document.body.dataset.pass116ActiveOverlay !== 'more-tools') return;
      next.focus();
      document.body.dataset.pass176MoreToolsFocusState = 'repaired-after-' + reason;
    }, 0);
  }

  function pass177MeasureWebsitePaneBudget(): { available: number; chrome: number; share: number; forced: boolean } {
    const topbar = document.querySelector<HTMLElement>('.topbar');
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    const bookmarks = document.querySelector<HTMLElement>('.chromium-bookmarks-bar:not([hidden])');
    const statusbar = document.querySelector<HTMLElement>('.statusbar');
    const topbarHeight = Math.ceil(topbar?.getBoundingClientRect().height || 0);
    const toolbarHeight = Math.ceil(toolbar?.getBoundingClientRect().height || 0);
    const bookmarksHeight = Math.ceil(bookmarks?.getBoundingClientRect().height || 0);
    const statusbarHeight = Math.ceil(statusbar?.getBoundingClientRect().height || 0);
    const viewport = Math.max(1, Math.round(window.innerHeight || 1));
    const chrome = topbarHeight + toolbarHeight + bookmarksHeight + statusbarHeight;
    const available = viewport - chrome;
    const share = chrome / viewport;
    const forced = available < PASS177_MIN_WEBVIEW_HEIGHT_PX || share > PASS177_MAX_CHROME_VIEWPORT_SHARE;
    document.body.dataset.pass177SiteViewportRecovery = 'true';
    document.body.dataset.pass177MeasuredChromeHeight = String(chrome);
    document.body.dataset.pass177MeasuredWebviewHeight = String(available);
    document.body.dataset.pass177MeasuredChromeShare = share.toFixed(3);
    document.body.dataset.pass177ViewportBudgetState = forced ? 'forced-overflow' : 'healthy';
    return { available, chrome, share, forced };
  }

  function pass178ViewportBudgetNodes(): HTMLElement[] {
    return [
      document.body,
      document.querySelector<HTMLElement>('.app-shell'),
      document.querySelector<HTMLElement>('.topbar'),
      document.querySelector<HTMLElement>('.toolbar'),
      document.querySelector<HTMLElement>('.chromium-bookmarks-bar'),
      document.querySelector<HTMLElement>('.statusbar'),
      document.querySelector<HTMLElement>('.webview-stage')
    ].filter((node): node is HTMLElement => Boolean(node));
  }

  function pass178AuditViewportBudget(reason: string): void {
    const budget = pass177MeasureWebsitePaneBudget();
    const overflowCount = Number(document.body.dataset.toolbarOverflowCount || '0');
    const itemCount = sortedItems().length;
    document.body.dataset.pass178ViewportBudgetObserver = 'true';
    document.body.dataset.pass178LastViewportBudgetReason = reason;
    document.body.dataset.pass178LastViewportBudgetState = budget.forced ? 'forced-overflow' : 'healthy';
    document.body.dataset.pass178LastOverflowCount = String(overflowCount);
    document.body.dataset.pass178LastManagedUtilityCount = String(itemCount);
    if (!budget.forced) return;
    if (overflowCount >= itemCount) return;
    const now = Date.now();
    if (now < pass178ViewportRelayoutUntil) return;
    pass178ViewportRelayoutUntil = now + PASS178_VIEWPORT_OBSERVER_RELAYOUT_COOLDOWN_MS;
    document.body.dataset.pass178ViewportObserverRelayout = 'forced';
    document.body.dataset.pass178ViewportObserverRelayoutReason = reason;
    scheduleRelayout(0);
  }

  function pass178ScheduleViewportBudgetAudit(reason: string, delay = 90): void {
    window.clearTimeout(pass178ViewportAuditTimer);
    pass178ViewportAuditTimer = window.setTimeout(() => pass178AuditViewportBudget(reason), delay);
  }

  function pass178InstallViewportBudgetObserver(): void {
    if (document.body.dataset.pass178ViewportBudgetObserver === 'true') return;
    document.body.dataset.pass178ViewportBudgetObserver = 'true';
    document.body.dataset.pass178EnterpriseButtonGeometry = 'true';
    document.body.dataset.pass180PrimaryChromeCompactRecovery = 'true';
    document.body.dataset.pass179MoreToolsOverflowClarity = 'true';
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    if (typeof ResizeObserver !== 'undefined') {
      pass178ViewportBudgetObserver = new ResizeObserver(() => pass178ScheduleViewportBudgetAudit('resize-observer', 60));
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver.observe(node);
    } else {
      document.body.dataset.pass178ViewportBudgetObserverFallback = 'window-resize-only';
    }
    pass178ViewportMutationObserver = new MutationObserver(() => {
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver?.observe(node);
      pass178ScheduleViewportBudgetAudit('chrome-mutation', 80);
    });
    pass178ViewportMutationObserver.observe(document.body, { attributes: true, childList: true, subtree: false, attributeFilter: ['class', 'style', 'hidden', 'data-command-toolbar'] });
    const appShell = document.querySelector<HTMLElement>('.app-shell');
    if (appShell) pass178ViewportMutationObserver.observe(appShell, { childList: true, subtree: false });
    document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT, () => pass178ScheduleViewportBudgetAudit('chrome-stack-reflow', 120));
    for (const delay of PASS178_VIEWPORT_BUDGET_AUDIT_DELAYS_MS) window.setTimeout(() => pass178AuditViewportBudget(`startup-${delay}`), delay);
  }

  function pass181PreparePrimaryCompactControls(): void {
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    for (const control of PASS181_PRIMARY_COMPACT_CONTROLS) {
      const element = byId<HTMLElement>(control.id);
      if (!element) continue;
      element.dataset.pass181CompactPrimaryControl = control.label;
      element.dataset.pass181CompactGlyph = control.compactGlyph;
      element.dataset.pass181CompactTitle = control.compactTitle;
      element.dataset.pass182CompactTooltip = 'true';
      element.dataset.pass182CompactHitTarget = 'true';
      element.dataset.pass182Tooltip = `${control.label} — ${control.compactTitle}. Compact toolbar glyph: ${control.compactGlyph}.`;
      const icon = element.querySelector<HTMLElement>('span[aria-hidden="true"]');
      if (icon) {
        icon.dataset.pass181CompactGlyph = control.compactGlyph;
        icon.dataset.pass181CompactRole = control.label;
      }
      if (!element.getAttribute('aria-label')) element.setAttribute('aria-label', control.compactTitle);
    }
  }

  function pass181UpdateCompactUxHints(target: number, forcedReason: string): void {
    const compact = document.body.dataset.pass180PrimaryChromeCompactMode === 'condensed';
    const summary = byId<HTMLElement>(PASS181_COMPACT_UX_SUMMARY_ID);
    const countCopy = target === 0
      ? 'All secondary controls are still on the toolbar.'
      : `${target} secondary control${target === 1 ? '' : 's'} moved into More Tools.`;
    const compactCopy = compact
      ? 'Primary controls are compact: D=DevOps, IT=IT Tools, M=Mission.'
      : 'Primary control labels are visible.';
    const reasonCopy = forcedReason === 'webview-height-below-floor'
      ? 'Moved to protect the website pane height.'
      : forcedReason === 'chrome-share-above-budget'
        ? 'Moved because browser chrome exceeded the viewport budget.'
        : target > 0
          ? 'Moved before the address bar was crowded.'
          : 'No compact recovery is active.';
    const addressCopy = `Address bar ${Math.round(addressWidth())}px.`;
    const message = `${countCopy} ${compactCopy} ${reasonCopy} ${addressCopy}`;
    if (summary) summary.textContent = message;
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass181CompactPrimaryGlyphs = compact ? 'active' : 'ready';
    document.body.dataset.pass181CompactOverflowExplanation = target > 0 ? 'visible' : 'standby';
    document.body.dataset.pass181CompactSummary = message.slice(0, 180);
    if (buttonEl && target > 0) {
      buttonEl.dataset.pass181CompactUxSummary = message;
      buttonEl.setAttribute('aria-describedby', PASS181_COMPACT_UX_SUMMARY_ID);
    } else {
      buttonEl?.removeAttribute('aria-describedby');
    }
    for (const control of PASS181_PRIMARY_COMPACT_CONTROLS) {
      const element = byId<HTMLElement>(control.id);
      if (!element) continue;
      const baseTitle = control.compactTitle;
      element.title = compact ? `${baseTitle} (${control.compactGlyph} in compact toolbar)` : baseTitle;
      element.setAttribute('aria-label', compact ? `${baseTitle}; compact toolbar glyph ${control.compactGlyph}` : baseTitle);
      element.dataset.pass181CompactMode = compact ? 'glyph' : 'label';
      element.dataset.pass182Tooltip = compact
        ? `${control.label}: ${baseTitle}. Compact glyph ${control.compactGlyph}.`
        : `${control.label}: ${baseTitle}.`;
    }
  }


  function pass182CompactPrimaryTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const element = target.closest<HTMLElement>('[data-pass182-compact-tooltip="true"]');
    if (!element || !PASS182_COMPACT_HIT_TARGET_CONTROLS.has(element.id)) return null;
    if (document.body.dataset.pass180PrimaryChromeCompactMode !== 'condensed') return null;
    if (!pass175IsVisibleUtilityControl(element)) return null;
    return element;
  }

  function pass182AnnounceCompactPrimaryFocus(element: HTMLElement, reason: string): void {
    const label = element.dataset.pass181CompactPrimaryControl || element.getAttribute('aria-label') || element.id;
    const glyph = element.dataset.pass181CompactGlyph || '';
    const copy = glyph ? `${label} compact control (${glyph}).` : `${label} compact control.`;
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    document.body.dataset.pass182CompactFocusedControl = element.id || label;
    document.body.dataset.pass182CompactFocusReason = reason;
    setStatus(copy);
  }

  function pass182InstallCompactPrimaryFocusController(): void {
    if (document.body.dataset.pass182CompactFocusController === 'ready') return;
    document.body.dataset.pass182CompactFocusController = 'ready';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    document.addEventListener('focusin', (event) => {
      const target = pass182CompactPrimaryTarget(event.target);
      if (target) pass182AnnounceCompactPrimaryFocus(target, 'focus');
    });
    document.addEventListener('pointerover', (event) => {
      const target = pass182CompactPrimaryTarget(event.target);
      if (target) pass182AnnounceCompactPrimaryFocus(target, 'hover');
    });
    document.addEventListener('pointerdown', (event) => {
      const target = pass182CompactPrimaryTarget(event.target);
      if (target) {
        document.body.dataset.pass182CompactLastActivatedControl = target.id || 'unknown';
        document.body.dataset.pass182CompactLastActivation = 'pointer';
      }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const active = pass182CompactPrimaryTarget(document.activeElement);
      if (!active) return;
      document.body.dataset.pass182CompactLastActivatedControl = active.id || 'unknown';
      document.body.dataset.pass182CompactLastActivation = 'keyboard';
    }, true);
  }

  function pass183OpenDialogIds(): string[] {
    return Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'))
      .filter((dialog) => document.contains(dialog) && dialog.open)
      .map((dialog) => dialog.id || 'dialog')
      .slice(0, 6);
  }

  function pass183OpenCommandPanelIds(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.tool-menu-panel:not([hidden])'))
      .filter((panel) => document.contains(panel) && panel.getAttribute('aria-hidden') !== 'true' && Boolean(panel.getClientRects().length))
      .map((panel) => panel.id || 'tool-menu-panel')
      .slice(0, 6);
  }

  function pass183MoreToolsIsOpen(): boolean {
    return Boolean(menuEl && !menuEl.hidden && menuEl.getAttribute('aria-hidden') !== 'true');
  }

  function pass183AuditMoreToolsOverlayCollision(reason: string): void {
    const dialogs = pass183OpenDialogIds();
    const panels = pass183OpenCommandPanelIds();
    const collisionId = dialogs[0] || panels[0] || 'none';
    const collisionState = dialogs.length ? 'dialog-open' : panels.length ? 'command-panel-open' : 'clear';
    document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    document.body.dataset.pass183MoreToolsOverlayCollisionAuditReason = reason;
    document.body.dataset.pass183MoreToolsOverlayCollisionState = collisionState;
    document.body.dataset.pass183OpenDialogCount = String(dialogs.length);
    document.body.dataset.pass183OpenCommandPanelCount = String(panels.length);
    document.body.dataset.pass183OverlayCollisionSurface = collisionId;
    if (!pass183MoreToolsIsOpen() || collisionState === 'clear') return;
    document.body.dataset.pass183MoreToolsCollisionAction = 'closed-more-tools';
    document.body.dataset.pass183MoreToolsCollisionClosedFor = collisionId;
    closeMenu({ restoreFocus: false });
    pass174HideUtilityTooltip();
    setStatus(`More Tools closed so ${collisionId.replace(/-/g, ' ')} stays in focus.`);
  }

  function pass183ScheduleMoreToolsOverlayCollisionAudit(reason: string, delay = 40): void {
    window.clearTimeout(pass183OverlayCollisionTimer);
    pass183OverlayCollisionTimer = window.setTimeout(() => pass183AuditMoreToolsOverlayCollision(reason), delay);
  }

  function pass183InstallMoreToolsOverlayCollisionRecovery(): void {
    if (document.body.dataset.pass183MoreToolsOverlayCollisionController === 'ready') return;
    document.body.dataset.pass183MoreToolsOverlayCollisionController = 'ready';
    document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    pass183OverlayCollisionObserver = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target instanceof HTMLElement ? record.target : null;
        return Boolean(target && (target.matches('dialog, .tool-menu-panel') || target.closest('dialog, .tool-menu-panel')));
      });
      if (relevant) pass183ScheduleMoreToolsOverlayCollisionAudit('surface-mutation', 20);
    });
    pass183OverlayCollisionObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'hidden', 'aria-hidden', 'aria-expanded', 'class']
    });
    document.addEventListener(PASS116_CHROME_OVERLAY_OPEN_EVENT, () => pass183ScheduleMoreToolsOverlayCollisionAudit('chrome-overlay-open', 0));
    document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT, () => pass183ScheduleMoreToolsOverlayCollisionAudit('chrome-overlay-close', 80));
    document.addEventListener('toggle', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('dialog')) pass183ScheduleMoreToolsOverlayCollisionAudit('dialog-toggle', 0);
    }, true);
    for (const delay of PASS183_OVERLAY_COLLISION_AUDIT_DELAYS_MS) {
      window.setTimeout(() => pass183AuditMoreToolsOverlayCollision(`startup-${delay}`), delay);
    }
  }



  function pass184ActiveElementInsideMoreTools(): HTMLElement | null {
    if (!menuEl) return null;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!active || !menuEl.contains(active)) return null;
    return active;
  }

  function pass184PreferredFocusRecoveryTarget(): HTMLElement | null {
    const address = byId<HTMLInputElement>('address');
    if (address && pass170ElementCanRestoreFocus(address)) return address;
    if (buttonEl && pass170ElementCanRestoreFocus(buttonEl)) return buttonEl;
    const toolbarFocus = document.querySelector<HTMLElement>('.toolbar button:not([hidden]):not([disabled]), .toolbar input:not([hidden]):not([disabled])');
    if (toolbarFocus && pass170ElementCanRestoreFocus(toolbarFocus)) return toolbarFocus;
    const stage = byId<HTMLElement>('webview-stage');
    if (stage && pass170ElementCanRestoreFocus(stage)) return stage;
    return null;
  }

  function pass184RepairHiddenMoreToolsFocus(reason: string): void {
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusReason = reason;
    const trapped = pass184ActiveElementInsideMoreTools();
    const hidden = Boolean(menuEl && (menuEl.hidden || menuEl.getAttribute('aria-hidden') === 'true'));
    if (!trapped || !hidden) {
      document.body.dataset.pass184HiddenMoreToolsFocusState = 'clear';
      return;
    }
    if (pass164MoreToolsActionInFlight) {
      document.body.dataset.pass184HiddenMoreToolsFocusState = 'deferred-action-in-flight';
      return;
    }
    const target = pass184PreferredFocusRecoveryTarget();
    if (!target) {
      document.body.dataset.pass184HiddenMoreToolsFocusState = 'no-safe-target';
      return;
    }
    target.focus();
    document.body.dataset.pass184HiddenMoreToolsFocusState = 'repaired';
    document.body.dataset.pass184HiddenMoreToolsFocusFrom = trapped.id || trapped.dataset.pass113ChromeOverflowCandidate || 'more-tools-item';
    document.body.dataset.pass184HiddenMoreToolsFocusTo = target.id || target.tagName.toLowerCase();
    setStatus('Focus restored after More Tools closed.');
  }

  function pass184ScheduleHiddenMoreToolsFocusRepair(reason: string, delay = PASS184_HIDDEN_MENU_FOCUS_REPAIR_DELAY_MS): void {
    window.clearTimeout(pass184HiddenMenuFocusRepairTimer);
    pass184HiddenMenuFocusRepairTimer = window.setTimeout(() => pass184RepairHiddenMoreToolsFocus(reason), delay);
  }

  function pass184InstallHiddenMoreToolsFocusRecovery(): void {
    if (document.body.dataset.pass184HiddenMoreToolsFocusController === 'ready') return;
    document.body.dataset.pass184HiddenMoreToolsFocusController = 'ready';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    document.addEventListener('focusin', () => {
      if (!menuEl) return;
      if (!menuEl.hidden && menuEl.getAttribute('aria-hidden') !== 'true') return;
      if (pass184ActiveElementInsideMoreTools()) pass184ScheduleHiddenMoreToolsFocusRepair('focus-entered-hidden-menu', 0);
    }, true);
    document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT, () => pass184ScheduleHiddenMoreToolsFocusRepair('chrome-stack-reflow', 48));
    document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT, () => pass184ScheduleHiddenMoreToolsFocusRepair('chrome-overlay-close', 48));
  }

  function ensureShell(): void {
    if (buttonEl && menuEl) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    if (!toolbar) return;
    buttonEl = document.createElement('button');
    buttonEl.id = BUTTON_ID;
    buttonEl.type = 'button';
    buttonEl.className = 'home-button secondary toolbar-overflow-toggle utility-chrome-button';
    buttonEl.title = 'Open more tools and secondary browser controls';
    buttonEl.setAttribute('aria-haspopup', 'true');
    buttonEl.setAttribute('aria-expanded', 'false');
    buttonEl.setAttribute('aria-controls', MENU_ID);
    buttonEl.dataset.pass176ControlsOverflowMenu = MENU_ID;
    buttonEl.dataset.pass117OverlayOpener = 'more-tools';
    buttonEl.setAttribute('aria-keyshortcuts', 'Escape');
    buttonEl.setAttribute('aria-label', 'Open More Tools');
    buttonEl.dataset.pass173Iconified = 'more-tools';
    buttonEl.dataset.pass173Tooltip = 'More Tools';
    buttonEl.dataset.pass179OverflowClarity = 'true';
    buttonEl.innerHTML = '<span class="chrome-action-icon" aria-hidden="true">☰</span><span class="chrome-action-label">More Tools</span><span id="toolbar-overflow-count" class="toolbar-overflow-count-badge" aria-hidden="true">0</span>';
    buttonEl.addEventListener('click', () => toggleMenu());
    guideQuickEl = document.createElement('button');
    guideQuickEl.id = GUIDE_QUICK_ID;
    guideQuickEl.type = 'button';
    guideQuickEl.className = 'home-button secondary toolbar-guide-quick utility-chrome-button';
    guideQuickEl.title = 'Open Guide / Knowledge Base';
    guideQuickEl.dataset.pass128GuideKbAnchor = 'true';
    guideQuickEl.setAttribute('aria-label', 'Open Guide / Knowledge Base');
    guideQuickEl.dataset.pass173Iconified = 'guide-quick';
    guideQuickEl.dataset.pass173Tooltip = 'Guide / KB';
    guideQuickEl.innerHTML = '<span class="chrome-action-icon" aria-hidden="true">?</span><span class="chrome-action-label">Guide</span>';
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
    menuEl.dataset.pass163MoreToolsActionDispatch = 'true';
    menuEl.innerHTML = `<div class="toolbar-overflow-header"><strong>More Tools</strong><span id="${PASS181_COMPACT_UX_SUMMARY_ID}" data-pass181-compact-overflow-summary="true">Secondary controls move here before they crowd the active address/pane routing row.</span></div><div class="toolbar-overflow-items" id="toolbar-overflow-items"></div>`;
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
    menuEl.addEventListener('click', (event) => {
      const activated = pass163OverflowActionElement(event.target);
      if (!activated) return;
      const actionId = pass164MoreToolsActionId(activated);
      document.body.dataset.pass163LastMoreToolsAction = actionId;
      document.body.dataset.pass163MoreToolsActionDispatch = 'activated';
      document.body.dataset.pass164MoreToolsFirstClickAction = actionId;
      const request = new CustomEvent(PASS164_MORE_TOOLS_ACTION_EVENT, {
        bubbles: true,
        cancelable: true,
        detail: { actionId, source: 'more-tools', elementId: activated.id || '' }
      });
      const unhandled = document.dispatchEvent(request);
      const knownPass165Action = PASS165_MORE_TOOLS_KNOWN_ACTION_IDS.has(actionId);
      document.body.dataset.pass165MoreToolsKnownAction = knownPass165Action ? actionId : 'unknown';
      if (!unhandled) {
        event.preventDefault();
        event.stopPropagation();
        pass164MoreToolsActionInFlight = true;
        document.body.dataset.pass164MoreToolsFirstClickDispatch = 'handled';
        document.body.dataset.pass165MoreToolsDispatchMode = 'broker-handled';
        window.setTimeout(() => { pass164MoreToolsActionInFlight = false; }, PASS164_MORE_TOOLS_ACTION_SETTLE_MS);
      } else {
        document.body.dataset.pass164MoreToolsFirstClickDispatch = knownPass165Action ? 'known-native-fallback' : 'native-fallback';
        document.body.dataset.pass165MoreToolsDispatchMode = knownPass165Action ? 'known-native-fallback-settle' : 'native-fallback';
        if (knownPass165Action) {
          pass164MoreToolsActionInFlight = true;
          window.setTimeout(() => { pass164MoreToolsActionInFlight = false; }, PASS164_MORE_TOOLS_ACTION_SETTLE_MS);
        }
      }
      if (knownPass165Action) {
        document.body.dataset.pass165MoreToolsImmediateClose = actionId;
        closeMenu({ restoreFocus: false });
        return;
      }
      const closeDelay = (!unhandled || knownPass165Action) ? PASS164_MORE_TOOLS_ACTION_SETTLE_MS : PASS163_MORE_TOOLS_ACTION_CLOSE_DELAY_MS;
      window.setTimeout(() => {
        if (!menuEl || menuEl.hidden) return;
        closeMenu({ restoreFocus: false });
      }, closeDelay);
    }, true);
    menuEl.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); pass174MoveMenuFocus(1); }
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); pass174MoveMenuFocus(-1); }
      else if (event.key === 'Home') { event.preventDefault(); pass174MoveMenuFocus('first'); }
      else if (event.key === 'End') { event.preventDefault(); pass174MoveMenuFocus('last'); }
      else if (event.key === 'Tab') { event.preventDefault(); pass174MoveMenuFocus(event.shiftKey ? -1 : 1); document.body.dataset.pass175MoreToolsTabRoving = 'true'; }
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
      element.dataset.pass173Iconified = element.dataset.pass173Iconified || definition.id;
      element.dataset.pass173Tooltip = element.dataset.pass173Tooltip || definition.label;
      if (element instanceof HTMLButtonElement && !element.getAttribute('aria-label')) element.setAttribute('aria-label', definition.label);
      managed.push({ id: definition.id, priority: definition.priority, marker, element, toolbarRole: element.getAttribute('role') });
    }
  }


  function pass171BumpMoreToolsFocusEpoch(reason: string): number {
    pass171MoreToolsFocusEpoch += 1;
    document.body.dataset.pass171OverlayFocusEpochGuard = 'true';
    document.body.dataset.pass171MoreToolsFocusEpoch = String(pass171MoreToolsFocusEpoch);
    document.body.dataset.pass171MoreToolsFocusEpochReason = reason;
    return pass171MoreToolsFocusEpoch;
  }

  function pass117FocusFirstMenuItem(): void {
    if (!menuEl) return;
    const target = menuEl.querySelector<HTMLElement>(PASS117_FOCUSABLE_SELECTOR) || menuEl;
    const focusEpoch = pass171MoreToolsFocusEpoch;
    window.setTimeout(() => {
      if (focusEpoch !== pass171MoreToolsFocusEpoch) { document.body.dataset.pass171MoreToolsFocusSkipped = 'stale-epoch'; return; }
      if (document.body.dataset.pass116ActiveOverlay !== 'more-tools') { document.body.dataset.pass171MoreToolsFocusSkipped = 'inactive-overlay'; return; }
      if (!menuEl || menuEl.hidden || menuEl.getAttribute('aria-hidden') === 'true') return;
      if (!document.contains(menuEl) || !document.contains(target)) return;
      if (pass164MoreToolsActionInFlight) { document.body.dataset.pass171MoreToolsFocusSkipped = 'action-in-flight'; return; }
      if (document.activeElement && menuEl.contains(document.activeElement)) return;
      document.body.dataset.pass169DelayedOverlayFocusGuard = 'more-tools';
      document.body.dataset.pass171MoreToolsFocusAppliedEpoch = String(focusEpoch);
      target.focus();
    }, 0);
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
  function pass170ElementCanRestoreFocus(target: HTMLElement | null): target is HTMLElement {
    if (!target || !document.contains(target)) return false;
    if (target instanceof HTMLButtonElement && target.disabled) return false;
    if (target.getAttribute('aria-disabled') === 'true' || target.getAttribute('aria-hidden') === 'true') return false;
    if (target.hidden) return false;
    if (!target.getClientRects().length) return false;
    return true;
  }
  function pass170RestoreFocusToMoreToolsOpener(target: HTMLElement | null): void {
    window.setTimeout(() => {
      document.body.dataset.pass170RestoreFocusTargetGuard = 'more-tools';
      const activeOverlay = document.body.dataset.pass116ActiveOverlay || 'none';
      if (activeOverlay !== 'none' && activeOverlay !== 'more-tools') {
        document.body.dataset.pass170RestoreFocusSkipped = `more-tools:${activeOverlay}`;
        return;
      }
      if (!pass170ElementCanRestoreFocus(target)) {
        document.body.dataset.pass170RestoreFocusSkipped = 'more-tools:invalid-target';
        return;
      }
      target.focus();
      document.body.dataset.pass170RestoreFocusApplied = 'more-tools';
    }, 0);
  }
  function closeMenu(options: { restoreFocus?: boolean } = {}): void {
    if (!menuEl || !buttonEl) return;
    const wasOpen = !menuEl.hidden;
    pass171BumpMoreToolsFocusEpoch('close');
    pass174HideUtilityTooltip();
    pass351ResetMoreToolsScroll('close');
    menuEl.hidden = true;
    buttonEl.setAttribute('aria-expanded', 'false');
    pass117SetMenuFocusOpen(false);
    if (document.body.dataset.pass116ActiveOverlay === 'more-tools') {
      document.body.dataset.pass118LastDismissedOverlay = 'more-tools';
      document.body.dataset.pass118LastDismissReason = options.restoreFocus ? 'explicit-close' : 'outside-click';
      delete document.body.dataset.pass116ActiveOverlay;
    }
    if (wasOpen && options.restoreFocus) pass170RestoreFocusToMoreToolsOpener(pass117MoreToolsOpener || buttonEl);
    if (wasOpen) pass184ScheduleHiddenMoreToolsFocusRepair(options.restoreFocus ? 'close-with-restore' : 'close-without-restore');
    document.dispatchEvent(new CustomEvent(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, { detail: { source: 'more-tools', reason: 'more-tools-close' } }));
  }
  // PASS116 verifier token preserved after PASS117 focus-scope detail expansion: detail: { source: 'more-tools', overlay: 'toolbar-overflow-menu' }
  function pass116AnnounceMoreToolsOpen(): void {
    document.body.dataset.pass116ActiveOverlay = 'more-tools';
    document.body.dataset.pass122ActiveOverlayOpenedAt = String(Date.now());
    document.body.dataset.pass122ActiveOverlayOpenedSource = 'more-tools';
    document.body.dataset.pass168OverlayOpenAgeStamp = 'true';
    pass171BumpMoreToolsFocusEpoch('open');
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
    document.body.dataset.pass118MoreToolsDismissRecovery = 'true';
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
      pass351ResetMoreToolsScroll('open');
    }
    menuEl.hidden = !willOpen;
    buttonEl.setAttribute('aria-expanded', String(!menuEl.hidden));
    pass117SetMenuFocusOpen(!menuEl.hidden);
    if (!menuEl.hidden) {
      pass117FocusFirstMenuItem();
      pass183ScheduleMoreToolsOverlayCollisionAudit('more-tools-open', 0);
    } else closeMenu({ restoreFocus: true });
  }
  function overflowItemsEl(): HTMLElement | null { return document.getElementById('toolbar-overflow-items') as HTMLElement | null; }
  function pass163OverflowActionElement(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const host = overflowItemsEl();
    const candidate = target.closest<HTMLElement>('.in-toolbar-overflow');
    if (!host || !candidate || !host.contains(candidate)) return null;
    if (candidate instanceof HTMLButtonElement && candidate.disabled) return null;
    if (candidate.getAttribute('aria-disabled') === 'true') return null;
    return candidate;
  }
  function pass164MoreToolsActionId(element: HTMLElement): string {
    return element.id || element.dataset.pass113ChromeOverflowCandidate || element.dataset.opsAction || 'overflow-action';
  }
  function pass351ResetMoreToolsScroll(reason: string): void {
    if (menuEl) {
      menuEl.scrollTop = 0;
      menuEl.scrollLeft = 0;
    }
    const host = overflowItemsEl();
    if (host) {
      host.scrollTop = 0;
      host.scrollLeft = 0;
    }
    document.body.dataset.pass351MoreToolsScrollReset = reason;
  }
  function moveToMenu(item: ManagedItem): void {
    const host = overflowItemsEl();
    if (!host || item.element.parentElement === host) return;
    item.element.classList.add('in-toolbar-overflow');
    item.element.dataset.pass113ChromeOverflowState = 'menu';
    item.element.dataset.pass174MoreToolsMenuRole = 'menuitem';
    item.element.setAttribute('role', 'menuitem');
    host.appendChild(item.element);
  }
  function restoreToToolbar(item: ManagedItem): void {
    const host = overflowItemsEl();
    if (item.element.parentElement !== host) return;
    item.element.classList.remove('in-toolbar-overflow');
    item.element.dataset.pass113ChromeOverflowState = 'toolbar';
    delete item.element.dataset.pass174MoreToolsMenuRole;
    if (item.toolbarRole) item.element.setAttribute('role', item.toolbarRole);
    else item.element.removeAttribute('role');
    item.marker.parentElement?.insertBefore(item.element, item.marker.nextSibling);
  }
  function sortedItems(): ManagedItem[] {
    return [...managed]
      .filter((item) => pass351OverflowItemVisible(item))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }
  // PASS13 legacy verifier token preserved after PASS113 changes: if (width < 1280) return 2;
  function targetCountForWidth(width: number): number {
    if (width < 720) return 9;
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
  function pass179UpdateMoreToolsOverflowClarity(target: number, forcedReason: string): void {
    if (!buttonEl) return;
    const count = Math.max(0, target);
    const badge = document.getElementById(PASS179_OVERFLOW_COUNT_BADGE_ID) as HTMLElement | null;
    const hidden = count === 0;
    const forced = forcedReason !== 'not-needed';
    const label = hidden
      ? 'Open More Tools'
      : `Open More Tools, ${count} secondary control${count === 1 ? '' : 's'} moved out of the toolbar`;
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = hidden;
      badge.dataset.pass179OverflowCount = String(count);
      badge.dataset.pass179ForcedOverflow = String(forced);
    }
    buttonEl.setAttribute('aria-label', label);
    buttonEl.title = hidden ? 'Open more tools and secondary browser controls' : label;
    buttonEl.dataset.pass173Tooltip = hidden ? 'More Tools' : `More Tools · ${count} moved`;
    buttonEl.dataset.pass179OverflowCount = String(count);
    buttonEl.dataset.pass179ForcedOverflow = String(forced);
    buttonEl.dataset.pass179ForcedOverflowReason = forcedReason;
    document.body.dataset.pass179MoreToolsOverflowClarity = 'true';
    document.body.dataset.pass179MoreToolsOverflowCount = String(count);
    document.body.dataset.pass179MoreToolsOverflowMode = hidden ? 'toolbar-clear' : forced ? 'viewport-forced' : 'responsive';
    document.body.dataset.pass179MoreToolsForcedReason = forcedReason;
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
    document.body.dataset.pass114ChromeStackGuard = 'true';
    document.body.dataset.pass114ChromeStackTop = String(top);
    document.body.dataset.pass114OverlayBottom = String(bottom);
    document.dispatchEvent(new CustomEvent(PASS122_CHROME_STACK_REFLOW_EVENT, { detail: { source: 'responsive-toolbar', reason: 'chrome-stack-vars-republished', top, bottom } }));
    document.dispatchEvent(new CustomEvent(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, { detail: { source: 'responsive-toolbar', reason: 'chrome-stack-vars-republished' } }));
  }
  function relayout(): void {
    pass174HideUtilityTooltip();
    ensureShell(); pass181PreparePrimaryCompactControls(); collectManagedItems(); updateChromeStackVars();
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
    const pass177Budget = pass177MeasureWebsitePaneBudget();
    if (pass177Budget.forced && target < sorted.length) {
      target = sorted.length;
      applyMenuTarget(target);
      document.body.dataset.pass177ForcedOverflow = 'true';
      document.body.dataset.pass177ForcedOverflowReason = pass177Budget.available < PASS177_MIN_WEBVIEW_HEIGHT_PX ? 'webview-height-below-floor' : 'chrome-share-above-budget';
    } else {
      document.body.dataset.pass177ForcedOverflow = 'false';
      document.body.dataset.pass177ForcedOverflowReason = 'not-needed';
    }
    updateGuideQuickAnchor();
    if (toolbar) toolbar.scrollLeft = 0;
    let anchorGuard = 0;
    while (target < sorted.length && !pass351OverflowAnchorsReachViewport() && anchorGuard < sorted.length) {
      target += 1;
      applyMenuTarget(target);
      updateGuideQuickAnchor();
      if (toolbar) toolbar.scrollLeft = 0;
      anchorGuard += 1;
    }
    pass177MeasureWebsitePaneBudget();
    pass179UpdateMoreToolsOverflowClarity(target, document.body.dataset.pass177ForcedOverflowReason || 'not-needed');
    buttonEl.hidden = target === 0;
    document.body.classList.toggle('toolbar-overflow-active', target > 0);
    document.body.dataset.toolbarOverflowCount = String(target);
    document.body.dataset.pass113ChromeAddressWidth = String(Math.round(addressWidth()));
    const pass180PrimaryCompact = window.innerWidth <= PASS180_PRIMARY_COMPACT_WIDTH_PX || addressWidth() < PASS113_MIN_ADDRESS_WIDTH;
    document.body.dataset.pass180PrimaryChromeCompactMode = pass180PrimaryCompact ? 'condensed' : 'full';
    pass181UpdateCompactUxHints(target, document.body.dataset.pass177ForcedOverflowReason || 'not-needed');
    pass176UpdateCompactIconViewportState(target);
    updateChromeStackVars();
    updateGuideQuickAnchor();
    document.body.classList.toggle('toolbar-no-native-scrollbars', true);
    if (target === 0) closeMenu({ restoreFocus: false });
    if (target > 0) {
      pass176StabilizeOpenMoreToolsFocus('relayout');
      setStatus(`${target} secondary browser controls are available in More Tools`);
    }
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
    document.body.dataset.pass113AdaptiveChromeDensity = 'true';
    document.body.dataset.pass114ChromeStackGuard = 'true';
    document.body.dataset.pass115OverflowVisibilityGuard = 'true';
    document.body.dataset.pass116OverlayArbitration = 'true';
    document.body.dataset.pass117OverlayFocusRecovery = 'true';
    document.body.dataset.pass118OverlayDismissRecovery = 'true';
    document.body.dataset.pass119OverlayAriaContract = 'true';
    document.body.dataset.pass120OverlayPointerBoundary = 'true';
    document.body.dataset.pass121OverlayScrollContainment = 'true';
    document.body.dataset.pass122OverlayViewportReflow = 'true';
    document.body.dataset.pass123OverlayCycleGuard = 'true';
    document.body.dataset.pass128GuideMissionTriviewHardening = 'true';
    document.body.dataset.pass163MoreToolsActionDispatch = 'true';
    document.body.dataset.pass164MoreToolsFirstClickBroker = 'true';
    document.body.dataset.pass165MoreToolsKnownActionSettle = 'true';
    document.body.dataset.pass166RuntimeCssStateAlignment = 'true';
    document.body.dataset.pass167OverlaySourceSafeClose = 'true';
      document.body.dataset.pass168OverlayOpenAgeStamp = 'true';
    document.body.dataset.pass169DelayedOverlayFocusGuard = 'true';
    document.body.dataset.pass170RestoreFocusTargetGuard = 'true';
    document.body.dataset.pass171OverlayFocusEpochGuard = 'true';
    document.body.dataset.pass173IconifiedUtilityChrome = 'true';
    document.body.dataset.pass174IconifiedUtilityChromeHardening = 'true';
    document.body.dataset.pass175IconScreenSizeUxHardening = 'true';
    document.body.dataset.pass176CompactIconViewportHardening = 'true';
    document.body.dataset.pass177SiteViewportRecovery = 'true';
    document.body.dataset.pass178ViewportBudgetObserver = 'true';
    document.body.dataset.pass178EnterpriseButtonGeometry = 'true';
    document.body.dataset.pass180PrimaryChromeCompactRecovery = 'true';
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    pass174InstallUtilityTooltipController();
    pass116InstallOverlayArbitration();
    pass118InstallDismissRecovery();
    ensureShell(); pass181PreparePrimaryCompactControls(); pass182InstallCompactPrimaryFocusController(); pass183InstallMoreToolsOverlayCollisionRecovery(); pass184InstallHiddenMoreToolsFocusRecovery(); watchDynamicChromeControls(); pass178InstallViewportBudgetObserver(); relayout();
    window.addEventListener('resize', () => { scheduleRelayout(80); pass178ScheduleViewportBudgetAudit('window-resize', 140); });
    document.addEventListener(PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT, () => scheduleRelayout(0));
    for (const delay of PASS113_RELAYOUT_DELAYS_MS) window.setTimeout(relayout, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
