# PASS254 — Mission Recipe Click Contract Hardening

PASS254 makes Mission Recipes a flagship, deterministic entry point instead of a passive card list.

## Contract

Every visible recipe card must expose stable recipe identity and support two actions:

1. Select / preview the recipe.
2. Start the Mission from the recipe.

The browser must not rely on per-card handlers that can be lost during `innerHTML` re-renders. PASS254 installs a delegated event handler and a card annotation pass so freshly-rendered cards are wired after every Mission Recipe render.

## Required visible population

Selecting a recipe populates:

- mission type
- recommended layout
- safe URL count
- preflight state
- runbook steps
- evidence prompts
- export profile
- policy tags
- expected pane roles

## Required start hydration

Starting a recipe verifies and repairs when possible:

- current mission exists
- mission name/type match the recipe
- runbook exists
- evidence prompts exist
- timeline has a recipe-start event
- runtime tabs exist
- mission tabs exist
- panes have tab IDs
- active pane is visible
- Mission layout renders

If a Quad or multi-view recipe has too few safe URLs, PASS254 fills missing visible panes with the configured new-tab/local launch surface instead of leaving a dead blank pane.

## Store gate posture

Microsoft Store submission remains blocked until recipe click/start/hydration and Quad View switching pass installed visual smoke.
