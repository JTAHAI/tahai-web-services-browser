# PASS329 ESM verifier repair

The original PASS329 verifier was written as CommonJS inside a `.mjs` file. On the current repo/Node runtime, `.mjs` is executed as an ES module and `require(...)` is undefined.

This repair replaces the verifier with an ESM-native implementation using `import fs from 'node:fs'` and `import path from 'node:path'`.

Run:

```powershell
Set-Location D:\dev\browser\app
npm run verify:pass-329-runtime-lifecycle-geometry-sentry
npm run build
```
