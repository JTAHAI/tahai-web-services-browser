# Native browser upgrade — September 5, 2026

This batch changes the native Chromium browser in this repository. It is not an
Electron-only prototype. Source implementation is in place; the complete native
build and runtime gate have not yet passed. No installed-browser or MSIX release
claim follows from syntax checks or tests against older binaries.

## Keyboard and navigation

**Ctrl+Shift+Space**, or **App menu > Finder**, searches enabled browser commands,
open tabs across this exact profile's windows, and saved workspaces. Multiple
search terms match together. Arrow keys choose a result; Enter opens it; Escape
closes the dialog. Tab results switch to the existing tab, and workspace results
open a new window. Private results remain separate from regular profiles.

Results retain native tab/window identity and recheck it when selected. Closing
or moving a tab cannot redirect an old result to another tab. Results are capped
at 60 with a refine-search hint. The dialog relinquishes focus before a selected
action runs. Four native tests cover identity, private separation, command
allowlisting, and the shortcut/search/Enter/reopen Views flow.

## Guard

Balanced bundles 56,787 EasyList network candidates plus TAHAI's existing
baseline. Strict adds 55,966 EasyPrivacy candidates and the Strict additions.
These are parser candidates, not a measured accepted-rule count or a guarantee
that every advertisement is blocked. The sandboxed Rust engine remains the
authority on accepted rules and actual request matching.

Snapshots are pinned with upstream URLs and hashes in
`third_party/tahai_guard_lists/sources.json`. The checked-in transformation is
offline and reproducible, records exclusions, and enforces the engine's input
budgets. Credits identify The EasyList authors, the CC-BY-SA-3.0 license, and the
network-only adaptation. Lists update with browser releases.

The native Guard panel adds a mode selector and refreshes engine status and
counters while open. Balanced and Strict support document pause and eligible
site exceptions. Clearing an already-empty Custom list no longer stops active
built-in protection. Controlled local HTTP tests distinguish actual blocked
requests from certificate/CORS failures and cover a domain present only in the
bundled EasyList snapshot.

The second batch adds declarative cosmetic hiding, described below. Scriptlets,
URL rewriting and background list updates remain outside the supported scope.

## Skins and creator kit

Installed skins now supply native light/dark/high-contrast palettes for the
frame, toolbar, tabs, workspace rail, and supported side-panel cards. OS forced
colors take priority. The profile service owns apply/reset and retires removed
or replaced revisions even after their manager closes. Manual theme changes
retire skin ownership so a later package removal preserves the manual choice.
Startup validates compatibility and reconciles the selected store revision.

**Skin packages > Save skin creator kit** exports a ZIP containing the editable
starter, instructions, a Python 3.9+ packager, artwork license, and a prebuilt
Chromium-150 `.tahaiskin`. The packager validates contrast, paths and PNG
integrity, recomputes hashes, builds deterministic file-only archives, and
refuses output overwrites. The browser still performs final sandbox validation.

The old corrupt starter PNG is replaced. New native regressions cover the
shipped package, actual toolbar palette colors, reset, policy changes, manual
theme changes, and removal after manager cancellation.

The second source batch adds document-bound cosmetic filtering, timed live skin
preview, reviewed-archive export, eight included palettes, bounded decoration
artwork in the rail, compact rail spacing and an offline visual Skin Studio.
Skin artwork is always still. Per-window package choices remain outside this
profile-owned appearance model.

## Second batch and release candidate 2.0.33.0

Guard admits plain element-hiding selectors and exceptions, including generic
hiding exceptions. It never exposes scriptlets, arbitrary style actions,
resource replacement or executable filter content. Utility replies, browser
delivery and renderer insertion have size and syntax bounds. Document-scoped
Mojo pipes and browser document ownership prevent stale replies crossing a
navigation. Off, pause and exact-site cosmetic exceptions remove inserted
styles. Incognito owns its own utility and does not write rules or counters.
Same-document path/query changes also refresh URL-dependent cosmetic exceptions;
fragment-only changes do not re-query the engine. The new SPA regression and
tab helper passed native compiler checks; runtime execution remains pending.
Bundled EasyList includes 23,856 cosmetic candidates; Rust remains the final
admission boundary. Ordinary generic candidates fit the 16,384-selector and
512 KiB per-document response budgets.

Native Skin packages now offers included palettes and "Try for 30 seconds".
Temporary appearance never writes theme preferences and reverts on timeout,
review cancellation or an external theme change. Reviewed archive export keeps
the exact validated bytes. Startup re-decodes installed artwork in the sandbox;
a missing, corrupt or replaced revision retires its appearance. Decoration has
a separate noninteractive rail slot, never behind labels or security controls.

The creator kit includes studio.html and adjacent local JS/CSS. It works from
an extracted folder without a server or Python. All three palettes have visual
color controls and contrast checks. The generated file-only ZIP includes the
licensed starter PNG and fresh SHA-256 metadata. The Python workflow remains
available for custom artwork and compatibility ranges.

Verified before the full build: the Rust engine and generated CXX bridge;
17 changed C++ translation units with Chromium's normal compiler checks;
five creator tests; reproducible bundle/kit generation; a real Chrome Studio
download validated by the creator validator; low-contrast export rejection;
24 synthetic release-gate checks. These are not native browser runtime results.

A read-only query of OSV on September 5 returned no published advisories for
the exact 60-package Cargo.lock dependency closure rooted at adblock 0.12.6.
The query and raw response are retained in `out/tahai_release_x64/tahai_verify/`
as `guard-osv-request.json` and `guard-osv-response.json`. This includes
optional/build dependencies and does not establish a final linked-binary SBOM
or prove that the code has no vulnerabilities.

The release audit found the non-official build still used Chromium's sample
credits. TAHAI now defaults to generating real credits. Standalone generation
produced the complete 20,215,886-byte notice page, including Guard and filter
licenses. The new resource verifier rejected the actual old `resources.pak`
because it contained sample credits; it also requires the packaged filter lists
and creator kit to equal current source bytes. Packaging includes the original
and derived filter data, transformation, provenance and full license texts.
The final incremental build must pick up this GN change before native release
tests/evidence are finalized. Neither the old binaries nor the standalone
credits output are a passing release.

The new full build and complete TAHAI test run is captured in
`out/tahai_release_x64/upgrade-checks-20260905-085112/`. The runner records the
actual build interval and exit code, runs all native TAHAI tests and every
discovered browser test matching `*Tahai*`, with no retries. The MSIX gate also
requires the new cosmetic/preview/built-in restart regressions explicitly.
Read the current status and logs before claiming a successful build or release.

## Verification and continuation

Passed locally: five creator tests; reproducible filter generation and hash/
budget checks; targeted Chromium compiler syntax checks with normal warnings
and plugins. GN and native compilation/runtime are distinct gates.

The current captured run is
`out/tahai_release_x64/upgrade-checks-20260905-085112/`. Read `status.json`,
`build.log`, and the resulting test logs together. A `running` status or empty
stderr is not success. It builds `chrome`, `browser_tests`, and
`tahai_mission_service_tests` with six jobs, then runs the complete native test
target and `*Tahai*` browser tests with no automatic retries. The earlier
`upgrade-checks-20260905-001730` run was deliberately stopped to regenerate
the new cosmetic-filtering interfaces; its failed status is not a runtime
test result. A full runtime result is still pending.

To start a new captured verification run after resolving any failure:

```powershell
pwsh -File tools/tahai/verify_upgrade.ps1
```

Keep GN's Python and Visual Studio selection stable. Switching toolchain paths
can rerun generators and invalidate a large portion of Chromium's build. Do not
substitute old executables, weaken accessibility teardown checks, or treat a
synthetic fixture as native execution evidence. After the full native gate,
verify appearance, keyboard navigation and Guard behavior in the rebuilt app,
then complete installed-package QA before release.
