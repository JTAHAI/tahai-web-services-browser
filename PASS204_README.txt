PASS204 — Operator Command Center v2

Apply after PASS203.

Commands:
Set-Location C:\dev\browser\app
npm ci
node scripts\apply-pass204-operator-command-center-v2.mjs
npm run verify:pass-204-operator-command-center-v2
npm run verify:release-blockers
npm run build

Boundary: browser-side/local-only command center UX. No IT Docs backend code, no PSA connector code, no direct PSA API calls, no signing or GA claim.
