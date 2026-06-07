# PASS271-R1 — TypeScript Build Blocker Closeout QA

## Acceptance

- `npm run build` no longer fails on PASS255-PASS259 renderer additions.
- PASS255 uses `MissionTabRef`, not an undefined `MissionTab` type.
- PASS255/PASS256 timeline events use allowed `MissionTimelineEventKind` values.
- PASS256 mount routing normalizes broad `MissionLayoutType` values before calling the narrower state-machine transition API.
- PASS258 and PASS259 runtime hooks are typed and do not rely on implicit `any` or undeclared `window` properties.
- No version bump or release claim is introduced.

## Verification

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r1-typescript-build-blocker-closeout.mjs
npm run verify:pass-271-r1-typescript-build-blocker-closeout
```

For a quick gate without a full build:

```powershell
npm run verify:pass-271-r1-typescript-build-blocker-closeout -- --static-only
```
