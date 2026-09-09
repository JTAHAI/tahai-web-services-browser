# TAHAI Local Operational Intelligence architecture

## Purpose and boundary

TAHAI Local Operational Intelligence (Local OI) is a **profile-local,
deterministic** operational workspace inside the native TAHAI Chromium browser.
It is not a client-management service, connector host, tenant control plane, or
hosted OI synchronization client.  Local OI operates on explicitly created
TAHAI Mission records and other expressly approved, typed local records.  It
does not silently inspect general browsing activity.

The reference product inspected for this design is
`D:\\dev\\Operational_intelligence`.  Its README explicitly retains
`release_ready=false`, `ai_backend_ready=false`, and
`productionAIEnabled=false`; those hosted readiness flags and product claims
are not inherited by the browser.

## Reference-product inventory

The reference product establishes a useful operator vocabulary: canonical
entities, typed relationship edges, evidence and timeline records, explainable
health factors, documentation/knowledge gaps, unified safe search, operational
memory, relationship exploration, evidence-backed reporting, and a
command-deck information hierarchy.  Its visual documentation describes a
premium command deck with an intelligence rail, health, evidence timeline,
relationship graph, and handoff controls.

The inspected contracts also establish non-transferable hosted concepts:
tenant/org/client isolation, RBAC/ABAC, connector registries, remote API
routes, provider adapters, vault references, billing and entitlements,
retention/legal-hold, append-only hosted audit, and deployment infrastructure.

| Disposition | Browser treatment |
| --- | --- |
| **REUSE DIRECTLY** | Local-first terminology: command deck, Mission health, evidence basis, operational memory, knowledge gaps, relationship explorer, deterministic and explainable findings, safe search, and a clear finding/remediation hierarchy. Reuse is conceptual and does not copy hosted source. |
| **ADAPT FOR LOCAL** | Canonical entity and edge thinking becomes profile-scoped Local OI records; hosted health factors become rule-by-rule local readiness state; evidence/timeline become editable, local provenance records; search is an allowlisted local index; reports are sanitized local JSON/Markdown; the command-deck visual hierarchy is adapted to Chromium WebUI. |
| **HOSTED OI ONLY** | Multi-client views, team assignment, dispatcher workflows, tenancy, RBAC/ABAC authority, organization-wide retention, cloud audit immutability, server analytics, synchronization, connectors, and remotely hosted AI/provider capabilities. |
| **FORBIDDEN IN BROWSER** | Credentials, OAuth/session material, cookies, authorization headers, raw authenticated bodies, PSA/RMM/IT-doc integrations, hosted environment values, billing/entitlement secrets, tenant/customer records, generic filesystem/shell handlers, and automatic uploads. |
| **FUTURE AUTHORIZED BRIDGE** | An allowlisted public `https://ops.tahaiportal.com` referral; an opaque `links.oi` reference; and a user-reviewed, redacted promotion preview. None transfers data or authenticates until a separately authorized hosted contract exists. |

## Local storage and service topology

`TahaiLocalOiServiceFactory` owns one `TahaiLocalOiService` per regular
Chromium profile.  The service coordinates a versioned `TahaiLocalOiStore`,
typed model validation, deterministic rule evaluation, a bounded local search
index, relationship graph queries, report generation/redaction, and policy
evaluation.  The store is a single schema-versioned profile preference
document, so an update is committed atomically through Chromium's scoped
preference update.  It contains no profile identifier, cross-profile pointer,
remote URL payload, credential, browser-storage value, raw page body, or
production sample fixture.

The factory declines off-the-record profiles.  Guest profiles keep no durable
Local OI records.  The only intended caller is the TAHAI WebUI controller; an
ordinary HTTPS page or extension cannot obtain its handler or store.

### Explicit support diagnostics

The Support surface includes a user-triggered DNS and TLS inspection for one
public host at a time. It resolves addresses and resolver aliases available
through Chromium, then sends a credential-omitted, redirect-disabled HTTPS
`HEAD` request on port 443. The implementation records typed DNS/TLS metadata
plus a presence-only observation of six fixed HTTP security headers: bounded
IPv4/IPv6/alias counts, net errors, HTTP status, certificate
validity/issuer/subject/expiry, TLS version, cipher suite, elapsed time, and
the presence/count of those six fixed headers. It never retains a
response-header value.
The target validator accepts a public ASCII DNS host name or publicly routable
IPv4 literal only and rejects schemes, ports, paths, credentials, local suffixes,
private/loopback/reserved literal addresses, empty labels, and labels longer
than 63 characters before any resolver or network request is started. A DNS
failure, timeout, empty answer, or answer containing a non-public address ends
the inspection without launching the HTTPS request.
The DNS preflight does not pin the later connection. The HEAD loader also uses
Chromium's mandatory `kURLLoadOptionBlockLocalRequest`, which rejects an actual
private/loopback connection endpoint even if it differs from the initial DNS
answer. It bypasses/disables the HTTP cache and suppresses login prompts. A
connection-time block is reported separately from a rejected preflight; this
source correction still requires native rebinding/proxy regression validation.
Only one explicit inspection is permitted in flight for a Support surface;
further requests receive a visible local rejection until its bounded completion
callback returns.

It does not query MX, NS, or TXT records; fetch response bodies; persist raw
response headers; create a schedule; inspect browser history; or operate an
IT Docs, PSA, RMM, or hosted OI connector. Managed Local OI policy can disable
recording, while an explicit inspection still remains visible to the operator.
When a completed inspection is not recorded, the Support surface reports that
fact without attributing a cause: policy, local-store availability, or a stale
saved-watch/Mission context can each reject persistence.
The Support result includes a deterministic local outcome banner for DNS
failure, target rejection before DNS, public-address blocking, HTTPS/TLS
failure, certificate expiry, successful Chromium certificate validation, or a
remaining validation review; it derives only from the typed result and does
not inspect response content. It also presents a display-only deterministic
next-step checklist from that same outcome state: public-host correction,
resolver review, HTTPS transport review, service-health review, certificate
renewal, or a clear no-immediate-escalation state. The checklist omits the
target, addresses, aliases, certificate names, headers, bodies, credentials,
cookies, and browser data; it creates no record, clipboard write, retry, or
background task. A credential-free 401 or 403 is identified as an
authentication boundary, not a service-health success or failure, and the
tool never adds credentials to change that result.
After a completed explicit inspection, an operator may copy a separate
sanitized support handoff through the native clipboard. That handoff includes
only the validated target, typed outcome, numeric DNS/HTTPS status, TLS and
certificate state labels, bounded remaining-days state, bounded DNS topology
counts, and whether Local OI recording succeeded. It deliberately excludes
resolved address and resolver-alias values, certificate subject/issuer/SAN
names, TLS version, cipher suite, response headers, response bodies, cookies,
credentials, and browser data. The browser neither reads the clipboard nor
records this clipboard action as an OI event; it is an explicit local operator
handoff, not a connector, export API, sync mechanism, or hosted OI promotion
flow.
When an operator selects an existing active local Mission before the probe,
Local OI adds only typed Mission-to-endpoint and Mission-to-result
relationships. The probe's network behavior and retained transport metadata do
not change; an invalid or inactive Mission association rejects local recording
rather than creating an implicit Mission.

Successive explicit probes of the same host are retained as separate local
tool results and compare only bounded fields already produced by the probe:
IPv4/IPv6/alias counts, the presence/count of six fixed response-security
headers, DNS/request net errors, HTTPS status,
certificate-valid/expired/root status, days remaining, TLS version, and cipher
suite. Version 2 of the local store removes legacy raw DNS address/alias fields
and raw-value-derived fingerprints during migration. Local OI can therefore
explain count or address-family topology changes without retaining, exporting,
or comparing exact address or alias values. The newest result supersedes the
prior result and a change produces an explainable local finding. This is not a
traffic recorder, page diff, header comparison, redirect collector, or
background monitor.
After a user-initiated inspection is recorded, Support may display at most the
newest eight metadata-only rows for that exact validated host. Those local
history rows contain only the inspection time, comparison state, changed field
names, bounded address-family/alias counts, numeric DNS/HTTPS results,
public-address-guard state, TLS validity/expiry state, and the bounded count of
selected response-security headers. Reading them does not initiate another
request, schedule a recheck, or expose address or alias values, certificate
names, header values, or response content.
The deterministic support rules distinguish a public-address guard block from
an explicit HTTPS probe network failure, and also flag 5xx statuses while
avoiding an inference from credential-free 401/403 responses; the tool does not
authenticate to make those results look healthier. Certificate findings are
tiered deterministically as expired (critical), three or fewer days remaining
(high), or fourteen or fewer days remaining (medium); a result appears in only
its most urgent applicable tier. Missing or unavailable remaining-days metadata
does not infer an expiry tier.
When Chromium's typed certificate status identifies revocation, an untrusted
authority, or a target-name mismatch, Local OI records only that fixed failure
class and creates a prioritised certificate finding (revocation critical; the
other two high). It never stores a chain, certificate identity, or verification
detail for those findings, and a specific class replaces the generic invalid-
certificate finding for that record.
The Support result displays that same fixed status class for the explicit run,
but deliberately does not render a certificate chain or additional certificate
value through the new status row.
An explicit TLS 1.0 or TLS 1.1 observation also produces a medium-severity
legacy-transport finding. It is deliberately limited to the typed protocol
version recorded by the public credential-free probe; it neither assesses an
authenticated service nor claims that the protocol alone defines the complete
security posture.

The fixed HTTP security-header observation is intentionally a narrow
credential-free signal: `Strict-Transport-Security`, `Content-Security-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and
`Permissions-Policy` are recorded only as presence flags and a count. It does
not retain their values, follow redirects, authenticate, inspect other headers,
or claim that an observed or absent header proves the security of a service.
For a successful 2xx/3xx public probe where none of those six headers is
observed, Local OI creates a low-severity knowledge gap asking the operator to
review intended public posture manually. 401/403 responses deliberately do not
produce that finding.

The Support work mode exposes this tool directly. Builder mode surfaces the
same fixed Support page as endpoint proof during release work, and Operator
mode surfaces it beside Mission Control, Local OI, and the multi-pane
workspace. These are fixed native navigation commands only: a work mode cannot
provide a host, target, account, URL, or tool argument.

### Explicit Change Lens

The Support surface also provides a manual Change Lens for a public hostname
or canonical query-free HTTPS target. An operator supplies a lowercase
SHA-256 digest obtained from an approved source and selects the digest's
meaning (DNS record, TLS certificate, redirect chain, endpoint status,
response-header, content, or download artifact). Local OI validates the target
with the same public-target boundary as Sentinel, stores only the canonical
target, capture kind, digest, local capture time, and comparison state, and
links each new record to its predecessor. A current digest that differs from
the preceding digest creates an explainable local finding; a later capture
supersedes it deterministically.

Change Lens is not a fetcher or a diff engine. It does not retrieve DNS
records, page bodies, response headers, downloads, screenshots, selected text,
credentials, or browser data; it cannot reconstruct the material behind a
digest. It has no hidden capture, schedule, connector, or upload path. The
artifact-ingestion policy only gates this explicit safe-digest feature and does
not grant filesystem or download access.

After an operator records a capture, Support can show up to eight newest local
comparison states for that exact capture kind and target. This timeline shows
only local record time, baseline/changed/unchanged state, and whether the row
is current. It does not display, return, derive, transmit, or recover a digest,
and reading it never performs a capture, fetch, recheck, or scheduled task.

An operator may optionally associate a Change Lens capture with an existing
active local Mission. That adds typed Mission-to-target and Mission-to-result
edges for local graph and health context only; it neither changes capture scope
nor creates a cross-Mission authority, tenant relationship, or hosted transfer.

### Explicit artifact integrity metadata

An operator can also record a bounded artifact label, canonical public HTTPS
origin, and supplied SHA-256 value. Labels reject slash, backslash, and colon
characters so a local path is never accepted; the label is never resolved as a
filename or filesystem location. The record is a typed Local OI `artifact` and can be linked only to an existing
active local Mission through an explicit profile-local picker. The browser does
not open the origin, inspect the download shelf, read bytes, calculate a hash,
retain a local path or filename, or access response headers, cookies, or
credentials. Artifact and Change Lens entries remain fully profile-local.

After a successful explicit record, Support may show up to eight newest local
artifact metadata rows for that exact approved origin. Each row has only the
operator label, record time, and a digest-recorded state. It does not display
the origin, SHA-256 value, file name, local path, bytes, download shelf entry,
or browser activity, and viewing the rows opens nothing.

### Explicit endpoint documentation pointers

Support engineers can link a human-entered label and a canonical public HTTPS
documentation pointer to an existing local `endpoint` record. This makes the
relationship graph and deterministic endpoint-documentation knowledge-gap rule
useful without turning the browser into an IT documentation system. The
reference URL must be credential-free and query-free; the browser validates and
stores only the canonical pointer, label, endpoint association, and local time.
It never opens the reference, fetches it, reads it, indexes it, takes a
screenshot, retains document content, or connects to IT Docs or another
documentation provider. The separate documentation-reference policy preference
can disable this explicit local record type without enabling any other
collection.

An operator may optionally select an active local Mission for a documentation
pointer. That adds only a typed local Mission-to-pointer context edge.
Re-saving the same endpoint/reference pair with another Mission, or with no
Mission, replaces that current edge; the browser never infers a Mission from
the URL or endpoint host and never opens the reference.

For an explicitly selected active local endpoint, Support may display up to
sixteen current validated documentation pointers. The registry shows the saved
label, canonical pointer, and local record time only. It does not retrieve the
pointer, inspect a documentation provider, retain document content, create a
corpus, or infer endpoint context from a URL or hostname.

### Manual recheck lists

Local Watchlists are explicit **manual recheck configurations**, not monitors.
An operator may save a validated public DNS/TLS host or canonical public HTTPS
target along with a cadence reference. The persisted `watch` record identifies
the approved target, requested kind, manual-only execution mode, and reference
cadence; it does not schedule a task, launch a background request, observe
browsing, inspect authenticated consoles, or run a daemon. The registry derives
a local **due** or **next manual recheck** reminder from the last successful
explicit result and the saved cadence. That derived state starts neither a
timer nor a queue. A future recheck must be initiated visibly through a
separately approved support tool and will produce its own bounded local result.
For the already-supported public
DNS-record and TLS-certificate kinds only, the Support registry now exposes an
explicit **Run DNS + TLS inspection** action. That foreground click uses the
same single public-host inspector and policy boundary as a newly entered
support target, preserving the saved active Mission association when present.
The resulting typed tool-result record is linked back to that exact validated
manual-watch record only when its host and Mission context still match; an
arbitrary saved identifier cannot add a graph edge.
It is not a timer, retry, queue, watcher, or generic recheck runner; redirect,
status, header, content, and artifact entries remain manual reference metadata
only.

An operator may optionally associate a saved manual recheck configuration with
an active local Mission. That creates only typed local Mission-to-watch and
Mission-to-target relationships for context; it does not alter the target,
schedule work, create monitoring, authorize access, or initiate a request.

Support may display up to sixteen validated current manual-only entries, with
their operator label, public target, capture kind, cadence reference, last
completed explicit result time, and derived due state. This is a configuration
registry, not a timer, polling loop, background task, or watch feed. Reading
it cannot initiate an inspection or recheck.

### Exact-origin Environment Guard registry

The Local OI Environment Guard registry accepts only an operator-entered exact
HTTPS origin without paths, query values, fragments, or user information. It
stores the selected environment and its deterministic local posture (for
example, persistent-boundary and redaction-preview expectations) as typed
metadata. This is an explicit Local OI reference record: it does not inspect
a page, infer a tenant, alter tab navigation, enforce permissions, control an
account, or claim browser-wide protection. It is deliberately separate from
any future native navigation enforcement work. Although its local graph record
uses the endpoint entity shape, the deterministic rule engine recognizes the
Environment Guard marker and does not treat it as a DNS/TLS support endpoint:
it cannot produce missing-baseline, missing-documentation, certificate, DNS,
or HTTPS findings until a separately recorded explicit support endpoint exists.

An active local Mission may be selected as the current context for one saved
classification. The association is a typed local Mission-to-classification
edge only. Re-saving the same origin with another Mission, or with no Mission,
replaces that current context edge; it neither affects browser policy nor
starts a scan, observer, or request.

Support may display up to sixteen current entries from this profile-local
registry, sorted by canonical origin. The list shows only the exact origin,
declared environment, and locally stored posture labels. Rendering it reads no
page, performs no discovery, starts no observer, changes no navigation, and
does not claim browser-wide enforcement.

## Data model

The persisted record vocabulary is deliberately explicit: `mission`,
`mission_tab`, `pane`, `runbook`, `runbook_step`, `evidence`, `artifact`,
`endpoint`, `domain`, `document_reference`, `note`, `tool_result`, `watch`,
`finding`, `report`, and `external_reference`.

Persisted relationships are `mission_contains`, `mission_uses`,
`mission_targets`, `mission_produced`, `evidence_supports`,
`evidence_validates`, `evidence_conflicts_with`, `artifact_belongs_to`,
`endpoint_resolves_to`, `finding_affects`, `finding_supported_by`,
`runbook_governs`, `reference_links_to`, `supersedes`, and `derived_from`.

All IDs are canonical UUIDs.  Records carry created/updated timestamps,
bounded safe metadata, provenance, and a generation counter.  Finding records
add stable ID, rule ID, category, severity, title, explanation, affected and
supporting IDs, remediation, state, acknowledgement, resolution reason,
basis, and optional explainable confidence.  Scores are never invented:
insufficient inputs render as **Insufficient data**.

When a finding affects a support record with an explicit direct typed Mission
edge, Local OI resolves that Mission as private command-deck context for the
finding card and action queue. It never guesses context from a hostname,
browser tab, page, account, or arbitrary multi-hop relationship traversal.

### Local explorer, search, and report ledger

The Local OI command deck renders a bounded technical-record explorer for
persisted domain, endpoint, tool-result, artifact, documentation-reference,
and manual-watch records. It displays only the typed fields already accepted by
their source contracts and caps the visible record and field counts. The local
search index additionally uses a per-record bounded projection of those typed
field names and values, but a search result returns a label and safe summary,
not a raw field dump. Search is entirely in-process and never becomes a remote
query or provider lookup.

The Command Center accepts a bounded text query together with fixed record-type,
Mission-context, finding-severity, current-finding-state, and recency filters.
The native handler accepts only its finite enum values, active profile-local
Mission IDs, and one of the fixed 1/7/30/90-day windows (or all retained local
records). Results are capped, ranked deterministically, and use only a safe
label, summary, and local finding metadata. The page can move keyboard focus
through those results, but cannot turn a result into a URL, provider request,
cross-profile lookup, or raw-record export.

The relationship explorer separately accepts one existing profile-local entity
ID, one fixed relationship vocabulary value (or all), and an explicit one- or
two-hop limit. Native code rejects invalid IDs, types, and depths; it traverses
only the already-materialized local relationship projection, orders the result
deterministically, and caps it at 48 lanes. Each lane displays the saved typed
relationship basis so an operator can see why it exists. It cannot infer an
edge from a tab, URL, browser history, page content, account, file, or network
lookup, and the explorer page uses text nodes rather than treating a result as
a navigable link. Selecting either endpoint opens a compact native Local OI
detail panel containing only the stored safe projection and direct-edge count;
a missing or deleted record is shown as absent instead of being resolved by a
stale reference.

The Local OI surface also renders the active policy source and effective state
for the master switch, bounded Mission ingestion, artifact/change metadata,
documentation pointers, support-tool metadata, reports, clipboard export, and
the privacy-safe MSP referral surface. An unmanaged profile can change exactly
those finite settings; managed settings remain visible but locked. Disabling a
setting does not delete or backfill data. The explicit refresh action only
reconciles the existing bounded Mission schema and refuses to run when the
master feature or Mission ingestion is policy-disabled.

The command deck reports first use, master-policy disablement, unavailable
storage, validated corruption recovery, ephemeral browser contexts, a failed
bounded Mission refresh, and insufficient data as distinct runtime states. In
particular, explicit support metadata without an active Mission is insufficient
for a readiness signal and is never labeled healthy or ready. Safe report copy
failure is surfaced as a local error state; the interface does not claim a
report was created when policy, storage, or redaction prevents it.

For a change Mission, before/after readiness is derived from explicitly linked
Change Lens records: the first saved digest is the before-state marker, and a
subsequent compared digest (changed or unchanged) is the after-state marker.
The Mission projection does not hard-code either marker and never treats a
page capture or browser activity as a change snapshot.

Artifact integrity also detects a deterministic conflict when two active local
artifact records use the same approved source but have different retained
SHA-256 values. The finding links the two local records but never displays or
exports either digest; the operator must verify the artifact outside Local OI.

Generated safe reports have a local ledger that displays report metadata
(kind, title, provenance, time, and applied redaction count), not the report
body. A report still leaves the browser only through an explicit clipboard
action. Report generation and a completed clipboard action are separate local
events: only after the native clipboard writer is issued does Local OI append a
bounded `safe_export_completed` event against the newest matching report. It
never reads clipboard contents. The ledger is not team sharing, cloud audit,
synchronization, or an evidence export client.

Each available report has a distinct aggregate focus: Mission Health Summary,
Operational Handoff, Change Record, Knowledge Gap Report, Evidence Summary,
Artifact Integrity Report, or Local OI Diagnostic Report. The focus lines use
only counts and deterministic state labels; they never add Mission names, IDs,
URLs, digests, raw evidence, browser content, or hosted-recipient information.
Each focus can be copied as redacted Markdown or as a safe JSON document with a
fixed `tahai_local_oi_safe_report_v1` schema. The JSON document contains only
its format, focus label, local-only boundary, one validated local generation
timestamp, fixed limitation text, and aggregate counts. It is not an API,
integration payload, synchronization format, promotion mechanism, or provider
handoff; it reaches another tool only when an operator explicitly copies it
from the local browser surface.

### Deterministic local operations briefs and future on-device assist

Local OI has a narrow on-device assist contract, but no configured model. Its
only permitted operations are explaining explicitly selected findings,
summarizing explicitly selected local records, drafting a checklist, and
drafting a sanitized handoff. Today, an operator may select one to eight
persisted entities or findings and create a deterministic display-only local
brief: review, summary, and checklist output may use the already-selected record's kind,
display-safe label, and bounded detail; the sanitized handoff scope uses only
aggregate typed-record counts and never includes labels, IDs, or details. No
brief is persisted, copied, exported, promoted, synchronized, or sent to a
provider. Each current Local OI finding card can add only that visible finding
to the bounded brief selection; it does not resolve a new entity, fetch any
context, change the finding lifecycle, or create a record.

The future on-device adapter can receive only the same bounded input shape. It
does not invoke an adapter or model today, connect to a provider, open a page,
execute a tool, create a record, or change a Mission. The contract has no
provider, URL, credential, transport, browser-data, navigation,
tool-execution, or write operation. The future adapter remains separately
gated by Local AI policy and may be used only after a genuine on-device runtime
is configured; the deterministic brief does not require that unavailable
runtime and is labelled clearly as non-model output.

## Audited pre-foundation scaffold

The former `tahai_local_oi_model` surface constructed cards, fixed capability
and promotion arrays, generated graph edges, calculated percentage health, and
generated findings from the in-memory Mission projection.  Its client-side
filter only filtered already-rendered HTML, and its report copied derived text
without a persistent Local OI record model.  Those are presentation scaffolds,
not operational intelligence evidence.  The service/store replaces their
production data source; static examples are retained only in explicit test
fixtures.

`links.oi` currently remains an inert opaque-reference contract, and the
existing promotion preference is a user setting seam.  Neither is treated as
hosted sync, a transfer, a sign-in state, or proof of promotion.

## Privacy and operational principles

Collection is opt-in at typed source boundaries and metadata-only where a
source is optional.  The implementation excludes passwords, cookie values,
authorization/session/OAuth material, form contents, browser storage, general
history unless explicitly enabled later, arbitrary page bodies, and remote
provider responses.  Deleting Local OI data clears its isolated store.  A
corrupt document is rejected, replaced by an empty current-schema store, and
surfaced as a recovery state rather than partially trusted.

### Source validation boundary

The Windows test graph includes Local OI browser-test source for trusted
`tahai://local-oi/` rendering, off-the-record service exclusion, and a
profile-local persistence/restart scenario, alongside the model, store,
redactor, policy, rule-engine, and handler unit-test source. Embedded WebUI
scripts are parsed without execution, and the Local OI source verifier checks
the production boundary separately from test fixtures. These source-only gates
are not a substitute for the later authorized native compile, test execution,
controlled browser smoke launch, or package validation.

The profile-local retention preference is enforced on Local OI writes and
service startup. Supplemental entities, relationships, findings, memory, and
reports older than the configured retention period are pruned with orphaned
relationships. Generated Mission schema—including Mission, Mission evidence,
and Mission timeline source records—remains owned and retained by Mission
Control's separate bounded store; Local OI does not silently delete a Mission
or its generated evidence in the name of supplemental-data retention.

The Local OI command deck also includes a profile-local data inventory. It
reports only the current schema and generation together with counts by fixed
entity category, relationships, findings, memory events, and report-ledger
entries. It intentionally exposes neither a raw-record viewer nor a generic
export path: record fields, IDs, paths, browser data, and secrets stay absent.
The inventory makes the isolated-store deletion boundary concrete without
misrepresenting Mission Control's separately owned bounded Mission store.

Recalculation preserves a resolved Local OI finding only while its rule's
condition remains absent. If the same deterministic condition becomes active
again, the original finding reopens, clears its prior resolution rationale,
updates its local time, and records a `finding_reopened` operational-memory
event. This prevents a stale resolved state from hiding an active local gap.
