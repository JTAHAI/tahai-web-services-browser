# PASS142 — Electron Security Final Audit

PASS142 closes the Electron security audit lane before enterprise-release packaging freezes. The browser remains version `1.8.30` and this pass is source-only.

## Audit scope

PASS142 checks and documents the runtime boundary between the privileged Electron main process, the preload bridge, the renderer shell, and remote webview content.

The pass focuses on:

- BrowserWindow hardening: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, and `allowRunningInsecureContent: false`.
- Webview hardening: centralized `contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=yes,devTools=yes` preferences with popup permission absent from renderer-created webviews; PASS153 owns popup/attach enforcement in the main process.
- Runtime blocked protocols for `ftp:`, `gopher:`, `javascript:`, `data:`, and `vbscript:`.
- IPC allowlist coverage for every `ipcMain.handle` channel exposed to the renderer shell.
- Renderer event allowlist coverage for the main-process channels sent back to preload.
- Safe external open discipline through `safeOpenExternal` only.
- Shell-origin enforcement before privileged IPC handlers execute.

## Source contract

The canonical Electron security contract now lives in:

- `src/shared/electron-security-contract.ts`

That file is intentionally shared by the main process, runtime security module, and renderer shell so future changes do not silently drift across duplicated string literals.

## IPC allowlist rule

Every trusted invoke channel must be listed in `TAHAI_TRUSTED_IPC_CHANNELS` and asserted during registration with `assertTrustedIpcChannel(...)` before `ipcMain.handle(...)` is installed.

Forbidden channel families remain blocked, including direct PSA fetches, secret getters, cookie dumps, raw file read/write channels, generic shell/exec/eval channels, and open-anywhere URL helpers.

## Renderer event rule

Main-process events sent back to the renderer must use the trusted renderer event contract. The supported event channels are:

- `tahai-browser:open-in-tab`
- `tahai-browser:menu-command`
- `tahai-browser:toggle-devtools`
- `tahai-browser:download-state`

## What PASS142 does not claim

PASS142 is a source/static audit and build gate. It does not claim a full installed-app manual smoke run. Manual smoke continues in PASS146 and PASS147.

## Verification

Run:

```bash
npm run build
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:pass-142-electron-security-final-audit
npm run verify:release-blockers
```
