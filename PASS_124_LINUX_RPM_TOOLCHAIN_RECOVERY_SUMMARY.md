# PASS124 — Linux RPM Toolchain Recovery Guard

Version remains `1.8.30`.

PASS124 hardens the Linux RPM packaging operator surface after a Fedora WSL split-brain failure where `npm` was present but the Linux-native `node` binary was missing.

- Adds PASS124 repair messaging to `scripts/build-linux-installers.sh`.
- Adds `scripts/diagnose-linux-rpm-toolchain.sh`.
- Adds `npm run diagnose:linux:rpm-toolchain`.
- Adds `verify:pass-124-linux-rpm-toolchain-recovery`.
