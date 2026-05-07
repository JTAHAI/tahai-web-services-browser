(() => {
  type BootState = {
    startedAt: number;
    appScriptSeen: boolean;
    ready: boolean;
    lastError: string;
  };

  const state: BootState = {
    startedAt: Date.now(),
    appScriptSeen: false,
    ready: false,
    lastError: ''
  };

  function detailEl(): HTMLElement | null {
    return document.getElementById('boot-diagnostic-detail');
  }

  function panelEl(): HTMLElement | null {
    return document.getElementById('boot-diagnostic');
  }

  function setBootDetail(message: string): void {
    state.lastError = message;
    const el = detailEl();
    if (el) el.textContent = message;
  }

  function showBootPanel(message: string): void {
    setBootDetail(message);
    panelEl()?.removeAttribute('hidden');
  }

  function hideBootPanel(): void {
    panelEl()?.setAttribute('hidden', 'true');
  }

  function currentScriptLabel(): string {
    const current = document.currentScript as HTMLScriptElement | null;
    return current?.src ? current.src.split('/').pop() || current.src : 'boot.js';
  }

  document.documentElement.dataset.tahaiBootPreflight = '1';
  setBootDetail(`Renderer boot preflight loaded from ${currentScriptLabel()}; waiting for the application bundle.`);

  window.addEventListener('tahai-renderer-app-script', () => {
    state.appScriptSeen = true;
    setBootDetail('Renderer application bundle is executing; waiting for shell ready marker.');
  });

  window.addEventListener('tahai-renderer-ready', () => {
    state.ready = true;
    document.documentElement.dataset.tahaiShellReady = '1';
    hideBootPanel();
  });

  window.addEventListener('error', (event) => {
    const filename = event.filename ? event.filename.split('/').pop() : 'renderer';
    const line = event.lineno ? `:${event.lineno}${event.colno ? `:${event.colno}` : ''}` : '';
    showBootPanel(`Renderer script error in ${filename}${line}: ${event.message || 'unknown error'}`);
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'unknown rejection');
    showBootPanel(`Renderer promise rejection: ${reason}`);
  }, true);

  window.setTimeout(() => {
    if (state.ready || document.documentElement.dataset.tahaiShellReady === '1') return;
    const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
    if (!state.appScriptSeen) {
      showBootPanel(`Renderer boot watchdog: app.js did not execute within ${elapsed}s. Re-run npm run build so the renderer bundle is generated, then start the app again.`);
      return;
    }
    showBootPanel(`Renderer boot watchdog: app.js executed but did not report ready within ${elapsed}s. Last renderer detail: ${state.lastError || 'no error captured'}.`);
  }, 9000);
})();
