# TAHAI Skin packages and native appearance

The September 5 upgrade adds native appearance, timed live preview, reviewed
archive export, eight included palettes, rail decoration and an offline visual
Skin Studio to the existing sandboxed package manager. The full browser build and runtime
gate for this revision are still pending; no new MSIX has been produced from
this batch. See [the upgrade record](tahai-upgrade-2026-09-05.md) for the current
scope and verification commands. The older implementation notes below describe
their original batches, not the current verification result.

## Starter package

`docs/tahai-skins/starter-skin/` is a ready-to-copy source folder, and
`docs/tahai-skins/starter-skin.tahaiskin` is the corresponding minimal valid
archive for Chromium 150. The shipped **Skin packages > Save skin creator kit**
action exports `docs/tahai-skins/skin-creator-kit.zip`, including the source
template, an offline `studio.html`, a Python packager/validator, instructions,
artwork license, and the prebuilt example. The packager updates hashes and produces the exact file-only
ZIP layout accepted by the importer. It refuses to overwrite existing output.

The example's old PNG had an invalid IDAT CRC. It is replaced with a valid
128-pixel Chromium fixture, and a real sandbox browser regression now decodes
the shipped resource. Five Python creator tests pass; the browser regression
is awaiting the current native build. The actual Studio download was exercised
in a browser and its resulting ZIP, CRC, manifest and hashes passed validation.
The Studio refuses export below 4.5:1 text contrast in any of its three palettes.

## Apply, reset, and profile ownership

Install a reviewed package, review its installed revision, then choose **Apply
to browser colors**. Light, dark, and high-contrast palettes style the native
frame, toolbar, tabs, workspace rail, and supported side-panel cards. OS forced
colors take priority. Origin/security indicators, warnings, focus rings,
permission prompts, and web content retain Chromium's native definitions.

The profile service owns the selection and immutable color supplier. It
restores compatible validated palette metadata at startup, reconciles the
selected revision with the package store, and retires a removed or replaced
revision even if the manager closes before storage finishes. Idempotent imports
do not reset appearance. A later manual theme change clears skin ownership, so
removing the old skin preserves that manual choice. Master-disable policy
resets an owned appearance without deleting packages.

**Try for 30 seconds** temporarily supplies the reviewed palette without
changing saved appearance preferences. Revert, expiry, manager closure or an
external theme change ends the preview. **Export reviewed skin** saves the
exact validated archive, subject to current review-token and policy checks.
**Reset browser appearance** restores the native default.

Eight included palettes come from a closed native catalog, persist across
restart and obey the same policy/ownership rules. Imported packages cannot
impersonate those reserved identities. A declared still shell decoration appears
in a separate, noninteractive rail slot, hidden in icon-only/hidden rail and OS
forced-color modes. Compact density adjusts rail spacing while retaining
minimum control sizes. Artwork restored from storage is decoded again in the
sandbox before use. There is no skin animation path.

Appearance remains profile-owned. Per-window/mode selection, arbitrary current
theme export and launch-collection artwork are not implemented capabilities.

## Boundary

The pure manifest/package validators now live in `chrome/common/tahai_skins`.
Compatibility headers retain the original WebUI include paths; the sandbox does
not link WebUI or Profile services.

`chrome/services/tahai_skins` registers a `kService` sandboxed Mojo decoder.
One instance accepts one archive. It gets bytes only: no filesystem, extraction
directory, URL, network service, native library or arbitrary browser callback.
It copies incoming writable shared memory before parsing, inspects the entire
ZIP directory, validates the manifest/inventory, and only then extracts assets
into bounded memory. CRC and manifest SHA-256 must match before raster decode.

Literal central-directory names are checked before ZipReader normalization.
The additive ZipReader metadata exposes raw names, compressed length, method,
Unicode path aliases and external attributes. The decoder rejects absolute/UNC/
drive paths, traversal, backslashes, alternate streams, NULs, case aliases,
Windows device names, trailing-dot segments, duplicate/unlisted entries,
directories, symlinks, reparse points, POSIX special files, encryption, alternate
Unicode names, and methods other than store/deflate. It never stages a ZIP member
at a filesystem path. A matching digest is integrity metadata, not a signature.

Only explicit still PNG (Rust PNG decoder) and WebP codecs are permitted; suffix
and magic must agree. Dimensions are checked before pixel allocation, animation
is rejected, and successful output is tightly packed premultiplied N32/sRGB.
Partial/failed decode results never return a candidate.

`chrome/browser/tahai_skins/SkinDecodeSession` owns one separately launched
utility and a 30-second deadline. Explicit cancellation/disconnect/timeout cannot
publish a candidate. Cleanup precedes user callbacks; callbacks may destroy the
owner. Destruction silently cancels callbacks. Cancellation before the process
handle arrives also terminates that exact newly owned process, not a process
found by name or an arbitrary PID.

The browser reparses the closed manifest, checks the current Chromium version,
and validates the complete returned inventory and all dimensions/byte lengths
before bitmap allocation. It copies writable shared memory into private,
immutable bitmaps. Only the browser calculates the original archive SHA-256.
The sandbox's output is not treated as a publisher/trust attestation.

## Limits

| Input/output | Hard limit |
| --- | --- |
| ZIP input | 9 MiB |
| Manifest | 64 KiB; JSON depth 16 |
| ZIP members | one `manifest.json` and 1–16 declared assets |
| Encoded asset | 4 MiB |
| Total encoded assets | 8 MiB |
| Per-member uncompressed/compressed ratio | at most 100:1, exact multiplication |
| Image dimensions | 1–2048 pixels on each axis |
| Decoded asset | 16 MiB |
| Total decoded output | 32 MiB |
| Decode lifetime | one request, 30 seconds, no automatic retries |

Limits are rejection boundaries, not measured performance claims. Codec-internal
allocation behavior, decoder fuzzing, process failure, latency and memory budgets
still require validation before release.

## Original decoder test source

The original fourteen `TahaiSkinDecoderBrowserTest` definitions cover:

- Actual sandbox IPC with valid PNG/WebP, store/deflate and immutable output.
- Literal path aliases, Windows device names, POSIX links/special files,
  reparse/encryption/method flags and Unicode aliases.
- Duplicate/missing/unexpected members, exact compression ratio, declared versus
  extracted size, CRC/hash mismatch, hostile manifests and unreadable colors.
- Unsupported/animated images, dimensions and aggregate decoded pixels.
- Current-version incompatibility and malformed controlled utility replies.
- A retained writable IPC mapping that must not alter the accepted bitmap.
- Single-use ownership, cancellation, disconnect, callback-driven destruction,
  actual timeout and input bounds.

The native `MissionServiceTest` also has Windows-path and exact-ratio/invalid-
purpose regressions. All are mandatory in the packaging evidence gate; adding
their names to a synthetic fixture does not mean they ran in Chromium.

## Historical checks for the original decoder batch

- Chromium clang-format dry run and scoped `git diff --check` passed.
- GN header/dependency checks passed for the browser session/tests and sandbox
  decoder targets. These are not C++ compilation or linker checks.
- The official DEPS include checker, applied explicitly to all ten new/shared
  C++ source/header files, reported zero include violations. Explicit-file
  checking avoids skipping newly untracked directories.
- The Mojo grammar parser accepted the new interface. Generated C++ bindings
  and service launch have not been compiled/executed.
- Static inventory found fourteen unique browser regression definitions, all
  present in the required gate and its synthetic fixture; the new localized
  process-name resource occurs exactly once.
- The packaging guard passed 22 synthetic checks, using 20 native and 89 browser
  *fixture* attempts. No Chromium test executable was run.

Read-only artifact check still found August 27 browser binaries, an August 25
focused native-test binary and no `browser_tests.exe`. No intermediate build,
smoke launch, installation or MSIX packaging was performed in this batch.

## Remaining release and extended-feature work

Actual original launch-collection assets; Studio and arbitrary appearance
export; live preview with revert/save-copy; per-window/mode/Mission selection;
safe-UI/crash recovery; native runtime/private/managed/persistence proof;
upgrade/disk-full/physical-file failure tests; accessibility/DPI/contrast/RTL;
focused native tests and installed MSIX QA.
The hosted catalog and legacy `.wsz` importer remain separately deferred.

## Historical package-management implementation notes

- `skin_package_store` stores original archives and accepted manifest text in a
  fixed profile-local `TAHAI Skins` SQLite database on a background sequence.
  There is no member extraction or image data in preferences. Limits: 24
  packages, one previous revision per package, 48 MiB retained archive bytes,
  80 MiB database pages, 512 KiB page cache, mmap disabled. SQLite transaction
  journal space is additional; these are not total process/disk measurements.
- Add is insert-only; update/remove require the exact reviewed current SHA-256.
  A same-hash update preserves rollback. Update retains current as previous
  atomically; rollback uses the same compare-and-swap after decoding the prior
  archive again. No quota recovery silently evicts another package. Unknown
  versions/corruption fail without razing or rebuilding the user's database.
- `SkinProfileService` is regular-profile-only, lazy, one operation/candidate
  per profile. Its read path validates stored metadata/hash then re-runs the
  sandbox decoder and compares the returned manifest/id/hash to the stored
  record. Preview tokens are opaque, short-lived in memory, and invalidated on
  replacement, cancellation, policy change or shutdown. Old review release
  cannot clear a newer token. Stock/first-party IDs cannot be imported.
- `tahai_skin_manager` is a single native Views window per profile, available
  through the app and secondary toolbar menus even when the rail is hidden.
  It offers explicit local `.tahaiskin` selection, validated metadata/artwork
  review, confirmed install/update/restore, current/previous review, and
  confirmed removal. Source files are never deleted. Artwork is explicitly
  labeled untrusted package content, not a prompt or live appearance preview.
  UI closes/revokes callbacks and drops pixels on policy changes/closure.
- The global file-dialog policy is checked when opening and receiving a
  selection. Package policies `TahaiSkinsEnabled` (1473) and
  `TahaiSkinInstallationsAllowed` (1474), atomic group 68, are non-syncable
  per-profile managed preferences. Installation lock still allows current
  package review/removal. Master disable denies access without deleting data.
  Already-confirmed storage transactions may finish after cancellation/policy
  changes, but cannot publish or activate a revoked preview. No visual apply
  operation exists yet. Native chooser path checks reject relative/traversal,
  UNC and device-prefix spellings; this does not prove all filesystem-backed
  remote locations such as mapped drives are impossible.
- Five new store test definitions exercise atomic updates/restart, reviewed
  removal/profile separation, malformed input/reserved IDs, quota preservation,
  unknown versions/corruption. Five real-sandbox owner and three native manager
  browser-test definitions exercise install/update/rollback, isolation, policy,
  token/cancellation, rejected imports, all-mode menu/singleton access, native
  chooser/confirmed storage, and chooser revocation/closure. Fake OS chooser
  responses are used in manager tests; decoder/service/store remain real.
  All 27 Skins definitions (5 store + 22 browser) are required by the release
  gate. This is test source, not executed native test evidence.

Source checks actually run for this batch: clang-format dry run, scoped
whitespace check, GN header checks for Skins source/tests and native UI,
explicit-file DEPS on 21 C++ files (zero violations), two Chromium policy
definition checks (zero errors/warnings), valid resource XML with 34 unique
manager strings, SQL tag/inventory checks, and 22 synthetic packaging-guard
checks (25 native / 97 browser fixture attempts). No native build or run.
