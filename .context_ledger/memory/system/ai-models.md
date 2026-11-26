# Agent + Model Registry (update in place)

Which agents and models have worked on this repo — and what they've
shown they can and can't do here. Update your row each session (last
seen + session count); add a row only if this **(agent, model) pair** is
new. The Observations section is how the user learns which agent to hand
which task, and how agents learn a predecessor's blind spots (and verify
its work accordingly).

> **Update in place — do NOT append a duplicate.** This is not an
> append-only log. There is exactly one row per (agent, model) pair: to
> correct a count, model note, or date, **edit that row** — its prior value
> is safe in git history, so you lose nothing. Never add a second row for a
> pair that already exists (that is how a registry ends up with two rows
> and conflicting counts). Different models for the same agent are separate
> rows — that is expected, not a duplicate. `sh .context_ledger/core/bin/ledger-mem
> check` (Windows: the `.ps1`) flags a duplicated (agent, model) key.

| Agent | Model | First seen | Last seen | Sessions |
|---|---|---|---|---|
| Claude Code | claude-opus-4-8 | 2026-11-26 | 2026-11-26 | 1 |

## Observations

Concrete, evidence-based capabilities and limits — things demonstrated
in this repo's sessions, not marketing claims or self-assessment.
Update in place when a newer session contradicts an old observation.

- **Claude Code / claude-opus-4-8:** Rebuilt the GVI UI from a dashboard into a canvas "living presence" (hand-written requestAnimationFrame scene) and bootstrapped this ledger; both `web` and `server` typecheck clean, verified live in the in-app browser. (2026-11-26)
- **Claude Code / claude-opus-4-8:** The in-app browser pane does not flush its console buffer across HMR/navigations, so stale errors referencing deleted symbols persist — the rendered screenshot is the source of truth, not the console log. (2026-11-26)
