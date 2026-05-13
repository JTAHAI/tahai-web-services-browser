# PASS189 — Settings Screen Public Copy Closeout

The Settings dialog must be readable as product UI, not an internal pass ledger. Security/privacy notes may remain visible, but they must be phrased for operators instead of exposing pass numbers or implementation language.

## Public-copy rule
Visible Settings text must not contain:

- PASS numbers
- source-repo language
- renderer/main-process language
- SSRF terminology
- boundary/handoff labels
- trusted-shell implementation language

## Preserved behavior
This pass does not relax the underlying permission, download, path-disclosure, drop, capture, settings, diagnostics, or tab-metadata safety gates. It only changes the user-facing copy and updates the verifiers to guard against visible dev-language regression.
