# Downloads and installers

**Screenshot target:** `docs/kb/screenshots/16-downloads-installers.png`

## Screenshot capture checklist

- **File to add later:** `16-downloads-installers.png`
- **Capture:** Capture the downloads or installer surface showing package choices and checksum context.
- **Must show:** Windows/Linux package options if visible; Checksum or verification language; Signing/preview posture if visible
- **Avoid:** Local filesystem paths; Unsigned installer warning screens unless intentionally documenting them

## What this feature does

The downloads/installers surface should make Windows and Linux package choices clear, including checksums and known signing status.

## How to use it

Use checksums for package verification. Linux RPM/AppImage/DEB handoff manifests are build outputs, not source files.

## Safety notes

- Keep secrets, tokens, cookies, runtime browser profiles, generated installers, and local data out of source.
- IT Docs and PSA references remain browser-side display/context unless a server-authorized workflow exists.
- Treat Mission files and exported evidence as untrusted until validated and redacted.
