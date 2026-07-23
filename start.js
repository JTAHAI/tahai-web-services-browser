(() => {
  const storeUrl = 'https://apps.microsoft.com/detail/9PJ1RHFW9GL8?hl=en-us&gl=US&ocid=pdpshare';
  const routes = [
    {title:'Get TAHAI Browser from Microsoft Store', meta:'Open the current official Windows release', url:storeUrl, badge:'Store'},
    {title:'Open Microsoft Store listing', meta:'Install TAHAI Web Services Browser through Windows', url:storeUrl, badge:'Store'},
    {title:'Mission Control', meta:'Jump to the flagship multi-pane workspace', url:'/#mission-control', badge:'Product'},
    {title:'Product screenshots', meta:'View current browser surfaces', url:'/#screenshots', badge:'Product'},
    {title:'Distribution policy', meta:'Current Microsoft Store lane and retired preview builds', url:'/code-signing-policy/', badge:'Policy'},
    {title:'Privacy policy', meta:'Browser privacy posture', url:'/privacy/', badge:'Policy'},
    {title:'TAHAI IT Docs', meta:'Operational documentation platform', url:'https://docs.tahaiportal.com', badge:'TAHAI'},
    {title:'TAHAI Web Services', meta:'Company and project work', url:'https://tahai.net', badge:'TAHAI'}
  ];
  const year = document.getElementById('site-year');
  if (year) year.textContent = String(new Date().getFullYear());
  const form = document.getElementById('site-search');
  if (form) form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('site-search-input');
    const value = (input?.value || '').trim();
    if (!value) return;
    const match = routes.find(r => (r.title + ' ' + r.meta + ' ' + r.badge).toLowerCase().includes(value.toLowerCase()));
    if (match) { location.href = match.url; return; }
    if (/^https?:\/\//i.test(value)) { location.href = value; return; }
    location.href = storeUrl;
  });
  let overlay, input, results, active = 0, filtered = routes.slice();
  function render() {
    const q = (input?.value || '').toLowerCase().trim();
    filtered = routes.filter(r => !q || (r.title + ' ' + r.meta + ' ' + r.badge).toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, filtered.length - 1));
    results.innerHTML = filtered.length
      ? filtered.map((r, i) => `<button class="command-item ${i === active ? 'is-active' : ''}" data-url="${r.url}"><span><strong>${r.title}</strong><small>${r.meta}</small></span><span>${r.badge}</span></button>`).join('')
      : '<div class="notice">No matching command. Press Enter to open the Microsoft Store listing.</div>';
  }
  function open() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'command-overlay';
      overlay.innerHTML = '<section class="command-modal" role="dialog" aria-modal="true" aria-label="Site commands"><div class="command-head"><strong>TAHAI Browser commands</strong><button aria-label="Close">×</button></div><input class="command-input" placeholder="Store, Mission Control, screenshots, privacy…"><div class="command-results"></div></section>';
      document.body.appendChild(overlay);
      input = overlay.querySelector('input');
      results = overlay.querySelector('.command-results');
      overlay.querySelector('.command-head button').onclick = close;
      overlay.onclick = e => { if (e.target === overlay) close(); };
      input.oninput = () => { active = 0; render(); };
      input.onkeydown = e => {
        if (e.key === 'ArrowDown') { active = Math.min(active + 1, filtered.length - 1); render(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
        if (e.key === 'Enter') location.href = filtered[active]?.url || storeUrl;
        if (e.key === 'Escape') close();
      };
      results.onclick = e => { const b = e.target.closest('[data-url]'); if (b) location.href = b.dataset.url; };
    }
    overlay.hidden = false;
    input.value = '';
    active = 0;
    render();
    setTimeout(() => input.focus(), 0);
  }
  function close() { if (overlay) overlay.hidden = true; }
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === 'Escape') close();
  });
})();
