(() => {
  const body = document.body;
  const walkthroughStart = document.querySelector('[data-kb-walkthrough-start]');
  const walkthroughSteps = Array.from(document.querySelectorAll('[data-kb-walkthrough-step]'));
  body.dataset.pass137KbWalkthroughReady = 'true';
  if (!body || body.dataset.pass131KbSearchReady === 'true') return;
  body.dataset.pass131KbSearchReady = 'true';
  body.dataset.pass136KbScreenshotNavigationReady = 'true';

  const input = document.querySelector('[data-kb-search-input]');
  const clearButton = document.querySelector('[data-kb-search-clear]');
  const filterButtons = Array.from(document.querySelectorAll('[data-kb-filter]'));
  const screenshotFilterButtons = Array.from(document.querySelectorAll('[data-kb-screenshot-filter]'));
  const articles = Array.from(document.querySelectorAll('[data-kb-article]'));
  const navLinks = Array.from(document.querySelectorAll('[data-kb-nav-link]'));
  const status = document.getElementById('kb-search-status');
  const empty = document.querySelector('[data-kb-search-empty]');
  const screenshotSummary = document.getElementById('kb-screenshot-status-summary');
  const screenshotCounts = document.getElementById('kb-screenshot-counts');
  const firstMissingLink = document.querySelector('[data-kb-first-missing]');
  const readyList = document.getElementById('kb-screenshot-ready-list');

  let activeScreenshotFilter = '';

  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9#+.-]+/g, ' ').trim();
  const searchableText = (article) => normalize([
    article.id,
    article.dataset.kbTitle,
    article.dataset.kbSearch,
    article.textContent
  ].join(' '));
  const index = new Map(articles.map((article) => [article.id, searchableText(article)]));

  function screenshotStateFor(article) {
    return article?.dataset?.kbScreenshotState || 'none';
  }

  function articleMatchesScreenshotFilter(article) {
    if (!activeScreenshotFilter) return true;
    const state = screenshotStateFor(article);
    if (activeScreenshotFilter === 'needs-screenshot') return state === 'awaiting' || state === 'invalid-name' || state === 'missing';
    if (activeScreenshotFilter === 'screenshot-ready') return state === 'loaded';
    return true;
  }

  function setStatus(visible, query) {
    if (!status) return;
    const total = articles.length;
    const filterLabel = activeScreenshotFilter === 'needs-screenshot'
      ? ' needing screenshots'
      : activeScreenshotFilter === 'screenshot-ready'
        ? ' with screenshots ready'
        : '';
    if (!query) status.textContent = `Showing ${visible} of ${total} KB articles${filterLabel}.`;
    else status.textContent = `Showing ${visible} of ${total} KB articles${filterLabel} for “${query}”.`;
  }

  function applySearch(rawQuery) {
    const query = normalize(rawQuery);
    const terms = query ? query.split(/\s+/).filter(Boolean) : [];
    let visible = 0;

    for (const article of articles) {
      const haystack = index.get(article.id) || '';
      const textMatched = terms.length === 0 || terms.every((term) => haystack.includes(term));
      const screenshotMatched = articleMatchesScreenshotFilter(article);
      const matched = textMatched && screenshotMatched;
      article.hidden = !matched;
      article.dataset.kbSearchMatch = matched ? 'true' : 'false';
      if (matched) visible += 1;
    }

    for (const link of navLinks) {
      const target = link.dataset.kbTarget || link.getAttribute('href')?.replace(/^#/, '') || '';
      const article = target ? document.getElementById(target) : null;
      const matched = !article || !article.hidden;
      link.hidden = !matched;
      link.dataset.kbSearchMatch = matched ? 'true' : 'false';
    }

    if (empty) empty.hidden = visible !== 0;
    setStatus(visible, rawQuery || '');
    body.dataset.pass131KbSearchActive = query || activeScreenshotFilter ? 'true' : 'false';
    body.dataset.pass131KbSearchResults = String(visible);
    body.dataset.pass136KbScreenshotFilter = activeScreenshotFilter || 'all';
  }

  function updateScreenshotCounts() {
    const slots = Array.from(document.querySelectorAll('[data-screenshot-id]'));
    const counts = { total: slots.length, loaded: 0, awaiting: 0, invalid: 0 };
    const missing = [];
    const ready = [];

    for (const slot of slots) {
      const state = slot.dataset.screenshotState || 'awaiting';
      const article = slot.closest('[data-kb-article]');
      const fileName = slot.dataset.screenshotId || '';
      if (article) article.dataset.kbScreenshotState = state === 'loaded' ? 'loaded' : state === 'invalid-name' ? 'invalid-name' : 'awaiting';
      if (state === 'loaded') {
        counts.loaded += 1;
        ready.push(fileName);
      } else if (state === 'invalid-name') {
        counts.invalid += 1;
        missing.push({ fileName, id: article?.id || 'screenshots-needed' });
      } else {
        counts.awaiting += 1;
        missing.push({ fileName, id: article?.id || 'screenshots-needed' });
      }
    }

    body.dataset.pass136KbScreenshotTotal = String(counts.total);
    body.dataset.pass136KbScreenshotsReady = String(counts.loaded);
    body.dataset.pass136KbScreenshotsAwaiting = String(counts.awaiting + counts.invalid);

    if (screenshotSummary) {
      screenshotSummary.textContent = counts.loaded === counts.total
        ? `All ${counts.total} KB screenshots are ready.`
        : `${counts.loaded} of ${counts.total} KB screenshots are ready; ${counts.awaiting + counts.invalid} still need approved PNGs.`;
    }

    if (screenshotCounts) {
      const total = screenshotCounts.querySelector('[data-kb-screenshot-count="total"]');
      const loaded = screenshotCounts.querySelector('[data-kb-screenshot-count="loaded"]');
      const awaiting = screenshotCounts.querySelector('[data-kb-screenshot-count="awaiting"]');
      if (total) total.textContent = `${counts.total} slots`;
      if (loaded) loaded.textContent = `${counts.loaded} ready`;
      if (awaiting) awaiting.textContent = `${counts.awaiting + counts.invalid} awaiting`;
    }

    if (firstMissingLink) {
      const first = missing[0];
      firstMissingLink.href = first ? `#${first.id}` : '#top';
      firstMissingLink.textContent = first ? `Jump to first missing: ${first.fileName}` : 'All screenshots ready';
    }

    if (readyList) {
      readyList.textContent = ready.length
        ? `Ready screenshots: ${ready.slice(0, 5).join(', ')}${ready.length > 5 ? `, plus ${ready.length - 5} more.` : '.'}`
        : 'Screenshots are optional during source builds. Drop approved PNGs into docs/kb/screenshots and run the ingestion command when ready.';
    }

    applySearch(input?.value || '');
  }



  function focusWalkthroughTarget(targetId) {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    document.querySelectorAll('.kb-walkthrough-active').forEach((node) => node.classList.remove('kb-walkthrough-active'));
    target.classList.add('kb-walkthrough-active');
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  walkthroughStart?.addEventListener('click', () => focusWalkthroughTarget(walkthroughStart.dataset.kbWalkthroughTarget || 'getting-started'));
  for (const step of walkthroughSteps) {
    step.addEventListener('click', (event) => {
      const targetId = step.dataset.kbWalkthroughTarget || step.getAttribute('href')?.replace('#', '');
      if (!targetId) return;
      event.preventDefault();
      window.location.hash = targetId;
      focusWalkthroughTarget(targetId);
    });
  }

  input?.addEventListener('input', () => applySearch(input.value));
  clearButton?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    activeScreenshotFilter = '';
    input.focus();
    applySearch('');
  });
  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      if (!input) return;
      activeScreenshotFilter = '';
      input.value = button.dataset.kbFilter || '';
      input.focus();
      applySearch(input.value);
    });
  }
  for (const button of screenshotFilterButtons) {
    button.addEventListener('click', () => {
      activeScreenshotFilter = button.dataset.kbScreenshotFilter || '';
      applySearch(input?.value || '');
    });
  }

  function hydrateScreenshotSlots() {
    const slots = Array.from(document.querySelectorAll('[data-screenshot-id]'));
    let loaded = 0;
    for (const slot of slots) {
      const fileName = slot.dataset.screenshotId || '';
      if (!/^[0-9]{2}-[a-z0-9-]+\.png$/.test(fileName)) {
        slot.dataset.screenshotState = 'invalid-name';
        continue;
      }
      slot.dataset.screenshotState = 'awaiting';
      const article = slot.closest('[data-kb-article]');
      if (article) article.dataset.kbScreenshotState = 'awaiting';
      const image = new Image();
      image.className = 'kb-screenshot-image';
      image.alt = slot.querySelector('span')?.textContent || 'TAHAI Browser KB screenshot';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        slot.dataset.screenshotState = 'loaded';
        if (article) article.dataset.kbScreenshotState = 'loaded';
        const label = slot.querySelector('strong');
        if (label) label.textContent = 'Screenshot ready';
        if (!slot.contains(image)) slot.appendChild(image);
        loaded += 1;
        body.dataset.pass135KbScreenshotsLoaded = String(loaded);
        updateScreenshotCounts();
      };
      image.onerror = () => {
        slot.dataset.screenshotState = 'awaiting';
        if (article) article.dataset.kbScreenshotState = 'awaiting';
        updateScreenshotCounts();
      };
      image.src = `./screenshots/${fileName}`;
    }
    body.dataset.pass135KbScreenshotSlots = String(slots.length);
    body.dataset.pass135KbScreenshotIngestionReady = 'true';
    updateScreenshotCounts();
  }

  hydrateScreenshotSlots();
  applySearch('');
})();
