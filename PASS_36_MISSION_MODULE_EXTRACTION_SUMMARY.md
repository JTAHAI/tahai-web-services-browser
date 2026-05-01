# Pass 36 — Mission module extraction

- Extracted mission constants, labels, role inference, pane visibility, runbook factories, recipe blueprint generation, mission factory/duplicate helpers, timeline mutation, layout sync, and Markdown export into `src/renderer/mission-model.ts`.
- Renderer shell now imports shared Mission types from `src/shared/mission-types.ts` instead of owning duplicate local type aliases.
- Mission creation, duplication, layout pane syncing, and export preview now delegate to extracted mission model helpers.
- Added `scripts/verify-pass-36-mission-module-extraction.mjs` and wired it into `verify:release-blockers`.
- Incremented package and lockfile version to `1.8.13`.
