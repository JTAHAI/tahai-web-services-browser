# RC engineering evidence — 2026-09-30

This is an engineering record, not an RC acceptance certificate. No new native
build, dependency sync, MSIX, signing, installation or Store upload was performed
in this review. The scheduled continuation remains paused. Work stays in
`C:\src\TAHAI-GA\src` on `codex/ga-2.0.33-chromium-152`, preserving the recovered
toolchain, Store identity and existing implementation.

## Upstream security baseline decision

The checkout is Chromium **152.0.7977.83**. The current Windows stable release
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
