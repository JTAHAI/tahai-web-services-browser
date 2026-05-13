# First-run walkthrough

Screenshot target: `docs/kb/screenshots/19-first-run-walkthrough.png`

## Screenshot capture checklist

Capture prompt: Open the Guide / KB and capture the guided first-run walkthrough panel with the Start walkthrough control and the main step list visible.

Must show:
- Guide / KB walkthrough panel
- Start walkthrough control
- First 10 minutes operator path
- Mission Control, Mission Views, Tools, Evidence, Settings, and Troubleshooting steps
- No private page content or account details

Avoid:
- Signed-in account details
- Private URLs, customer names, local filesystem paths, or runtime profile data
- Any secret-bearing console content

## What this feature does

The first-run walkthrough gives new users a safe order for learning the browser. Version 2 starts with the fastest operator path: confirm normal browsing, open Mission Control, try Mission Views, use Runbook Rail, open DevOps/IT tools, capture/export safely, review settings, and recognize troubleshooting states.

## How to use it

1. Open **Guide / Knowledge Base** from the browser toolbar or More Tools fallback.
2. Use **First 10 minutes** when you want the fast path for a new IT admin or DevOps operator.
3. Select **Start walkthrough** for the full guided sequence.
4. Work through normal mode, Guide access, Mission Control, Mission Tabs, Mission Views, active pane routing, Runbook Rail, Command Center, tools, evidence/export, settings, and troubleshooting.
5. Use the search box to jump to any feature you need to revisit.
6. Add screenshots later through the screenshot ingestion workflow.

## Safety notes

The walkthrough is local static documentation. It must not call remote services, collect telemetry, write cookies, use browser storage, or depend on IT Docs/PSA backend behavior. Keep all screenshots sanitized before adding them to the repo.
