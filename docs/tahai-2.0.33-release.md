# TAHAI Browser 2.0.33.0 — candidate

Status: source integration implemented; buildability audit, full native build,
runtime tests and MSIX verification pending. The fallback targets Chromium
152.0.7977.158, official tag commit
`9007248033443cbe529d18cf911d6954f5ce4f49`. The
[semantic backport inventory](chromium-152-backport-inventory.json) records the
retained product and reliability changes and excluded Chromium 154 repairs.
Earlier build evidence remains historical.

- Guard uses offline EasyList in Balanced mode and adds EasyPrivacy in Strict.
- Cosmetic hiding covers ordinary CSS filters, exceptions and later DOM changes.
  Native pause, Off and site exceptions control existing pages as well as requests.
- Guard's utility boundary limits inputs, queue size, response size and timeouts;
  private profiles retain their own protection without persistent rule writes.
- Skin packages support sandboxed import, review, install, update, rollback,
  removal, apply, reset and exact reviewed-archive export.
- Try a skin for 30 seconds with automatic recovery to the saved appearance.
- Choose from nine included palettes or Stock in the native manager. Fresh
  stock windows use the website-matched royal indigo/lavender default, while
  explicit light themes, custom Skins and system forced colors take precedence.
- Skins can provide still decoration in a separate rail slot and compact spacing.
- Save the creator kit and open its offline Skin Studio to build your own skin
  with light/dark/high-contrast controls and text-contrast validation.
- Finder opens with Ctrl+Shift+Space to search commands, tabs and saved workspaces.
- The TAHAI surface command palette adds Up/Down/Home/End navigation,
  multi-word filtering, an announced no-match state and opener focus recovery.
- Royal branding covers the product/taskbar/tile/high-DPI artwork, six default
  work-mode surfaces, Local OI panels, launchpad copy and offline creator kit.
  Active tabs have a distinct native surface. Package checks compare compiled
  mark and logo bytes against the release sources.
- Studio adds live four-pair contrast feedback, scoped Ctrl+S, bounded edits,
  stale-control protection and freshness-checked clipboard status. Its fresh
  light and dark templates are distinct Royal palettes.
- Real third-party credits replace the upstream development sample; the package
  includes filter provenance, original/derived lists, transformation and licenses.

Appearance belongs to a regular profile. System forced colors, security text,
permission prompts, focus indicators and websites retain browser control.
Filters and skins cannot install scripts, native code or arbitrary style sheets.
Provider-specific connectors, credential references, custom widgets and a new
privileged Mission-to-extension bridge are deferred to optional extensions;
they are not part of this native MSIX or prerequisites for its verification.

Release verification must use fresh binaries and real native execution. A
successful MSIX packaging run verifies the actual credits, filter lists and
creator-kit bytes in `resources.pak`, then produces a receipt and SHA-256 sidecar. The Store
package is unsigned until processed through the appropriate signing workflow.

Run `tools/tahai/verify_source.ps1 -RenderCss` before the next release build.
It does not run GN/Ninja or package anything. Its stock-Edge source render
checks are not evidence that the newly compiled TAHAI browser passes native
runtime, trust/security, operational or isolated MSIX installation gates.
