# RC engineering evidence — 2026-09-30

This is an engineering record, not an RC acceptance certificate. The later
sections record the approved source/dependency migration and checkpoint push.
No new native browser build, MSIX, signing, package installation or Store upload
has been completed for this revision. The scheduled continuation remains paused.
Work stays in `C:\src\TAHAI-GA\src` on `codex/ga-2.0.33-chromium-152`, preserving
the recovered toolchain as rollback, Store identity and existing implementation.

## Upstream security baseline decision

The starting checkout was Chromium **152.0.7977.83**. The Windows stable release
announced September 29 is **154.0.8037.92/.93**, with 32 security fixes in that
announcement. Moving to the current stable engine is recommended for this RC;
changing the displayed version is not a security update.

Read-only upstream verification:

- `refs/tags/154.0.8037.93`: `f89f3a4363808e117c592adedcf9947882ac3b79`.
- `refs/tags/154.0.8037.92`: `334b65d254ccc35df4fca82706d1753227b01039`.
- Local compiler pin: `llvmorg-23-init-19482-g53d18800`, subrevision 1.
- 154.0.8037.93 compiler pin: `llvmorg-24-init-3796-g20e97c4b`, subrevision 27.
- The target's Windows instructions require Visual Studio 2026 >=18.0.0 and
  Windows SDK debugging tools >=10.0.26100.3323.

This is a real engine/dependency/toolchain migration, not a version-file edit.
The user explicitly approved the upgrade: "Yup. upgrade everything!" This
supersedes the previous 152/compiler pin for the RC. Preserve the recovered 152
toolchain and source checkpoint as rollback before migrating. The
checkout uses a shared shallow Git repository; do not reset it, force-push it or
run an unbounded unshallow operation to obtain the target.

Sources: [official release announcement](https://chromereleases.googleblog.com/2026/09/stable-channel-update-for-desktop_01807488085.html),
[stable release feed used to read the announcement](https://chromereleases.googleblog.com/search/label/Stable%20updates),
[upstream tag](https://chromium.googlesource.com/chromium/src/+/refs/tags/154.0.8037.93),
[target compiler pin](https://chromium.googlesource.com/chromium/src/+/refs/tags/154.0.8037.93/tools/clang/scripts/update.py),
[target Windows build instructions](https://chromium.googlesource.com/chromium/src/+/refs/tags/154.0.8037.93/docs/windows_build_instructions.md).

## Primary-source research and engineering consequences

This is a scoped set of relevant primary references, not a claim to have found
every article on browser engineering.

| Area | Primary reference | Application to this candidate |
| --- | --- | --- |
| Privileged IPC | [Chromium Mojo security guidance](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/mojo.md) | Browser-side validation, active profile/document checks and explicit gesture checks; renderer messages are not authorization. |
| Untrusted parsing | [Chromium rule of two](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/rule-of-2.md) | Keep skin/archive and filter decoding in existing bounded sandboxed paths; no script/native-code import through skins. |
| WebUI lifecycle/CSP | [WebUI explainer](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/webui/webui_explainer.md), [WebUI development](https://www.chromium.org/developers/webui/) | Bind asynchronous inspection results to a weak document and request generation; deny renderer connections and base-URL replacement. |
| Origin/security display | [URL display guidance](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/url_display_guidelines/url_display_guidelines.md), [Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation/) | Validate origin as well as path; retain Chromium's security UI and process boundaries. |
| Keyboard interaction | [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Keyboard command navigation, cancel-to-opener focus, native Finder viewport sizing and visible focus remain explicit gates. |
| Appearance/accessibility | [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [approved brand reference](https://browser.tahai.net/) | Four-pair Studio contrast feedback, faithful Royal derivatives, distinct active tabs, light/custom/forced-color precedence. |
| Extensions | [Chrome extension permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) | Keep provider-specific connectors in optional extensions; do not replace native consent/security with extension presence. |
| Windows accessibility lifetime | [Microsoft COM reference counting](https://learn.microsoft.com/en-us/windows/win32/com/implementing-reference-counting) | Existing COM reference-leak test failures require investigation in an identified isolated session; do not disable accessibility or leak assertions to pass. |
| MSIX identity/signing | [Signing overview](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview), [signing guide](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide), [Store package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements) | Preserve exact Store identity/publisher/version rules; report actual signing status. A test signature is not Store signing. |
| Installation/upgrade | [MSIX deployment updates](https://learn.microsoft.com/en-us/windows/msix/desktop/managing-your-msix-deployment-update), [desktop MSIX behavior](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes) | Validate the exact package under an isolated Windows identity, including applicable upgrade and profile-state retention. |
| Certification | [Windows App Certification Kit](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit) | Run package-level certification checks; a successful archive build alone is not acceptance. |

## Concrete source improvements

- Royal resource generation now emits a stable manifest across Windows PowerShell
  5.1 and PowerShell 7; all 33 derived artwork files are checked against the
  approved master. The branding/Studio/command improvements remain in the tree.
- Fixed browser-owned command dispatch, recipe launch, identity-lane opening and
  report copying require an active same-profile TAHAI page with a user gesture.
  The common check validates a recognized origin, not only a path.
- Network inspection is confined to Support with bounded argument lengths.
  Results cannot publish, persist Local OI observations or enable copying after
  the originating document reloads or navigates away. An in-flight request remains
  single-flight even across reload; clipboard review also requires the current
  document and a fresh gesture.
- Guard configuration/rule mutation requires an active Support gesture. Local OI
  deletion, collection/export controls, projection rebuild, finding lifecycle
  changes and referral preference changes require an active Local OI gesture.
  Existing service-level profile and enterprise-policy restrictions remain.
- Privileged TAHAI pages add `default-src 'none'`, `connect-src 'none'` and
  `base-uri 'none'`, retaining explicit local script/style/image allowances and
  Chromium's other default restrictions. Native authorized tools own networking.
- Failed Local OI projection refresh now releases the busy button so an operator
  can retry. Disabled, detached and already-busy controls do not dispatch again.
- New Tab and Policy use their existing TAHAI title constants consistently.
  Earlier browser diagnostics showed title mismatches stopping workflow tests
  before their substantive assertions. Skin Studio's corrected title was already
  present at the starting checkpoint and is preserved.
- Finder's minimum native-window size no longer inherits every result row's
  preferred height. The existing live resize/keyboard regression now additionally
  checks that the requested window height is actually honored.
- The stock-theme regression checks the explicit user-color preference and
  resulting toolbar color, rather than assuming a user-color theme must use a
  non-default ThemeSupplier. The production stock-color path already checks for
  an explicit user color.

Seven added native browser cases cover gesture/page/background rejection,
legitimate actions, CSP enforcement, reload invalidation and late inspection
completion. These cases are source changes and have **not** been compiled or run.

## Evidence and remaining acceptance work

Base commit before this engineering pass:
`478fa4c1974422badc8b7162eb4414b6bef6a2ea`, plus the current uncommitted changes.

Source-only preflight completed with **21/21 suites, exit 0**, recorded in
`out/source-review-20260930-102939/summary.json`. This includes 64 stock-Edge
source-render/keyboard/CSP checks, 8 Local OI DOM-control checks, creator tests,
packaging guard fixture tests and Royal derivative verification. The subsequent
two title substitutions, Finder minimum-size change and theme-test assertion
change still require native compilation/runtime verification. No source-only
result is being substituted for native acceptance.

Historical evidence retained:

- `out/tahai_ga_release_x64/upgrade-checks-20260928-034541`: previous BuildOnly
  exit 0; not a build of these new changes.
- `out/tahai_ga_release_x64/runtime-followup-20260928-080500`: previous exact
  native gate **331/331 passed** with one job/no retries; not new-source coverage.
- `out/tahai_ga_release_x64/upgrade-checks-20260928-010637`: earlier exact
  `*Tahai*` browser gate failed. The title, native sizing/focus, theme and COM
  reference-leak failures remain unresolved acceptance items until demonstrated
  fixed by fresh execution. Tests were not removed, disabled or retried into a pass.

RC acceptance still requires the selected engine baseline, provenance-bound
one-job build, nonzero exact native/browser gates without retries, B1 trust and
security regressions, real operational workflows, and exact-package validation.
Then checkpoint/push safely, package through the established MSIX pipeline and
test installation/upgrade/state retention in the isolated Windows environment.
Do not touch the host Store 2.0.32 browser/profile, resume the scheduler, upload
to the Store or label the release complete without that evidence.

## Approved Chromium 154 port — source engineering checkpoint

The user approved upgrading the engine and matching dependencies. The port uses
the official `154.0.8037.93` tag at
`f89f3a4363808e117c592adedcf9947882ac3b79`. The complete pre-port implementation
was committed as `d8853eed913a95ab86d15466cf1d65976b3a59b6` and retained on
`codex/rollback-chromium-152-20260930`. The old recovered toolchain, release
configuration and clean nested ARIA checkout are preserved under
`out/upgrade-154-20260930/rollback-152`; the backup manifest verified 7,405 files.
The original release output remains separate. The checkpoint was subsequently
published to GitHub as described below.

Because the repository is shallow, the source merge used the known 152 base
`79460ebecaa5625e57a5fb679a735659e73dc687` explicitly. Its merged tree was
`460e326c241e4c3aff995f41ab7b57c36d4022f3`; all 20 conflicts were resolved.
The completed merge retains both the checkpoint and official 154 parents as
`e035511dcbab7bfc9d73a94fc96e7527c0daa733` (tree
`85566e19024db18eba1521ffd10f9c049ee21fc6`). No unrelated-history/ours-only result
is a candidate.
An initial CRLF-sensitive conflict-index restoration failed; it was repaired
using LF-only index input before the 20 resolutions were staged. The source tree
and compiler upgrade are not established by a version-string substitution.

Concrete port work:

- TAHAI native controllers, retained actions, dialogs and WebUI dispatch use
  `BrowserWindowInterface`, current weak pointers and session identifiers. Native
  workspace creation uses the current browser-window factory. Removed upstream
  migration shims are not reintroduced.
- Native two-to-four-pane restore preserves Chromium's weak live-tab lifetime
  checks. Horizontal tab layout retains shared borders for every pane count and
  distributes odd/tiny widths without negative coordinates. New browser coverage
  exercises 2/3/4 panes in both orientations, bounded/unbounded/minimum geometry.
- TAHAI enterprise policy names and semantics remain; their unshipped RC numeric
  slots move to 1483–1499 so upstream's new 1477–1482 policies are not overwritten.
  Policy template generation succeeded and 14 policy-generator tests passed
  (`out/upgrade-154-20260930/policy-generation-tests.log`).
- Generated elevation-service interfaces now match TAHAI's configured IID.
  Chromium 154 changed tracing's invitation ABI, so tracing gets a new interface
  IID (`E91BA5EB-59CF-50E3-8BC8-175FE36F3E79`) and retains the previous IID only
  for registration cleanup. Store identity and service CLSIDs are unchanged.
  Added native factory/interface tests also reject the previous tracing ABI.
- The encryption round-trip service test frees its second BSTR instead of
  freeing the first one twice.
- Recorded browser failures drove three test corrections: wait for catalog
  refresh before the skin Reset action; verify Mission's public committed URL
  and actual WebUI; activate the native window and traverse enabled rail controls
  while confirming disabled controls remain unfocusable. No product permission,
  accessibility or leak check was disabled.
- Release evidence is now version 2 and binds eight binaries: browser EXE/DLL,
  mission/browser tests, both Windows services and both service-test binaries.
  The runner and packaging guard require successful nonzero `ServiceMainTest.*`
  and `SystemTracingSessionTest.*` results, including the new IID regressions,
  with one job/no retries. Missing/stale service evidence fails closed. The guard
  passed 36 synthetic checks; these are not native browser/service execution.
  System-wide service installation and cross-integrity tests remain separate
  isolated-VM acceptance work.

The merged source preflight passed 21/21 suites at
`out/source-review-20260930-123245/summary.json`, including the COM/evidence-gate
edits above and 36 packaging-evidence fixture checks. Native 154 compilation and runtime verification
remain pending. In particular, the earlier accessibility COM-reference leaks
are not declared fixed from source inspection. Dependency sync completed with
actual exit 0, no hooks and two jobs. Follow-up inventory checked 244 dependency
pins and 154 clean Git dependency worktrees. Resolved CIPD instance IDs were
compared with independently queried installed site pins; the initial generic
comparison exposed gclient JSON truncating tags containing a second `@`, not a
dependency mismatch. Logs and both inventories remain under
`out/upgrade-154-20260930`. Hooks/native build have not run.

## Follow-up compatibility and publication evidence

- Window presentation restoration now checks controller/window weak pointers
  after native observer callbacks, before continuing skin/theme work or returning
  a restored window. A restore superseded by a callback also stops on generation
  mismatch. Reentrant mode notifications are coalesced into a weak UI task rather
  than recursively iterating Chromium's non-reentrant observer list. Three new
  browser regressions cover controller destruction, replacement/deferred
  delivery during notification, and destruction during custom-mode reset;
  they remain pending native execution.
- Chromium's non-Android window factory is synchronous in this target revision
  (`create_browser_window_non_android.cc`). Named workspace restoration retains
  that supported desktop path and now also checks for an unavailable tab model.
- A direct checkpoint push was rejected because the shallow Chromium parent
  `d04cdb24d67b081f6cf80200ffc5233f44b61109` is absent. No branch was force-pushed.
  The existing publication branch's tree was verified identical to native
  `ea5a5f922816ba0d72f462e81e43259cebfd7be2`, then the repository's established
  source-publication approach was used. GitHub accepted the fast-forward
  `2fde194ebe..bc52b0d9ec2d35cc85af65b340b2ec461cc9e29a` and `ls-remote` confirmed
  it. Its tree `d7c23489d8dd92f6921bd6fdbae7f795c75c3c0d` exactly matches local
  checkpoint `d8853eed913a95ab86d15466cf1d65976b3a59b6`. The subsequent 154 merge
  is not included in that pre-port checkpoint. Logs: `github-checkpoint-push.log`
  and `github-source-publication.log` under `out/upgrade-154-20260930`.
- The 154 Rust toolchain resolved all 337 vendored packages offline. The initial
  `--locked` check failed because one `syn` reference needed its version and the
  manual merge was not in canonical ordering. Cargo's offline normalization
  changed no package versions; a second locked/offline metadata check exited 0.
  Guard remains pinned to adblock 0.12.6. The original merged lockfile is retained
  as `Cargo.lock.before-resolution`; metadata logs are beside it. This is graph
  resolution, not compilation or runtime evidence for the shipped Guard service.
- The latest source preflight passed 21/21 suites with actual exit 0 at
  `out/source-review-20260930-130733/summary.json`. The native observer regressions
  still require compilation and a fresh native test run.
- The release runner defaults to one job and a separate `out/tahai_rc_154_x64`
  output. It rejects paths outside this checkout's `out` and output directories
  without reviewed `args.gn` before acquiring a build lock or invoking GN. Both
  rejection cases were exercised (`runner-escape-rejection.log` and
  `runner-missing-args-rejection.log`); neither started a build.
- The pinned Rust toolchain built the `gnrt` source-generation helper, which
  completed `gen` with exit 0. Its formatting subprocess lacked `gn.bat` on
  PATH, so generated files were explicitly formatted with the synced GN tool.
  The 281 tracked generated rules then matched the merged index. Two ignored
  hash-crate BUILD.gn files were also formatted and explicitly added to Git.
  No browser build or GN build-graph generation was performed.
- A real Guard source audit found missing ignored dependency READMEs and two
  original Cargo.lock files. Pinned original archives identified the missing
  files; executable source bytes were unchanged. The six source/metadata/build
  files are now explicitly tracked. All 15 recorded inventory entries and 339
  original archive files verified without changing the recorded hashes.
  The auditor gained a current-lock/inventory mode with six new synthetic tests
  (12 total). The source preflight now includes that real checkout audit and
  passed **22/22 suites, exit 0**, at
  `out/source-review-20260930-132817/summary.json`.

## Windows SDK prerequisite

The target's Windows build instructions require SDK **10.0.28000.2270**, with
headers/libraries under `10.0.28000.0`. Only `10.0.26100.0` is currently installed.
The installed debugging tools **10.0.26100.7705** satisfy the separate minimum
debugger requirement. Do not lower Chromium's SDK pins to reuse the older SDK.

The exact installer was downloaded from Microsoft's
[official SDK downloads](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/downloads)
to `out/upgrade-154-20260930/winsdksetup-28000.2270.exe`; its Microsoft Corporation
Authenticode signature verified valid, product version is `10.1.28000.2270`, and
SHA-256 is `E9F1BDE566381355E594E2F90DAF4F714EB5C7EF2C45C501CE236AFE2ABEA300`.
The attempted elevated side-by-side install did **not** start: Windows reported
that elevation was cancelled. The wrapper later exited zero after null-process
errors; that is **not** an installer success or installer exit status. No SDK
installation is claimed. Administrator installation remains required; no second
elevation attempt or permission workaround was made.
An explicit administrator-only helper, `out/upgrade-154-20260930/install-required-sdk.ps1`,
verifies the pinned installer, installs the x86/x64 C++/UWP/signing components
without rebooting, and checks the required files. Its syntax was checked; the
helper has **not** been run. It reports actual installer status and treats a
missing SDK tool/header/library as failure.

## Source-only handoff requested by the user

The latest user instruction is to continue source engineering, commit and push,
then build binaries on another machine. This supersedes the local-build/SDK
installation next step. No further local native build or SDK installation is
authorized by this handoff; the scheduler stays paused. See the checked-in
[build-machine handoff](tahai-154-build-handoff.md) for dependency setup,
explicit machine paths, preserved validation arguments and pending acceptance.

The runner now fails before GN when the source-pinned SDK files or compiler
stamps are missing/stale, including the SDK override used by Chromium. Ten
synthetic preflight cases pass. Its failure handler also preserves an original
lock-acquisition error before a run directory exists. Four actual PowerShell
rejection-path tests pass without starting GN, compilers or browsers: outside
output, missing arguments, existing lock preservation, and missing isolation
with failure/status capture and owned-lock cleanup. These are runner/source
checks, not native product runtime tests. The checked-in x64 profile explicitly
preserves validation settings and does not claim official PGO optimization.

The expanded source preflight passed **24/24 suites, actual exit 0**, including
the optional source-render harness, at
`out/source-review-20260930-135331/summary.json`. PowerShell parser checks and
`git diff --check` passed. The real read-only prerequisite check returned the
expected exit 1 for the 11 missing SDK 28000 headers/libraries/tools; both compiler
stamps and the other required files matched. That failure is preserved in
`out/upgrade-154-20260930/build-machine-prerequisite-check.log` and is not being
counted as a build pass. No installer, GN generation or native build was started.

## Operational-skin correctness follow-up

The next source review found and repaired concrete gaps rather than treating the
prior source pass as complete product acceptance:

- Fresh native Studio drafts and all eight creator-kit packages now target the
  selected Chromium 154 engine. Native fresh drafts derive their milestone from
  version_info; saved/imported source and signed archives are never silently
  widened. The release runner and source preflight reject stale bundled starter
  ranges against `chrome/VERSION`. The new regression first reproduced the old
  152 mismatch (exit 1), preserved under
  `out/upgrade-154-20260930/creator-current-engine-regression-before.log`.
- Operational activation now carries authored `compensation_steps` through the
  native-to-Mission-Control handoff. The existing queue had dropped them and
  substituted generic recovery labels. Malformed recovery definitions fail
  validation without replacing an existing queued launch. Recovery remains a
  manual terminal-state checklist, never automatic commands or undo claims.
- Built-in operational modes and saved operational aliases share one guarded
  native activation path. It holds weak window/dialog/profile/controller owners,
  blocks reentrant activation, and rechecks selected mode/revision and command
  availability across synchronous notifications. Closing or retargeting the
  manager, revoking a binding, or changing the selected custom mode stops further
  dispatch. Rail presentation remains window-local.
- Native Studio source transfer checks the decoded UTF-8 budget before replacing
  edits, suppresses stale asynchronous read errors and releases failed downloads.
  The offline creator exports an immutable gesture-time snapshot while hashing,
  prevents duplicate exports during edits, and releases failed download URLs.
- Creator outputs were regenerated deterministically; no browser binaries or
  MSIX were built. Royal brand assets, Store identity, dependency pins and the
  separate build-machine instruction are unchanged.

Nine new native regressions are mandatory in the packaging evidence validator:
two fresh/persisted draft compatibility tests, two queued-recovery tests, and
five native manager tests covering authored recovery, close, custom-alias close,
retarget and revocation. **They are added source, not executed native evidence.**
The test fixture's expected sentinel counts were explicitly updated after the
first full source run correctly failed on the old count; no assertion was
disabled. The evidence validator passes 36 synthetic rejection/acceptance checks.

Source verification includes 34 creator tests (including Ed25519 package
verification), 19 shipped Studio transfer checks and 17 offline export checks.
The full preflight has 26 nonzero suites, including 64 CSS/command/CSP checks in
the isolated stock-Edge source harness. These do not prove native TAHAI behavior.
Current full-run logs are under `out/source-review-20260930-200018`; the earlier
failed fixture run is retained under `out/source-review-20260930-195556`.
Native compilation, all four runtime gates, accessibility leak verification and
exact-package acceptance remain pending on the other machine. There is no
"every feature verified" or GA claim from this source-only checkpoint.

## Cross-feature engineering follow-up

This source pass extends beyond operational skins. It retains the Chromium 154
pins, Royal defaults, Store identity and extension-only provider connectors.

- Work Modes now observe profile/policy preference changes, reject managed or
  malformed writes, merge only the edited mode while preserving unknown data,
  and keep density/compact snapshots consistent. Notification dispatch tolerates
  reentrant edits, shutdown and observer-driven destruction. Explicit private
  edits stay ephemeral and do not acknowledge superseded settings. Merely loading
  an unknown active mode no longer rewrites it; an explicit selection can replace
  that fallback. Named workspace storage also rejects managed shadow writes and
  wrong-typed default-fallback overwrites. Workspace restore pins tab/content
  identity, ordering, pin/group/split membership, applied visuals and active
  selection across synchronous notifications; interruptions preserve the partial
  window and return failure rather than applying saved indices to changed tabs.
- All fixed/custom/native Work Mode controls correlate acknowledgments, restore
  rejected controls, preserve edits, block cross-control duplicate submissions
  and retain status inside dialogs. Creation, activation, copying and retained
  skin/layout edits use the same request owner. Local OI search results
  open typed, read-only entity detail; findings/memory are not misrepresented as
  entity IDs. Search and graph requests are invalidated immediately when their
  query, filter, selected record or availability changes.
- Archiving pauses running operational workflows even without a pending timer.
  Restoring does not implicitly resume native actions. Mission loading rejects
  duplicate identifiers and keeps history-integrity warnings sticky after malformed
  records are discarded. Titles/notes require valid UTF-8; duplication preserves
  character boundaries.
- Local OI preserves unfamiliar schema/wrong-typed data, rejects stale snapshot
  commits and managed hidden writes, and validates relationship targets on reload.
  Finding lifecycle changes update the search/graph projection atomically and
  clear obsolete acknowledgment/suppression metadata. Unavailable storage does not
  authorize continued searches, briefs, exports or mutations. Public raw-data
  projections also return an immutable empty snapshot while disabled/unavailable,
  so relationship/detail/list adapters cannot bypass those checks.
- Capability approval/use now requires a live HTTPS primary document: an inherited
  origin on `about:blank` and a crashed renderer do not meet that contract.
  Wrong-typed persisted grants cannot be silently replaced during approval.

The 33 new native regressions (29 service/unit, four browser) are wired into the
mandatory release evidence sentinels, not
represented as executed results. The two new shipped-JavaScript suites use DOM
doubles for Work Mode request handling and Local OI navigation. The preliminary
expanded source preflight passed **28/28 suites, exit 0**, including the isolated
stock-Edge source-render harness, at
`out/source-review-20260930-202646/summary.json`. The completed combined source
also passed **28/28, exit 0**, at
`out/source-review-20260930-203255/summary.json`; the Work Modes suite now exercises
30 checks across the production script sequence, and Local OI navigation has 23.
The packaging validator passes 36 synthetic checks with all new sentinels required.
None of these checks compile or execute the
native Chromium 154 candidate. Native regression, operational, accessibility and
package acceptance remain required on the user's build workstation.

The first clean-checkpoint run (`out/source-review-20260930-203518`) failed in
the source-render harness: Playwright polled a string expression using page-world
`eval`, which the unchanged production `script-src 'self'` correctly rejected.
The harness now polls explicit functions for focus and CSP violation events;
neither `unsafe-eval` nor a CSP bypass was enabled. The corrected harness executed
all 64 checks with zero failures. The failed run remains preserved and is not a
native product failure or a passing full-source run.
