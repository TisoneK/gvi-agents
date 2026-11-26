# User Preferences (update in place)

How the user likes things done **on this project**. Seeded from
Pre-Flight at bootstrap; grows as sessions reveal preferences —
corrections the user gives, patterns they approve, things they state
outright. This file exists so the user never has to give the same
correction twice.

## Learning rules

1. **Record preferences, not instructions.** A preference is standing:
   it would apply to future sessions ("plain-language changelog
   entries"). An instruction is one-off ("skip the tests this once") —
   it dies with the session and does not belong here.
2. **Every bullet carries provenance** — how and when it was learned:
   `(pre-flight)`, `(stated, YYYY-MM-DD)`, `(correction, YYYY-MM-DD)`,
   `(approved pattern, YYYY-MM-DD)`. An explicit statement or correction
   outranks an inferred pattern.
3. **Current-state file.** When the user changes their mind, update the
   bullet in place and refresh its provenance — don't keep the stale
   version. History lives in the session log, not here.
4. **A session instruction beats a recorded preference for that
   session.** Follow the instruction; afterwards, if it looked like a
   standing change of mind, update this file.
5. **Committed to git — keep it professional.** Working-style facts
   only. Never personal details, never opinions about people, never
   credentials.

## Workflow

- Feature-branch flow, never commit straight to `main`: branch → commit → PR → merge → delete the merged branch (approved pattern, 2026-11-26)
- Commit / push / open-PR only when explicitly asked, not automatically (approved pattern, 2026-11-26)
- Verify a change working in the real app (browser/live) before committing; show screenshots (approved pattern, 2026-11-26)

## Communication

- Wants a direct, honest verdict with real critique — say what is weak, not a sales pitch; "does this look good to you?" expects a genuine answer (stated, 2026-11-26)

## Code style

- Comment the *why*, not the *what*; keep a clear, restrained visual/design system (approved pattern, 2026-11-26)

## Review depth

- Treats a review/critique as a **diagnosis, not a checklist** — do not mechanically implement a review's bullet list or patch the previous version; restart from the vision/behavior (correction, 2026-11-26)

## Risk & approvals

- For a big redesign, restate the vision and the "first 10 seconds" in your own words and get sign-off before building (correction, 2026-11-26)
- Design intent for the GVI UI: a living presence, not a dashboard — state shown by behavior not labels; gold-on-ink palette; wants "out of the box", not website-like (correction, 2026-11-26)
