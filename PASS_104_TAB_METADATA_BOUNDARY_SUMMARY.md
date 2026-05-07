# PASS104 — Tab Metadata Boundary

PASS104 hardens live tab/page metadata before it can become renderer status text, Mission timeline content, Mission tab metadata, or Mission evidence.

## Hardened surfaces

- Remote `page-title-updated` values are sanitized before tab display.
- Status-bar message/detail strings are sanitized before renderer display.
- Mission tab titles are sanitized before local Mission state persistence.
- Mission metadata URLs are sanitized through a shared browser/evidence URL boundary before local Mission handoff.
- Mission evidence title, URL, note, and metadata records are sanitized before insertion into Mission evidence.
- Mission timeline event title/detail fields are sanitized before insertion.

## Blocked / neutralized metadata risks

- Control characters and null bytes.
- Bidirectional text spoofing controls.
- Overlong titles/status strings.
- Secret-like values and auth/header/token patterns.
- Embedded URL credentials.
- Tokenized sensitive query values before Mission handoff.

## Guardrail

Remote page metadata is treated as hostile display/input data. It may be useful for the operator, but it is not trusted as safe Mission evidence, local Mission JSON, or export-ready handoff content.
