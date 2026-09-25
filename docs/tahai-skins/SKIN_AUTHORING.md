# TAHAI Skin authoring reference

A TAHAI Skin changes the browser shell: the frame, toolbar, tabs, workspace
rail, and supported side-panel cards. It does not restyle websites, alter page
content, inject scripts, or change security indicators, permission prompts,
focus rings, or forced-colors behavior.

Start with `starter-skin` from the creator kit. The kit also includes an
offline visual editor (`studio.html`) and a deterministic builder
(`build_skin.py`). It targets Chromium 152.

For a v2 operational-skin source draft, open `tahai://skin-studio/` in the
native browser. Studio keeps only validated, profile-local JSON source. Its
palette, native-surface, and workflow controls edit the same source
document, and its import/download/copy controls exchange JSON source only. The
workflow controls can add, rename or remove local `instruction`, `checkpoint`
and `run-command` steps. Native action choices are limited to the package's
existing capability declarations; they never add capabilities or grants.
They cannot create a URL, script, credential or connector. Studio does not
create an archive, inspect a page, supply a trust
key, sign a package, install a skin, or authorize an operational action. Use
the creator kit to add actual artwork, calculate asset hashes, build the
archive, and sign it under the explicit publisher trust model described below.

The **Package workflows** selector reaches every workflow in the draft (up to
24). Selecting one only changes the editor, not the saved source or a mode.
**New workflow** starts a local checkpoint; **Copy selected workflow** preserves
the selected definition, inputs, conditions and any existing action declarations
under an independent ID. Neither changes capabilities or copies live run values.
Choose a mode and explicitly use **Use selected workflow for this mode** to
change its binding. A workflow cannot be removed while any mode uses it, or if
it is the package's last workflow. Undo/redo applies to these source edits.

The selected workflow's input editor, step labels, condition picker and step
order controls all target that same definition. The simulator uses disposable
document-local values and never runs a browser action. An unanswered input used
by a condition blocks simulation and the native Mission checklist, even when
the input is marked optional; explicit `false` is different from an unset
answer. Switching workflows, editing source or leaving the page clears the
simulation. Invalid labels, option types and quota violations do not replace
the last valid source through these controls. New Mission runs use the
versioned native action adapter described in `OPERATIONAL_SKIN_V2.md`; legacy
checklist-only runs remain inert. Simulation is not runtime execution evidence.

Use **Typed local variables** to create an empty slot by copying an ordinary
input or variable's type, options and limits. Select an instruction/checkpoint
and use **Set assignment step** to choose its typed source and destination.
Native actions remain separate. Assignments cannot read protected inputs and
do not convert types; an empty source clears the destination. Each explicit
assignment runs once per step, with later assignments allowed to overwrite.
The Mission displays current local values; changing an input does not alter a
previously captured value. Restart never assigns automatically. Rename/remove
variables in the list, removing dependent assignments/results before deletion.
Simulation uses disposable values and is not proof of native persistence or
disk-failure recovery. See the [variable contract](OPERATIONAL_SKIN_V2.md#typed-local-variables-and-assignments).

Use **Named local outputs** to name a result and choose its source input or variable. The
result inherits that source's type, limits and privacy: protected values remain
masked. Rename, rebind or remove outputs without changing an existing run.
Remove/rebind dependent outputs before deleting their input. The simulator
shows disposable results only after all applicable steps complete. Actual
Mission results appear only after explicit workflow success, stay with that
local run, and are never copied into skin, evidence, handoff or capsule exports.
No website is contacted. See the [output contract](OPERATIONAL_SKIN_V2.md#named-local-outputs)
for completion, restart, retention and sharing boundaries.

For text/URL inputs, optional **Minimum**/**Maximum** limits count UTF-8 bytes
(0–256 minimum, 1–256 maximum), not characters. For number inputs they are
inclusive numeric bounds within +/- 1,000,000,000,000. Existing inputs have
**Save limits** controls; clear both to remove the limits. These design edits
are validated and undoable and do not change a run already pinned to an
installed revision. The simulator checks the limits on dummy values. Mission
Control enforces them again in native code, including after restart and for
protected values. See the [validation contract](OPERATIONAL_SKIN_V2.md#creator-defined-input-validation)
for exact precision, blank-value and failure semantics.

The input editor's **Protected value** option marks a definition for masked,
OS-encrypted storage when a person later enters a value in Mission Control.
Ordinary inputs are not secret storage. Protected inputs cannot be condition
choices, and the design never contains a value or ciphertext. Use dummy values
only in Studio's password-style simulation fields; simulation does not save
secrets or grant connector access. Mission Control offers replacement, explicit
clearing and retry when OS storage is unavailable. A restored required value
must be successfully decrypted before the person can explicitly resume the run.

## Local modes and built-in presets

In **Work Modes**, **Save editable preset copy** copies a built-in mode's
validated presentation and native command layout into an independent local
definition. It does not activate the mode, open sites, copy a running workflow,
or change the original preset. Rename the copy and select **Use mode** when
ready. Saved modes remain local to the current regular profile.

Under **Edit native controls and saved workspace**, select the controls and
an explicitly saved workspace. **Place and order controls** sets independent
primary-toolbar, secondary-toolbar and app-menu positions: 0 hides an item,
1–17 orders checked controls, and positions cannot repeat within a menu.
Finder and the rail retain all checked controls. Guard and Skin recovery
remain browser-owned and reachable. After editing, reopen old menus; their
stale mode bindings cannot execute.

The rail supports all 17 native controls, not just its first five entries.
Scroll its contents with the mouse wheel or move focus with Tab; focused
controls are brought into view. Expanded rails show a scrollbar when needed;
the narrow icon rail scrolls without reducing its native hit targets. Expand
and hide controls stay outside the scrolling area. Removing or replacing a
focused control returns focus to rail recovery. A mouse, keyboard or touch
press cannot acquire the action of a replacement mode before it is released.

To change a saved mode's skin, apply the reviewed package to the current window
first, then choose **Use this window's pinned skin** in the mode editor. This
saves its exact verified revision, not a grant or an uncommitted preview.
**Remove saved skin** detaches that reference. Choose **Use mode** again after
a skin-reference change; existing windows do not silently acquire a replacement
binding. Restore revalidates package trust, and unavailable/revoked skins cannot
broaden the mode's commands. Layout capture likewise retains only a kept Studio
layout. Websites belong to an explicitly saved workspace, not the skin package.

These native presets use the same finite definition/command schema as local
modes. They do not enable connectors, widgets, scripts, external writes, or
additional operational-package capabilities.

## Fast path

1. Extract `skin-creator-kit.zip` to a writable folder.
2. Open `studio.html` for an offline color-only skin, or copy `starter-skin` to
   a new folder for custom artwork and an optional operational work mode.
3. Give the skin a unique ID, name, creator, and license.
4. Check and build it with Python 3.9 or later:

   ```powershell
   py build_skin.py my-skin --check
   py build_skin.py my-skin my-skin-1.0.tahaiskin
   ```

5. In TAHAI, open **Skin packages**, select **Review local file**, choose the
   package, review it, then install and apply it. An operational skin then
   shows its modes in this manager; activate one with its explicit button.

The builder never edits the source folder and refuses to overwrite an existing
package. The browser performs a second, sandboxed validation at import time.

## Package layout

The native package review and install confirmation show the verified signing
key ID, its public-key SHA-256 fingerprint and the operational capabilities
declared by the reviewed package. Compare the fingerprint through an independent
trusted channel. This verifies a key under mandatory policy or explicit local
enrollment (the review identifies which), not the
creator's self-described real-world identity. Installing is separate from
activation and does not grant website data, credentials or external actions.
Changing publisher policy clears the review and invalidates its install token;
restoring policy does not revive that old review. Appearance-only packages are
explicitly labelled as having no verified operational publisher authority.
Production publisher approval, independent security review and end-to-end
runtime acceptance remain release gates; this display does not replace them.

For local creators without managed publisher policy, open **Manage local
publisher trust** in the package manager. Paste only the public Ed25519 key and
its signing ID, review the fingerprint and confirm. Never paste a private PEM
or private raw key. Key review alone grants nothing. The list is regular-profile
local, limited to 32 keys and not synced. Revoke a key (or explicitly clear all
local trust) to invalidate its authority without deleting archives or run
history. Changing an ID's key requires revoking the old entry first.
Mandatory policy overrides the local list completely, even if its value is
empty or malformed; local enrollment is then disabled. Retained local keys are
suspended, not erased. They can still be revoked locally, and return to use
after policy removal only through fresh signature verification. Local key
management never edits enterprise policy or imports keys from a skin.

`.tahaiskin` is a ZIP archive containing files only. It has one top-level
manifest and one or more declared image assets:

```text
manifest.json
assets/preview.png
assets/rail-decoration.webp   # optional
```

Use `build_skin.py`; generic ZIP tools commonly add directory entries that
TAHAI rejects. The builder recalculates asset SHA-256 values and writes a
reproducible archive with only declared entries.

## Manifest contract

`manifest.json` permits exactly these top-level fields for an appearance skin:

```json
{
  "schema_version": 1,
  "id": "my-skin",
  "name": "My Skin",
  "creator": "Example Studio",
  "license": "CC-BY-4.0",
  "compatibility": {
    "min_chromium_major": 152,
    "max_chromium_major": 152
  },
  "appearance": {
    "density": "comfortable",
    "reduced_motion": false,
    "light_tokens": {},
    "dark_tokens": {},
    "high_contrast_tokens": {}
  },
  "assets": []
}
```

Use a lowercase ID of 3–64 characters: letters, digits, and interior hyphens.
Keep the ID unchanged when publishing an update. `name`, `creator`, and
`license` are required, plain ASCII metadata of 1–128 characters. Do not use
quotes, backslashes, angle brackets, markup, or control characters.

Set the compatibility range to every Chromium major version you actually test.
The shipped starter is intentionally scoped to 152 so an untested package is
not silently accepted by a newer browser.

## Operational work modes (v2)

To let a skin define a browser work mode, set `schema_version` to `2` and add
one `operational` object. Keep every other appearance and asset field exactly
as described above. Copy `operational-starter-skin` from the creator kit for a
buildable template, or consult `OPERATIONAL_SKIN_V2.md` and
`operational-skin-v2.example.json` for the full reference.

An operational mode may select `one`, `dual`, `tri`, or `quad` layout; an
`icons`, `expanded`, or `hidden` rail; and a TAHAI start surface. Its action
list is closed: it can focus the address bar, open the Finder, saved
workspaces, Mission Control, Guard, or supported layouts. It cannot name a
site, run code, inject page content, access files, or change security settings.

An operational surface may also use `rail_modules` to order one to five of the
native `tabs`, `saved-workspaces`, `bookmarks`, `history`, `downloads`,
`mission`, `local-oi`, `command-center`, and `guard` controls. This is
window-local presentation only: a skin cannot add a panel, register a command,
attach a URL, or persist the rail selection. Omit the field to retain the
compiled rail for the chosen work mode.
The user must activate the mode from **Skin packages**. TAHAI verifies all
commands are available before beginning. If a later browser command fails, it
stops and reports the failure; it never attempts to replay or compensate for a
completed browser action. A successful activation opens Mission Control through
a one-shot local handoff, which creates a revision-pinned checklist with inert
workflow labels. It does not execute a workflow step or retain the archive.
Operational packages additionally require an explicitly trusted Ed25519 publisher
anchor and detached envelope; see `OPERATIONAL_SKIN_V2.md`. The current
authoring kit can emit that envelope only when given an approved Ed25519 PEM
key and its trusted signing ID:

```powershell
py build_skin.py my-operational-skin my-operational-skin.tahaiskin `
  --signing-key release-ed25519.pem --signing-key-id enterprise-2026
```

The key remains local to the signing workstation; the resulting archive
contains only the key ID and 64-byte signature. The package will still be
rejected unless the browser profile has the matching mandatory public-key policy
or explicitly enrolled local public key. The builder prefers the local Python `cryptography` Ed25519
backend and falls back to OpenSSL; use `--signer-backend openssl` when a
controlled signing workstation requires that implementation.

## Colors and accessibility

Each of `light_tokens`, `dark_tokens`, and `high_contrast_tokens` must contain
all ten lowercase `#rrggbb` colors:

```text
shell_background       toolbar_background   toolbar_foreground
tab_background         tab_foreground       rail_background
rail_foreground        accent               panel_background
panel_foreground
```

`density` is either `comfortable` or `compact`; `reduced_motion` is a boolean.
The toolbar, tab, rail, and panel foreground/background pairs must each meet a
4.5:1 contrast ratio. The Studio reports contrast while you edit, and the
builder and browser reject insufficient contrast.

## Artwork rules

Declare one to sixteen image files in `assets`. Every asset has exactly
`path`, `sha256`, and `purpose`; the builder fills the hash.

```json
{
  "path": "assets/preview.png",
  "sha256": "filled-by-build-skin",
  "purpose": "preview"
}
```

- Paths start with `assets/`, use lowercase letters, digits, `.`, `_`, `-`, and
  `/`, and end in `.png` or `.webp`.
- Paths cannot include `..`, backslashes, percent escapes, colons, empty
  segments, trailing dots, Windows device names, or duplicate names.
- Include exactly one `preview`; optional additional images use
  `shell-decoration`.
- Images are still PNG or WebP, each no larger than 4 MiB and 2048 × 2048.
- Total encoded assets are at most 8 MiB; the complete archive is at most
  9 MiB. The browser also limits decompression to 100:1 and decoded imagery to
  32 MiB total.

Shell decoration is displayed in a separate, noninteractive rail slot. Never
design it as a background for text or controls. Animated formats, SVG, HTML,
CSS, JavaScript, URLs, undeclared members, symbolic links, encrypted ZIPs, and
active content are rejected.

## Review and lifecycle

Review shows the package metadata and artwork before installation. **Try for
30 seconds** previews it without persisting settings; **Revert** restores the
saved appearance. Install updates retain one prior revision. Review that
revision to restore it, or use **Reset browser appearance** to return to the
native default. **Export reviewed skin** writes the exact reviewed archive.

Replacing an installed archive (including rollback) first reads and separately
sandbox-decodes the exact current revision. The native review shows both archive
SHA-256 values, each signing identity verifiable under current managed policy,
and added/removed capabilities. A changed signing key is explicitly warned
about. A historical key no longer verifiable under policy is labelled as such;
its archive may be compared but cannot acquire operational authority. A rollback
candidate itself must still pass current trust policy.

The read-only, keyboard-selectable definition comparison shows every changed
JSON value, including layouts, mode actions, workflow steps, input types/privacy,
asset hashes and appearance. Paths use JSON Pointer escaping (`~0` for `~`,
`~1` for `/`) and zero-based array positions; ordering changes are visible.
`<absent>` means a field or array entry does not exist on that side. Formatting
or signature-only changes may have no parsed-definition differences, so the
archive hashes and signing identities must still be reviewed. No run values,
website contents or profile data enter this comparison.

Check the revision-review acknowledgement and confirm installation separately.
The browser binds that acknowledgement to both exact hashes and the transient
review token. Cancellation, a new candidate, closing the manager or a policy
change discards it. The store rejects a commit if the installed revision changed
after review. Missing/corrupt/incompatible installed archives or comparison
limits block the review; changes are never silently truncated. Installation
retains one prior revision but does not apply the package, migrate pinned runs
or authorize external capabilities. A byte-identical reimport is a no-op and
does not consume or replace the retained rollback revision.

Skins are profile-local. Private windows cannot install one, and managed policy
can disable skins or package installation. OS forced colors always take
precedence.

## Troubleshooting

Release verification uses `test_build_skin.py --release-gate -v`: all creator
tests must run without skips, including generated-key Ed25519 signing, modified
payload rejection and wrong-key rejection. The release runner accepts
`-CreatorPython` for a signing-capable interpreter without changing Chromium's
build interpreter or configuration. Ordinary dependency-free author checks can
still skip the optional Python signing test; that is not release evidence.
The OpenSSL signing backend is noninteractive, time-bounded and hidden on Windows;
it cannot prompt for an encrypted key while running in the background.

- Run `py build_skin.py my-skin --check` first; it reports field, contrast,
  path, archive, and PNG errors.
- Confirm the package’s compatibility range includes the Chromium major at
  `chrome://version`.
- Rebuild after every asset edit so hashes update.
- If browser import fails after a successful local check, inspect image
  encoding, image dimensions, ZIP encryption, and unsupported WebP animation.
  A rejected import never replaces the installed revision.
