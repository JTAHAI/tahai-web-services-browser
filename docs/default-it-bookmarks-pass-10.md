# Pass 10 - Default IT Bookmarks Guard

Pass 10 hardens the Chromium-style bookmarks seed and local-store recovery path.

## Fixed

- Restores the default `IT Admin` bookmarks folder in `browser/bookmarks/bookmarks.json`.
- Adds renderer-side self-healing for missing default folders in localStorage-backed bookmark state.
- Preserves user-created folders and bookmarks while adding only missing default folders.
- Applies the same default-folder guard after legacy migration and JSON import.
- Extends `verify:chromium-bookmarks` so `IT Admin` cannot disappear silently in later passes.

## Default IT Admin links

- Microsoft 365 Admin
- Microsoft Entra Admin
- Google Admin Console
- Cloudflare Dashboard
- CISA KEV Catalog
- MXToolbox
- ICANN Lookup

## Guardrail

The browser should not wipe user bookmarks to restore defaults. It should append missing default folders only, then persist the healed store.
