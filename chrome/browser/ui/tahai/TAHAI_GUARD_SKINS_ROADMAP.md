# TAHAI Guard, Skins, and native rail acceptance contract

Status: approved product direction. A strict declarative Skin manifest validator
and the sandboxed Guard engine/session now exist in source. Guard now has source
for regular/incognito ownership, a production request-factory hook, Custom-rule
editing and managed policy, but has not been compiled or runtime-tested.
Private engines are separate and ephemeral in source, but not runtime-verified.
The native document-bound recovery panel and its regressions now exist in source,
but remain uncompiled/unrun. Default lists remain unfinished.
Skin archive/PNG/WebP decoding and a browser-owned, bounded sandbox session now
exist in source. A regular-profile SQLite package store and native package
manager now add explicit file review, install/update, previous-revision review
and restore, and confirmed removal. Five store and twenty-two browser-test
definitions are uncompiled/unrun. These include the fourteen decoder cases.
Appearance preview/apply/recovery, Studio, original launch assets, export and a
hosted catalog remain unimplemented. A package artwork review is not a live
browser-appearance preview.
No UI may imply unimplemented capabilities or protection in the old installed
package. See `docs/tahai-guard-engine.md` for the current source and open gates.

## Immediate rail correction

The native rail has exactly three persisted, per-profile/per-mode states:

| State | Required behavior |
| --- | --- |
| `icons` | 48-DIP rail; 20-DIP vector icons in at least 36-DIP buttons; no initials, selected bullets, or truncated names; full tooltips and accessible names; one click opens the browser-owned action. |
| `expanded` | Icons plus descriptive labels; width 220–480 DIP; no automatic intermediate collapsed-text state. |
| `hidden` | Invisible view with zero preferred/minimum width; no leftover resize handle or keyboard focus; restore from the toolbar mode menu, browser menu, or Work Modes settings. |

Existing `show_runbook_rail` preferences migrate once to expanded/icons when no
valid `rail_state` is present. Thereafter Mission guidance is independent of
native navigation. A skin must never override this explicit user preference.
Changing presentation must not navigate, create, close, or move tabs.

Source regression coverage: `WorkspaceRailStatesAreFiniteAndPersistPerMode`,
`WorkspaceRailMigratesLegacyBooleanAndRejectsBadState`,
`WorkspaceRailPreferencesDoNotCrossProfiles`,
`TahaiRailHasOnlyIconsLabelsOrHidden`, and
`TahaiCollapsedRailActivatesAndRestoresPreferences`.
The last two belong in the native browser release gate, not only a source grep.
Visual acceptance additionally requires installed-MSIX screenshots at
100/125/150/200% scaling, light/dark/high contrast, each mode, keyboard-only
navigation, Narrator, narrow/restored/maximized windows, and upgrade migration.

## Canonical product boundaries

- **TAHAI Guard**: native ad/tracker blocking. The earlier "Shield" name in the
  proposal is superseded by Guard. Do not confuse it with Environment Guard.
- **TAHAI Skins**: validated, local declarative browser-shell packages, not
  executable extensions and not CSS that can style website content.
- Windows native Chromium first. No Electron, MV3 substitute, or mobile work.
- No Brave or Winamp trademarks/artwork. Original TAHAI identity only.
- Browser origin/TLS display, permission prompts, warnings, focus, active-pane
  indication, and protection state are browser-owned and cannot be skinned away.

## Foundation batch G1: native Guard engine and ownership

Current source foundation: `tahai_guard_configuration.{h,cc}` and its
profile-local registry define and validate a strict Guard mode and
exact-origin recovery vocabulary (`Off`, `Balanced`, `Strict`, `Custom`, full
site off, or cosmetic-only off). The latest source connects Custom network
rules to profile-owned services and a request-factory proxy. The Support
editor exposes compile/replace, load/clear and actual owner state. Default lists,
cosmetic filtering and automatic updates remain unavailable. The native
document-bound panel now has source and unrun regression definitions.
Persistent exact-site exceptions are
not navigation-lifetime "allow once" controls. Source-only browser regressions
and managed policy definitions do not establish runtime protection. Browser-facing
editor/configuration accessors still reject off-the-record writes and raw rule
reads. Private engines inherit effective protection settings through their own
PrefService, never share the regular engine, and collect no counters. See the
engine document for bounds, ownership and unverified gates.
The existing explicit Support inspection clipboard handoff binds a pending
review to its exact inspected origin and re-evaluates that local Environment
Guard decision immediately before the copy; a newly blocked decision discards
the pending handoff. This is scoped clipboard enforcement, not native
ad/tracker filtering.

1. Pin `brave/adblock-rust` to a reviewed immutable revision; inventory Rust
   transitive dependencies and preserve notices. Use Chromium's Rust/GN tooling,
   not a Cargo invocation that downloads dependencies during a release build.
2. Implement a small TAHAI-owned C++/Rust bridge with owned request strings,
   bounded inputs/results, explicit errors, no borrowed cross-thread lifetimes,
   and no unwinding over FFI. Fuzz parsers and bridge inputs.
3. A profile-keyed service owns settings, compiled filter generations, and local
   exceptions. Matching must not block the UI thread or read prefs/disk per
   request. Compile updates off-thread and atomically publish an immutable,
   last-known-good generation with explicit sequence ownership.
4. Inspect the current `ChromeContentBrowserClient::WillCreateURLLoaderFactory`
   and throttle hooks before choosing interception placement. Prove coverage for
   top-level navigation, redirects, subframes, workers, service workers, fetch,
   images/media, and keepalive. A navigation-only throttle is insufficient.
5. Attribute requests to the correct BrowserContext, storage partition,
   document/navigation lifetime, and top-level site. Never infer ownership from
   the currently focused pane when evaluating requests from another pane.
6. The Guard panel targets the active pane, but decisions belong to each request.
   Lock the panel's document identity while it is open; refresh or invalidate it
   on navigation, pane switch, or tab destruction before accepting mutations.
7. Baseline engine failure must not crash navigation. Preserve managed mandatory
   policy behavior explicitly; do not silently fail open over an administrator's
   enforced block. Present degraded status without fabricating protection counts.

Exit: local fixture requests are observably blocked by the native engine;
switching the feature off restores baseline behavior; incognito and profiles
remain isolated. No "Guard enabled" badge before this evidence exists.

## Foundation batch S1: safe skin packages

Current source foundation: `chrome/common/tahai_skins/tahai_skin_manifest.{h,cc}`
accepts only schema v1
closed-vocabulary manifest metadata, bounded opaque raster asset references,
opaque SHA-256 integrity fields, finite shell tokens, and readable text color
pairs. `tahai_skin_package.{h,cc}` accepts only an already-inspected bounded
archive directory of exactly declared assets and verifies bounded staged asset
bytes against those integrity fields. These pure validators do not open archives
or change browser appearance. The separate `chrome/services/tahai_skins` source
opens an immutable bounded ZIP copy in a sandbox, rejects unsafe literal names,
validates the complete inventory/CRC/hash, and decodes only bounded still PNG/WebP
images into pixels. `chrome/browser/tahai_skins` owns one decode, a 30-second
deadline/cancellation, and revalidates all returned metadata before copying
immutable pixels. The regular-profile owner now sends admitted original
archives to a bounded background SQLite store; the native package manager
requires separate review and confirmation, checks exact reviewed revisions,
and does not apply appearance. There is no publisher authentication.
See `docs/tahai-skin-decoder.md` for exact source limits and unrun tests.
The source also holds a profile/mode-local selection of a
finite original TAHAI launch-collection identity and a pure precedence resolver
for forced recovery, future enterprise policy, future Mission assignment, Work
Mode, profile, and stock fallback. These identity decisions alone still do not
apply a skin or alter any browser surface. Browser-facing selection accessors
also return stock and reject writes for off-the-record profiles, so an
incognito window cannot read from or write through the regular profile.

1. Define `.tahaiskin` schema v1: ID/name/creator/license, schema version,
   compatibility range, finite token maps, density bounds, local asset hashes,
   preview, and light/dark/contrast metadata. Unknown fields fail validation.
2. Tokens affect only enumerated browser-shell colors, geometry, and approved
   icon slots. Protect origin/security/warning/focus colors and minimum hit areas.
   Native skin consumers must not depend on a WebUI renderer being alive.
3. Reject scripts, HTML, stylesheets/selectors, dynamic URLs, remote references,
   native libraries, absolute/UNC/drive paths, traversal, symlinks/reparse points,
   alternate data streams, duplicate/case-colliding entries, and archive bombs.
   Begin with bounded raster assets; reject SVG until a safe decoder pipeline is
   explicitly reviewed. Hash checking is integrity, not publisher authenticity.
4. Extract/validate/decode in bounded staging, then atomically install. Persist
   current and last-known-good IDs. Preview is temporary and always reversible.
5. Provide an unskinned recovery route and startup safe-UI flag. Crash-loop or
   version incompatibility returns to the stock TAHAI skin without deleting the
   user's package. No skin can prevent access to recovery or settings.
6. Resolve precedence: forced enterprise policy, explicit Mission assignment,
   work-mode assignment, profile default, stock fallback. Incognito never writes
   back to the regular profile. Rail state always remains outside skin authority.

Exit: bounded fixture packages can be validated, previewed, applied, reverted,
and recovered without code execution or website changes. Reject adversarial
packages before any asset becomes visible.

## First-class experience batch G2/S2

Guard: Off/Balanced/Strict/Custom; site-scoped recovery; temporary navigation-
lifetime disable; permanent exception; cosmetic-only disable; reload confirmation;
list manager; local rule editor; diagnostics that explain rule/list/resource type.
Classify ads/trackers only where list provenance supports that distinction; do
not split an undifferentiated count into invented categories. Store no request
bodies, cookies, authorization headers, or full URL telemetry. Diagnostics are
bounded, ephemeral, explicit, and redact URL credentials/query/fragment.

Skins: Skin Manager and Studio; live preview with Apply/Revert/Save Copy;
import/export/update/remove; original first-party launch collection (Neon,
Sentinel, Terminal Green, Bare Metal, Glass Command, Classic Amp-inspired,
Midnight Operations, High-Contrast Operator). Keep animations optional and honor
reduced motion. Community catalog and `.wsz` conversion are later features,
not prerequisites for safe local packages.

Cosmetic filtering uses a distinct browser-controlled pipeline restricted to
the intended document and origin. Scriptlets/resource replacement require a
separate audited allowlist; a remote filter update must not gain arbitrary
execution merely by being called data. CNAME-uncloaking stays research-gated.

## Filter supply chain and licensing

Maintain `THIRD_PARTY_NOTICES.md`, `FILTER_LIST_LICENSES.json`, and
`FILTER_LIST_SOURCES.json` with reviewed origin/license, redistribution rights,
revision/hash, trust key, default status, update endpoint and success time.
The engine license does not license every list. No list ships enabled without
its own license/provenance review. Covered-source obligations and notices must
be satisfied for distributed MPL files and modifications.

Updates: HTTPS, trusted signed manifest (a hash fetched from the same untrusted
endpoint is not authentication), bounded payload/decompression/rule counts,
rollback/version rules, atomic installation, last-known-good fallback, and no
browsing-history upload. User subscriptions are explicit untrusted data with
separate size/SSRF controls; forbid local/private/credentialed endpoints by
default. Do not invent a TAHAI signing key, service URL, or live catalog.

Primary references checked for planning:

- https://github.com/brave/adblock-rust (engine/API/features/license)
- https://github.com/brave/adblock-rust-ffi (archived; not the production bridge)
- https://www.mozilla.org/en-US/MPL/2.0/FAQ/ (licensing guidance, not legal signoff)

## Hardening batch G3/S3 and release evidence

- Test ordinary tabs and every Dual/Tri/Quad/focus layout, pane switching,
  redirects, prerender, back-forward cache, popup/new-window creation, worker
  teardown, profile shutdown, network-service crash, and private-mode isolation.
- Test per-site login/payment/admin-console recovery and managed-policy
  precedence. Include extension coexistence without dependence on extensions.
- Measure Guard disabled overhead, p95 request-decision latency, filter compile
  memory, idle CPU, list-cache size, skin decoding, resize latency, and 24-hour
  steady-state memory. Establish reference-hardware budgets before claiming gains.
- Test malformed archives/manifests/assets/filters, cache corruption, offline
  updates, signature/hash mismatch, rollback, failed migration, and disk full.
- Verify installed MSIX upgrade/uninstall, UIA/Narrator, keyboard focus, contrast,
  DPI, snapping, dragging, tab hit targets, security surfaces, and local recovery.
- Ship only after fresh native build, focused unit/browser tests, runtime smoke,
  privacy/traffic review, license inventory/SBOM, and package manifest/payload/hash
  verification. Source scaffolding or this roadmap is not GA evidence.

Current rail implementation is source-only pending compilation and runtime QA.
The previous native build stopped on two upstream Blink compile actions before
this rail change; neither that build nor an older MSIX contains this fix.
