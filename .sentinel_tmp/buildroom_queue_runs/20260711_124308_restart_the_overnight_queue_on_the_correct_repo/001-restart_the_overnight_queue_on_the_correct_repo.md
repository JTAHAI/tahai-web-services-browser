MAINELY CODE WINDOWS DESKTOP BUILD PROMPT

STRUCTURED WORK ORDER
TARGET REPO: D:\dev\browser\app
MISSION: restart the overnight queue on the correct repo
MODEL: qwen2.5-coder:32b
MODEL LOCK: qwen2.5-coder:32b. No silent fallback.
ROUTE: Black Bear Heavy Lift / Tri-lane dry-run / Coding WSL primary lane qwen2.5-coder:32b
PASS BUDGET: minimum 50 passes; target 100 passes; max 100 passes. Run 50-100 passes because this request is framed as a queue, overnight, or long-run task.
OWNED PATH HINTS:
- Treat D:\dev\browser\app as the target repo root and narrow to concrete source files before mutation when possible.
- Keep generated, dist, release, runtime, import, and .git paths blocked unless the approved packet explicitly allows them.
REQUIRED VERIFICATION COMMANDS:
- cd /d "D:\dev\browser\app" && npm run validate
- git diff --check

User request:
restart the overnight queue on the correct repo

Interpretation rules:
- The user supplied a simple prompt. Infer the smallest useful build scope, keep the implementation practical, and make reasonable defaults visible before acting.
- Assume the user may not know file names, frameworks, packaging steps, or exact test commands; discover those from the repo and fill gaps safely.
- Accept complex input as authoritative when it is specific. Do not erase explicit user constraints while expanding the prompt.
- Prefer a Microsoft Windows native desktop application path over browser/web UI work when the request touches app experience, installability, launchers, or packaging.

Companion/work-style routing:
- Selected companion: Black Bear Heavy Lift (Capacity muscle).
- Purpose: Coordinates big runs, queues, workers, and long-running lane plans.
- Route explanation: Prompt requested Black Bear Heavy Lift explicitly.
- App route mapping: tri-lane/queue/worker-fabric/long-run.
- Execution mode: dry-run/queue unless explicit apply gate passes.
- Model: qwen2.5-coder:32b.
- Model plan: Qwen3-Coder Heavy 30B for local coding runs and long-run queue builds; Qwen2.5-Coder ME Cloud 32B only after internal entitlement proof.

Lane controls:
- Selected lane profile: Tri-lane dry-run.
- Enabled lanes: primary local, optional GPU candidate, CPU verification.
- Primary runtime lane: WSL-first using qwen2.5-coder:7b. This is the default run path until the heavier GPU/model lanes are proven current.
- Primary lane: on. GPU candidate lane: on. CPU/WSL verification lane: on. LAN worker lanes: off.
- Bigger-model output is proposal-only until operator approval. WSL verification remains authoritative for final proof.
- Hardware lane policy: single lane uses the WSL primary path with model qwen2.5-coder:32b; dual lane uses optional WSL-visible GPU lanes with model qwen2.5-coder:14b; tri-lane uses optional WSL-visible GPUs plus CPU with model qwen2.5-coder:14b.
- Selected hardware lanes: GPU1 off, GPU2 off, WSL/CPU on. Dual-lane coding: on. Auto-select hardware: on.
- Windows and WSL may swap GPU0/GPU1. Treat WSL-visible VRAM ranking as authoritative for WSL/Ollama lane launch, but show both maps to the operator.
- If dual or tri-lane is requested, verify or launch each selected hardware path from the Windows app and report per-lane proof rather than assuming it is alive.
- If the user does not specify owned files, treat the approved write scope as repo-wide source ownership with blocked/generated/release/runtime paths excluded by the packet.

Memory controls:
- Repo memory: on. Session memory: on. Learn from accept/reject decisions: on. Client Privacy Mode: off.
- Project Memory is on for this repo. Mainely Code can use this repo's saved preferences and record approved feedback locally.
- Cloud memory: disabled/gated until entitlement and explicit repo approval.
- Studio shared memory: disabled/gated until team entitlement and operator approval.
- If memory is disabled, do not read memory, write memory, inject a preference brief, sync cloud memory, promote studio/team memory, or learn from this repo.

Required build behavior:
- First restate the interpreted requirement in plain language so a non-technical user can approve or reject it.
- List owned files, read-only context, blocked files, rollback target, and acceptance gates before applying changes.
- If the request is too broad, reduce it to the smallest useful first build slice and make the deferred work explicit.
- Never touch blocked, generated, release, runtime, import, or .git paths unless the approved scope explicitly allows it.
- Prefer real Windows install/publish proof for desktop-app work: build the native app, preserve installer scripts, and report the exact publish/install command.

Required proof:
- Report changed files and why each changed.
- Run the narrowest relevant tests/builds first, then the native desktop build when desktop surfaces are changed.
- If any test or build cannot run, state why, classify the blocker, and give the next safe action.
- Do not claim the app is installable unless a Windows publish/install path is present and has been checked.

CONTINUOUS RUN CONTRACT
- Run as a governed multi-pass queue for up to 12 hour(s).
- Keep iterating on the same target repo until a visible stop, no-progress, hard blocker, or time cap ends the run.
- Re-read repo truth between passes, verify each mutation, and keep proof human-readable inside Buildroom.
- Do not silently fall back to a different model, widen blocked scope, or treat a single green patch as the end if meaningful repo upgrades remain.
