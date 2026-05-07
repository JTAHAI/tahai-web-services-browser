We are continuing TAHAI Web Services Browser Mission View hardening from PASS68.

Repo: C:\dev\browser\app

Latest artifact: TAHAI-browser-pass68-source-truth-hardening-20260502.zip

PASS68 changes:
- Asymmetric Tri View layouts are first-class in mission-model visible panes and labels.
- 3-Up defaults to triple-bottom instead of equal panes.
- Pane reorder has click-to-swap fallback: click one Drag Pane handle, then another; Esc cancels.
- Drag Pane handles hide until hover/focus/drag/armed state so they do not obscure webviews.
- Mission Control responsive fit/overflow guards added.
- Linux installer verifier token drift fixed.
- build/icon.ico and build/icon.png restored because the review ZIP excluded build/.
- PASS45 stale README version verifier made compatible with current package version.

Verified before container reset in prior run: npm run verify:linux-installers-config, verify:pass-68, verify:public-repo, PASS63-66 verifiers, and npm run build. Full release-blockers progressed to PASS45 stale README verifier before reset; PASS68 artifact includes the PASS45 compatibility fix, but full release-blockers still need local rerun.

Run locally:
npm ci
npm run verify:release-blockers
npm run build
