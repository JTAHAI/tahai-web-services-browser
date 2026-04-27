# TAHAI Web Services Browser 1.8.0 Preview

This is an early friend-feedback preview build.

## Important Windows note

This preview installer is currently unsigned. Windows SmartScreen may show a warning. Only install this build if you downloaded it directly from TAHAI Web Services or this official GitHub repository.

Open-source publication and code-signing work are in progress.

## Known preview limitation

Keyboard back/forward shortcuts work, including `Alt+Left` and `Alt+Right`. Dedicated mouse back/forward buttons are scheduled for the next browser navigation parity pass.

## Verification

```powershell
npm ci
npm run verify:release-blockers
npm run verify:public-repo
```
