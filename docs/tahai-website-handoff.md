# TAHAI Browser: finish the Cloudflare website update

## Task

Update and publish the existing browser.tahai.net website, then verify it and the browser's GitHub Pages site. This is website work only, not a browser release or an MSIX build.

Repository: https://github.com/JTAHAI/tahai-web-services-browser
GitHub Pages: https://jtahai.github.io/tahai-web-services-browser/
Cloudflare production: https://browser.tahai.net/
Official Store product: https://apps.microsoft.com/detail/9PJ1RHFW9GL8?hl=en-us&gl=US
Company website: https://tahai.net

Justin's latest supplied Codex direction was to replace the stale Electron source on main with the native Chromium browser and publish a GitHub Pages site linking to the actual Microsoft Store listing and tahai.net. The current product must not be marketed as an Electron shell. Do not confuse the existence of the Store listing with certification or publication of the latest development build.

## Inspect before editing

1. Read current remote main and site/index.html. Its content revision is `2026-09-13-native-sites-1`. Verify the actual remote commit; do not assume a local worktree is current.
2. The supplied native worktree was C:\src\TAHAI-GA\src. Confirm it before using it. Locate the existing browser website source and Cloudflare deployment configuration through the known browser worktrees and existing authenticated tooling. Do not assume a retired Electron worktree is the active native source.
3. Identify the real Cloudflare project, production branch, build output, and custom-domain mapping. Do not create another project, replace DNS, invent a build-hook URL, print credentials, or modify another TAHAI product.
4. Preserve local changes and any running Chromium/MSIX verification. No reset, clean, force push, unrelated-history merge, wholesale checkout, native rebuild, or installer packaging for this website task.

## Website changes

Use the updated GitHub landing page as the wording reference, but preserve Cloudflare's existing product screenshots, brand assets, navigation, responsive behavior, privacy policy, distribution policy, and routes.

- Link prominent install buttons directly to Store product 9PJ1RHFW9GL8. Do not use a Store search route or say the listing is waiting for first publication.
- Keep visible links to tahai.net, the native repository, and the browser's GitHub Pages site.
- Present TAHAI as a Windows-native Chromium browser. Remove stale "native rebuild approaching" and "next-generation native edition" framing. Refer to the former Electron implementation only as history.
- Keep Mission Control, Dual/Tri/Quad/Focus layouts, workflow-aware Work Modes, and the difference between Work Modes and skins clear. Do not replace the rich Cloudflare showcase with a three-card placeholder.
- Add creator-kit and starter-skin downloads. The existing repository files are docs/tahai-skins/skin-creator-kit.zip and docs/tahai-skins/starter-skin.tahaiskin; the updated landing page links to their raw GitHub download URLs. Copy their exact bytes into the appropriate Cloudflare output or use verified published download URLs; check archive contents and file hashes.
- Describe skin compatibility and native request blocking as release-dependent development. Do not claim all source features are in the Store package, full blocker coverage, or Brave parity. Do not fabricate a missing SKIN_AUTHORING.md; recover the real local document or inspect the existing creator kit first.
- Update release-related introductory/footer copy on the privacy and distribution pages where it still describes a future first native release. Preserve their substantive privacy, security, and signing commitments.
- Explain that the Store carries published releases, GitHub contains ongoing native development, and a source commit or unsigned MSIX is not a newly published/certified release. Do not claim a new version, Store certification, signed direct download, or GA without package-specific evidence.

IMPORTANT: Do not deploy site/ alone over the current Cloudflare project. That folder uses an existing browser.tahai.net screenshot and links to existing Cloudflare policy routes. A complete Cloudflare publish must retain those assets and routes. Prefer patching the real current Cloudflare source. A shared source can be introduced only after preserving the complete production site and verifying both hosting base paths.

## Verify and publish

Run the existing website build and tests. Check mobile, tablet, and desktop layouts, keyboard navigation, anchor targets, screenshots, download archives, privacy/distribution routes, canonical/social metadata, and every Store/company/source link. Ensure GitHub project-subpath hosting and Cloudflare root hosting both work; do not add a GitHub CNAME that redirects the Pages site away.

Publish through the existing authenticated Cloudflare deployment path. Record the exact source commit, deployment ID, deployment result, and production URLs. Fetch both production pages and check the updated copy and downloads, not just HTTP 200. A successful GitHub Pages run is not proof of Cloudflare publication.

Report: files changed, commit, GitHub Pages status, Cloudflare status, live checks, and any exact remaining blocker. Never report Cloudflare as updated unless its production response has been checked. Do not touch browser binaries or call this a browser GA release.

## Inspection boundary

This handoff was prepared on 2026-09-13 after inspecting the supplied Codex transcript, GitHub main, and the public Cloudflare pages. No Cloudflare deployment connector was available in the originating chat. Cloudflare source location, project configuration, and deployment were not verified there.
