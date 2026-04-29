(function () {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const aliases = new Map([
    ['tahai', 'https://tahaiportal.com'], ['portal', 'https://tahaiportal.com'], ['home', 'https://tahaiportal.com'], ['os', 'https://os.tahai.net'], ['sentinel', 'https://sentinel.tahai.net'], ['docs', 'https://docs.tahaiportal.com'],
    ['chatgpt', 'https://chatgpt.com'], ['openai', 'https://platform.openai.com'], ['anthropic', 'https://console.anthropic.com'], ['claude', 'https://console.anthropic.com'], ['gemini', 'https://aistudio.google.com'], ['groq', 'https://console.groq.com'],
    ['aws', 'https://console.aws.amazon.com'], ['azure', 'https://portal.azure.com'], ['gcp', 'https://console.cloud.google.com'], ['cloudflare', 'https://dash.cloudflare.com'], ['vercel', 'https://vercel.com/dashboard'], ['github', 'https://github.com'],
    ['m365', 'https://admin.microsoft.com'], ['entra', 'https://entra.microsoft.com'], ['google admin', 'https://admin.google.com']
  ]);
  function isProbablyUrl(value) { return /^(https?:\/\/|file:\/\/|localhost(:\d+)?\/|[\w.-]+\.[a-z]{2,})(.*)?$/i.test(value); }
  function resolveTarget(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if (aliases.has(lower)) return aliases.get(lower);
    if (isProbablyUrl(value)) return /^(https?:\/\/|file:\/\/)/i.test(value) ? value : `https://${value}`;
    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }
  document.querySelectorAll('img[data-fallback], img[data-optional]').forEach(function (img) {
    img.addEventListener('error', function () {
      const fallback = img.getAttribute('data-fallback');
      if (fallback && img.src.indexOf(fallback) === -1) {
        img.src = fallback;
        return;
      }
      if (img.getAttribute('data-optional') === 'true') {
        img.closest('.footer-stage')?.classList.add('missing-media');
      }
    }, { once: true });
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const target = resolveTarget(input.value);
    if (target) window.location.assign(target);
  });
})();
