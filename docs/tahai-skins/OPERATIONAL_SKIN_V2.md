# Operational skin v2 contract

Status: source contract pending independent trust/security review and native
runtime evidence. TAHAI Browser validates, imports, stores, rolls back,
previews and applies only an operational package authenticated by mandatory
publisher policy or explicit local public-key enrollment as described below.
The native Skin packages manager presents
each verified active mode as an explicit activation button.

## Why v2 is separate

Version 1 changes a bounded browser appearance. Version 2 adds a declarative
description of a workspace surface, a named work mode, a local workflow and the
browser capabilities that description needs. It keeps the complete v1
appearance section unchanged so creators can retain their palette and artwork.

Installing a package is never a grant to navigate, access a site, read a page,
send data, run a command or alter an account. Activation maps symbolic action
names to the small set of browser-owned commands below only after a person
clicks that mode in **Skin packages**. Browser command enablement and policy
are checked before any command runs.

## Publisher trust (required)

An operational package is rejected unless it carries both of these ZIP members:

```text
META-INF/tahai-key-id
META-INF/tahai-signature.ed25519
```

The key ID is a 1–64 byte lowercase identifier and the signature is exactly 64
bytes. They are metadata, not manifest fields. A mandatory
`tahai.operational_skin_trusted_keys` policy has the exact closed shape below.
It replaces, rather than augments, local trust. An empty or malformed mandatory
value fails closed and never falls back to locally enrolled keys. User or
recommended values in this policy preference cannot supply managed authority.

```json
{
  "keys": [
    {
      "id": "enterprise-2026",
      "public_key": "64 lowercase hexadecimal characters"
    }
  ]
}
```

The Ed25519 preimage has a fixed `TAHAI-SKIN-SIGNATURE-V1` domain separator
(including its NUL byte), followed by the exact UTF-8 `manifest.json` byte
length as an unsigned big-endian 32-bit integer and then the manifest bytes.
The manifest contains each encoded asset’s SHA-256, which the sandboxed decoder
verifies before returning pixels to the browser. An unsigned package, unknown
key, malformed effective trust store, altered manifest, or altered artwork fails
closed. The release signer must use this exact preimage. No production key is
implicitly approved by the source implementation or a test fixture.

Without mandatory publisher policy, **Skin packages → Manage local publisher
trust** permits a regular profile to enroll a public key. Paste the signing ID
and 64 lowercase hexadecimal public-key characters, review the browser-derived
SHA-256 fingerprint through an independent channel and confirm trust. Enrollment
alone installs or activates nothing. Import, revision comparison, installation,
mode activation and any capability grants remain separate decisions. Archives
cannot enroll keys, and no WebUI or website bridge exposes enrollment.

The local store (`tahai.local_skin_trusted_keys`) is a non-syncing regular-profile
preference containing at most 32 public keys, not private keys or credentials.
Replacing an existing signing ID requires explicit revocation first. Reviews
are bound to a process-local trust generation; any policy/enrollment change
invalidates old confirmations, pending archive reviews and window bindings.
Revocation and clearing local trust retain installed archives and Mission
history but remove operational authority. Mandatory policy suspends local keys;
removing that policy allows retained local keys to be used again after fresh
verification. Users may revoke suspended local keys without modifying policy.
Private/guest profiles cannot enroll or borrow regular-profile keys. Invalid
local data denies all local trust until explicit clearing; no subset is used.
The profile/OS user is the storage boundary: this does not defend against a
process already able to rewrite that user's profile or execute native browser
code. Persistence, revocation, accessibility and adversarial runtime tests are
release gates, not satisfied by source compilation.

## Top-level structure

The v2 manifest has the v1 fields plus `operational`:

```json
{
  "schema_version": 2,
  "id": "research-flight",
  "name": "Research Flight",
  "creator": "Example Studio",
  "license": "CC-BY-4.0",
  "compatibility": {
    "min_chromium_major": 152,
    "max_chromium_major": 152
  },
  "appearance": { "...": "the unchanged v1 appearance contract" },
  "assets": ["the unchanged v1 asset declarations"],
  "operational": {
    "capabilities": [],
    "surfaces": [],
    "workflows": [],
    "modes": []
  }
}
```

All objects use a closed vocabulary. Unknown fields fail validation. IDs are
lowercase 3–64 character identifiers made from letters, digits and interior
hyphens. Names are 1–128 printable ASCII characters without markup, quotes or
backslashes. The v1 asset, color, contrast, compatibility and metadata rules
continue unchanged.

## Capabilities

The initial contract accepts only these requested capabilities:

| ID | Browser-owned scope |
| --- | --- |
| `browser-navigation` | Focus the address bar so the person can navigate. It carries no URL. |
| `workspace-layout` | Open a supported native layout or local saved-workspace UI. |
| `mission-checklist` | Open a local Mission checklist surface. |
| `guard-control` | Open the native Guard surface; it does not change filtering by itself. |

Capabilities are package declarations, not grants. They contain no URL,
origin, token, credential, selector, shell command, file path or executable
payload. Origin-scoped adapters and custom widgets are later contracts with
their own install, review and grant flows.

Every v2 surface requires `workspace-layout`, including `one` because it can
leave an existing split. A Mission start surface or rail module requires
`mission-checklist`; a Guard rail module requires `guard-control`. Every v2
mode also requires `mission-checklist` for its bound local workflow, even if
its start surface is different. These checks apply during package validation
and native command resolution; putting a control in the rail does not bypass
the capability rules for that control's command. Studio does not silently add
capabilities when editing imported source; declare the required capability in
the source before selecting the corresponding module.

## Surfaces

Each surface has `id`, `layout`, `rail_state`, `start_surface`, and an optional
`rail_modules` list and optional `design` tree.

- `layout`: `one`, `dual`, `tri` or `quad`.
- `rail_state`: `icons`, `expanded` or `hidden`.
- `start_surface`: `launchpad`, `mission`, `commands` or `modes`.
- `rail_modules`: an optional ordered list of one to five unique native module
  IDs: `tabs`, `saved-workspaces`, `bookmarks`, `history`, `downloads`,
  `mission`, `local-oi`, `command-center`, or `guard`. Omitting it retains the
  compiled rail presentation for the selected work mode, preserving v2
  packages created before this field existed.

When a person activates a mode, TAHAI applies its layout, rail state, and start
surface. Declared command controls require separate explicit invocation; they
do not automatically execute when the mode is selected. Surface declarations cannot carry
websites, URL parameters, tabs, page content, arbitrary View classes or CSS.
`rail_modules` selects and orders only existing browser-owned controls for the
activated window; it neither registers an extension nor supplies a command,
script, URL, data source, or custom panel. It is not persisted as a profile
preference, so reselecting a normal work mode restores its compiled rail.
An eventual shareable workspace template uses reviewed placeholders; a saved
personal workspace remains profile-local because its URLs may be private.

### Native layout tree

`design` describes geometry, never tab URLs or authority. The exact fields are
`version` (integer 1), `nodes`, `rail_dock` (`leading` or `trailing`), `gap`
(4–24 DIPs), `narrow_width` (320–1600 DIPs), `short_height` (200–900 DIPs), and
`keyboard_order` (each pane index once). Sizes are content-area sizes after
native browser controls and the rail have reserved their space.

`nodes[0]` is the root. A pane node has exactly `kind: "pane"`, `pane` (0–3),
and `role` (`working`, `reference`, `tasks`, `preview`, or `notes`). A split node
has exactly `kind: "rows"` or `"columns"`, `first` and `second` child indices,
and integer `percent` (10–90) for the first child's preferred share. A tree has
at most seven nodes and depth four; cycles, shared children, unused nodes and
duplicate panes are rejected. Pane indices are consecutive and their count
must match `layout`. Roles label an existing pane; they do not load a site or
replace its content with a privileged panel.

The browser clamps geometry to usable pane minimums. Below a breakpoint or the
tree's minimum size it shows the active pane only, retaining all tabs, member
order and the selected document. Enlarging the window restores the tree.
Keyboard traversal follows `keyboard_order`; browser-owned resize controls
follow the panes. Unmodified arrow keys adjust a divider and Home balances it.
Double-clicking or double-tapping a divider also balances it. Neither resizing
nor restoring a design executes a mode action. Window/session and named
workspace snapshots retain the tree and its adjusted ratios. Selecting a
native built-in mode resets the authored tree without closing tabs.

Studio's **Surface canvas** edits templates, split orientation/percentages,
pane roles, rail docking, gaps, breakpoints and keyboard order. It preserves
the same tree in source; invalid or unknown trees are not silently rewritten.
Its content preview runs pure geometry calculations without loading websites.
To try the geometry in the current window, first open the same number of native
panes and select Studio, then choose **Try for 30 seconds**. **Keep window
layout** commits it; **Revert trial**, navigating away, or expiry restores the
previous design. **Reset window layout** removes the authored geometry while
retaining tabs. Trials are never included in session/workspace capture until
kept. The trial is pinned to its window, initiating document and native tab set;
an old trial cannot undo a newer choice. Private, non-regular and managed Studio
profiles cannot use this editing bridge. This direct authoring bridge accepts
geometry only, not an unsigned operational package or a grant to run actions.

The native **Work Modes** editor can explicitly retain a kept window layout
when creating a custom mode. An existing native mode offers **Use this window's
kept layout** and **Remove saved layout**. Copies retain independent definitions;
updating the saved layout updates windows using that mode, while unrelated
control or color edits preserve each window's adjusted dividers. Geometry alone
does not restore websites: select an explicitly saved local workspace separately.

Applying, copying or clearing a window skin retains its kept layout and rail
width, cancels any unkept trial, and leaves the old preset's control binding.
Further settings edits target the displayed built-in mode, not a now-detached
custom definition. Neither appearance changes nor clearing a skin alters the
saved custom definition or closes tabs. To reset geometry, use Studio's layout
reset or explicitly select a built-in mode.

This source integration still requires native runtime, accessibility and DPI
verification before release. It is not a general custom-widget compositor.

## Workflows

Each workflow has `id`, `name`, optional `inputs`, `variables` and `outputs` lists, and a list of 1–32
steps. A step has `id`, `name`, `kind`, and, only for `run-command`, `action`.

`inputs` is an optional list of at most twelve profile-local values. Each item
has an `id`, `name`, `type`, and `required`, plus optional boolean `protected`
(default `false`) and optional `validation` rules; a `selection` also has one to
twelve bounded display `options`. The closed input types are `text`, `number`,
`boolean`, `selection`, `date`, and `url`. These are local Mission-run values, not package
defaults, page fields, selectors, credential grants, external data bindings, or
connector parameters. Required values must be set before a run can enter its
local `running` state. Input values are retained with that Mission run only and
are excluded from skin exports, Evidence Packs, handoffs, Mission Capsules,
and generated timeline records.

A `date` is a real Gregorian calendar date in `YYYY-MM-DD` form, from
`0001-01-01` through `9999-12-31`, without a time or timezone. Leap days are
validated. A `url` is an explicit HTTP/HTTPS reference of at most 256 ASCII
characters (use encoded/punycode forms for non-ASCII URLs). Credentials in the
authority, whitespace, backslashes and malformed authorities are rejected.
Ordinary (unprotected) fields additionally reject known sensitive markers; do
not enter secrets in those fields. Query and fragment text stay with the local
run. Saving or simulating a URL never opens it,
contacts a server, obtains a grant, or populates a web form. Definitions contain
only the input type and label, never a default URL or entered date. The Studio
input editor and simulator use the same six input types; simulated values are
discarded on design/workflow changes and never saved into a draft.

### Creator-defined input validation

`text` and `url` inputs may declare `validation: {"min_bytes": 2, "max_bytes": 64}`.
Either bound may be omitted. Minimum is an integer from 0 to 256; maximum is an
integer from 1 to 256; minimum cannot exceed maximum. These count **UTF-8 bytes**,
not characters or UTF-16 code units. Existing input-type/privacy restrictions
still apply; URL references remain ASCII. Missing bounds mean 0 and 256.

`number` inputs may declare `validation: {"minimum": -0.5, "maximum": 10}`.
Either inclusive bound may be omitted (unbounded in that direction). Bounds
must be finite JSON numbers within +/- 1,000,000,000,000 and cannot be reversed.
Comparison uses finite IEEE-754 double precision, not arbitrary-precision
decimal/money arithmetic. Entered values remain decimal strings (optional sign
and decimal point; no exponent, whitespace, NaN or infinity). Exponent notation
is allowed for authoring finite *limits*, not entered run values.

Boolean, selection and date types do not accept this rule object. Null, empty,
mixed-type rules, patterns, scripts, defaults, and unknown rule keys are rejected.
Omitting `validation` keeps existing v2 definitions compatible. A blank value
still clears an input or leaves a draft unfinished; required inputs must have an
accepted nonblank value before running. Invalid replacements leave the previous
value and timeline unchanged, including protected ciphertext.

Studio provides optional minimum/maximum controls and per-input **Save limits**;
blanking both removes the rule object. Edits are design-only, flow through
ordinary source validation/autosave/undo, and never change an already pinned run.
The simulator enforces limits on disposable values. Mission Control explains
the rules alongside the input; native validation is authoritative even if HTML
attributes are removed. Queue transfer and restart retain the exact rules.
Protected encryption binds them, and native actions compare them with the
trusted revision. Malformed saved rules or out-of-range saved ordinary values
make the operational run inert rather than silently dropping a required field.
These bounded rules are not the later expression, variable or data-binding
runtime, and source tests do not establish native/installed-package acceptance.

### Protected values

`protected: true` opts a field into masked entry and OS-backed encrypted local
storage. Only a regular, non-managed Mission profile can retain it. There is
no plaintext fallback. Values are capped at 256 UTF-8 bytes, reject control
characters, and still satisfy the declared type. Text may contain private
punctuation; protected URL references may contain private query markers, but
never userinfo in the authority. A saved value is never returned to WebUI:
the UI shows only whether it is available, with explicit replace/clear controls.
Encryption binds the value to the profile path, run ID, installed revision,
workflow and complete input definition. A copied or damaged ciphertext cannot
satisfy an input. Unavailable encrypted records are retained for retry or an
explicit clear; a required locked input prevents running. Restart never resumes
a run automatically. Losing the OS key/profile binding can make a value
unrecoverable; it is not a portable credential vault or a connector grant.
Studio authors only the flag, never defaults or ciphertext. Its masked
simulator accepts disposable dummy values only, without encrypted persistence.

### Typed local variables and assignments

`variables` is optional, with up to twelve unique IDs in a separate namespace.
Each declaration has exactly `id`, `name`, `type` and optional `options`,
`validation` and boolean `protected`, using the six input types and the same
limits. Variables start blank. A declaration cannot contain `required`, a value,
ciphertext, runtime readiness flags, a default, a script or an external source.
Missing/false `protected` retains ordinary local storage. `protected: true`
selects the encrypted, masked storage described below.

An `assign-variable` step has `id`, `name`, `kind`, optional `when`, and:

```json
"assign": {"variable": "total", "from": {"input": "amount"}}
```

`from` contains exactly one declared `input` or `variable` ID. The source and
destination must have the same type; no implicit conversion, concatenation,
script, selector or privacy override is accepted. The actual source value must
also meet the destination's options/limits. An empty source explicitly clears
the destination. A failed check changes neither the variable nor completion.

The person clicks **Assign local variable** in a running Mission after earlier
applicable steps complete. Required inputs/branch choices must be answered and
no native action may be pending. Pause, terminal states, archive, managed
Mission data and private sessions cannot assign. Assignment and its checkpoint
require a fresh document control: a browser-owned, runtime-only token changes
on run/input mutations and after service restart. An old tab is told to reload
instead of silently copying a value changed elsewhere. Tokens contain no data
and are not persisted or exported. Assignment and its checkpoint
are saved in the same run record; no external action is executed. Ordinary
completion/reopen controls cannot bypass or repeat assignment. A later authored
step can overwrite the same variable. Changing the source afterwards does not
retroactively change a captured variable. Restart retains values/completion and
never performs an assignment automatically. This uses existing profile-preference
storage, not the external-effect intent journal; final disk-write/crash/failure
tests remain required before any durability claim.

Definitions remain pinned to the run revision and are compared before native
dispatch. Malformed stored definitions, bindings or values make the operational
run inert rather than removing a constraint. Ordinary values appear only as escaped text
in that Mission, while protected values remain masked, with no URL navigation/fetch. Design exports, routine evidence,
handoffs, capsules and generated timeline entries exclude values. A duplicate
Mission does not carry variables; archives retain them and deleting the run
deletes its values. These are local values, not trusted website assertions.

Studio creates an empty variable by copying an input/variable's type,
options, privacy and limits. A creator may additionally protect a new variable;
a protected template cannot be downgraded. Its accessible list supports rename/remove, assignment
source/destination selection and result bindings. Numeric variables expose their
inclusive minimum/maximum bounds; text and URL variables expose UTF-8 byte bounds.
Use **Set variable limits** to validate and save both together; a blank field
removes that bound, and two blanks remove the validation object. Bounds cannot
be inverted, non-finite, out of range or malformed. Variables of other types do
not offer unsupported limit fields. Each control names its variable and links
to the limit explanation. This changes the draft definition only: it does not
edit its source input, any existing pinned run, a saved variable value or an
installed revision. Stale/disconnected and read-only controls cannot save.
Remove dependencies before
deleting an input/variable. Source editing supports all validated definitions.
The simulator keeps values only in a disposable map, executes an assignment
only on its simulation button, enforces order/type/limits, and clears the map
on source edits, input changes, workflow selection, reset and page close.

#### Protected variable storage and assignments

Copying ordinary data into a protected variable is allowed. Copying a protected
input/variable is allowed only into a protected variable of the same type.
Protected variables cannot be used in conditions or calculations, including
as a calculation destination; no implicit declassification or coercion exists.

The browser decrypts a source only inside the native assignment transaction,
validates the actual value against destination options/limits, and re-encrypts
for that destination before recording any branch decision, completion or value
change. It never copies ciphertext as if it belonged to another field. Encryption
binds profile, run, revision, workflow, variable ID, name, type, options and limits,
with a separate variable purpose that cannot accept an input ciphertext. Plaintext
is never retained in a Mission variable snapshot, preference, WebUI, output or
routine export. The variable's ordinary `value` slot stays empty. Saved protected
variables use only `protected_value`; mixed plaintext/ciphertext or forged
readiness fields make the restored operational run inert.

Key/context failure retains the existing ciphertext and disables assignments
that need that source or would overwrite an unavailable destination. Unlocking
revalidates saved data without rewriting it or replaying a completed assignment.
A fresh explicit assignment from a genuinely empty source may clear a protected
destination without a key; an unreadable nonempty ciphertext is never treated as
empty. Failed validation/encryption does not change progress, token or previous
value. Storage remains regular-profile only and is blocked by managed Mission
policy and private/guest/system contexts.

Mission shows only not-set, masked-saved or unavailable status and offers a
protected-storage retry. Workflows containing protected variables but no protected
inputs initialize that same provider through the variable's locked marker.
Named results inherit privacy and stay masked; they report unavailable when the
saved value cannot be authenticated. Keys do not authorize connectors or websites.
Studio simulations use dummy values in disposable memory, mask protected results,
and never serialize simulated values into a draft/package. These source guarantees
still require the mandatory native/browser and final installed-package tests.

### Bounded numeric calculations

An `assign-variable` step may replace `from` with an `expression` tree. Exactly
one binding is required; it cannot also carry a copy source. The destination
must be an ordinary numeric variable. For example:

```json
"assign": {
  "variable": "total",
  "expression": {
    "op": "multiply",
    "args": [{"input": "amount"}, {"number": 2}]
  }
}
```

Leaves are exactly one of `{"number": 2}`, `{"input": "amount"}` or
`{"variable": "total"}`. References must name ordinary numeric definitions in
that same workflow. Protected inputs/variables and other types cannot be used,
even with a numeric-looking value. There is no script interpreter, string
coercion, website access, connector or external effect. Operators are binary
`add`, `subtract`, `multiply`, `divide`, `min`, `max`, or unary `abs`, `negate`.
Every operator has exactly `op` and `args` with the required number of children.
Trees are limited to 31 nodes and five levels, including leaves. Extra fields,
unknown operators, missing references and mixed node kinds are rejected.

Constants, operands and every intermediate result must be finite numbers with
absolute value at most 1,000,000,000,000. Computation uses IEEE-754 binary64,
including its rounding/underflow behavior; it is not exact financial decimal
arithmetic. Results use shortest round-trip decimal digits, with exponent
notation expanded into the existing decimal-only input format, negative zero
normalized to zero, and a maximum of 256 bytes. An unrepresentable-size result
is rejected rather than truncated or rounded to fit. Destination limits apply.

Blank references (`missing-number`), division by either sign of zero
(`division-by-zero`), range failures (`number-out-of-range`), oversized formatted
results (`result-too-long`) and destination-limit failures (`target-constraint`)
leave the previous variable, checkpoint and mutation token unchanged. Mission
shows a fixed, value-free explanation. These preflight failures do not fail the
run; correct source values and explicitly try again. Calculations use the same
ordered, fresh-document assignment control, policy/private-profile restrictions,
atomic run record, restart/no-replay and value-export exclusions described above.
They are not automatically reevaluated when an input changes.

Studio's basic calculation controls offer labeled operation/source selectors and
numeric constant fields beside the destination selector. No JSON is needed for
one-value or one-operator expressions. Ordinary numeric inputs and variables
are offered by name; protected or other typed sources are excluded. Unary
operations disable the unused second source. Saving validates the whole workflow.
Reload repopulates these controls from the saved definition, never a simulated
value. A nested tree stays in the advanced JSON editor and is never silently
flattened: choosing and explicitly setting a basic calculation replaces it, with
a visible explanation. Read-only/native-action steps cannot be changed through
either editor. The advanced editor retains the complete bounded tree model.
Referenced inputs/variables cannot be removed. Simulation evaluates only in its
disposable local map and never saves results into the design. This integrated
calculation editor is not the remaining general visual B5 graph/palette/inspector.
Other typed expressions and action-output bindings
and compensation remain separate roadmap work. Exact native/browser runtime,
accessibility and installed-package acceptance are still required.

### Bounded text expressions

An assignment may use `text_expression` instead of `from` or the numeric
`expression`. Its destination must be an ordinary text variable. Leaves are
exactly one of `{"text":"constant"}`, `{"input":"id"}` or
`{"variable":"id"}`. References must name ordinary text definitions; numbers,
URLs, dates, choices, booleans and protected fields are not implicitly converted.
No interpolation, property access, page access, script or external effect exists.

Operations use exactly `{"op":"name","args":[...]}`:

- `concat`: two values, joined without an implicit separator.
- `trim-space`: one value, removes only U+0020 at its ends.
- `lower-ascii` / `upper-ascii`: one value, changes ASCII letters only; other
  Unicode characters are preserved. Behavior does not depend on system locale.
- `replace`: text, search and replacement. Literal, case-sensitive,
  non-overlapping matches; inserted text is never scanned again. No regular
  expressions or replacement-token expansion. An empty search is an error.

Trees allow at most 31 nodes and five levels including leaves. Every constant,
source and intermediate result is at most 256 UTF-8 bytes, valid Unicode without
ASCII control characters or Unicode noncharacters. The native evaluator bounds replacement
growth before appending. Over-limit intermediates cannot be rescued by a later
trim/replacement. Blank references produce `missing-text`; an explicit empty
constant or a legitimate empty operation result can clear the destination.
The final value also passes the existing ordinary-text privacy screen and
destination validation. No prefix, truncation or partial assignment is stored.
Errors are value-free (`invalid-expression`, `missing-text`, `invalid-text`,
`empty-search`, `result-too-long`, `target-constraint`). Failed assignments retain
the previous value, token, branch decisions, preferences and completion state.

Studio provides operation/source/constant controls and an advanced JSON tree
editor. Nested trees remain intact until explicitly replaced. Only the definition
is saved; simulation values remain disposable. Constants are shared design data,
not encrypted fields: never place secrets in them. Mission evaluates only on a
fresh explicit assignment, retains the exact definition and prior result across
restart without replay, and exposes named results only after run success. This
does not supply the remaining action-output, connector or compensation runtime.

### Explicit timed waits

The `wait` step has a closed definition: `"wait": {"seconds": 3}`. Seconds
must be an integer from 1 through 86,400; fractional, boolean and string values
are rejected. A wait cannot also carry an action or assignment. Definitions
never contain clocks, timestamps, remaining time or completion state.

An optional `timeout_seconds` defines a completion deadline, for example
`"wait": {"seconds": 3, "timeout_seconds": 5}`. It must be a whole integer
strictly greater than `seconds` and at most 86,400. Omit it for no deadline;
explicit zero/null/false is invalid. Both budgets start together and use the
same monotonic clock. In this example the wait can be explicitly completed
after three seconds but must finish before five active seconds. At the deadline,
an unfinished wait becomes **timed-out** and the run **failed**. A browser-owned
single wakeup handles the earliest deadline across local runs, even without an
open Mission page. There is no next-step dispatch, automatic retry, compensation
or external operation. Explicit completion disarms that deadline. Expiry records
a fixed, value-free timeline reason; it never records input contents.

In a regular, unmanaged profile, a running adapter-1 Mission offers **Start
timed wait** after required/branch answers and preceding applicable steps are
complete. Starting is explicit. The browser measures elapsed time with its
monotonic clock. The visible countdown is an estimate, not authority to finish.
**Check and complete wait** is a separate click; the browser rejects early
completion. No automatic completion, next-step dispatch or external operation
occurs when a timer expires. Completed waits cannot be reopened or replayed.
Stale controls must be reloaded after another tab changes that run.

Pausing, losing a required input, cancelling or archiving freezes the remaining
duration. Resuming a run does not resume a clock: choose **Resume remaining
wait** separately. Graceful service shutdown saves the remaining duration once
and pauses the run. An interrupted restart restores only progress in the last
saved checkpoint, never credits offline time and never restores a live clock.
Unsaved progress may therefore be repeated after a crash, but a delay is not
shortened by a wall-clock change or time spent with the browser closed. Existing
Mission saves may capture progress; there are no periodic timer disk writes.
Malformed persisted durations/states/clocks make the operational run inert.
This is bounded local workflow state, not tamper-resistant proof of elapsed time
or protection from the same OS user editing their profile.

Deadlines pause and recover with the delay, using saved remaining budgets, not
wall-clock timestamps. Offline time does not consume a budget. An already
recorded timeout remains failed; an expired budget saved at the exact crash
boundary cannot recover as a successful or resumable wait. Malformed deadline
fields are rejected, not silently removed. Managed Mission storage suppresses
timer-driven writes; after policy is removed, a new Mission interaction checks
the elapsed deadline before permitting another wait or step action. Completed,
cancelled, archived, paused or shutdown clocks do not retain scheduled wakeups.

Mission's displayed countdown remains an estimate. **Refresh run status** reads
the current recorded outcome without automatically replacing a page containing
unsaved text. A recorded timeout identifies the failed step and leaves later
native actions untouched. The expired run cannot resume/retry its wait; start a
new workflow run deliberately if appropriate. These are relative active-run
budgets measured by the platform monotonic clock, not calendar alarms, exact
real-time scheduling guarantees or measurement of machine-awake CPU time.

Studio's **Timed wait** section converts a selected nonnative step into a wait
or back to a checkpoint. Its simulator has separate **Start wait in simulation**
and **Advance time and complete in simulation** buttons, no real timer or native
messages, and clears simulated progress on edits, input changes and reset.
For a configured deadline, **Advance to deadline and fail in simulation** shows
the terminal failure and suppresses later simulated steps and outputs until
reset. Its outcome is disposable and does not enter the draft or exported skin.
The draft/archive contains only the definition. This timed-delay slice does not
implement event/origin waits, deadlines for other step kinds, loops, compensation or remote
triggers; those remain separate roadmap requirements. Native/browser runtime,
accessibility and installed-package acceptance remain required.

### Named local outputs

`outputs` is an optional list of at most twelve named results. Each is a closed
object with `id`, `name`, and `from: {"input": "declared-input-id"}` or
`from: {"variable": "declared-variable-id"}`. For example:

```json
"outputs": [
  {"id": "reviewed-reference", "name": "Reviewed reference", "from": {"input": "reference"}}
]
```

The source input or variable must exist in the same workflow. Output IDs are unique within
the output namespace (separate from input IDs). Multiple outputs may refer to
one input. Missing/empty `outputs` preserves earlier v2 behavior. Null, dangling
bindings, duplicate output IDs, extra fields, inline values/defaults, page
selectors, destinations, scripts, or overrides of type,
validation or sensitivity are rejected. The output inherits its source's type,
validation and protected status; binding cannot declassify a protected value.

Results resolve only in an explicitly `succeeded` run with its applicable steps
complete. Before then the UI shows a pending result, not a value. Paused,
failed, cancelled, incomplete and waiting runs do not publish results. An
optional input left blank produces **Not set**, not an invented default.
Terminal run inputs and checkpoints cannot be changed. Output bindings persist
with the pinned run definition and reference that same immutable run's validated
input/variable storage; result values and ciphertext are not copied into a second store.
There is no automatic result delivery or permission grant. Displayed URL results
are plain text, not navigation or fetch commands.

Protected outputs show only masked presence/unavailability. Neither plaintext
nor ciphertext is returned by the output presentation projection. After restart,
protected storage must become available again before presence can be confirmed;
encrypted records remain available for retry. Ordinary results remain local
to that Mission/profile. Archives retain results; deleting a Mission removes
their bindings with its run data. Duplicating a Mission creates a fresh generated
runbook without its inputs, outputs, protected values or operational authority.
Off-the-record/other profiles do not inherit the regular profile's results.
This is ordinary profile storage, not protection against the same OS user
tampering with their files, nor independently attested proof of remote work.

Skin/creator exports include only output definitions, never entered results.
Evidence Packs, sanitized status/handoffs, Mission Capsules and generated
timeline entries do not include output values. Sharing a result with a website,
connector or file exporter requires a separately reviewed future action; creating
an output is not authorization for such sharing.

Studio's **Named local outputs** section provides input/variable selection, naming,
rename/rebind/remove controls, and copies bindings with **Copy selected workflow**.
An input cannot be removed until its dependent outputs are removed or rebound.
Edits use the usual source validation/autosave/undo path and do not rewrite
existing runs. The simulator shows results only after simulated completion,
masks protected dummy values, and clears results on edits/reset/workflow changes.
These are finite local bindings and typed copies, not the remaining general
expression/action-output/data-binding runtime. Native/browser runtime,
accessibility and installed-package acceptance remain required.

### Conditions and steps

A step may optionally include `when: {"input": "input-id", "equals":
"value"}`. It is a bounded local equality check against a declared ordinary
boolean or selection input. An ordinary numeric input may instead use:

```json
"when": {"input": "amount", "compare": {"op": "greater-than", "number": 3.125}}
```

The numeric comparison vocabulary is `equal`, `not-equal`, `less-than`,
`at-most`, `greater-than`, and `at-least`. `compare` contains exactly `op` and
`number`; the threshold must be a finite JSON number within ±1,000,000,000,000.
It cannot be a string, boolean, expression, source reference or script. `when`
contains exactly one source (`input` or `variable`) plus either `equals` or
`compare`, never both. A numeric comparison refers only to a declared ordinary
numeric input or variable; protected values
(including protected numbers/booleans), text, date and URL values
cannot drive these branches. Numeric comparisons use binary64 numeric value,
not string ordering; signed zero is equal and no tolerance is invented. Input
values retain their existing decimal grammar, length and validation limits;
comparisons perform no arithmetic and may compare larger finite input values
against the bounded threshold. This does not expand calculation operand limits.

Every referenced input must be explicitly answered, even if declared optional.
An unanswered condition blocks starting/succeeding the run rather than silently
skipping its work. Mission distinguishes **Waiting for answer** from **Skipped
by condition**. An unsatisfied step is unavailable and cannot be completed.
Changing an answer never dispatches a step. A branch answer becomes locked when
its step or any subsequent step is complete, waiting, or has begun a native
attempt, including when the branch itself was skipped. This prevents inserting
work behind a recorded action. Earlier work alone does not lock a later branch;
reopening all affected ordinary checkpoints can release that lock, but native
attempts/assignments/completed waits cannot be undone or replayed that way.
Restart retains the definition, answer, progress and resulting lock. Malformed
or mixed saved comparison fields make the operational run inert; no permissive
fallback or preference rewrite occurs at load. Numeric predicates require the
native version-1 Mission adapter, not the inert legacy adapter.

Variables use the same comparison vocabulary with an explicit namespace:

```json
"when": {"variable": "total", "compare": {"op": "at-least", "number": 3}}
```

Boolean/selection variables use `{"variable":"choice","equals":"true"}`
or a declared selection option. A similarly named input does not supply or
become required by a variable condition. A blank variable is **Waiting for
variable assignment**, not false or zero: it blocks that step, all later
progress and success, but does not block starting or earlier assignments.
Place an explicit assignment before the branch. A branch that depends on its
own first assignment cannot resolve itself; cancel and correct the design.

Immediately before explicit forward progress (checkpoint completion, variable
assignment, wait start, or native attempt), the browser records every preceding
variable branch decision, including skipped branches and the current step's
condition. The decision is taken before a conditional assignment changes its
own source variable. A later assignment may change that variable, but cannot
re-evaluate an already recorded branch. Later, not-yet-reached branches use the
new value. Reopening a checkpoint does not erase a recorded variable decision.
Trailing false branches are recorded when success is explicitly requested.
No decision itself grants an action, advances a checkpoint or repeats work.

The run record stores only the boolean decision beside the existing definition
and progress, not a copy of the predicate value or a script. Pause/restart and
archive retain decisions. Missing decisions behind recorded progress, malformed
types, false decisions on completed/attempted steps, or decisions attached to
input/unconditional steps make restored operational state inert without
rewriting the saved preferences. A successful run must also have every trailing
variable decision recorded before results can be read; missing final decisions
cannot be reconstructed from current values at load. The exact source namespace is compared against
the pinned definition before native dispatch, including asynchronous callbacks.
Version-1 native Mission adaptation is required. These preference-write semantics
still require final disk-failure/crash testing; they are not a durability claim.

Studio offers input/variable, comparison and threshold controls, with existing
validation/autosave/source round-trip behavior. Its simulator distinguishes
missing answers/unassigned variables from false comparisons, records disposable
decisions before simulated progress, and never saves dummy answers, results or
decisions to the draft. Editing/resetting/changing workflows clears simulation
state. A referenced variable cannot be deleted until its conditions are rebound.
Conditions never observe pages, navigation, timers, website events or remote
results. Loops and effectful integrations
remain separate roadmap work; this does not declare B4 or GA complete.

### Compound local conditions

`when` can also be a bounded tree combining the same ordinary typed leaves:

```json
"when": {"all": [
  {"input": "approved", "equals": "true"},
  {"any": [
    {"variable": "total", "compare": {"op": "greater-than", "number": 3}},
    {"not": {"input": "scope", "equals": "Personal"}}
  ]}
]}
```

`all` means AND, `any` means OR, and `not` negates one child. Each group contains
exactly one key. All/any require arrays of 2–8 children; not contains one object,
not an array. Every tree has at most 31 nodes and five levels, counting the root
and leaves. Empty groups, arbitrary operators, scripts, embedded results, mixed
leaf/group fields, implicit coercion and protected references are rejected.
Every leaf is validated even if another leaf could determine the answer.

All referenced inputs are required before starting, even within OR or NOT. All
referenced variables must be assigned before advancing through that condition.
An unresolved child makes the entire tree unresolved: OR cannot hide a missing
value and NOT cannot turn a missing value into permission. Evaluation performs
no I/O or action, and does not observe websites. Native dispatch still requires
the pinned definition, current profile/window/document, policy and user action.

Every compound condition, including input-only trees, records its whole boolean
decision on explicit forward progress, using the same run-only decision storage
as variable conditions. A later assignment cannot reinterpret part of a consumed
tree. Inputs referenced by a recorded compound condition stay locked even if
ordinary checkpoints are reopened. No partial leaf values are copied to the
decision record. Pause/restart preserve that outcome, malformed or contradictory
saved state is inert, and successful runs must have trailing decisions recorded.
Plain single-input conditions retain the earlier input-lock semantics.

In Studio, choose a source/comparison and **Use this check** to replace the
condition or combine it with the existing tree using AND/OR. **NOT current
condition** wraps the current tree. The bounded JSON editor supports the complete
tree contract and round-trips nested trees without flattening them. Invalid,
over-budget, protected, stale or read-only changes preserve the saved draft.
Deleting a source requires removing/rebinding all nested references first.
Simulation uses the same missing-value and recorded-decision rules without
saving simulation values or outcomes. Mission exposes an escaped definition
review containing author constants and source IDs, never entered run values.

These are local conditions, not loops, an unrestricted expression language,
remote triggers or an external integration grant. Native/browser and installed-
package runtime acceptance remains required.

| Step kind | Meaning |
| --- | --- |
| `instruction` | A creator-authored local instruction. |
| `checkpoint` | A deliberate local completion point. |
| `run-command` | A symbolic action accepted from the small native action vocabulary. |
| `assign-variable` | An explicit typed local copy or bounded numeric/text calculation, after preceding applicable checkpoints. |
| `wait` | An explicit local delay with bounded seconds and separate start/completion. |

Initial action IDs are `address.focus`, `tabs.find`, `workspaces.open`,
`mission.open`, `guard.open`, `layout.one`, `layout.dual`, `layout.tri`,
`layout.quad` and `layout.focus`. A workflow or mode may reference an action
only when the manifest declares the action's capability.

The declaration contains no arbitrary code, unbounded/general expressions or loops, webhook,
connector, URL, scriptlet or fetch rule. Only the bounded local conditions
and calculations above are supported. Parsing, storing, simulating, changing run
state or restoring a declaration never executes a workflow command. Mode
activation applies its separately validated presentation/start-surface choices;
the contextual action list remains explicitly invoked browser controls.

New Mission runs use native adapter version 1. Each `run-command` requires an
explicit click in the active Mission document, the same trusted installed
archive revision and bound mode, all required/branch answers, and completed
preceding applicable checkpoints. Command IDs are resolved from that trusted
manifest at use, never accepted from page messages or preferences. The browser
rechecks the document, window, revision, policy and command availability after
the background attempt journal commits and before dispatch. A stale document
or a journal operation reaching the ten-second deadline cannot dispatch a command.
The invocation also pins the run's browser-owned random mutation token, not
its timestamp. Any intervening run edit invalidates the pending invocation
even if two edits share a clock timestamp. This token is neither persisted in
a design nor accepted as command authority from a renderer.

The browser owns one monotonic **ten-second native-attempt deadline** covering
reservation and result recording together. It starts when the explicit attempt
becomes pending, not when a background callback happens to arrive. Its timer is
owned by the Mission service and does not require a renderer, page reload or
journal callback to expire. Dispatch and completion also check the deadline
synchronously, so a delayed timer task cannot authorize a late callback.
This is not a customizable manifest timeout or a promise of real-time scheduling
while the machine is suspended; no privileged operation can dispatch after the
browser observes that its deadline has elapsed.

Expiry closes the step as `unknown`, with the fixed local reason
`deadline-exceeded`, and fails its run unless it was explicitly cancelled.
Pause/archive/cancellation do not reset an in-flight attempt's clock. Success
recorded before the deadline disarms it; a late result cannot overwrite the
closed outcome or make the UI display success. The action may already have
happened before result recording stalled: this is never reported as rollback
or proof of no effect. The durable attempt journal is not erased or replayed.

A pending step offers **Refresh run status** without automatically navigating
or clearing unsaved input. The browser uses the same bounded wakeup for the
earliest native or authored-wait deadline across runs, but keeps their budgets
and pause semantics independent. Under managed Mission policy an in-flight
native deadline may close in memory, but neither managed nor underlying user
preferences are rewritten. Authored waits retain their policy-write inhibition.
Graceful shutdown closes pending native outcomes as unknown and removes live
clocks. Interrupted restart likewise never restores or restarts a native clock;
persisted clock fields or malformed error combinations make a snapshot inert.

The profile-local `TAHAI Workflow Journal` stores only a SHA-256 of opaque
run/revision/workflow/step identity and a fixed intent/result token. SQLite
transactions use flush-to-media; corruption, unsupported versions, I/O failures,
the 16,384-attempt quota or the 8 MiB database bound fail closed. No automatic
pruning discards replay protection. An existing attempt never dispatches again,
even if Mission preferences reverted. An interrupted or unrecorded result is
shown as unknown, not successful. Review the actual state and start a fresh run
if another attempt is needed. No storage mechanism promises protection against
deliberate deletion of profile data or hardware that violates flush guarantees.

Dispatch means only that Chromium accepted the native command. The person must
verify its actual result before completing the checkpoint. It is not evidence
of remote work, and it does not imply mission success. Earlier checklist-only
snapshots and version-2 handoffs stay inert; they never acquire action authority
through migration. Runtime and crash/failure verification remain release gates.

A rejected native attempt or unknown outcome now closes its workflow as
`failed`; an explicitly cancelled run stays `cancelled`. The step remains
incomplete, later work and success outputs stay unavailable, and this attempt
cannot resume or retry. A late journal result may record that failure even if
the run was paused or archived, without resuming it. A late successful dispatch
does not resume a paused or cancelled run. A policy arriving during journal
I/O cannot cause the completion callback to overwrite managed Mission storage.

On restart, saved `pending` becomes `unknown`. Older snapshots containing a
rejected or unknown native attempt also become failed, including an inconsistent
saved success claim, except for explicit cancellation. This local recovery
does not rewrite preferences merely by loading or execute any effect.
Mission shows a fixed per-step reason and an explicit **Refresh run status**
control after a live failure; it does not auto-reload and discard unsaved text.
Unknown means **the action may have happened**: inspect the actual browser
state before deliberately starting a fresh run. Failure does not roll back or
compensate for an external effect.

Studio's **Simulate rejected action** and **Simulate unknown outcome** controls
exercise these terminal paths for the next applicable native action. Preceding
work must be completed, later actions and outputs disappear until reset, and
all simulated outcomes remain disposable: no native dispatch, run journal,
input values or error state is written into the design. General authored error
branches and optional compensation remain separate runtime work.

### Bounded repeat sequences

A workflow can declare up to eight `repeats`. Each selects an inclusive,
contiguous range of authored step IDs and a fixed total iteration count:

```json
"repeats": [{"id": "review-rounds", "from": "increment", "through": "review", "count": 3}]
```

Each object has exactly those four fields. Count is an integer from 2 to 8,
not a condition, expression, website event or entered value. Both endpoints
must exist in forward order; one-step ranges are valid. Ranges cannot overlap
or nest. The entire expanded workflow must still have at most 32 steps. A
missing `repeats` field or an empty list retains existing workflow behavior.

The browser expands each range in step order before creating a run. Iteration
steps get IDs `r-<repeat-id>-<iteration>-<authored-step-id>` and labels
`[iteration/count] Original label`. Expanded IDs must fit 64 characters and
cannot collide with any authored or expanded ID; repeated labels must fit
128 characters including their six-character prefix. Invalid definitions are
rejected, never truncated, repaired or partially expanded. List order does
not change range execution order. Authored package/source exports keep the
original steps and repeat declarations, not the expanded run or its values.

Ordinary variables carry forward between iterations. A condition is evaluated
for each distinct iteration; variable/compound decisions are frozen separately
when consumed. Instructions/checkpoints remain explicit checklist items. Native
actions, assignments and waits require preceding applicable steps and a fresh
explicit user action; no loop starts or retries them automatically. Wait clocks,
native intent/result records and completion flags are distinct per iteration.
Restart retains completed progress, pauses remaining work and never replays an
earlier iteration. Unknown native outcomes still require reconciliation rather
than proceeding. Every dispatch is checked against the exact expanded, pinned
package definition; updating a design does not rewrite an existing run.

Studio provides first/last-step and count pickers, edit/remove controls and the
expanded step count. Remove a range before deleting an endpoint. Editing or
moving interior steps intentionally changes that authored sequence and is
revalidated against all quotas. Simulation uses the same expansion and separate
disposable iteration progress without native actions or saved run values.

## Native action status bindings

An explicit assignment may copy a preceding native action's recorded dispatch
status into an ordinary text or selection variable:

```json
{"id":"record-status","name":"Record dispatch status","kind":"assign-variable",
 "assign":{"variable":"outcome","from":{"action_status":"open-layout"}}}
```

The source must identify an earlier `run-command` step in the same workflow.
Missing, forward, self, non-action and ambiguous namespace references are
rejected. The destination cannot be protected, and its normal validation limits
still apply transactionally. This binding cannot read a page, credential, URL,
command return payload or external service response. `dispatched` means the
browser dispatched its native command, not that website work succeeded.

The source action must finish and its checkpoint must be explicitly reviewed
before assignment. The existing failed/unknown-attempt rules still stop the
run; binding status does not resume failures, retry commands or grant authority.
Assignment itself is explicit, never performed while loading a definition,
restoring a run or exporting a skin. Values remain private run state. Native
dispatch pins this binding together with the rest of the exact installed
revision.

Inside a repeated range, a binding refers to the latest preceding occurrence
of its source. Within the same iteration this is that iteration's action; after
the range it is the final iteration. A skipped or uncompleted current occurrence
cannot fall back to a previous successful occurrence. Studio exposes these
sources in the typed assignment picker, blocks deleting a referenced action,
preserves the definition through drafts and simulates dispatch without doing it.

## Modes

Each mode has `id`, `name`, `surface`, `workflow` and `actions`. `surface` and
`workflow` must point to IDs in the same manifest. `actions` is a unique list
of 1–12 allowed action IDs. The native browser retains ownership of command
IDs, toolbar/menu placement, security controls and access to recovery UI.

See `operational-skin-v2.example.json` for a full declaration. Add the same
`operational` object to a normal skin folder and use `build_skin.py` to produce
a package. Use its signing options before importing: an unsigned v2 archive is
intentionally rejected by the browser.
