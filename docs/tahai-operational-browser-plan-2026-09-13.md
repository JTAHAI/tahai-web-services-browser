# TAHAI operational browser: repository map and delivery plan

Date: 2026-09-13. Status: source audit and proposed implementation plan.

## Product direction

A TAHAI skin should let a person design how their browser looks, how their
workspace is arranged, and how their work proceeds. A creator should be able
to build a research desk, a classroom, a production studio, a shopping and
comparison workspace, an accessibility-focused environment, or an operations
console using the websites and services they choose. No TAHAI service or team
account should be required for local creation, use, or file sharing.

In the product, this is one creator experience: **Create a skin → Design the
surface → Design the workflow → Try it → Use it → Share it**. Internally,
appearance, layout, actions, permissions, and run state need distinct contracts.
Installing artwork must not silently authorize an action on a website.

This expands the earlier appearance-only skin scope. Preserve existing v1
skins and their guarantees while adding a versioned operational skin format.
The features below are proposed unless explicitly marked as existing source.

## Release brand direction

The supplied live `browser.tahai.net` reference establishes the visual direction
for the next TAHAI Browser release. It reads as a native Windows/Chromium
flagship with a dark operational cockpit, rather than a generic cyber-security
dashboard.

| Element | Release direction | Product use |
| --- | --- | --- |
| Base field | Near-black indigo with restrained ultraviolet depth and large areas of quiet space | Welcome, new tab, first-run and marketing; never the only distinction for a browser warning or control state. |
| Accent | Electric violet is the signature; lavender carries primary actions; a small warm orange/red point marks selected research or attention states | Keep each work mode identifiable, while native error, warning, security and permission colors remain Chromium-owned. |
| Type | Large, compact, high-weight display headlines; small, widely tracked uppercase labels; practical readable body copy | Use a display face only where it remains available through Windows fallback. Controls, page text and browser chrome retain accessible system typography. |
| Flight mark | A single angular line-art flight mark, rendered as a crisp vector or approved raster asset | Brand anchor for launch, empty states, Skin Studio and creator documentation. It is decorative and receives alternative text or is hidden from assistive technology. |
| Mode markers | Small outlined pills with a colored point: Daily Driver, Creator, Builder, Research and Ops/Operator | Reuse as a consistent mode identity in the rail, Finder, template gallery and package metadata. They supplement text; they never replace it. |
| Composition | Oversized statement on the left, brand mark or product preview on the right, sparse floating mode labels and a clear primary CTA | Use in promotional/new-tab surfaces. Work surfaces should become denser and more utilitarian without losing hierarchy. |
| Shape and motion | Fine violet rules, rounded controls and panels, subtle luminance bloom, slow optional ambient motion | Honor reduced motion; never use flicker, flashing transitions or motion to indicate status. |

The brand promise is: **a familiar browser that adapts to the way people work.**
Release language should speak to independent creators, learners, researchers,
personal organizers and operators before TAHAI-specific products. “Native
Windows” and “Chromium-powered web” are proof points, not the headline.

The existing native WebUI already has a related dark surface and per-mode color
tokens in `chrome/browser/ui/webui/tahai/tahai_ui.cc`; the current GitHub Pages
source at `site/index.html` is an older blue treatment and does not match the
provided live reference. Align both only through the first release-design slice,
with visual comparison on Windows light/dark, forced-colors and high-DPI
displays. Do not make a screenshot the source of truth: first recover or create
the approved flight-mark source asset, token values and typographic license/
fallback guidance in a versioned brand asset package.

## Where the work is

Primary native checkout: `C:\src\TAHAI-GA\src`.

- Branch: `codex/ga-2.0.33-chromium-152`.
- HEAD at inspection: `72a40778d7` (Finder test fix), following `dc58aac5b4`
  (2.0.33 Chromium 152 GA hardening).
- Candidate documentation identifies TAHAI 2.0.33.0 / Chromium 152.0.7977.83.
- Build output: `out/tahai_ga_release_x64`.
- The app's current directory, `D:\dev\browser\app`, is a different, older
  Electron checkout on `codex/browser-end-to-end-hardening`. Its README still
  describes Electron and IT/DevOps workflows. Its skin source checker defaults
  to another checkout, `C:\src\TAHAI-Chromium\src`. It is not the native
  source being assessed here. Historical UX material may inform design, but
  does not establish native implementation or release status.

Existing uncommitted work at inspection:

```text
chrome/browser/tahai_guard/guard_engine_browsertest.cc
chrome/browser/tahai_guard/guard_request_browsertest.cc
chrome/browser/tahai_skins/skin_profile_service.cc
chrome/browser/ui/tahai/tahai_finder.cc
chrome/browser/ui/tahai/tahai_finder_browsertest.cc
chrome/browser/ui/webui/tahai/tahai_ui.cc
tools/tahai/verify_upgrade.ps1
docs/tahai-skins/SKIN_AUTHORING.md  [untracked before this audit]
```

This audit adds only this plan. Existing changes are retained. No build,
browser test, packaging run, push, or automation was started for this audit.

## Repository map

Paths in this table are relative to the native checkout.

| Area | Primary source | What exists / implication |
| --- | --- | --- |
| Skin schema and assets | `chrome/common/tahai_skins/` | Strict v1 metadata, finite colors, density, motion preference, raster references and archive validation. No operational layout or workflow definition. |
| Sandboxed import | `chrome/services/tahai_skins/`; `chrome/browser/tahai_skins/skin_decode_session.*` | ZIP admission and still-image decoding behind a utility boundary, with limits and cancellation. Reuse this admission architecture. |
| Installed skins | `chrome/browser/tahai_skins/skin_package_store.*`, `skin_profile_service.*`, `skin_color_supplier.*` | Profile-local SQLite package store; review, apply, temporary preview, update, previous revision, removal, export and reset. Appearance ownership is profile-wide. |
| Native skin UI | `chrome/browser/ui/tahai/tahai_skin_manager.cc` | Package manager, built-in palette application, live preview and creator-kit export entry point. |
| Creator kit | `docs/tahai-skins/` | Starter manifest/artwork, `.tahaiskin` example, offline color Studio, Python builder, author reference, reproducible kit builder and tests. This is an appearance kit. |
| Work modes | `chrome/browser/ui/tahai/tahai_mode_service.*` | Six compiled definitions, twelve compiled starters, finite customization values. Unknown mode IDs are rejected. |
| Commands | `chrome/browser/ui/tahai/tahai_mode_command_model.*`, `tahai_finder.*` | Fixed native toolbar/menu command groups; Finder searches commands, tabs and saved workspaces. No creator-defined action registry. |
| Window surfaces | `chrome/browser/ui/tahai/tahai_window_mode_controller.*`, `tahai_workspace_rail_view.*`; `chrome/browser/ui/views/frame/` | Window-local mode selection, rail, native multi-pane integration and skin consumers. These are the host surfaces for a future compositor. |
| Layout persistence | `components/split_tabs/`; native frame/session integration | Dual/Tri/Quad geometry and ratio persistence; native focus/resize behavior. A finite layout system, not a general nested layout tree. |
| Saved workspaces | `chrome/browser/ui/tahai/tahai_named_workspace_store.*`, `tahai_named_workspace_controller.*`, `tahai_named_workspace_manager_view.cc` | Save/restore tabs, groups, splits, active tab, mode and rail into an independent regular-profile window. Limits: 24 saved workspaces, 64 tabs each. |
| Missions and WebUI | `chrome/browser/ui/webui/tahai/tahai_mission_service.*`, `tahai_ui.cc` | Browser-generated runbooks, checkpoints, validation/rollback steps, evidence markers, timeline, archive/restore and duplication. UI strings and behavior are substantially embedded in a large C++ source file. |
| Local intelligence | `chrome/browser/ui/webui/tahai/tahai_local_oi_*` | Local typed records, deterministic rules, search, relationships and reports. Existing scope is not a general page-data or third-party connector runtime. |
| Identity / environment | `chrome/browser/ui/tahai/tahai_identity_lane.*`, `tahai_environment_guard_registry.*`; WebUI environment guard | Real Chromium profiles remain the account/session boundary. A custom mode must not imply account isolation. |
| Operational Pack contracts | `chrome/browser/ui/webui/tahai/tahai_pack_manifest.*`, `tahai_pack_bundle.*` | Capability/origin declarations and exact-manifest Ed25519 verification. The verifier explicitly does not fetch, install, execute or persist Packs. |
| Other future contracts | WebUI `tahai_sync_*`, `tahai_team_mission_contract.*`, `tahai_pilot_contract.*`, `tahai_sentinel_*` | Useful typed boundaries; filenames and validators alone are not proof of connected sync, automation or team services. |
| Guard | `chrome/browser/tahai_guard/`; `third_party/tahai_guard_lists/` | Native filtering and bundled list source; regression dependency for arbitrary websites and workflow panes. |
| Release | `tools/tahai/verify_upgrade.ps1`, `assemble_release_evidence.ps1`; `chrome/installer/win/tahai_msix/` | Build/test evidence collection, payload checks and unsigned MSIX packaging. |
| Public site | `site/index.html`, `.github/workflows/pages.yml` | Pages source and main-branch deployment workflow. Current Store CTA is a search URL, not a product listing permalink; tahai.net is linked. Deployment and Store availability were not checked in this audit. |

## What is actually done

The appearance pipeline is substantial source implementation. It supports
light/dark/high-contrast token sets, two package density values, bounded PNG/WebP
artwork, noninteractive rail decoration, sandboxed import, local persistence,
review/apply, 30-second preview, rollback, reset and exact-archive export. Eight
built-in palettes plus Stock and a usable starter kit exist in source.

The six native modes are Daily Driver, Creator Studio, Builder Mode, Operator
Mode, Research Desk and Support Desk. They have finite customization options,
window-local selection, fixed command groups, and twelve generated starters.
Users can save a working browser arrangement. They cannot author a new mode
definition, attach their own action graph, or place arbitrary operational
controls through a skin.

Mission steps currently have a label and completion flag. The service generates
runbooks rather than accepting arbitrary authored steps, typed inputs,
conditions or external actions. Evidence markers do not capture page bodies,
screenshots or form data. A saved workspace reopens URL references; it does not
restore unsaved forms or transport an authenticated session.

There is also an integration split: `tahai_skin_resolution.*` resolves finite
built-in identities without applying appearance, while `SkinProfileService`
owns actual installed package appearance. The inspected resolution references
are its definition and tests, not an end-to-end custom mode/package binding.
Unifying effective appearance and mode selection is prerequisite work.

### Verification status, not a GA declaration

Existing logs in `out/tahai_ga_release_x64/upgrade-checks-20260912-105453/` show:

- Build exit code 0 in `build-result.json`.
- 141/141 native tests passed in `native-tests.log`.
- Five creator tests passed; creator-kit reproducibility check passed.
- Browser test log stops after 83/140 results. The user stopped the runner.
  Its `status.json` still says `running`; that is a stale on-disk marker, not
  evidence that a process is active or that verification completed.
- The preceding `upgrade-checks-20260912-103729/browser-tests.log` ended with
  a timeout in `TahaiNamedWorkspaceRestoresIntoIndependentWindow`.
- The verifier currently disables `PartitionAllocDanglingPtr` in the browser
  suite. Diagnose the earlier teardown failure and resolve it or document a
  narrowly scoped, justified exception with separate coverage. Disabling a
  detector is not proof the lifetime issue was fixed.

Older roadmap documents contain source-only and unrun-test statements that no
longer fully describe this evidence. Conversely, passing component tests does
not establish installed MSIX behavior. There is no completed release proof for
the entire current working tree in the inspected run.

## Target architecture

One operational skin can contain five independently versioned parts:

1. **Appearance:** palettes, artwork, icon roles, typography and spacing rules.
2. **Surface:** responsive layout, pane roles, panels, command placement,
   keyboard order, visibility conditions and reusable components.
3. **Modes:** creator-defined names, start surfaces, workspace templates,
   command collections and optional appearance bindings.
4. **Workflows:** typed inputs, steps, branches, checkpoints, explicit actions,
   outputs, failure handling and resumable run state.
5. **Capabilities:** the browser operations, website origins and data access
   the creator requests and the person using it actually grants.

Keep `.tahaiskin` as the user-facing package. Define a v2 container and migration
contract; interpret v1 as appearance-only. Reconcile the existing Pack signature
and capability contracts with this format rather than maintaining competing
installers. Separate editable project sources from immutable installed revisions
and from private run data. Exporting a design must not export a user's sessions,
workspace URLs, entered values or credentials by default.

Use a browser-owned registry and capability broker. Definitions refer to stable
action names with typed parameters, not raw Chromium command integers, C++ view
names or a generic privileged message channel. The broker validates the current
profile, window, document and grant when an action runs, including after an
asynchronous wait. Native browser security controls stay recognizable and
reachable in every operational surface.

Build a native component compositor for browser controls and real WebContents
panes. Give creators rich layout freedom within explicit component contracts.
Later custom widgets can use isolated HTML/CSS/JavaScript surfaces with narrow
brokered capabilities; they must not execute as privileged `chrome://` content.
Normal websites stay normal Chromium sites with their own authentication,
permissions and storage. TAHAI integrations are optional adapters using the
same public contracts as anyone else's integrations.

Store immutable operational definitions at profile scope, but resolve effective
appearance, layout and mode at window scope. Two windows must be able to use
different operational skins without theme oscillation. Existing profile theme
behavior becomes the fallback; forced colors and recovery remain browser-owned.

## Delivery batches for Terra

Each slice ends with a reviewable change, the listed acceptance evidence and
updated creator-facing documentation. Do not batch all architecture changes into
one rewrite. Paths named as new below are proposed, not present implementations.

| Batch / dependencies | Slices and implementation targets | User-visible exit condition |
| --- | --- | --- |
| **0. Establish the native release baseline** | **0.1** Reconcile existing dirty changes and release evidence; diagnose Finder teardown and workspace restore timeout. **0.2** Make verification cancellable with truthful final status, and provide an isolated test desktop or dedicated Windows runner before interactive suites resume. Hiding only the launcher is insufficient. **0.3** Close required installed-package checks; reconcile native README, old roadmap claims and artifact/source identification. | A traceable baseline that restores work reliably; tests do not commandeer the person's desktop. No new test execution is authorized by this planning document. |
| **1. Operational skin contracts** — design can proceed alongside 0 | **1.1** Define v2 schema, stable TAHAI API compatibility, component IDs, capabilities, revision identity and v1 behavior under `chrome/common/tahai_skins/`. **1.2** Add parser/validation, quotas, immutable definition storage and migrations. **1.3** Build golden examples and invalid-package fixtures; reconcile `tahai_pack_*` signing contracts and local unsigned import policy. | A creator can describe a complete surface and workflow with precise validation errors. v1 skins still install unchanged. |
| **2. User-defined modes and actions** — 1 | **2.1** Add a proposed `chrome/browser/tahai_workflows/` registry/broker; migrate the six modes into the same definition path used for custom modes. **2.2** Replace fixed mode-command switches with validated action bindings; connect Finder, rail and menu to one registry. **2.3** Bind appearance packages and workspace templates to modes with window-local resolution and safe fallback. | Duplicate Research Desk, rename it, choose unrelated websites, choose a skin and commands, save it, and reopen it beside a differently styled window. |
| **3. Detailed surface composition** — 2 | **3.1** Implement a layout tree/constraint model over current native panes and component hosts; preserve existing split/tab/session behavior and version its persistence. **3.2** Support component placement, dockable panels, command bars, breakpoint rules, spacing, icon slots, bounded typography and artwork layers. **3.3** Add preview transactions, keyboard reordering, focus validation, compact-window fallback and one-action reset. Start with supported pane counts; generalize nested content layouts only with explicit tab/session migration coverage. | A creator arranges a reference pane, working site, task panel and command bar; the design works at narrow widths and with keyboard/screen reader use. |
| **4. Custom workflow runtime** — 2; surface integration uses 3 | **4.1** Add typed inputs, variables, user-authored instructions/checklists, native actions and data bindings. **4.2** Add conditions, bounded loops, waits, timeouts, cancellation, per-step errors and optional compensation steps. **4.3** Persist run state separately from definitions with pause/resume, redacted event history and revision pinning. Extend Mission integration through a versioned adapter rather than forcing arbitrary data into its current metadata-only schema. | A person runs their own multi-step process, pauses, closes the browser, resumes safely and understands exactly which steps completed or need attention. |
| **5. Visual Skin Studio** — 3 + 4 | **5.1** Build a browser-integrated visual editor: component palette, canvas, outline, property inspector, responsive preview, undo/redo and autosaved drafts. Move maintained WebUI resources into dedicated files/build targets rather than growing `tahai_ui.cc`. **5.2** Add workflow graph and accessible list editor, variable picker, action inspector and a simulator that substitutes external effects. **5.3** Add template gallery, source editor/schema help, build diagnostics, Save Copy, import/export and first-run guidance. | A nonprogrammer can create a custom operational skin entirely in TAHAI and share a working package; an advanced creator can round-trip the same project through source editing without losing detail. |
| **6. Wider-web integrations and custom widgets** — 4 + capability review from 1 | **6.1** Ship origin-scoped permission review, invocation context, grant revocation and browser-held credential references. **6.2** Add explicit selected-content/page actions and provider-neutral connector adapters; third-party extensions may integrate through a documented narrow protocol. **6.3** Introduce isolated custom widget runtime and SDK with origin/storage separation, typed messages, resource budgets and recovery. | A mode works with chosen non-TAHAI services. Users see what it can read or change and can revoke it. A broken widget cannot disable the browser or impersonate its security controls. |
| **7. Distribution and operational-skins GA** — 0–6 | **7.1** Finish offline sharing, versioned updates, diff review, publisher identity/trust, atomic install and rollback; no automatic new permissions. **7.2** Publish templates, reference docs and compatibility policy through the site and bundled creator kit; replace the Store search CTA when the verified listing ID is available. **7.3** Complete security/accessibility/performance/upgrade gates against final binaries, package unsigned MSIX and bind its hash to evidence; then publish reviewed source and release materials. | Users can discover, create, install, update, recover and share complete operational skins in a supported release. Store submission and Store publication remain separate states. |

Useful intermediate releases: a stable appearance-kit baseline after batch 0;
an operational-mode developer preview after 1–2; a visual/workflow creator beta
after 3–5; wider-web beta after 6; the full operational-skin GA after 7. Do not
market the intermediate appearance release as the completed operational engine.

## Required workflow semantics

Specify these in batch 1 and implement them in batch 4, before admitting
effectful integrations in batch 6:

- States: ready, running, waiting for input, paused, succeeded, failed and
  cancelled. Record a step's intent/result so a restart never silently repeats
  an external write whose outcome is unknown; use idempotency where supported
  and otherwise ask the person to reconcile the result.
- Typed text/number/boolean/date/URL/selection inputs, validation rules, named
  outputs, explicit scope and retention. Sensitive values use protected
  runtime storage and are excluded from design export and routine logs.
- Conditions evaluate typed local state with a bounded expression language.
  Navigation or a website-controlled event alone cannot authorize an external
  write. Every trigger has documented scope and lifetime.
- External publishing, sending, deleting or account changes require an
  appropriate user grant and clear action UI; installing a skin is not such a
  grant. Batch 6 defines narrowly scoped reusable grants where appropriate.
- Pin runs to an installed revision; updates do not rewrite an in-flight graph.
  A removed package may disable further actions while preserving exportable
  local run history. A rollback cannot undo real-world effects automatically.
- A workspace template contains placeholders and intentional starter sites.
  An explicitly saved user's workspace can contain sensitive URL parameters;
  converting it into a shareable template requires review and sanitization.

## Templates that prove this is for the wider world

Ship at least these examples with editable source, package, screenshots,
workflow explanation and acceptance walkthrough:

| Template | Surface | Workflow |
| --- | --- | --- |
| Research desk | Sources, comparison panel, notes and reference queue | Define a question, review sources, capture explicitly selected material, compare and export a reviewed brief. |
| Creator studio | Brief, references, editor site and preview | Gather assets, complete a checklist, review an output and explicitly initiate publishing through an available adapter. |
| Personal planning | Calendar/task sites, reading queue and local checklist | Collect priorities, compare options, make a plan and record follow-up. Basic local use requires no connector or account. |
| Learning space | Course page, practice page, notes and progress panel | Choose a lesson, perform exercises, record completion and resume later. |
| Operations console | Ticket, documentation, diagnostic view and runbook | Select scope, inspect, follow steps, validate and prepare a reviewed handoff. TAHAI services are optional destinations. |
| Blank canvas / accessible focus | Minimal browser surface and one working pane | Build from scratch with large controls, keyboard-first navigation and adjustable information density. |

The detailed author documentation must explain the design model, component
reference, token and asset rules, layout constraints, workflow/state semantics,
action parameter schemas, capabilities, credentials, widget protocol, package
trust, debugging, migration and publishing. Generate reference tables from
the actual schemas/registries to reduce documentation drift. Keep the current
v1 guide clearly labeled until v2 exists.

## Evidence required before calling this delivered

- A clean-machine user creates a mode and surface, builds a branched workflow,
  packages it, and another user imports and runs it without a TAHAI account.
- Two windows with different modes/skins remain independent through theme
  changes, restart and workspace restoration. Profile and private-mode tests
  cover every broker and storage boundary.
- Malformed packages, stale grants, cross-origin messages, widget crashes,
  definition updates during a run, disk-full and interrupted installs fail
  without losing the last good design or silently replaying external effects.
- Keyboard-only operation, Narrator/UIA, forced colors, zoom/DPI, reduced motion
  and narrow-window behavior are checked for both Studio and exported surfaces.
- Guard remains correct for each pane, redirects, workers, login recovery and
  policy. Workflow code cannot inherit a blanket ability to disable protection.
- Establish and record reference-hardware CPU/memory/startup/resize budgets
  before beta; measure representative complex skins and prolonged use. Do not
  choose performance claims from unmeasured targets.
- Validate installed-package upgrade from the prior supported release, v1/v2
  skin migration, workflow persistence/recovery, creator-kit contents, notices,
  manifest and payload against the actual candidate. Keep detector exclusions
  visible in evidence and require justified, scoped treatment.
- Bind final source revision plus working-tree state, build configuration,
  test results, smoke records and MSIX hash. A stopped run or an old artifact
  cannot satisfy the release gate.

The immediate engineering handoff is batch 0 plus the schema/design work in
batch 1. The first expansion users should receive is the ability to create
their own named mode, bind its own appearance, choose real websites and native
actions, and reopen the resulting workspace. That establishes the runtime
foundation needed for detailed surface design and authored workflows.
