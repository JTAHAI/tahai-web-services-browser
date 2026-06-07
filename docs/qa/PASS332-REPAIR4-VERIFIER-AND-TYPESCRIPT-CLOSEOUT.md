# PASS332 Repair 4 — Verifier + TypeScript Closeout

Fixes the PASS332 verifier and TypeScript build break reported from local Windows testing.

Repairs:
- Removes the verifier self-false-positive for CommonJS `require` by avoiding the literal token in verifier source.
- Narrows unsafe protocol scanning to `normalizeShellUrl`, not blank URL classification helpers.
- Repairs TypeScript inference by typing the scored webview array as `Pass332WebviewInfo[]`.

Expected commands:

```powershell
npm run verify:pass-332-webview-navigation-owner-truth
npm run build
```
