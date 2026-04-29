# Pass 12 — Local Runtime and Git Repair Guardrails

Pass 12 adds local-machine repair guardrails for two issues that can happen after expanding a full source ZIP into a clean folder:

1. `npm run build` succeeds, but `npm run dev` fails with `Electron failed to install correctly`.
2. The expanded source folder has no `.git` directory because release/source ZIPs intentionally exclude Git metadata.

## Electron install repair

This error is a local `node_modules/electron` install problem, not a TypeScript or application-source failure.

Run from PowerShell:

```powershell
Set-Location C:\dev\browser\app
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\repair-electron-install.ps1
```

The script removes only the broken Electron package folder and Electron binary caches, runs `npm ci`, then reruns the release gates and `npm run dev`.

## Reconnect the GitHub remote

Source ZIPs do not contain `.git`, `node_modules`, generated packages, local runtime profiles, or secrets. After the app builds and boots cleanly, restore the canonical GitHub remote with:

```powershell
Set-Location C:\dev\browser\app
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\reconnect-github-remote.ps1
```

Review `git status`. When ready to commit and push:

```powershell
.\scripts\reconnect-github-remote.ps1 -Push
```

Canonical public repo:

```text
https://github.com/JTAHAI/tahai-web-services-browser.git
```

## Source hygiene

These scripts do not store GitHub tokens, Electron binaries, generated release artifacts, local browser profiles, or secrets in the repo.
