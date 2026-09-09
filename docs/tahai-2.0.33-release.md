# TAHAI Browser 2.0.33.0 — candidate

Status: source changes implemented; full native build, runtime tests and MSIX
verification pending. Ported to Chromium 152.0.7977.83; see
`tahai-ga-2026-09-06.md` for the current build and validation state.

- Guard uses offline EasyList in Balanced mode and adds EasyPrivacy in Strict.
- Cosmetic hiding covers ordinary CSS filters, exceptions and later DOM changes.
  Native pause, Off and site exceptions control existing pages as well as requests.
- Guard's utility boundary limits inputs, queue size, response size and timeouts;
  private profiles retain their own protection without persistent rule writes.
- Skin packages support sandboxed import, review, install, update, rollback,
  removal, apply, reset and exact reviewed-archive export.
- Try a skin for 30 seconds with automatic recovery to the saved appearance.
- Choose from eight included palettes or Stock in the native manager.
- Skins can provide still decoration in a separate rail slot and compact spacing.
- Save the creator kit and open its offline Skin Studio to build your own skin
  with light/dark/high-contrast controls and text-contrast validation.
- Finder opens with Ctrl+Shift+Space to search commands, tabs and saved workspaces.
- Real third-party credits replace the upstream development sample; the package
  includes filter provenance, original/derived lists, transformation and licenses.

Appearance belongs to a regular profile. System forced colors, security text,
permission prompts, focus indicators and websites retain browser control.
Filters and skins cannot install scripts, native code or arbitrary style sheets.

Release verification must use fresh binaries and real native execution. A
successful MSIX packaging run verifies the actual credits, filter lists and
creator-kit bytes in `resources.pak`, then produces a receipt and SHA-256 sidecar. The Store
package is unsigned until processed through the appropriate signing workflow.
