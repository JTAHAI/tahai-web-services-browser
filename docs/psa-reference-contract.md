# PASS 42 — PSA reference contract

TAHAI Web Services Browser treats PSA data as browser-side reference metadata only.

## Allowed browser state

- Provider label or enum.
- Opaque ticket/change identifier.
- Safe display key.
- Safe ticket/change title.
- Safe status display.
- Validated HTTPS deep link with no embedded username, password, fragment, token, cookie, or authorization header.

## Forbidden browser state

- PSA API keys.
- OAuth refresh tokens.
- Client secrets.
- Bearer tokens.
- Cookie headers.
- Authorization headers.
- Provider tenant credentials.
- Direct browser-to-PSA fetch/writeback code.

## Writeback rule

The browser may prepare a PSA ticket/change note draft, but writeback must route through TAHAI IT Docs server-side connector authority. IT Docs must authorize user, org, provider, ticket/change object, and write capability on every request.

## Local-only behavior

When IT Docs does not report PSA provider capabilities, the PSA lane remains a local draft/reference surface. The user can copy or save a sanitized handoff, but the browser does not contact PSA vendors.
