Project: TAHAI Web Services Browser

Current Windows repo path:
C:\dev\browser\app

Current stabilized source version:
1.8.0

Current source bundle:
tahai-web-services-browser-1.8.0-public-github-ready-source.zip

Goal:
Continue hardening TAHAI Browser toward an enterprise-grade public friend-feedback release, then publish the source to a public GitHub repository and proceed toward SignPath open-source code signing.

Hard rules:
- Do not use blind runtime DOM hacks.
- Fix actual Electron source, renderer templates, CSS, package resources, and installer scripts.
- Do not commit generated installers, release zips, dist, node_modules, runtime profiles, caches, secrets, certs, .env files, or local data.
- Keep Apache-2.0 LICENSE, NOTICE attribution, and TRADEMARKS.md in place.
- Verify before returning zips.

Completed 1.8.0 stabilization:
- DevOps and IT Tools buttons open again.
- Guide has packaged onboarding fallback.
- Ops Panel is more readable.
- Tool cards no longer overlap shortcut pills.
- release blockers passed locally for the previous 1.8.0 build.
- Friend-feedback Windows installer was built locally by Justin:
  - TAHAI-Web-Services-Browser-1.8.0-x64.exe
  - TAHAI-Web-Services-Browser-1.8.0-x64.msi
  - TAHAI-Web-Services-Browser-1.8.0-Preview-Friend-Feedback.zip

Open-source/public repo hardening added:
- Apache-2.0 LICENSE.
- NOTICE attribution.
- TRADEMARKS.md.
- SECURITY.md.
- CONTRIBUTING.md.
- CODE_OF_CONDUCT.md.
- SUPPORT.md.
- README.md refreshed for public preview.
- GitHub Actions validation workflow.
- GitHub Actions unsigned preview package workflow.
- Dependabot config.
- Issue templates and PR template.
- docs/open-source-release-plan.md.
- docs/code-signing-signpath-plan.md.
- docs/known-issues.md.
- scripts/verify-public-repo.mjs.
- npm script verify:public-repo.

NEXT PASS — first priority:
Implement browser mouse back/forward button parity:
- Electron BrowserWindow/BaseWindow app-command event.
- browser-backward -> active webview/tab goBack() if canGoBack().
- browser-forward -> active webview/tab goForward() if canGoForward().
- Must target the active browser tab/webview, not only the shell window.
- Must safely no-op when there is no history.
- Keep Alt+Left and Alt+Right behavior working.
- No renderer DOM hacks.
- Add/extend verification notes for installed Windows build.

Then:
1. Run npm ci.
2. Run npm run verify:public-repo.
3. Run npm run verify:release-blockers.
4. Create/push public GitHub repo JTAHAI/tahai-web-services-browser.
5. Publish unsigned 1.8.0 preview release with SmartScreen note.
6. Prepare SignPath Foundation application path.

Windows commands Justin prefers for repo/app work should start with:
wsl -d FedoraLinux-43 --cd /mnt/c/dev/tahai-os-sentinel

For this browser repo, use PowerShell path:
Set-Location C:\dev\browser\app
