# PASS111 — Release Blocker Build Phase Ordering

The release-blocker chain must not run source ZIP/generated-artifact checks after the build step creates `dist/` as legitimate build output.

PASS111 makes the chain deterministic:

1. Static source and security verifiers run first.
2. PASS105–PASS111 handoff/source/gate verifiers run next.
3. `npm run build` runs last.

This preserves local developer verification and prevents false failures after dependency install or TypeScript build output generation.
