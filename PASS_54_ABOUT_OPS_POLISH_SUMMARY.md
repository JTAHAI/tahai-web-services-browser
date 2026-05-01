# PASS 54 — About Page and Ops Panel Polish

## Fixed
- Removed CSP-blocked inline styles from the local About page and moved them into browser/about/styles.css.
- Expanded the About page with useful project links: TAHAI, Browser site, GitHub repo, IT Docs, SENTINEL, and TAHAI OS.
- Constrained the SENTINEL logo inside its card to prevent image bleed and horizontal page scrollbars.
- Repaired Ops Panel launch recipe rows so provider/shortcut chips stack below titles instead of overlapping.
- Added a Mission Control chip containment override so the same overlap regression does not return in the Mission recipe drawer.
- Incremented the source package version to 1.8.28.

## Verification
- npm run verify:pass-54-about-ops-polish
- npm run build
