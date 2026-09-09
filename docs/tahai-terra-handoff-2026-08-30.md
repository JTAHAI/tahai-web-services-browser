# TAHAI Windows — checkpoint for Terra, 2026-08-30

## User direction and stop condition

The user asked to checkpoint at the next good stop and switch to Terra. This
checkpoint closes the Skins package-management source batch. Do not confuse it
with completion of the release goal. No model was switched programmatically.
No new native build was started. The active goal was not marked complete.

The older ten-minute heartbeat `tahai-native-release-hour-long-build-batches`
was subsequently paused at the 2026-08-30 14:17 UTC wakeup to preserve this
requested checkpoint for the Terra switch. Its schedule/prompt were retained;
it was not deleted. Resume scheduled work only after the user resumes work.

Windows native Chromium only. No Electron. Mobile deferred. Preserve the very
dirty worktree, including untracked directories. Do not clean/reset/commit or
delete user artifacts. Use source-only checks while release source work remains;
the requested final pipeline is fresh native build, actual focused tests, smoke,
then unique validated MSIX. Earlier permission to cap deferred UI is not a claim
that the capped feature has been implemented. Never fabricate test evidence.

## Answer to the user's latest status questions

- Local OI is **not fully implemented or end-to-end certified**. Source includes
  a profile-local store/service, typed entities/relationships, deterministic
  findings, search and redacted report flows. The entire requested vertical
  roadmap, runtime behavior, isolation/policy/persistence and large-data
  performance are not established by the source checks. See the full audit.
- Brave's `adblock-rust` **is integrated in native source**, not merely listed
  in a plan: pin 0.12.6, commit ca7f9f4a24a439da99e052b4e4041c45d87687f5; Rust
  bridge, sandboxed engine, browser request-factory interception, separate
  regular/incognito owners, Custom rules, native document-bound recovery and
  managed policy. It is **uncompiled and runtime-unverified**. The 54 mandatory
  Guard browser-test definitions have not run. No licensed default lists,
  automatic update service, cosmetic filtering or scriptlets are implemented.
  Do not tell the user the Store browser is currently protected by this source.
- The rail correction is source-only, not in a newly validated Store package.
- The release is not in final packaging. Full-chat GA is substantially wider
  than the latest slice; see the 21-area inventory and 100-upgrade checklist.

## Exact checkpoint source

New regular-profile Skin package functionality:

1. `chrome/browser/tahai_skins/skin_package_store.{h,cc}` — fixed-path bounded
   SQLite storage; insert-only add, exact-revision update/remove, one rollback,
   no silent eviction/raze, hash/metadata revalidation and corruption rejection.
2. `skin_profile_service{,_factory}.{h,cc}` — lazy regular-profile owner;
   explicit selected-file read, sandbox admission, opaque review tokens,
   asynchronous store operations, policy/cancel/shutdown lifecycle. Separate
   lifetime and operation weak pointers. Conditional release of old previews.
3. `chrome/browser/ui/tahai/tahai_skin_manager.{h,cc}` — native one-window-per-
   profile manager, chooser/review and explicit confirmations. Native command
   IDC_TAHAI_SKIN_MANAGER 34093 is wired into controller/app/toolbar menus.
   Policy/closure detaches chooser callbacks. Artwork is labeled as package
   content; installing does not apply appearance. Global file-dialog policy is
   rechecked on selection. Security surfaces and rail preference are untouched.
4. Built-in catalog moved to `chrome/common/tahai_skins/tahai_skin_catalog.*`.
   The old WebUI header forwards to it; the old `.cc` is removed from its target.
   Import/storage cannot impersonate stock or original launch-collection IDs.
5. Prefs and policy definitions/handlers/mapping fixtures: TahaiSkinsEnabled
   1473 and TahaiSkinInstallationsAllowed 1474, group 68; default true,
   non-syncable profile prefs. SQL metrics tag `TahaiSkins`; 34 localized native
   manager messages. Master disable retains data; install lock allows removal.
6. Five `TahaiSkinStoreTest` native definitions; five
   `TahaiSkinProfileBrowserTest` and three `TahaiSkinManagerBrowserTest`
   definitions, alongside fourteen decoder/browser-owner cases. Actual native
   tests are wired into `tahai_mission_service_tests` and `browser_tests`.
7. `chrome/installer/win/tahai_msix/release_evidence{,_test}.ps1` now require all
   27 Skins tests. Native discovery includes `TahaiSkin*`. Fixture attempt counts
   are 25 native / 97 browser. A tenth runtime smoke, `skin-package-manager`,
   is now mandatory. These counts are synthetic, NOT executed tests or smoke.

New directories and manager files are untracked. `git diff` alone will omit
them: inspect `git status --short` and explicit paths. No commit made.

## Source checks actually completed

- clang-format dry-run and scoped `git diff --check` passed.
- GN `check --check-generated` passed for
  `//chrome/browser/tahai_skins:*` and `//chrome/browser/ui:ui`.
  These inspect headers/build dependencies, **not C++ bodies/linking**.
- Official explicit-file DEPS API: 21 files, zero violations. The CLI would
  skip untracked directories and expects unavailable git.bat; the presubmit
  API avoids both. Existing Python escape-sequence warnings were not failures.
- Both new policies passed Chromium's definition checker, zero errors/warnings.
  Resource XML, all 34 manager IDs, SQL tag and source-to-gate inventories passed.
- Packaging guard: 22 synthetic checks passed. No Chromium test executed.

## Actual build/artifact state at checkpoint

No ninja/siso/clang-cl process was found in the last read-only check.

| File | UTC modification | Bytes |
| --- | --- | --- |
| out/tahai_release_x64/chrome.exe | 2026-08-27 19:00:38 | 3,979,264 |
| out/tahai_release_x64/chrome.dll | 2026-08-27 18:59:07 | 412,945,408 |
| out/tahai_release_x64/tahai_mission_service_tests.exe | 2026-08-25 21:38:40 | 404,943,872 |
| out/tahai_release_x64/browser_tests.exe | absent | — |

Last disk check: C: 63.80 GiB and D: 19.31 GiB free. Headroom is declining;
recheck before a final build and packaging. No user files were deleted.
The last known failed build log is
`out/tahai_release_x64/tahai_final_build_resume_20260829.stdout.log`;
failed Blink transform_stream_default_controller.obj / transferable_streams.obj
actions. Do not claim the underlying cause is known or that it is still running.
Old output `C:/src/tahai-release/store-msix-2.0.31.0-native-20260827-1503`
is stale and is not a deliverable for these changes.

## What Terra should do next

1. Read `docs/tahai-release-audit-2026-08-30.md`, the full approved
   `chrome/browser/ui/tahai/TAHAI_GUARD_SKINS_ROADMAP.md`, and this checkpoint.
   Reconcile actual code with requested scope. No native build was authorized
   as an intermediate shortcut; no claimed percentage reflects the full chat.
2. Review this batch for API/type correctness and lifecycle/transaction races
   before extending it. Pay particular attention to native dialog destruction,
   queued policy revocation and service shutdown, review-vs-storage semantics,
   unknown/corrupt database behavior, disk full and imported revision conflicts.
   Source tests are not proof these paths compile. No storage operation changes
   active appearance. Already-confirmed transactions may finish after closure
   or policy revocation; UI/docs say so, and revoked previews cannot publish.
3. Finish or explicitly retain the honest deferred UI boundary for active Skins
   appearance: safe shell consumers, original assets, Apply/Revert/Save Copy,
   Studio/export, mode/Mission/policy selection and safe-UI recovery. Do not
   treat the new native package manager as the entire skin system.
4. Keep other unfinished approved work visible: Environment Guard call-site
   coverage, Identity Lane management, capsule portability/key recovery,
   lawful sync transport, signed Pack lifecycle, Change Lens capture/diffs,
   Sentinel scheduling, broader Recall, governed Pilot, Team/War Room,
   mode/workspace acceptances, Local OI/DNS/TLS, enterprise deployment and AX.
   Proprietary Google/Edge sync stays unavailable; cloud contracts are not live.
5. Once the agreed release source scope is complete, diagnose the actual old
   build failure and run one fresh native build of browser and focused test
   targets. Repair scoped defects and rerun affected checks. Demand fresh four-
   binary identity/hash/timestamps and actual launcher JSON for every mandatory
   test. Run isolated-profile smoke and installed acceptance. Only then use
   `chrome/installer/win/tahai_msix/package_unsigned_msix.ps1` with a fresh unique
   directory/version and real evidence. Verify manifest/payload/hash; never
   label an unsigned package Store-certified or universal enterprise GA.

Do not run `D:/dev/browser/app/tahai_release_follow_through.ps1`: it is an old
helper with stale-output/process assumptions. The old app-side native gate is
also not complete release evidence. Do not hand-edit success into evidence.

## Useful paths and source-check environment

Native tree: `C:/src/TAHAI-Chromium/src`.
App/reference tree: `D:/dev/browser/app`.
Full plans: `TAHAI_WINDOWS_NEXT_100_UPGRADES.md` and
`TAHAI_WINDOWS_MODE_UI_REFACTOR_SPEC.md` in the app tree.
Guard details: `docs/tahai-guard-engine.md`.
Skins details: `docs/tahai-skin-decoder.md`.
Package evidence contract: `chrome/installer/win/tahai_msix/RELEASE_VALIDATION.md`.

For GN source checks only, use subprocess-local environment:
DEPOT_TOOLS_WIN_TOOLCHAIN=0;
vs2026_install=C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools;
PYTHONDONTWRITEBYTECODE=1; remove literal quote characters from process PATH.
Tools: buildtools/win/gn.exe, buildtools/win-format/clang-format.exe,
C:/Python314/python.exe. Do not reinterpret GN header success as compilation.
