/* TAHAI Browser website. No browser runtime or private data integration. */
(() => {
  'use strict';
  const scriptURL = document.currentScript?.src || new URL('./start-20260913-operational-everyone.js', location.href).href;
  const siteRoot = new URL('./', scriptURL);
  const local = path => new URL(path.replace(/^\//, ''), siteRoot).href;
  const store = 'https://apps.microsoft.com/detail/9PJ1RHFW9GL8';
  const github = 'https://github.com/JTAHAI/tahai-web-services-browser';
  document.documentElement.classList.add('js-ready');
  document.querySelectorAll('[data-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
  const header = document.querySelector('[data-header]');
  const setScrolled = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
  window.addEventListener('scroll', setScrolled, { passive: true });
  setScrolled();

  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const closeMenu = () => {
    toggle?.setAttribute('aria-expanded', 'false');
    nav?.classList.remove('is-open');
    const label = toggle?.querySelector('.sr-only');
    if (label) label.textContent = 'Open navigation';
  };
  toggle?.addEventListener('click', () => {
    const opening = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(opening));
    nav?.classList.toggle('is-open', opening);
    const label = toggle.querySelector('.sr-only');
    if (label) label.textContent = opening ? 'Close navigation' : 'Open navigation';
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  window.addEventListener('resize', () => { if (window.innerWidth > 1080) closeMenu(); });
  document.addEventListener('click', event => {
    if (nav?.classList.contains('is-open') && !nav.contains(event.target) && !toggle?.contains(event.target)) closeMenu();
  });

  // Progressive enhancement: without JavaScript, all mode descriptions remain visible.
  const tabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
  const panels = Array.from(document.querySelectorAll('.mode-panel[role="tabpanel"]'));
  const activate = (tab, focus = false) => {
    if (!tab) return;
    const panelID = tab.getAttribute('aria-controls');
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.classList.toggle('is-active', selected);
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== panelID; });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
      else next = (index + 1) % tabs.length;
      activate(tabs[next], true);
    });
  });
  activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);

  const lightbox = document.querySelector('[data-lightbox]');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption-output]');
  let lightboxReturn = null;
  const closeLightbox = () => {
    if (!lightbox?.open) return;
    lightbox.close();
  };
  document.querySelectorAll('[data-lightbox-open]').forEach(button => {
    button.addEventListener('click', () => {
      if (!lightbox || typeof lightbox.showModal !== 'function') return;
      const image = button.querySelector('img');
      const src = button.getAttribute('data-lightbox-src') || image?.getAttribute('src');
      if (!src) return;
      const caption = button.getAttribute('data-lightbox-caption') || image?.alt || 'TAHAI Browser screenshot';
      if (lightboxImage) { lightboxImage.src = src; lightboxImage.alt = caption; }
      if (lightboxCaption) lightboxCaption.textContent = caption;
      closeCommands(false);
      lightboxReturn = button;
      lightbox.showModal();
      document.body.classList.add('has-overlay');
      document.querySelector('[data-lightbox-close]')?.focus();
    });
  });
  document.querySelector('[data-lightbox-close]')?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  lightbox?.addEventListener('close', () => {
    document.body.classList.remove('has-overlay');
    if (lightboxReturn?.isConnected) lightboxReturn.focus({ preventScroll: true });
  });

  const routes = [
    { title: 'For Everyone', detail: 'Everyday browsing, learning, creating, shopping, comparing, planning and operations', badge: 'Purpose', url: local('/#for-everyone') },
    { title: 'Mission Control', detail: 'Multi-view browser workspaces and active panes', badge: 'Product', url: local('/#mission-control') },
    { title: 'Product screenshots', detail: 'Mission Control, Dual View, Tri View and Quad View', badge: 'Gallery', url: local('/#screenshots') },
    { title: 'Work Modes', detail: 'Daily Driver, Creator, Builder, Research and Ops', badge: 'Workflows', url: local('/#work-modes') },
    { title: 'Operational skins', detail: 'Redefine your operational layer: surface, modes, workflows and permissions', badge: 'Direction', url: local('/skins/#operational-model') },
    { title: 'Current v1 creator kit', detail: 'Appearance-format foundation, offline color Studio and starter skin', badge: 'Create', url: local('/skins/#creator-kit') },
    { title: 'Native foundation', detail: 'Native Windows and Chromium, beyond Electron', badge: 'Native', url: local('/#native') },
    { title: 'Request guard and Local OI', detail: 'Blocking and Local Operational Intelligence development', badge: 'Development', url: local('/#protection') },
    { title: 'Download TAHAI Browser', detail: 'Official Store listing and release information', badge: 'Download', url: local('/downloads/') },
    { title: 'Microsoft Store', detail: 'Open the official Windows package listing', badge: 'External', url: store },
    { title: 'Native source on GitHub', detail: 'Inspect the source and follow development', badge: 'External', url: github },
    { title: 'Feedback and bug reports', detail: 'Browser version, reproduction steps and suggestions', badge: 'External', url: github + '/issues' },
    { title: 'Privacy', detail: 'Local data, evidence and deliberate sharing', badge: 'Policy', url: local('/privacy/') },
    { title: 'Distribution policy', detail: 'Published packages, source builds and signing status', badge: 'Policy', url: local('/code-signing-policy/') },
    { title: 'TAHAI Web Services', detail: 'Visit the company website', badge: 'External', url: 'https://tahai.net' }
  ];
  const overlay = document.querySelector('[data-command-overlay]');
  const input = document.querySelector('[data-command-input]');
  const results = document.querySelector('[data-command-results]');
  let filtered = routes.slice();
  let active = 0;
  let returnFocus = null;
  let inertBefore = [];
  const announcer = document.createElement('span');
  announcer.className = 'sr-only';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  overlay?.append(announcer);
  const render = () => {
    if (!results) return;
    const query = (input?.value || '').trim().toLowerCase();
    filtered = routes.filter(route => `${route.title} ${route.detail} ${route.badge}`.toLowerCase().includes(query));
    active = Math.min(active, Math.max(0, filtered.length - 1));
    results.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'command-empty'; empty.textContent = 'No matching section. Try “skins”, “Mission”, “privacy”, or “downloads”.';
      results.append(empty);
    }
    filtered.forEach((route, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-item' + (active === index ? ' is-active' : '');
      button.dataset.commandIndex = String(index);
      const copy = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = route.title;
      const detail = document.createElement('small'); detail.textContent = route.detail;
      const badge = document.createElement('span'); badge.textContent = route.badge;
      copy.append(title, detail); button.append(copy, badge); results.append(button);
    });
    announcer.textContent = filtered.length ? `${filtered.length} results. ${filtered[active].title}.` : 'No results.';
  };
  function closeCommands(restore = true) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('has-overlay');
    inertBefore.forEach(([element, previous]) => { element.inert = previous; });
    inertBefore = [];
    if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  const openCommands = trigger => {
    if (!overlay) return;
    closeMenu(); closeLightbox();
    returnFocus = trigger || document.activeElement;
    inertBefore = Array.from(document.querySelectorAll('header, main, footer, .skip-link')).map(element => [element, element.inert]);
    inertBefore.forEach(([element]) => { element.inert = true; });
    overlay.hidden = false;
    document.body.classList.add('has-overlay');
    if (input) input.value = '';
    active = 0; render(); input?.focus();
  };
  const run = route => {
    if (!route) return;
    closeCommands();
    const url = new URL(route.url);
    if (url.origin === siteRoot.origin && url.pathname.startsWith(siteRoot.pathname)) location.href = url.href;
    else window.open(url.href, '_blank', 'noopener,noreferrer');
  };
  document.querySelectorAll('[data-command-open]').forEach(button => button.addEventListener('click', () => openCommands(button)));
  document.querySelector('[data-command-close]')?.addEventListener('click', () => closeCommands());
  input?.addEventListener('input', () => { active = 0; render(); });
  input?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = Math.max(0, Math.min(filtered.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)));
      render(); results?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') { event.preventDefault(); run(filtered[active]); }
  });
  results?.addEventListener('click', event => {
    const button = event.target.closest('[data-command-index]');
    if (button) run(filtered[Number(button.dataset.commandIndex)]);
  });
  overlay?.addEventListener('click', event => { if (event.target === overlay) closeCommands(); });
  overlay?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')).filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
      event.preventDefault();
      if (overlay?.hidden) openCommands(document.activeElement); else closeCommands();
    } else if (event.key === 'Escape') {
      const menuWasOpen = nav?.classList.contains('is-open');
      closeMenu(); closeCommands(); closeLightbox();
      if (menuWasOpen) toggle?.focus();
    }
  });
  window.addEventListener('hashchange', () => { closeMenu(); closeCommands(false); });
})();
