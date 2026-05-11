# PASS176 — Compact Icon Viewport Hardening Summary

Version remains `1.8.30`.

PASS176 hardens the responsive/iconified chrome after PASS175:

- Open More Tools relayout now repairs stale focus when viewport changes move controls in or out of the menu.
- More Tools toggle now has an explicit `aria-controls` relationship to the overflow menu.
- Runtime density markers identify full toolbar, mixed toolbar/menu, and all-utility-in-More-Tools states.
- Compact utility controls and More Tools menu items have safer hit targets, including coarse-pointer hardening.
- Compact Mission layout controls preserve visible focus and scroll the active layout control into view.

No generated artifacts, installers, release outputs, caches, node_modules, local runtime data, backend code, PSA connector code, secrets, or credentials are included.
