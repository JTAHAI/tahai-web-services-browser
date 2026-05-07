# PASS 38 — Credential Boundary Hardening

- Added a shared credential boundary module with strict UUID IDs, URL normalization, note-secret rejection, max record limits, reveal TTL, and clipboard expiration constants.
- Hardened the local credential vault so records remain OS-encrypted through Electron safeStorage, renderer-visible vault paths are reduced to a safe label, copied passwords auto-clear from the clipboard when unchanged, and reveal results expire after 20 seconds.
- Guarded credential IPC with a first-party file-shell sender check before listing, saving, deleting, copying, or revealing vault records.
- Updated Credential Manager UX copy to make the local-only boundary explicit and auto-clear revealed secrets from the form.
- Added pass verifier wiring for credential boundary regression checks.
