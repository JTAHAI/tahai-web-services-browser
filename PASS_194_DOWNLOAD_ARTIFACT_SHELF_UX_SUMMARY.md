# PASS194 — Download and Artifact Shelf UX

Status: source hardening complete.

## Fixed

- Added artifact IDs for downloads so the renderer can reference a completed artifact without learning the local filesystem path.
- Added SHA-256 calculation for completed downloads when the saved file is readable by the main process.
- Added download risk levels and labels for executable/installer, archive/disk-image, and normal downloads.
- Added a compact status-bar Artifact Shelf showing filename, source origin, risk, checksum when available, and evidence/handoff relation.
- Added a trusted-shell-only “Folder” action that reveals completed downloads from the main process without exposing local paths to renderer state.
- Added PASS194 verifier and release-blocker wiring.

## Not claimed

This pass does not certify installed Windows or Linux behavior. It hardens the source path and verifier. Installed-app proof remains a local/manual gate.
