# PASS168 — Overlay Open-Age Stamp Summary

Fixed a hidden compact-window overlay timing issue. More Tools and Site View could mark themselves active without refreshing the viewport-settle open-age timestamp, so the reflow guard could dismiss them immediately instead of allowing the settle window to complete.

PASS168 centralizes active overlay stamping, adds module-owned overlay open-age stamps, updates the cycle keeper to preserve timestamps, and adds a verifier/release-blocker gate.
