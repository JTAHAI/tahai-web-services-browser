# First-run walkthrough

Screenshot target: `docs/kb/screenshots/19-first-run-walkthrough.png`

## Screenshot capture checklist

Capture prompt: Open the Guide / KB and capture the guided first-run walkthrough panel with the Start walkthrough control and the main step list visible.

Must show:
- Guide / KB walkthrough panel
- Start walkthrough control
- Mission Control, Mission Views, Tools, Evidence, and Troubleshooting steps
- No private page content or account details

Avoid:
- Signed-in account details
- Private URLs, customer names, local filesystem paths, or runtime profile data
- Any secret-bearing console content

## What this feature does

The first-run walkthrough turns the local Guide / Knowledge Base into a practical starting path for new users. It explains the safe order for learning the browser: normal browsing, Guide / KB, Mission Control, pane layouts, active-pane routing, Runbook Rail, command workflows, tools, evidence/export, settings, and troubleshooting states.

## How to use it

1. Open **Guide / Knowledge Base** from the browser toolbar or More Tools fallback.
2. Select **Start walkthrough** in the KB hero or walkthrough panel.
3. Work through the steps in order: normal mode, Guide access, Mission Control, Mission Tabs, Mission Views, active pane routing, Runbook Rail, Command Center, tools, evidence/export, settings, and troubleshooting.
4. Use the search box to jump to any feature you need to revisit.
5. Add screenshots later through the PASS135 screenshot ingestion workflow.

## Safety notes

The walkthrough is local static documentation. It must not call remote services, collect telemetry, write cookies, use browser storage, or depend on IT Docs/PSA backend behavior. Keep all screenshots sanitized before adding them to the repo.
