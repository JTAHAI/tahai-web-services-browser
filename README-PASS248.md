# PASS248 — MSIX Local Blocker Repair

PASS248 repairs the two issues found during local PASS247 Store/MSIX execution:

1. The existing local `v2.0.0` tag did not point at the new PASS247 commit.
2. The MSIX PowerShell build script had an invalid leading character before `param(...)`, which made Windows PowerShell fail before packaging.

Run after overlay:

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run build
```

Then, after committing PASS248:

```powershell
git status --short
git add .
git commit -m "PASS248: repair MSIX local blockers"
npm run repair:store-tag:v2.0.0
npm run verify:store:git
npm run package:win:msix
```

`repair:store-tag:v2.0.0` only moves the local tag. Push or force-push the public tag only deliberately.
