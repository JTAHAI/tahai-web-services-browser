# TAHAI Chromium 154 build-machine handoff

This is a source-engineering handoff, **not a tested RC or an MSIX**. The user
will build on another machine. Do not reuse the old 152 binaries as evidence for
this source, resume the paused scheduler, or upload anything to the Store.

## Source identity and scope

- Repository: https://github.com/JTAHAI/tahai-web-services-browser
- Branch: `codex/ga-2.0.33-chromium-152` (the name is retained; source is **154**).
- Upstream: Chromium `154.0.8037.93`, tag commit
  `f89f3a4363808e117c592adedcf9947882ac3b79`.
- Native merge: `e035511dcbab7bfc9d73a94fc96e7527c0daa733`, followed by the
  portable-preflight/handoff checkpoint. GitHub publication uses the repository's
  existing tree-identical source-publication history, not the shallow native
  Chromium ancestry. The publication commit message records its native commit
  and tree. Record `git rev-parse HEAD` and `git rev-parse HEAD^{tree}` on the
  build machine; do not substitute a native commit ID for the checked-out ID.
- Keep the Store identity/publisher unchanged; the planned MSIX version remains
  `2.0.33.0`, distinct from Chromium's engine version.
- Royal website-derived artwork and default styling, native security/consent,
  workspaces, modes, Guard, skins and operational workflows remain in scope.
  Provider-specific connectors remain optional Chrome extensions.

The [engineering record](tahai-rc-engineering-review-2026-09-30.md) separates
source checks from historical and still-pending runtime evidence.

## Prepare the other Windows machine

Follow this revision's [upstream Windows instructions](windows_build_instructions.md).
Do not lower the source SDK/compiler pins to use older installed tools.

- Visual Studio 2026 >=18.0.0: Desktop development with C++, including ATL/MFC.
- Windows SDK **10.0.28000.2270** (header/library directory `10.0.28000.0`).
- x64 SDK Debugging Tools >=**10.0.26100.3323**.
- Git, depot_tools and its bootstrap Python; a separate Python 3.11+ with
  `tools/tahai/source-check-requirements.txt` installed (cryptography and
  Playwright); Node.js for the source DOM/logic tests and stock Microsoft Edge
  for isolated source-render checks. Do not install these into the bootstrap.
- PowerShell 7 with `ConvertFrom-Json -DateKind` support. Do not use Windows
  PowerShell 5.1 for the release runner.
- Dedicated NTFS checkout/output, sufficient free disk and RAM, and an identified
  isolated Windows account/session or VM for runtime/package testing. A hidden
  window or a label passed to the script does not create isolation.

The pinned toolchains are obtained through the source dependency hooks:

| Toolchain | Source pin |
| --- | --- |
| Clang | `llvmorg-24-init-3796-g20e97c4b-27` |
| Rust | `0913b18e489ac1011b580e31fa5559654be12bfc-2-llvmorg-24-init-3796-g20e97c4b` |

Clone the branch into a new `<checkout-root>\src`, **without recursive Git
submodule initialization**. Use gclient for Chromium's conditional dependencies.
Place this `.gclient` beside `src`, not inside it:

```python
solutions = [{
    "name": "src",
    "url": "https://github.com/JTAHAI/tahai-web-services-browser.git",
    "managed": False,
    "custom_deps": {},
    "custom_vars": {},
}]
target_os = []
```

From `<checkout-root>`, with depot_tools on PATH and the selected VS installation
configured per upstream instructions:

```powershell
$env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
gclient sync --nohooks --noprehooks --jobs=2 --no-history
if ($LASTEXITCODE -ne 0) { throw 'Dependency sync failed' }
gclient runhooks
if ($LASTEXITCODE -ne 0) { throw 'Dependency hooks failed' }
```

These commands download/install source-managed dependencies on the build machine.
Do not run them concurrently with a build. Freeze the selected depot_tools,
bootstrap Python, SDK and VS paths for the whole run; preserve sync/hook logs.
Use `WINDOWSSDKDIR` if the SDK is installed in a nonstandard location.

## Source checks and reviewed build arguments

From `src` in PowerShell 7, replace these example interpreter/tool paths with
the actual installations. `$BootstrapPython` must be inside `$DepotTools`.

```powershell
$DepotTools = 'C:\src\depot_tools'
$BootstrapPython = 'C:\src\depot_tools\<selected-bootstrap>\python3\bin\python3.exe'
$VisualStudio = 'C:\<selected-Visual-Studio-2026-installation>'
$SourcePython = 'C:\<Python-with-source-check-requirements>\python.exe'
$Node = 'C:\Program Files\nodejs\node.exe'
$PowerShell = 'C:\Program Files\PowerShell\7\pwsh.exe'

& $SourcePython tools/tahai/check_windows_build_prerequisites.py `
  --visual-studio $VisualStudio --depot-tools $DepotTools `
  --bootstrap-python $BootstrapPython
if ($LASTEXITCODE -ne 0) { throw 'Build-machine preflight failed' }

& $PowerShell -NoProfile -File tools/tahai/verify_source.ps1 `
  -PythonExecutable $SourcePython -NodeExecutable $Node `
  -PowerShellExecutable $PowerShell -RenderCss
if ($LASTEXITCODE -ne 0) { throw 'Source preflight failed' }
```

The prerequisite script checks required files and compiler stamps without
installing or executing compilers. It **does not verify** VS component versions,
SDK servicing/debugger versions, the whole dependency tree, or native behavior.
The source suite is also not native acceptance. Required `-RenderCss` exercises
the source-render/keyboard harness with an isolated stock-Edge profile; it does
not launch a freshly built TAHAI browser.

Use a **new** output directory and inspect the checked-in argument profile:

```powershell
$BuildDirectory = 'out\tahai_rc_154_x64'
if (Test-Path -LiteralPath $BuildDirectory) {
  throw 'Choose a new dedicated build directory; do not overwrite existing output'
}
New-Item -ItemType Directory -Path $BuildDirectory | Out-Null
Copy-Item -LiteralPath tools/tahai/rc-validation-x64.gn `
  -Destination (Join-Path $BuildDirectory 'args.gn')
Get-Content -LiteralPath (Join-Path $BuildDirectory 'args.gn')
```

This profile preserves the recovered non-debug, non-component x64 TAHAI
validation configuration. It does **not** enable `is_official_build` or claim
official PGO/shipping optimization. A production-optimized configuration needs
its own reviewed arguments, required profiles, fresh build and full evidence;
do not silently change arguments midway or treat validation output as proof of
that separate configuration.

## Native build and required regression gates

On the **already isolated** Windows test machine/session:

```powershell
& $PowerShell -NoProfile -File tools/tahai/verify_upgrade.ps1 `
  -BuildDirectory $BuildDirectory -DepotTools $DepotTools `
  -VisualStudioPath $VisualStudio -BootstrapPython $BootstrapPython `
  -CreatorPython $SourcePython -SourceNode $Node -SourcePowerShell $PowerShell `
  -Jobs 1 -MaxBuildAttempts 1 `
  -IsolatedTestSession '<actual-machine/account/session-or-VM-identity>'
if ($LASTEXITCODE -ne 0) { throw 'Native build or regression gate failed' }
```

The runner checks prerequisites before GN, acquires an exclusive output lock,
records source/argument provenance, and builds seven targets: `chrome`,
`browser_tests`, `tahai_mission_service_tests`, `elevation_service`,
`elevated_tracing_service`, and both corresponding `_unittests` targets.
Evidence binds eight binaries, including `chrome.dll`. It preserves old output
binaries before relinking; a second full invocation is not a tests-only run.
Do not delete a lock based solely on its PID. Check owner start time, actual
runner status/logs and child processes first.

Every runner invocation, including `-BuildOnly`, now runs the entire source
preflight **before GN or compilation**. It records 29 suites including the
isolated source render check at `source-preflight/source-preflight-summary.json`.
The version-2 source summary binds commit/tree, dirty/staged/untracked source
identity, tool versions, script hashes, nonzero check counts and hashed logs.
Source edits during preflight, generation or compilation invalidate the run.
Version-3 `release.json` requires this same preflight snapshot; old version-2
release manifests and standalone historical source summaries cannot qualify.
The evidence assembler preserves the summary and all 29 logs without rewriting
them; the MSIX receipt includes their summary hash, suite count and source tree.

## GitHub verification

`TAHAI source preflight` is the source-only required check for the publication
branch. It runs on ephemeral Windows hosted runners for every push/pull request
(no path filters), with read-only permissions, immutable action pins and a
commit-bound evidence artifact. It never starts Chromium compilation or TAHAI
native tests. A successful check is source acceptance only.

`TAHAI manual native acceptance` is dispatch-only and restricted to the approved
repository/branch, the `tahai-native-acceptance` environment, and a dedicated
`self-hosted, Windows, X64, tahai-native-isolated` runner. It never syncs or
rewrites a prepared checkout, dispatches on PRs, packages, or uploads to Store.
Set environment variables through GitHub environment/repository variables:
`TAHAI_SOURCE`, `TAHAI_BUILD`, `TAHAI_DEPOT_TOOLS`, `TAHAI_VISUAL_STUDIO`,
`TAHAI_BOOTSTRAP_PYTHON`, `TAHAI_SOURCE_PYTHON`, `TAHAI_SOURCE_NODE`, and
`TAHAI_SOURCE_POWERSHELL`. The prepared checkout must be clean and its tree must
match the dispatch commit; native/publication commit IDs may differ but their
trees may not. Default dispatch is BuildOnly; real runtime testing additionally
requires the actual isolated interactive Windows session. Diagnostics survive
failure, and builds serialize without canceling an active compiler.

GitHub also requires a dispatch workflow entry on the default `main` branch.
Install only this workflow there before trying to dispatch the source branch;
do not change the repository default branch or move browser source to `main`.
Do not dispatch this workflow until the external workstation is prepared.
Protect the runner environment with an approval reviewer and restrict it to the
publication branch; never attach an everyday desktop or public-PR runner.
See [GitHub's workflow security guidance](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
for immutable action pins and self-hosted runner trust boundaries.

It runs these exact scopes, one test job, **zero retries**, with nonzero
selection and required regression sentinels:

| Binary | Scope |
| --- | --- |
| `tahai_mission_service_tests.exe` | all tests |
| `browser_tests.exe` | `--gtest_filter=*Tahai*` |
| `elevation_service_unittests.exe` | `--gtest_filter=ServiceMainTest.*` |
| `elevated_tracing_service_unittests.exe` | `--gtest_filter=SystemTracingSessionTest.*` |

Use `-BuildOnly` instead of `-IsolatedTestSession` if only compiling on a
non-test desktop. **Exit 0 then means built, with runtime gates pending**.
Evidence lives in `out/<build>/upgrade-checks-<timestamp>`; preserve actual exit
codes, failed attempts, summaries, source snapshot and status. Never retry a
failing test into a claimed clean pass or package old output.

The operational-skin follow-up adds nine required regression sentinels. Preserve
the complete scopes above: fresh drafts must target the running engine without
rewriting saved author ranges; authored manual recovery must survive activation,
cancellation and restart; malformed handoffs must not replace valid ones; native
manager activation must stop on synchronous close, retarget and trust revocation.
The creator-kit check also compares bundled compatibility against `chrome/VERSION`.
The source-only JS/creator tests do not substitute for these native tests.

The cross-feature follow-up adds required native coverage for Work Mode preference
authority, preservation, shutdown/reentrancy and private-profile acknowledgment;
workspace storage policy; mission ledger integrity and UTF-8; archive/restore
workflow suspension; Local OI generation/schema integrity and finding projections;
and live-document capability boundaries. Run the complete scopes, not only the
new sentinels. The source preflight now also exercises actual shipped Work Modes
and Local OI request/navigation JavaScript with DOM doubles. Those tests are not
native WebUI or Windows integration evidence.

## Operational and package acceptance still required

After all four native gates pass, launch only the new binary with a new explicit
profile. Verify Royal/native appearance, keyboard/focus/accessibility, B1 trust,
security/consent, workspace and workflow behavior, and Windows-service
installation/cross-integrity behavior in the isolated environment. Earlier
accessibility COM-reference leaks remain unresolved until fresh runtime evidence
demonstrates otherwise; do not disable the assertions or accessibility.

The packaging guard requires a real clean-exit smoke report bound to both browser
binary hashes and separate evidence for `rail-icons`, `rail-expanded`,
`rail-hidden`, `native-menu-recovery`, `dual-view`, `local-oi`,
`named-workspaces`, `guard-custom-rules`, `guard-native-panel` and
`skin-package-manager`. See the schema/required checks in
`chrome/installer/win/tahai_msix/release_evidence.ps1`. Do not copy fixture
reports, invent successful checks, or relabel old reports.

Only after actual reports exist, assemble evidence with
`tools/tahai/assemble_release_evidence.ps1` (`RunDirectory`, `BuildDirectory`,
`SmokePath`, a new `EvidenceDirectory`, and explicit `ProvenancePython`). It
validates the bundle and creates `release.json`. Supply that exact file to
`chrome/installer/win/tahai_msix/package_unsigned_msix.ps1`, with explicit
`BuildDir`, new `OutDir`, `Version 2.0.33.0`, `ValidationEvidence` and
`ProvenancePython`. This pipeline produces an **unsigned** MSIX, not a
Store-signed package or a completed release.

Validate the exact final package/signature in an identified isolated Windows
environment: installation, launch, applicable upgrade from 2.0.32 and state
retention, manifest/resources/security, and certification checks. A separately
test-signed copy has a different hash and is not proof that the unsigned or
Store-signed bytes were installed. Report each artifact's path, version,
SHA-256, actual signing status, source identity and exact evidence. Do not touch
Justin's installed Store browser/profile or upload to the Store.
