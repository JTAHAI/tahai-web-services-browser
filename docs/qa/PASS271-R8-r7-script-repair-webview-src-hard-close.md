# PASS271-R8 — R7 Script Repair + Webview Src Hard Close

## Problem

PASS271-R7 did not apply because the apply script contained an unescaped template-literal backtick inside its Markdown body. That is why the local app showed no runtime change after R7.

The underlying runtime issue remains: the renderer creates an Electron webview and appends it before a safe src is present. The main-process webview attach boundary validates params.src during will-attach-webview, so an empty src can be blocked before the post-append safe-load path executes.

## Fix

- Seed the sanitized safeUrl on the webview before stageEl.appendChild(webview).
- Mark the legacy PASS239 initial-src-deferred flag false for this path.
- Preserve the existing PASS236 post-append safe-load telemetry.
- Add CSS to keep normal 1-Up browsing webviews as the top interactive surface.
- Replace the broken R7 apply script with a small wrapper that delegates to R8.

## Scope

Browser-side only. No IT Docs backend code. No PSA connector code. No direct PSA/API calls. No secrets.
