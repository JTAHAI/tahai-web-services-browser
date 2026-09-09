# Native TAHAI Guard engine

September 5 candidate: the sandboxed Rust engine and changed native translation
units have compiled. The complete release build and runtime tests are still in
progress; the installed Store package has not changed. See
[the upgrade record](tahai-upgrade-2026-09-05.md) for current evidence.

Guard has independent regular/private owners, production URLLoaderFactory
interception, bundled offline lists, declarative element hiding, a Custom-rule
editor and a document-bound native recovery panel. The claims below describe
the implemented boundaries; successful source checks do not replace runtime
or installed-package validation.

## Pinned dependency

- `adblock` 0.12.6, upstream commit
  `ca7f9f4a24a439da99e052b4e4041c45d87687f5`.
- Original crates.io archive SHA-256:
  `4844c456026028b3a22f3bc0b0e0b2485809591673e2d70930a4ada7c4d3a90d`.
- [Pinned upstream source](https://github.com/brave/adblock-rust/tree/ca7f9f4a24a439da99e052b4e4041c45d87687f5).
  This tag declares Rust 1.96; the checkout has a Chromium Rust 1.96 nightly.
  This is a toolchain-aligned pin, NOT a claim that it is the newest release or
  is free of vulnerabilities. A September 5 query of the exact 60-package
  Cargo.lock dependency closure returned no published OSV advisories. The
  closure includes optional/build dependencies and is not a linked-binary SBOM.
  Query inputs and responses are retained with the candidate verification files.
  See the [OSV API](https://google.github.io/osv.dev/post-v1-querybatch/).
- Chromium Cargo/gnrt integration uses checked-in source and GN dependencies;
  a release build does not download Cargo packages. Enabled upstream features
  are `full-regex-handling` and `single-thread` only. Embedded PSL,
  resource-assembler, CSS-validation, content-blocking export and debug-info
  features are forbidden in the import configuration.
- The native wrapper uses Chromium's registry-controlled domain implementation,
  including private registries. No second embedded PSL is shipped by the engine.
- `adblock` is restricted to the sandboxed service target. Existing `regex` and
  `aho-corasick` versions are classified sandbox-only, not first-party exposed.
- FlatBuffers and thiserror 1 use their stable code paths. Their optional
  nightly-probing build scripts are disabled through gnrt configuration. The
  existing thiserror 2 generation configuration is preserved separately.

The preflight dependency resolution introduced 14 package identities without
replacing/removing an existing version. Semver's existing placeholder also
became real source for a declared build dependency. The read-only audit verified
339 original archive files across these 15 source packages against checksummed
Cargo archives. `tahai-guard-import-inventory.json` records versions, provenance,
license hashes and vendored-tree hashes. This inventory is NOT the final linked
binary SBOM and does not include all previously present transitive dependencies.

## License and source availability

adblock-rust is MPL-2.0. Its full upstream license and VCS provenance are retained
in the vendored package and `README.chromium`. No upstream executable source
was modified by this import. All changes are in separate TAHAI bridge/service
files, generated GN/configuration, and license-text packaging.

Two crates omitted full license text from their archives:

- FlatBuffers: Apache-2.0 text restored from the exact package VCS revision
  `7e163021e59cca4f8e1e35a7c828b5c6b7915953`.
- SeaHash: its 4.1.0 manifest declares MIT and credits Ticki and Tom Almeida.
  The original author's full MIT text is retained from the upstream parent
  repository blob `3903091a13728186595aa53ee9a3765bc95fb0c7`. This is not claimed
  to be a license file present in the 4.1.0 archive; the provenance distinction
  is recorded in the patch. The Cargo author metadata is preserved.

Both additions have reproducible license-only patches. The final distribution
must preserve required notices/licenses and provide the pinned covered source
location. No filter-list license is implied by the engine's MPL license. There
are bundled EasyList/EasyPrivacy payloads under CC-BY-SA-3.0, with exact upstream
commit, hashes, notices and deterministic filtering in
`third_party/tahai_guard_lists`. Balanced enables EasyList; Strict also enables
EasyPrivacy. Updates ship with a reviewed browser release. There is no remote
list-update provider or invented signing service.

## Process, ownership and failure boundaries

- `chrome/services/tahai_guard` registers a `kService`-sandboxed utility API.
  Its interface has no file, network, scriptlet, arbitrary-action, or serialized
  engine-deserialization operation.
- A session lazily launches one separate utility process, compiles once and
  owns its remote and exact process handle. Reconfiguration is rejected; a
  profile owner compiles a replacement separately and publishes it
  only on success. No session may be shared between profiles.
- Rules: UTF-8, maximum 4 MiB, 150,000 lines, 8 KiB per line. The complete input
  is bounded before parsing; invalid input does not publish a partial engine.
- Network rules and plain CSS element-hiding/exception rules produce
  accepted/ignored counts. Scriptlets, procedural actions and active-content
  modifiers (redirect, CSP, removeparam, etc.) are rejected. No raw network
  match strings are returned.
- Requests: HTTP(S), maximum 8 KiB per URL/origin. The browser removes userinfo
  and fragments before sending a match to the utility. A non-empty source must
  be an origin without path/query/fragment. Empty source explicitly means
  unknown/opaque: upstream applies third-party semantics with no source-domain
  match. No synthetic trusted origin is invented for a sandboxed frame.
- Single-sequence ownership matches upstream's non-Send/non-Sync engine.
  Matching happens in the utility, not on the browser's UI sequence. UI-side
  IPC bookkeeping performs no preferences/disk I/O for individual requests.
- Maximum 128 combined pending network/cosmetic requests; 30-second compilation deadline; 500-ms request
  deadline, checked at 50-ms intervals and again when replies arrive. Timeout,
  overload, cancellation and disconnect return explicit unavailable outcomes,
  never a synthetic Allow or successful match.
- Failure/stop closes IPC and terminates only the process launched for that
  session. A retained launch callback handles cancellation before process
  creation. Pending callbacks are drained after state cleanup, including when
  callbacks destroy the owner. Late replies cannot revive a stopped session.
- These deadlines and process-cleanup behavior are source contracts pending
  native failure tests. They are not measured performance or safety claims.

## Profile ownership and production request path

- A `ProfileKeyedServiceFactory` selects regular and incognito profiles with
  **separate owned instances**, never redirects an incognito request to the
  regular engine, and excludes Guest/system profiles. An incognito engine reads
  inherited effective settings through its own PrefService, compiles its own
  immutable generations, and writes no rules, counters or request history.
  Regular policy/rule changes update the independent private generation. Private
  editor mutations are denied in native code as well as disabled in UI. Closing
  the private Profile destroys its engine/factories; this source is still unrun.
- Configuration validation and persistence now live in `chrome/browser/tahai_guard`,
  below WebUI. The request path has no dependency on a WebUI renderer.
- The service caches mode/exceptions and reads no preferences or files during
  request decisions. One active and one candidate engine are allowed. A failed
  user replacement preserves the previous live engine AND stored rule text.
- Custom rule text is a bounded 4-MiB non-sync profile preference, committed only
  after successful compilation. This is ordinary profile persistence, not a new
  encryption or crash-durable transaction guarantee. No remote list is fetched.
- Idle engine disconnection notifies the owner. Recovery is bounded to three
  attempts with 1/5/30-second delays until explicit reconfiguration; no request
  loop repeatedly launches new processes. Failure remains visible.
- The existing `ChromeContentBrowserClient::WillCreateURLLoaderFactory` calls
  Guard before the network-bound final interceptor. Each proxy preserves its
  original terminal factory/StoragePartition. TLS, CORS, credentials, authentication,
  redirect-security checks and response bodies are not modified by Guard.
- Document factories use browser-provided IsolationInfo. Only browser-owned
  navigation factories consult trusted per-request navigation parameters.
  Main-navigation exceptions follow the actual target of each redirect. Worker
  factories without a top origin use their browser-supplied worker origin, not
  an arbitrary client tab. Opaque top origins receive no exact-site exception.
- Requests are evaluated before forwarding; redirect Location and a subsequent
  `FollowRedirect` URL override are checked separately. Per-factory bounds are
  512 live requests and 256 clones. Completed/cancelled requests release their
  state; headers/body references are discarded after initial forwarding.
- Closing a factory receiver does not discard its terminal while asynchronous
  requests remain, including browser-owned keepalive after document navigation.
  Closing a Profile destroys its factories and owned engine processes. It cannot
  issue new usable weak references; late callers receive unavailable (mandatory
  unavailable under policy), not a permission to bypass filtering.
- Off and unconfigured non-managed modes use a forwarding fast path. These
  changes have not yet demonstrated end-to-end latency/memory budgets.
- Counters are opt-in, in-memory, aggregate **decision** counts, including
  redirect rechecks; not unique requests, ads, trackers, or browsing history.
  Opt-out clears them. UI refresh is explicit; no status polling loop was added.

## Managed configuration and Custom-rule UI

`TahaiGuardConfiguration` (ID 1471) and `TahaiGuardCustomRules` (1472), atomic
group 67, have Windows policy definitions and policy-handler mappings. In managed
Custom mode, missing/invalid/unavailable engine decisions fail closed for the
intercepted HTTP(S) requests unless an administrator exact-site exception applies.
User edits are rejected. Invalid managed replacements cannot reuse the previous
engine's Allow decisions. Revision checks also reject queued Allows after a policy
change. Managed Off explicitly bypasses Guard.

The policy schema uses Chromium's supported schema vocabulary; the C++ owner
enforces byte, line and origin-count limits that the policy schema cannot express.
These are source contracts, not claims that Windows policy deployment has passed.
Incognito inherits mandatory settings and the same fail-closed decisions, but
always disables counters. Guest modes and browser-internal service traffic remain
outside this scope; an administrator requiring filtering must separately govern
those entry points.

The Support surface now has a bounded Custom-rule editor, compile/replace, explicit
load/clear, mode and counter controls, and real owner-state messages. It distinguishes
Ready, Compiling, Last-known-good, Off, Missing rules, Invalid configuration and
Unavailable. Balanced/Strict use the pinned bundled lists; Custom compiles the
user's reviewed rule text.
The editor is separate from the native Guard panel described below.

## Declarative cosmetic filtering

The sandbox returns only bounded, plain selectors: at most 16,384 selectors,
2,048 bytes per selector and 512 KiB total. Both sides reject characters that
could escape the fixed CSS declaration. Generic class/ID rules, domain rules,
element-hide exceptions and `generichide` are resolved by adblock-rust. Escaped
generic identifiers, scriptlets and procedural/style actions are outside the
supported subset.

A browser-owned tab helper binds delivery to the actual committed document.
Profile, generation, document lifetime, page pause, exact-site exception and
effective mode are checked again before publishing a reply. Primary documents
and ordinary live subframes are eligible; opaque, fenced, guest and non-HTTP(S)
contexts cannot borrow another page's grant. URLs are stripped of credentials
and fragments before IPC.

The renderer inserts fixed `display:none!important` declarations in a user
stylesheet. This naturally covers later matching DOM changes. Navigation,
settings changes, pause, Off and failures clear the previous sheet. A late reply
cannot style a replacement document. No CSS from a skin or arbitrary style
declaration is passed through this interface.

## Document-bound native recovery

The native browser menu exposes Guard in every work mode and with every rail
state, including private windows. The secondary toolbar menu also exposes it.
The panel captures one selected WebContents, WeakDocumentPtr and canonical
HTTP(S) origin. Cross-document commit, renderer loss, tab destruction or a pane
selection change permanently invalidates its controls. Switching back does not
revive them; reopening from the native menu captures a fresh context. Every
mutation revalidates the browser-owned document, profile and selection. Closing
the panel cancels its queued button callbacks. The panel uses localized native
Views controls, a scrollable layout and explicit refresh, not a polling loop.

- Temporary pause is an in-memory grant for one primary document. A maximum of
  128 grants per profile is retained. The factory's browser-supplied page source
  ID connects pre-commit factory creation to the eventual committed document;
  it is used only as a local identity, never logged, persisted or reported as
  telemetry, and never read from renderer ResourceRequest fields.
- Only ordinary document-subresource factories receive this scope. Workers,
  background factories, fenced frames and embedded guest pages cannot borrow
  it. This is not a general site pause: worker/service-worker fetches retain
  their normal Guard decisions. Main navigations are not paused.
- Same-document history/fragment changes retain the grant. A new document
  commit, reload, renderer loss, tab destruction, or Guard preference/rule
  change revokes it. Leaving a page revokes its grant, including before a later
  BFCache restoration. Canceled navigation attempts alone do not revoke it.
- Posted paused decisions recheck the grant before forwarding. Revocation
  returns context-changed/ERR_ABORTED, not an unmanaged fail-open outcome.
  Managed mandatory configuration cannot grant a user pause.
- Persistent recovery edits only the displayed exact HTTPS scheme/host/port,
  preserving unrelated overrides. Strict validation prevents corrupt stored
  data from being replaced silently by defaults. The inherited regular-profile
  exception applies in private windows, but private windows cannot edit it.
- Reload is a separate explicit action with Chromium's form-repost checks.
  Pause itself does not reload. The panel distinguishes temporary pause,
  persistent exception, managed ownership and unavailable engine states; it
  does not infer site safety or call decisions ad counts.

The changed engine/native units have compiled; full native runtime tests are
pending. This does not change the installed Store browser.

## Test source and release gates

`TahaiGuardEngineBrowserTest` cases cover real sandbox IPC matching,
exceptions/resource types, Chromium private suffixes, unsupported modifiers,
URL/origin limits, immutable independent generations and whole-input rejection;
fake remotes cover queue exhaustion, timeout, disconnect, destruction, malformed
compile replies and cancellation. Every case is explicitly required by the
MSIX evidence validator. No case has run against a freshly built browser.

`TahaiGuardRequestBrowserTest` definitions additionally cover the actual
production hook: fetch/Off, redirects/navigation, exact-origin separation across
windows, failed replacement, private isolation, dedicated/shared/service-worker
fetches, script resource types, mandatory failure/invalid updates, counter consent,
sandboxed frames, the visible Custom-rule editor, keepalive after navigation and
two regular Profiles, incognito refresh/teardown, private managed failure and
native rejection of private editor mutations. Eleven further request/UI cases
cover document-pause isolation from same-origin tabs and workers, ordinary
subframes, reload/navigation/history return, private persistence boundaries,
queued grant revocation, managed-policy revocation, stale Dual View controls,
exact-site editing, every mode/rail menu path, actual native button activation,
private/managed live-panel locks and renderer loss. Nine controlled
`TahaiGuardProfileBrowserTest` definitions cover candidate failure/overlap,
generation changes with outstanding requests, queued bypass vs. policy changes,
shutdown/late compile callbacks and post-shutdown handles/decisions,
credential/opaque-origin sanitization,
mandatory queue exhaustion, finite idle-crash recovery and Off cancelling
recovery. Those owner tests use fake Mojo endpoints intentionally; they do not
prove the Rust matcher or production network hook. Six controlled proxy cases
add forged attribution, receiver/terminal lifetime, cancellation/late replies,
redirect URL overrides and bounded cloning. They exercise the production proxy
against a test terminal, not the real Network Service. New cases cover domain
and generic cosmetics, exceptions, late DOM changes, pause/Off, navigation,
private boundaries, malformed cosmetic replies and deadlines. Every discovered
TAHAI browser test and the explicitly named regressions are mandatory in the
package gate.
These test sources are not substitutes for execution or broader coverage.

Checks completed so far include dependency archive comparison, the read-only
OSV query, deterministic bundled-list regeneration, GN header-dependency checks,
the real Rust/CXX bridge build, changed native translation-unit compilation and
synthetic packaging-validator cases. Full native execution remains the release
gate; those checks must not be reported as browser runtime results.

## Release acceptance and supported scope

1. Compile and execute all engine, ownership, request, proxy and managed-policy
   tests. Owner/proxy failure and private-engine source definitions are present,
   but no native test has run yet. Test request-bound exhaustion, shutdown under
   live response streaming and policy changes during redirects as well.
2. Establish complete coverage for frames, images/media, redirects, prerender,
   BFCache, keepalive, workers and partitioned contexts. Cached service-worker
   responses and WebSocket/WebTransport are not URLLoaderFactory traffic; do not
   claim those paths are filtered by this implementation.
3. Preserve licensed pinned lists and source notices in the final distribution.
   Filter changes currently arrive through browser releases; remote subscription
   management is not an implemented capability.
4. Exercise native document controls, exact-site/temporary recovery and cosmetic
   fixtures against the final fresh binaries.
5. Fuzzing, native request fixtures, profile/private/redirect boundaries,
   performance/resource measurements and installed-package visual validation.

Until those gates pass, no release or UI may imply complete Guard protection.
The candidate's complete release build, native tests and MSIX packaging remain
in progress. Do not reuse older package evidence as evidence for this revision.
