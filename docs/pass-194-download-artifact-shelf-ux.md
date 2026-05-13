# PASS194 — Download and Artifact Shelf UX

PASS194 turns download status from a one-line browser event into an operator-facing artifact shelf.

## What changed

- Download events now carry a stable artifact identifier instead of a filesystem path.
- Renderer download status includes sanitized filename, source origin, risk label, handoff relation, and SHA-256 when the completed file can be hashed.
- Completed downloads can be revealed in their folder through a main-process-only action; the renderer receives only an artifact ID.
- Executables/installers remain high risk, archives and disk images are elevated risk, and normal files remain low risk.
- The status bar now includes a compact Artifact Shelf pill for the latest download.

## Security posture

The renderer still never receives local download paths. Remote web content cannot call the reveal action because the IPC handler is available only through the trusted shell preload bridge and uses the existing trusted shell IPC guard. Source URLs are reduced to safe origins before display. Checksums are safe metadata and are available only when the completed file can be read by the main process.

## Operator behavior

The shelf is intentionally compact. It shows the latest download first and retains recent download metadata in memory for quick handoff review. “Folder” reveals the completed file in the OS shell without exposing its path to the renderer or to remote content.

## Verification

Run:

```powershell
npm run verify:pass-194-download-artifact-shelf-ux
```

This verifier checks the artifact shelf UI, risk/checksum payloads, safe reveal IPC, local path non-exposure, and release-blocker registration.
