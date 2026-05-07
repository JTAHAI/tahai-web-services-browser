# PASS103 — Diagnostics SSRF Boundary

PASS103 hardens the PASS102 cookie-free diagnostics lane so operators do not have to manually chase DNS and subnet edge cases before running browser-side Ops diagnostics.

## Hardening added

- Added public-routability scope checks for diagnostics targets before any HEAD request is sent.
- Blocks localhost, single-label intranet names, `.local`, `.lan`, `.home.arpa`, and `.internal` diagnostic targets.
- Blocks RFC1918/private IPv4 ranges, loopback, link-local, CGNAT, benchmark/documentation ranges, multicast/reserved ranges, and known metadata endpoints such as `169.254.169.254` and `100.100.100.200`.
- Blocks IPv6 loopback, unspecified, unique-local, link-local, multicast, documentation ranges, and IPv4-mapped private addresses.
- Performs DNS preflight with `dns.lookup(hostname, { all: true, verbatim: true })` and fails closed if any resolved address is local/private/link-local/metadata/reserved.
- Keeps diagnostics redirect-safe: redirects are not followed, and unsafe `Location` targets are blocked or withheld from renderer output.
- Extends IT Service Card DNS snapshots with the same host/address boundary so private split-DNS results do not get treated as approved public-route data.

## Verification

- `npm run verify:pass-103-diagnostics-ssrf-boundary`
- Wired into `npm run verify:release-blockers`

## Operator impact

The browser now fails closed for risky diagnostics targets instead of asking the operator to reason through subnet tables, metadata service aliases, DNS rebinding, or local/private redirect traps.
