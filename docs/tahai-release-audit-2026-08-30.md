# TAHAI native Windows release audit — 2026-08-30

## Current decision

**Not GA-certified. No new verified MSIX for the current source.**
A source implementation, validator, disabled button, contract, or synthetic test
does not satisfy a feature's native interaction and installed-package acceptance.

The previous release output is stale: chrome.exe/chrome.dll date from August 27,
the focused native test executable from August 25, and browser_tests.exe was
absent at inspection. The final-build log ending August 29 contains failed
transform_stream_default_controller and transferable_streams compilation edges.
Its stderr log is empty; the root cause has not been established.

Disk headroom was initially critical. A later read-only check found C: 113.24 GiB
and D: 42.92 GiB free. This agent did not delete old packages or user files.
Treat free space as a live prerequisite, not a permanent blocker or build-success
claim.

## Scope truth

Windows native Chromium only. Electron-era reports and mobile packages do not
count. The user's earlier permission to cap deferred UI does not mean those
features are implemented. Proprietary Chrome/Edge sync remains unavailable;
TAHAI-owned Drive/OneDrive provider contracts are not live cloud transports.

| Area | Source finding | Remaining before full feature/GA claim |
| --- | --- | --- |
| Native rail | Three persisted choices, vector icons/direct actions, labels, hidden/menu recovery, migration and source regressions | Compile/run both rail browser tests, all modes/DPI/contrast/Narrator and installed-upgrade visual checks |
| Modes and multi-view | Window controller, native command/menu variants, real Dual/Tri/Quad/Focus | Complete every approved mode-refactor acceptance; precise session state, pane actions and UX must be demonstrated, not inferred |
| Named workspaces | Versioned profile store and native save/open/rename/delete manager, group/pane restoration into a new window, explicit URL privacy disclosure and managed policy | Fresh compile/runtime validation, process-restart and install QA; thumbnails, suspend/form preservation, import/export and startup workflows remain separate unfinished work |
| Identity Lanes | Routes fixed destinations into real existing Chromium Profiles | Automatic tenant/domain routing and full lane-management workflow are not active |
| Environment Guard | Exact-origin registry and scoped clipboard review/enforcement | Universal navigation/upload/download/paste enforcement is not established |
| Mission Capsules | Sanitized local envelope and generated-runbook import; OS-protected keyring | Key recovery/export and cross-device portability are not implemented; same-profile encryption is not full portable sync |
| TAHAI Sync | Object/provider contracts, envelope crypto and conflict model | OAuth client provisioning, consented transport, device pairing/revocation, recovery and live conflict UX |
| Signed Packs | Bounded manifest and Ed25519 verification primitive | Governed trust-store deployment, actual install/update/rollback/uninstall workflow |
| Change Lens | Explicit metadata/digest capture and local comparisons | Real page/screenshot capture, visual diff and redaction workflow |
| Sentinel | Saved manual recheck configuration and due-state calculation | Automatic scheduler/refresh watchers are not running |
| Recall | Search over finite Local OI projections | Broad saved research/bookmark/tab/history/download indexing is not present |
| Pilot | Closed action-permission contracts; deterministic Local OI briefs | A live governed model/tool execution workflow is not present |
| Team/War Room | Local role/handoff contracts | No remote participants, presence, cross-device sharing, or verified multi-monitor orchestration |
| Local OI | Profile service/store, typed records, deterministic rules, search/relationships, redacted reports | Native persistence/policy/private-mode tests, runtime UI flows, retention and large-data measurements |
| DNS/TLS Support | Explicit public-host diagnostic with bounded metadata | Execute transport/private-address/cancellation/browser tests; no MX/NS/TXT or live ITDocs connector |
| TAHAI Guard | Source for pinned sandboxed engine, separate regular/incognito owners, production factory/redirect filtering, managed policy, Custom-rule editor and native document-bound recovery panel; 54 mandatory browser-test definitions | Compilation/runtime proof, licensed defaults/updates, cosmetic scope, complete coverage and performance remain unfinished |
| TAHAI Skins | Shared strict validation and sandboxed decoder; regular-profile bounded SQLite package store, native chooser/review/install/update/rollback/remove manager, policy controls; 5 store and 22 mandatory browser-test definitions | No compile/runtime proof; actual appearance preview/apply/revert, Studio, export, launch assets and safe-UI recovery remain unfinished |
| Enterprise | Chromium inherited policy plus new TAHAI Local OI policy definitions/handlers | Real Windows managed-policy deployment, operational guidance, update/security cadence and measured release gates |
| UX/accessibility/localization | Source controls and selected regression coverage | Full keyboard/Narrator/DPI/RTL/translation matrix is not proven |
| Windows distribution | Native manifest/branding and package validation script | Fresh binary tests, signing/install/upgrade/repair, per-surface branding and package payload proof |

Guard/Skins scope: chrome/browser/ui/tahai/TAHAI_GUARD_SKINS_ROADMAP.md.
Original native mode specification:
D:/dev/browser/app/TAHAI_WINDOWS_MODE_UI_REFACTOR_SPEC.md.
The latest 100-upgrade plan is preserved at:
D:/dev/browser/app/TAHAI_WINDOWS_NEXT_100_UPGRADES.md.

## Repairs made during this audit

- Imported pinned adblock-rust 0.12.6 and required source dependencies, restored
  omitted license texts with provenance, and verified 339 archive files across
  15 imported/activated packages. Added a sandboxed immutable-generation engine
  and bounded browser-side IPC session with deadlines/cancellation. Ten new
  native browser-test definitions are required by the package evidence gate.
  A subsequent source batch added regular-profile ownership, the production
  factory hook, managed policy and Custom-rule UI. Separate ephemeral incognito
  engines and controlled owner/proxy-failure cases followed. Native document-bound
  recovery, exact-site editing, all-mode menu access and eleven additional
  request/UI regressions now bring the source inventory to 54 Guard browser-test
  definitions are now mandatory. Details and remaining gates are in
  `docs/tahai-guard-engine.md`. GN header checks and
  archive comparison passed; native Guard compilation/runtime tests are unrun.

- The native Guard panel cannot silently retarget a permission-changing action
  after navigation or a pane switch. Temporary grants are memory-only, bounded,
  revoked on document/settings changes, isolated from workers and private/regular
  profiles, and rechecked before posted decisions forward a request. Managed
  restrictions remain authoritative. This is source implementation, not a runtime
  protection or enterprise-certification claim. The package gate additionally
  requires a `guard-native-panel` isolated smoke assertion.

- Added eleven Windows Local OI policy definitions, stable downstream policy IDs,
  an atomic policy group, policy-handler bindings, and policy-pref mapping cases.
- Added the sandboxed Skins decoder and browser-side output admission below
  WebUI authority. It rejects literal path aliases, links/special entries,
  encrypted/unsupported ZIP methods, excessive ratios/sizes, mismatched CRC/hash,
  unsupported/animated images and excessive pixel allocations. The browser
  copies returned shared-memory pixels rather than exposing their writable
  backing to Views. Windows device/trailing-dot paths and fractional compression
  ratio bypasses were tightened in the shared validator. Fourteen browser-test
  definitions and two native validator regressions are mandatory in the package
  gate; none has run against a freshly compiled browser. A later source batch
  added package storage and a native manager, described below; actual appearance
  selection/application, live preview/revert and recovery remain unfinished.
- Blocked direct Local OI writes, finding transitions and recalculation when the
  effective master setting is disabled; report-ledger writes also honor report
  policy. Deleting retained local records remains allowed.
- Added managed-policy override and mutation/persistence regression source.
- Added the Network Service's connection-time local-address block to diagnostic
  HEAD requests, plus cache bypass and suppressed login prompts. Added option/
  guidance regressions and an actual Network Service browser-test case. These
  C++ tests have not yet run.
- Made packaging require explicit version/fresh output directory and fresh
  hash-bound build/test/smoke evidence. Removed automatic overwrite/deletion.
  Added staged-versus-unpacked payload hashing, architecture verification,
  package SHA-256 and an explicitly unsigned/non-certified receipt.
- Moved the shared ModeService source/header into the native UI layer and
  updated all found native includes/GN references. Suppressed no-op preference
  saves/notifications and unrelated-mode window refreshes; added unit/browser
  regression source for both behaviors. No timing claim is made.
- Added native Tri/Quad row and column dividers, mouse/touch resizing, F6/arrow
  access, Home/double-click reset, constrained geometry, interrupted-drag
  handling, and split-identity checks. Orientation-only changes preserve the
  existing split, active page and divider ratios. Versioned session and
  recently-closed trailers retain the ratios; legacy data remains balanced.
  Added eight new focused native/browser regression definitions and extended
  existing session/private-window cases. These are source implementations and
  regression definitions, not passing runtime results. See
  `docs/tahai-grid-layout.md` for the contract and remaining validation.
- Made pane-count changes prepare new panes before removing the original split.
  Added four failure-path/sibling-retention browser regressions to the package
  gate; cleanup does not close tabs that acquired navigation or unload state.
- Implemented profile-local named workspaces and a native manager, with bounded
  versioned validation, same-profile new-window restoration, lazy background
  tabs, retained groups/layout ratios and window-local mode/rail state. Added
  a managed policy plus five native and five browser regression definitions,
  including a two-process persistence pair.
  Native app-menu/Daily/rail controls now reach this actual workflow. See
  `docs/tahai-named-workspaces.md`; this is not completion of other workspace
  roadmap items or evidence of runtime correctness.

Checks actually executed after the source edits:
- Chromium policy syntax validator: 11 new definitions, zero policy errors/
  warnings (Python emits an unrelated existing escape-sequence warning).
- Local OI source verifier: passed.
- WebUI script verifier: 39 scripts passed.
- Packaging evidence guard: 22 synthetic cases passed, including Windows
  PowerShell 5.1. These are packaging-guard tests, not native browser tests.
- Selected changed tracked files: git diff whitespace check passed.
- GN header dependency checks passed for the focused native test and Local OI
  browser-test targets. These checks do not compile or execute C++. Automatic
  toolchain discovery needed the existing VS 2026 Build Tools installation
  selected via a subprocess-only hint; no toolchain download was performed.
- After the grid source batch, GN header checks passed for native UI, the
  focused native test executable, and the complete browser-test target. The
  four new localized-message definitions parse as valid resource XML; this is
  not resource generation or translated-language QA. Local OI/39-script checks
  and the expanded packaging guard's 22 synthetic cases passed again.
- After the named-workspace/transaction batch, native UI, focused-native-test
  and browser-test GN header checks passed. The new workspace policy passed
  Chromium's syntax checker with zero policy errors/warnings. The updated rail
  wiring check, Local OI and 39-script source checks passed. All 21 new workspace
  resource IDs were unique in parsed XML; selected formatting/whitespace checks
  passed. Packaging-guard synthetic cases passed, with no native execution.
No new native compilation, focused native test run, browser test run,
isolated-profile runtime smoke, installed-package QA or MSIX has passed.

Prior Guard privacy/failure source batch:
- Incognito now owns a separate ephemeral engine and factory set; it inherits
  effective settings without writing rules or collecting counters. Guest/system
  profiles remain excluded and are not represented as protected.
- The Guard release inventory is 43 definitions: 11 engine/session, 17 real
  request/profile/UI, nine controlled owner-failure and six controlled proxy
  cases. They are all required by the packaging gate, but all are still unrun.
- Header dependency checks passed for the Guard source/test targets. Changed
  C++ formatting, Guard WebUI syntax and source-to-gate inventory checks passed.
  Both Guard policy definitions, schemas and full-schema examples passed the
  Chromium source validators with zero definition errors/warnings.
- The expanded packaging guard passed all 22 synthetic checks. A stale expected
  synthetic fixture count initially failed after the new test names were added;
  it was corrected to match the expanded synthetic browser inventory and rerun. None of
  those synthetic entries is a real executed Chromium test.

Latest Guard document-recovery source batch:
- Added native document/selection-bound controls, exact HTTPS-site editing,
  temporary per-document grants, explicit reload and rule-editor access.
  Controls revoke their authority after navigation, renderer loss, pane change,
  tab destruction or panel closure. Private/managed mutations are checked in
  native code, not just disabled visually. Canonical origins wrap without
  elision; the panel scrolls vertically and announces lost page context.
- There are now 54 mandatory Guard test definitions: 11 engine/session, 28
  production request/profile/native-UI, nine controlled owner-failure and six
  controlled proxy cases. Native-panel smoke is the ninth required smoke
  assertion. None of these definitions is a recorded runtime pass.
- GN header checks passed for native UI and Guard source/test targets. Selected
  source formatting, parsed resource XML (29 unique Guard IDs), source-to-gate
  inventory, rail wiring and tracked whitespace checks passed. The packaging
  validator passed its 22 synthetic cases with the expanded fixture inventory.
- Read-only artifact inspection still found August 27 chrome.exe/chrome.dll,
  the August 25 native test executable, and no browser_tests.exe. No native
  build, browser launch or package command was run. Disk headroom at the batch
  check was C: 75.5 GiB and D: 29.8 GiB; no user files were removed.

## Approved 100-upgrade acceptance ledger

All rows below are **not release-verified**. This is deliberately not a count of
missing implementations: some have source, some are partial, and some are absent.
The complete acceptance text remains in the original numbered plan. A row may be
closed only with matching source, exercised native behavior, privacy/recovery
coverage and fresh artifact-bound evidence. Do not bulk-mark it complete after
a successful package build.

| ID | Approved upgrade | Release acceptance |
| --- | --- | --- |
| 001 | Fresh native interaction-test build | Not release-verified |
| 002 | Fail-closed test discovery and evidence | Not release-verified |
| 003 | Correct toolbar labels, destinations, and tests | Not release-verified |
| 004 | One mode selection path for native UI and settings | Not release-verified |
| 005 | Working rail activation and honest availability | Not release-verified |
| 006 | Consistent rail width, labels, and keyboard operation | Not release-verified |
| 007 | Persist each window's mode and rail state | Not release-verified |
| 008 | Restore exact split layout state | Not release-verified |
| 009 | Safe handling of unknown WebUI routes/resources | Not release-verified |
| 010 | Source-bound releases and Chromium security maintenance | Not release-verified |
| 011 | Typed mode registry and immutable snapshots | Not release-verified |
| 012 | Shared native command registry | Not release-verified |
| 013 | Finish model extraction and dependency cleanup | Not release-verified |
| 014 | Explicit Incognito and Guest capability snapshots | Not release-verified |
| 015 | Typed WebUI resources and live updates | Not release-verified |
| 016 | Responsive native toolbar with real overflow | Not release-verified |
| 017 | ★ Native mode chooser with previews | Not release-verified |
| 018 | ★ Native command palette available from any page | Not release-verified |
| 019 | Stateful visual Layout chooser | Not release-verified |
| 020 | ★ Per-mode toolbar and shortcut editor | Not release-verified |
| 021 | ★ Named local workspaces | Not release-verified |
| 022 | ★ Visual workspace switcher | Not release-verified |
| 023 | ★ Functional vertical tabs and groups in the rail | Not release-verified |
| 024 | ★ User-editable workspace templates | Not release-verified |
| 025 | ★ Safe workspace import and export | Not release-verified |
| 026 | Suspend and resume whole workspaces | Not release-verified |
| 027 | Clear workspace, profile, and origin boundaries | Not release-verified |
| 028 | Move tabs/groups between workspaces with undo | Not release-verified |
| 029 | Named workspace launch and startup choices | Not release-verified |
| 030 | ★ Workspace recovery history | Not release-verified |
| 031 | ★ Adjustable Tri/Quad rows and columns | Not release-verified |
| 032 | ★ Drag-to-arrange pane layouts | Not release-verified |
| 033 | ★ Complete native pane toolbars | Not release-verified |
| 034 | Open a link into a chosen pane | Not release-verified |
| 035 | ★ Find across visible panes | Not release-verified |
| 036 | ★ Optional linked scrolling and zoom | Not release-verified |
| 037 | ★ Reference-pane comparison mode | Not release-verified |
| 038 | Transactional layout creation and reconfiguration | Not release-verified |
| 039 | Complete pane keyboard navigation and resize | Not release-verified |
| 040 | Correct pane dialogs, media, fullscreen, and failure recovery | Not release-verified |
| 041 | ★ Quick Save bubble | Not release-verified |
| 042 | ★ Local collections | Not release-verified |
| 043 | ★ Continue dashboard on the start page | Not release-verified |
| 044 | ★ Tab manager with duplicate review | Not release-verified |
| 045 | ★ Local tab snoozing | Not release-verified |
| 046 | ★ Peek link preview | Not release-verified |
| 047 | Reader and Read Aloud integration | Not release-verified |
| 048 | Clean-link and Markdown-link copying | Not release-verified |
| 049 | ★ Workspace download desk | Not release-verified |
| 050 | Useful site-permission review entry point | Not release-verified |
| 051 | ★ Research Source Library | Not release-verified |
| 052 | ★ Workspace notes editor | Not release-verified |
| 053 | ★ Citation builder | Not release-verified |
| 054 | Explicit quotation capture and return anchors | Not release-verified |
| 055 | ★ PDF reading annotations | Not release-verified |
| 056 | ★ Research outline board | Not release-verified |
| 057 | ★ Source comparison tables | Not release-verified |
| 058 | ★ Explicit offline reading snapshots | Not release-verified |
| 059 | Research export packages | Not release-verified |
| 060 | ★ Local search across saved research | Not release-verified |
| 061 | ★ Environment labels for local/staging/production | Not release-verified |
| 062 | Active-pane DevTools targeting | Not release-verified |
| 063 | Complete reload menu | Not release-verified |
| 064 | ★ Responsive/device preview workspace | Not release-verified |
| 065 | Confirmed reset of the active origin | Not release-verified |
| 066 | Staging/production comparison launcher | Not release-verified |
| 067 | Explicit page-error diagnostic report | Not release-verified |
| 068 | Performance recording shortcuts | Not release-verified |
| 069 | ★ Network troubleshooting workspace | Not release-verified |
| 070 | Release artifact review checklist | Not release-verified |
| 071 | ★ Live native Mission rail | Not release-verified |
| 072 | Native operational status strip | Not release-verified |
| 073 | ★ Opt-in Watch/NOC mode | Not release-verified |
| 074 | Measured pane-health display | Not release-verified |
| 075 | ★ User-authored runbook editor | Not release-verified |
| 076 | ★ Explicit evidence capture packets | Not release-verified |
| 077 | ★ Local Support case workspaces | Not release-verified |
| 078 | ★ Support Diagnostics Center | Not release-verified |
| 079 | Reviewable handoff composer | Not release-verified |
| 080 | Validation and rollback checkpoint flow | Not release-verified |
| 081 | ★ Capture Studio | Not release-verified |
| 082 | ★ Redaction Studio | Not release-verified |
| 083 | ★ Before/after visual comparison | Not release-verified |
| 084 | ★ Design inspector | Not release-verified |
| 085 | ★ Creator reference board | Not release-verified |
| 086 | Editable preview-size presets | Not release-verified |
| 087 | Print/PDF export workflow | Not release-verified |
| 088 | Asset details and provenance | Not release-verified |
| 089 | Local publishing checklist | Not release-verified |
| 090 | ★ Presentation mode with clear boundaries | Not release-verified |
| 091 | Complete keyboard and accessibility behavior | Not release-verified |
| 092 | Localization, DPI, RTL, and small-window coverage | Not release-verified |
| 093 | Automated branding regression suite | Not release-verified |
| 094 | Complete packaged Windows browser integration | Not release-verified |
| 095 | Store-package upgrade and repair matrix | Not release-verified |
| 096 | Measured startup and interaction budgets | Not release-verified |
| 097 | Pane-aware resource management | Not release-verified |
| 098 | Honest runtime capability status | Not release-verified |
| 099 | Clear release-channel and recovery UI | Not release-verified |
| 100 | Maintainable native fork and release inventory | Not release-verified |

## Next release gates

Checkpoint for Terra: `docs/tahai-terra-handoff-2026-08-30.md`. The latest source
batch adds native Skin package management, bounded background SQLite storage,
two managed policies, five store and eight additional browser-test definitions.
Skins now has 27 required definitions total; none is runtime-verified. Source
formatting, Skins/native-UI GN header checks, explicit DEPS (21 files), policy
definitions, resource XML/SQL tag/inventory checks and 22 synthetic packaging
checks passed. The gate additionally requires a tenth `skin-package-manager`
runtime smoke; no such passing runtime evidence has been produced.
At the checkpoint the old binary dates and missing browser_tests.exe were
confirmed again; C: 63.80 GiB and D: 19.31 GiB free. No build/compiler process
was found by the ninja/siso/clang-cl process check. No fresh release artifact.

1. Complete the approved source requirements and document evidence against
   them. An explicitly limited candidate may retain honest deferred status,
   but that is not completion of the user's latest full-scope release goal.
   Do not silently turn a contract into a capability claim.
2. Freeze source inputs; preserve dirty-worktree/source hashes and toolchain/
   arguments. Diagnose the failed compile edges from exact logs.
3. Build chrome, tahai_mission_service_tests and browser_tests once for this
   final source scope. Verify chrome.dll as well as the launcher.
4. Discover and run all applicable focused native/browser/policy tests; reject
   missing, empty, skipped, failed or stale runs.
5. Run isolated-profile smoke and controlled installed-package acceptance.
6. Package a unique new version only with valid evidence and verify the manifest,
   every staged/unpacked payload hash and the MSIX hash. This still does not
   constitute Microsoft Store approval or enterprise certification.
