# PASS114 — Chrome Stack Guard Summary

Version remains `1.8.30`.

PASS114 hardens the post-PASS112/PASS113 chrome by replacing stale fixed overlay offsets with a measured chrome-stack anchor. More Tools, DevOps/IT tool lanes, Ops Panel, and Site View now anchor beneath the actual titlebar + toolbar stack and use bounded heights so they do not collide with the adaptive chrome or status bar.

Verifier added:

```powershell
npm run verify:pass-114-chrome-stack-guard
```

Wired into:

```powershell
npm run verify:release-blockers
```
