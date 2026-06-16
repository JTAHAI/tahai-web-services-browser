# PASS346 Browser History + Session Daily Driver

## Purpose

PASS346 upgrades the TAHAI Browser Kit from a shell-only quick-action lane into a more complete daily-driver surface without demoting the IT and DevOps-first UX. It adds local per-profile browsing history, recently closed tab recovery, duplicate-tab support, and non-destructive last-session restore.

## Scope

- Browser Kit recovery cards:
  - Duplicate Tab
  - Reopen Closed Tab
  - Restore Last Session
- Browser Kit dynamic lists:
  - Recent pages for the active profile
  - Recently closed tabs for the active profile
- Native app menu wiring under `History`
- Command Palette entries for the same actions
- Keyboard shortcuts:
  - `Ctrl+Shift+T` reopen closed tab
  - `Ctrl+Alt+Shift+T` duplicate active tab
- Built-app black-box coverage through PASS345

## Guardrails

- Local-only storage in renderer `localStorage`
- Per-profile partitioning through profile-scoped storage keys
- No cloud sync, no remote session service, no PSA/API/provider secrets
- No `allowpopups`, no Node in remote content, no raw IPC widening
- Session restore appends missing tabs instead of replacing the current workspace

## Acceptance

- Recent pages populate after normal browsing
- Recently closed list populates after closing a tab
- Duplicate Tab creates a new tab with the same active URL
- Reopen Closed restores the most recently closed tab in the current profile
- Restore Last Session becomes available after browsing and reopens missing tabs only
- Switching profiles keeps history/session lists scoped to the active profile
- PASS345 black-box Electron E2E proves the new flows from a built app
