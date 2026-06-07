# PASS254 — Mission Recipe Click Contract Hardening

Purpose:
- Increment the 2.0.x lane to 2.0.3.
- Make Mission Recipe cards select and start missions through a single delegated click contract.
- Ensure recipe selection visibly populates mission type, layout, preflight, runbook, evidence, export profile, policy tags, and URL/pane intent.
- Ensure recipe start hydrates Mission Control with mission state, runtime tabs, pane mappings, runbook, evidence prompts, timeline event, and visible layout state.
- Add repair/diagnostic truth so a recipe click cannot silently do nothing.

Run after overlay:

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass250-store-submission-evidence-identity-prep.mjs
node scripts\apply-pass251-mission-multiview-final-polish.mjs
node scripts\apply-pass252-mission-multiview-state-hardening.mjs
node scripts\apply-pass253-mission-pane-viewport-hardening.mjs
node scripts\apply-pass254-mission-recipe-click-contract.mjs
npm run verify:pass-254-mission-recipe-click-contract
```

Manual smoke:
- Open Mission Control.
- Change mission type.
- Click multiple Mission Recipe cards.
- Confirm selected recipe preview changes and mission type/layout/runbook/evidence details populate.
- Click Start Mission from each flagship recipe.
- Confirm Mission Control opens populated panes instead of doing nothing.
- Switch 1-Up, 2-Up, 3-Up, Quad, Focus, and back; website panes should remain visible.
