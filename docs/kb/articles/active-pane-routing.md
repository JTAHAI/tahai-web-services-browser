# Active pane routing

**Screenshot target:** `docs/kb/screenshots/09-active-pane-focus.png`

## Screenshot capture checklist

- **File to add later:** `09-active-pane-focus.png`
- **Capture:** Capture a Mission View where the focused pane is visibly marked before navigation.
- **Must show:** Focused pane marker; At least one other non-focused pane; Browser navigation controls; Pane title or URL context
- **Avoid:** Ambiguous active pane state; Console noise or errors

## What this feature does

In Mission Views, back, forward, reload, address-bar navigation, and relevant commands target the active pane rather than a random tab.

## How to use it

Click a pane to focus it before navigating. If a pane cannot go back or forward, the action should safely no-op without error noise.

## Safety notes

- Keep secrets, tokens, cookies, runtime browser profiles, generated installers, and local data out of source.
- IT Docs and PSA references remain browser-side display/context unless a server-authorized workflow exists.
- Treat Mission files and exported evidence as untrusted until validated and redacted.
