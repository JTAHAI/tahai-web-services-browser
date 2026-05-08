# PASS128 — Guide / Mission Small-Window / Tri-view Hardening

PASS128 hardens three operator-reported release blockers before the KB conversion work:

- Keeps Guide / future KB access first-class when responsive toolbar overflow moves the full Guide button into More Tools. A compact Guide anchor appears beside More Tools instead of burying the entry point.
- Makes Mission Control resilient in small windows by marking compact viewport mode, using a safe showModal/show/open fallback, reducing nonessential chrome, and keeping the Mission panel scrollable.
- Replaces the single ambiguous 3-Up control with explicit 3-Up Top and 3-Up Bottom entries, while preserving the legacy command and existing tri-view variant support.

Version remains 1.8.30.
