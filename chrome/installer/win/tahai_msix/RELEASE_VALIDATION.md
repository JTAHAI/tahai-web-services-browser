# Native Windows release evidence

This is a fail-closed packaging gate, not a GA certificate or Store approval.
Do not generate successful evidence from source checks, old binaries, fixture
data, a surviving browser process, or a failed build. The synthetic guard tests
do not execute Chromium.

`package_unsigned_msix.ps1` requires an explicit version, a previously nonexistent
output directory, and `-ValidationEvidence <absolute release.json path>`. There
is no overwrite switch or automatic deletion. Keep failed output directories
for diagnosis and use a different unique directory for a subsequent attempt.

Before producing evidence:

1. Finish and freeze the agreed release source scope. Record remaining deferred
   capabilities honestly; a disabled placeholder is not a completed feature.
2. Record the final build start/end as UTC Unix milliseconds and its actual exit
   code. Preserve the exact log. All four binaries below must be freshly produced
   within this interval. Do not adjust their timestamps to make them pass.
3. Run the focused native and browser test selections using
   `--test-launcher-summary-output=<new absolute file>` and no retries. Preserve
   JSON and exit codes. Include all TAHAI tests, both rail browser regressions,
   all `TahaiSkinDecoderBrowserTest`, `TahaiSkinProfileBrowserTest`,
   `TahaiSkinManagerBrowserTest`, `TahaiSkinStoreTest` cases and the
   Windows-path/exact-ratio skin validator regressions in `docs/tahai-skin-decoder.md`,
   Local OI persistence/private-mode tests, and the new policy regressions. The
   adjustable-grid model, interaction, and browser-restart regressions described
   in `docs/tahai-grid-layout.md`, named workspaces in
   `docs/tahai-named-workspaces.md`, and all engine/session IPC cases in
   `docs/tahai-guard-engine.md`, production Guard request,
   profile, policy, Custom-rule UI and cosmetic cases, controlled owner-failure
   cases and controlled proxy cases are mandatory. These Guard cases
   do not replace broader installed-package and performance acceptance. The
   package gate enforces named regressions and every discovered MissionService/
   Local OI/Skins native test and TAHAI browser test in the summaries' actual
   `all_tests` lists. A filtered-out discovered test is a failure. This still is
   not the entire upstream Chromium or installed-package QA plan.
4. The required `TahaiPolicyPrefsTest.TahaiAllEnterprisePoliciesMapToManagedPreferences`
   runs Chromium's policy-to-preference verifier on all 16 Local OI,
   named-workspace, Guard and Skins mapping files. It refuses missing files and
   ignores external mapping filters. Also verify effective managed values
   through the native policy page in a controlled test profile. The source
   policy syntax check does not prove deployment.
5. Launch the actual fresh browser with a new isolated profile and sandbox
   enabled. Inspect the rail's three states, native-menu recovery, Dual View and
   Local OI, named workspaces and Guard Custom-rule editing/filtering/Off recovery.
   Capture evidence for each assertion. Close normally and record the
   exit result. A forced termination cannot produce a successful clean-exit
   smoke report. Do not install over or inspect the user's normal profile.
6. Hash the binaries and reports after these checks. Record observed results in
   a new evidence directory. Never hand-edit a failure into a success. The gate
   verifies integrity/freshness, not the honesty of a human-written attestation.

The release JSON has `schemaVersion: 1`, `buildExitCode`,
`buildStartedUnixMs`, `buildFinishedUnixMs`, and these entries:

- `artifacts`: exactly one `{name, bytes, sha256}` each for `chrome.exe`,
  `chrome.dll`, `tahai_mission_service_tests.exe`, and `browser_tests.exe`.
- `buildLog`: `{file, sha256}` for the final successful build log.
- `nativeTests`, `browserTests`: `{file, sha256, exitCode}` referring to actual
  Chromium test-launcher summary JSON files. Empty runs, missing regressions,
  skipped/crashed/timed-out tests, and failed attempts followed by successful
  retries are rejected.
- `smoke`: `{file, sha256}` for the recorded isolated-profile smoke result.

Every referenced evidence file is a plain filename beside `release.json`, not
an absolute path, symlink, or a traversal. Smoke JSON has `schemaVersion: 1`,
boolean `isolatedProfile` and `cleanExit`, numeric `exitCode`, `chromeSha256`,
`chromeDllSha256`, and `checks`. Each check has `name`, `status`, and
`evidence: {file, sha256}`. Required names are `rail-icons`, `rail-expanded`,
`rail-hidden`, `native-menu-recovery`, `dual-view`, `local-oi`,
`named-workspaces`, `guard-custom-rules`, `guard-native-panel`, and
`skin-package-manager`. The Skin package smoke must use the actual native
chooser, validated artwork review, confirmed install/update, previous-revision
review/restore and confirmed removal, across restart and managed/private
boundaries. Check native-menu access with the rail hidden, keyboard navigation,
screen-reader names and supported DPI. Confirm that package storage alone does
not apply a live appearance. Also exercise timed preview/revert, exact archive
export, included palettes and restart, shell decoration, contrast, compact rail
spacing and a real offline Studio export imported through the native manager.
The Guard smoke must exercise
Custom-rule compilation, observable fixture blocking, Off recovery, managed
failure, and separate incognito protection with no rule writes or counters.
The native-panel smoke must exercise actual buttons, same-origin pane isolation,
navigation/reload expiry, exact-site exception persistence and removal, and
private/managed locks. Verify native-menu recovery in every mode with the rail
hidden, and keyboard focus/scrolling for the entire panel at supported DPI.
The workspace smoke must exercise native save, rename,
open-in-new-window with retained original tabs, and confirmed deletion in a
disposable regular profile, plus the disabled-policy and private-profile states.

Only a successful packaging pass emits `release-receipt.json` and an MSIX SHA-256
sidecar. The receipt covers every staged payload file and requires matching
unpacked bytes, manifest name/publisher/version/x64 architecture, and core binary
hashes. It explicitly says `unsigned: true` and `storeCertified: false`.

TAHAI builds generate full third-party credits even when `is_official_build` is
false. `verify_release_resources.py` decompresses the actual credits resource
from `resources.pak`, rejects the sample/missing Guard notices, and compares it
with the generated page. It also compares the two Guard lists and creator kit
with their exact current source bytes. The packager requires this check and
includes `ThirdPartyNotices/` with source provenance, engine/list licenses and
original/derived filter data. Python and the build's Brotli tool are required
for this read-only preflight. These packaging checks do not replace runtime tests.

After packaging, installed-package QA remains mandatory before describing a
release as ready for users: controlled install/upgrade, branding/taskbar identity,
rail migration, all modes, DPI 100/125/150/200%, keyboard/Narrator, contrast,
profile isolation, crash recovery, and update/uninstall behavior. Use a dedicated
test account or machine; do not bypass signing requirements or overwrite the
user's Store installation without authorization.

Run the packaging guard's synthetic regressions with:

```powershell
powershell.exe -NoProfile -File chrome/installer/win/tahai_msix/release_evidence_test.ps1
```

Those checks only validate the guard's rejection logic. They are not browser
test results and must never be included as native release evidence.
