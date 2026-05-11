# TAHAI Browser KB Screenshot Intake

PASS130 defines the screenshot contract for the Knowledge Base. Add screenshots only after review and only when they are safe for public/source distribution.

## Global capture rules

- Use PNG format.
- Prefer full-window screenshots unless a focused crop makes the feature clearer.
- Use safe demo pages, local pages, or sanitized placeholder data.
- Do not show customer names, private URLs, account IDs, secrets, cookies, auth headers, cloud credentials, runtime profiles, local filesystem paths, generated installers, `dist/`, `release/`, `node_modules/`, or `.git` internals.
- Keep the active pane marker visible for Mission View screenshots.
- Keep browser chrome visible when the screenshot is teaching where to click.
- Add the same approved screenshot to `docs/kb/screenshots/` and `browser/onboarding/screenshots/` only when it is ready to ship.

## Screenshot list

### 01. Main browser window / normal mode

- **File:** `01-main-browser-normal-mode.png`
- **Article:** `docs/kb/articles/getting-started.md`
- **Priority:** required
- **Capture:** Capture the full browser window in normal mode with the tab strip, address bar, toolbar controls, and page area visible.
- **Must show:** Tabs and address bar; Back/forward/reload controls; Guide / KB or its compact Guide anchor; No modal dialogs covering the page
- **Avoid:** Personal bookmarks with sensitive names; Signed-in account details; Private URLs or customer data

### 02. Guide / Knowledge Base entry point

- **File:** `02-guide-kb-entry.png`
- **Article:** `docs/kb/articles/guide-kb.md`
- **Priority:** required
- **Capture:** Capture the Guide / KB entry point. At a narrow width, include the compact Guide anchor next to More Tools if possible.
- **Must show:** Guide / KB button or compact Guide anchor; More Tools state if the window is narrow; Enough toolbar context to show where the user clicks
- **Avoid:** Private profile details; Unneeded page content

### 03. Mission Control open

- **File:** `03-mission-control-open.png`
- **Article:** `docs/kb/articles/mission-control.md`
- **Priority:** required
- **Capture:** Open Mission Control and capture the full window with the Mission panel, layout controls, and workbench area visible.
- **Must show:** Mission Control modal or panel open; Mission layout controls; Workbench/content area; Small-window compact behavior if testing a narrow window
- **Avoid:** Real customer mission names; Private ticket/project details

### 04. Mission Tabs

- **File:** `04-mission-tabs.png`
- **Article:** `docs/kb/articles/mission-tabs.md`
- **Priority:** required
- **Capture:** Capture a mission with tabs added and at least one role label visible.
- **Must show:** Selected mission name; Mission tab list or chips; Role selector or role labels; Local save/restore context if visible
- **Avoid:** Production credentials; Customer-specific admin console data

### 05. 2-Up Split View

- **File:** `05-two-up-split-view.png`
- **Article:** `docs/kb/articles/two-up-split-view.md`
- **Priority:** required
- **Capture:** Capture two panes with visibly different safe pages, such as docs plus a launch page.
- **Must show:** Two visible panes; Active pane marker; Pane labels or controls; Address/navigation context
- **Avoid:** Sites with private sessions; Any secret-bearing console pages

### 06. 3-Up Top

- **File:** `06-three-up-top.png`
- **Article:** `docs/kb/articles/three-up-top.md`
- **Priority:** required
- **Capture:** Capture the tri-view variant with one wide pane on top and two smaller panes beneath it.
- **Must show:** One wide top pane; Two lower panes; 3-Up Top control or command result if visible; Active pane marker
- **Avoid:** Confusing 3-Up Bottom layout; Overlapping pane chrome

### 07. 3-Up Bottom

- **File:** `07-three-up-bottom.png`
- **Article:** `docs/kb/articles/three-up-bottom.md`
- **Priority:** required
- **Capture:** Capture the tri-view variant with two smaller panes above and one wide pane on the bottom.
- **Must show:** Two upper panes; One wide bottom pane; 3-Up Bottom control or command result if visible; Active pane marker
- **Avoid:** Confusing 3-Up Top layout; Overlapping pane chrome

### 08. Quad View

- **File:** `08-quad-view.png`
- **Article:** `docs/kb/articles/quad-view.md`
- **Priority:** required
- **Capture:** Capture four panes in the 2x2 operator layout with the active pane clearly visible.
- **Must show:** Four panes; Pane dividers; Active pane marker; No clipped critical controls
- **Avoid:** Tiny unreadable panes; Private operational dashboards

### 09. Active pane focus state

- **File:** `09-active-pane-focus.png`
- **Article:** `docs/kb/articles/active-pane-routing.md`
- **Priority:** required
- **Capture:** Capture a Mission View where the focused pane is visibly marked before navigation.
- **Must show:** Focused pane marker; At least one other non-focused pane; Browser navigation controls; Pane title or URL context
- **Avoid:** Ambiguous active pane state; Console noise or errors

### 10. Runbook Rail

- **File:** `10-runbook-rail.png`
- **Article:** `docs/kb/articles/runbook-rail.md`
- **Priority:** recommended
- **Capture:** Open the Runbook Rail and capture checklist, notes, or rollback fields with safe placeholder text.
- **Must show:** Runbook Rail open; Checklist or notes area; Mission context; No secrets in sample notes
- **Avoid:** Real incident notes; Names, phone numbers, or ticket details

### 11. Operator Command Center

- **File:** `11-command-center.png`
- **Article:** `docs/kb/articles/command-center.md`
- **Priority:** recommended
- **Capture:** Open Ctrl+K / Operator Command Center and capture layout, mission, and tool commands.
- **Must show:** Command search or palette; At least several commands; Mission or view commands; Keyboard-first context
- **Avoid:** Commands exposing private paths; Debug-only internals

### 12. DevOps tools lane

- **File:** `12-devops-tools.png`
- **Article:** `docs/kb/articles/devops-tools.md`
- **Priority:** recommended
- **Capture:** Open the DevOps tools lane and capture the visible tool cards.
- **Must show:** DevOps lane open; Capture/Ops Check/Deploy/Routes/Dev Audit/Ops Guard/DevTools if visible; No vertical clipping
- **Avoid:** Private repository or deployment data; Unreviewed private operational data

### 13. IT tools lane

- **File:** `13-it-tools.png`
- **Article:** `docs/kb/articles/it-tools.md`
- **Priority:** recommended
- **Capture:** Open the IT tools lane and capture IT Card, Endpoint, Triage, or Secret Boundary cards.
- **Must show:** IT lane open; Visible IT/admin cards; Safe placeholder data only
- **Avoid:** Device serials, private IPs, user data; Unreviewed private operational data

### 14. Site View rail

- **File:** `14-site-view-rail.png`
- **Article:** `docs/kb/articles/site-view-rail.md`
- **Priority:** recommended
- **Capture:** Open Site View beside a safe page or Mission View and capture how site context is shown.
- **Must show:** Site View rail open; Page/site context; Pane or tab context if applicable
- **Avoid:** Private site names or admin portals; Unreviewed private operational data

### 15. Evidence and export

- **File:** `15-evidence-export.png`
- **Article:** `docs/kb/articles/evidence-export.md`
- **Priority:** recommended
- **Capture:** Capture the evidence/export UI using safe demo content and the redaction/preview flow if available.
- **Must show:** Evidence or export panel; Preview/export action; Redaction/safety language if visible; Safe demo notes
- **Avoid:** Tokens, cookies, auth headers, private keys, customer screenshots; Unreviewed private operational data

### 16. Downloads and installers

- **File:** `16-downloads-installers.png`
- **Article:** `docs/kb/articles/downloads-installers.md`
- **Priority:** recommended
- **Capture:** Capture the downloads or installer surface showing package choices and checksum context.
- **Must show:** Windows/Linux package options if visible; Checksum or verification language; Signing/preview posture if visible
- **Avoid:** Local filesystem paths; Unsigned installer warning screens unless intentionally documenting them

### 17. Settings, profiles, and safety

- **File:** `17-settings-security.png`
- **Article:** `docs/kb/articles/settings-security.md`
- **Priority:** recommended
- **Capture:** Capture settings or profile safety controls without showing private profile data.
- **Must show:** Settings panel/page; Profile or safety/privacy controls; Clear non-secret sample values
- **Avoid:** Real profile names, synced accounts, cookies, local paths; Unreviewed private operational data

### 18. Empty/error/blocked state

- **File:** `18-error-empty-blocked-state.png`
- **Article:** `docs/kb/articles/troubleshooting-states.md`
- **Priority:** recommended
- **Capture:** Capture one useful troubleshooting state such as disabled integration, offline state, blocked unsafe URL, redaction warning, or empty state.
- **Must show:** The warning/empty/blocked message; Suggested user action; No stack trace unless it is an intentional dev-only screenshot
- **Avoid:** Raw errors containing paths or secrets; Sensitive URLs or tenant IDs

## PASS135 ingestion workflow

1. Capture sanitized PNG screenshots only.
2. Save them under `docs/kb/screenshots/` with the exact file names listed in `docs/kb/screenshot-manifest.json`.
3. Run `npm run kb:screenshots:ingest -- --apply`.
4. Run `npm run verify:pass-135-kb-screenshot-ingestion`.
5. Confirm the in-app KB shows “Screenshot ready” for supplied captures and “Awaiting screenshot” for missing captures.

The ingestion command rejects unlisted files, non-PNG files, over-size files, and path traversal attempts. Missing screenshots are not a build blocker.


## PASS137 walkthrough capture

19. `19-first-run-walkthrough.png` — First-run walkthrough
   - Open the Guide / KB and capture the guided first-run walkthrough panel with the Start walkthrough control and the main step list visible.
   - Do not include signed-in account details, private URLs, customer names, local filesystem paths, or runtime profile data.
