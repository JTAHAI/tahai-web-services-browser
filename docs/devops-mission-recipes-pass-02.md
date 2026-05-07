# Pass 02 - DevOps Mission Recipes v1

This pass starts Phase 1 of the TAHAI browser roadmap: DevOps-first Mission Control.

## Added

DevOps Mission Recipes are now first-class mission starters. Each recipe can carry:

- a mission phase (`devops`, `it`, or `general`),
- a target profile lane,
- mission tabs and pane roles,
- a Mission Control layout,
- a primary action,
- a stop condition,
- recipe-specific runbook steps,
- evidence prompts.

## DevOps recipes

- Deploy Cockpit
- GitHub Actions Monitor
- DNS Migration Cockpit
- Cloudflare Change
- AWS Release Cockpit
- Vercel / Firebase Release
- Incident War Room
- Developer Debug Cockpit

## Shortcut

`Ctrl+Alt+D` starts the DevOps Deploy Cockpit.

## Guardrails

These remain browser-side only. No provider API secrets, no direct PSA calls, no generic shell/eval IPC, and no writeback to IT Docs or PSA from this repo.
