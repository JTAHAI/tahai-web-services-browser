(() => {
  const body = document.body;
  if (!body || body.dataset.pass131KbSearchReady === 'true') return;
  body.dataset.pass131KbSearchReady = 'true';

  const input = document.querySelector('[data-kb-search-input]');
  const clearButton = document.querySelector('[data-kb-search-clear]');
  const filterButtons = Array.from(document.querySelectorAll('[data-kb-filter]'));
  const articles = Array.from(document.querySelectorAll('[data-kb-article]'));
  const navLinks = Array.from(document.querySelectorAll('[data-kb-nav-link]'));
  const status = document.getElementById('kb-search-status');
  const empty = document.querySelector('[data-kb-search-empty]');

  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9#+.-]+/g, ' ').trim();
  const searchableText = (article) => normalize([
    article.id,
    article.dataset.kbTitle,
    article.dataset.kbSearch,
    article.textContent
  ].join(' '));
  const index = new Map(articles.map((article) => [article.id, searchableText(article)]));

  function setStatus(visible, query) {
    if (!status) return;
    const total = articles.length;
    if (!query) status.textContent = `Showing all ${total} KB articles.`;
    else status.textContent = `Showing ${visible} of ${total} KB articles for “${query}”.`;
  }

  function applySearch(rawQuery) {
    const query = normalize(rawQuery);
    const terms = query ? query.split(/\s+/).filter(Boolean) : [];
    let visible = 0;

    for (const article of articles) {
      const haystack = index.get(article.id) || '';
      const matched = terms.length === 0 || terms.every((term) => haystack.includes(term));
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
    body.dataset.pass131KbSearchActive = query ? 'true' : 'false';
    body.dataset.pass131KbSearchResults = String(visible);
  }

  input?.addEventListener('input', () => applySearch(input.value));
  clearButton?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    input.focus();
    applySearch('');
  });
  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      if (!input) return;
      input.value = button.dataset.kbFilter || '';
      input.focus();
      applySearch(input.value);
    });
  }
  applySearch('');
})();
