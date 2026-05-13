# PASS245 — Mission Control Card Scroll Closeout

Final Mission Control visual polish for end-user visible card cutoffs.

Fixed surfaces:

- Mission recipe cards now reserve enough bottom space for the launch pill and allow long recipe descriptions to scroll internally.
- Evidence Pack v2 preview/redaction blocks now use internal scroll instead of clipping text.
- Evidence panel itself can scroll when maximized/restored geometry leaves less vertical room.
- Runbook and evidence inputs remain inside their cards without hidden overflow.

Scope: renderer CSS and verifier only. No backend, IPC, storage, security, or packaging changes.
