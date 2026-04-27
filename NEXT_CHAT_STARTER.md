Project: TAHAI Web Services Browser

Current canonical repo:
https://github.com/JTAHAI/tahai-web-services-browser

Current Windows repo path:
C:\dev\browser\app

Current stabilized source version:
1.8.1

Current status:
- 1.8.0 friend-feedback Windows build exists locally.
- Public GitHub repo has been created and pushed under JTAHAI/tahai-web-services-browser.
- Source is Apache-2.0 with NOTICE and TRADEMARKS.md attribution.
- SignPath Foundation open-source code signing application has been submitted.
- Current release may be distributed unsigned with clear SmartScreen / unsigned preview note while signing is pending.
- 1.8.1 source pass adds mouse Button 4 / Button 5 navigation parity through Electron app-command events.

Hard rules:
- Do not use blind runtime DOM hacks.
- Fix actual Electron source, renderer templates, CSS, package resources, and installer scripts.
- Do not commit generated installers, release zips, dist, node_modules, runtime profiles, caches, secrets, certs, .env files, or local data.
- Keep Apache-2.0 LICENSE, NOTICE attribution, TRADEMARKS.md, SECURITY.md, docs/code-signing-policy.md, and docs/privacy-policy.md in place.
- Verify before returning zips or installer artifacts.
- Be explicit when Windows-only packaging/signing cannot be verified in ChatGPT.

Completed 1.8.1 navigation parity hardening:
- Added BrowserWindow app-command handler in src/main/main.ts.
- browser-backward routes to renderer menu command back.
- browser-forward routes to renderer menu command forward.
- Renderer routes Back/Forward through goBackIfPossible() / goForwardIfPossible().
- Active webview/tab remains the single navigation target.
- No history safely no-ops because canGoBack() / canGoForward() guard the action.
- Alt+Left, Alt+Right, toolbar Back/Forward, and History menu Back/Forward share the same active-tab path.
- RELEASE_NOTES_1.8.1_PREVIEW.md documents installed Windows hardware verification.

Verification completed in ChatGPT container:
- node scripts/verify-public-repo.mjs passed.
- node scripts/verify-enterprise-release.mjs passed.

Verification still required on local Windows repo:
- npm ci
- npm run verify:public-repo
- npm run verify:release-blockers
- npm run package:win:release
- npm run release:friend:zip
- Installed app hardware test for Mouse Button 4 / Button 5.

Useful Windows commands:
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:release-blockers

Windows package commands:
Set-Location C:\dev\browser\app
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run package:win:release
npm run release:friend:zip

Installed Windows navigation test:
1. Open any normal website in a browser tab.
2. Navigate two or more pages deep in that same tab.
3. Press Mouse Button 4 and confirm the active tab goes back like Chrome/Edge.
4. Press Mouse Button 5 and confirm the active tab goes forward like Chrome/Edge.
5. Open a new tab with no history and confirm Mouse Button 4 / 5 safely no-op without visible error.

Git commands after verified source fix:
git status
git add -A
git commit -m "Add mouse back forward navigation parity"
git push

NEXT PASS recommendation:
After local Windows verification, build the 1.8.1 unsigned friend-feedback installer, publish a GitHub release draft with checksums, and keep SignPath signed-release work separate from the unsigned preview lane.
