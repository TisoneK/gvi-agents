# Active Workflow (overwrite when the workflow changes)

The workflow currently in force for this repo — which protocol edition
agents follow and the standing session parameters. Update only when the
user changes the rules; note the change in your session entry.

- **Protocol:** by agent type — local agents → .context_ledger/core/rules/ai-engineering-protocol-local.md; cloud/sandbox agents → .context_ledger/core/rules/ai-engineering-protocol.md
- **Protocol location:** on disk — vendored in `.context_ledger/core/` (no network fetch needed; version in `.context_ledger/core/VERSION`, last verified in `../core.lock`)
- **Package upstream (for flaw back-ports + core updates):** https://github.com/TisoneK/context-ledger.git
- **Since:** 2026-11-26
- **Default role:** engineer — unless a session says otherwise; see .context_ledger/core/roles/
- **Scope:** feature work + review + fix safe issues
- **Target:** free text — whatever the user names in chat; "start" → general sweep
- **Focus areas:** UX / visual design, architecture, performance, testing
- **Findings handling:** fix safe issues; flag architectural ones for approval
- **Push policy:** feature branch → commit → push → PR → merge → delete branch, carried through autonomously once the work is done (don't ask at each gate); never commit to `main` directly
- **Commit style:** Conventional Commits with scope (e.g. `feat(web):`); `chore(ledger):` for this directory; end commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Commit granularity:** one logical change per commit
- **Deliverable:** working, browser-verified change + chat summary; session review in .context_ledger/memory/office/reviews/
- **Gates:** `.context_ledger/memory/workflows/gates.conf` — checkpoint before each next action; `pre-commit`, `integration`, and `exit` gates are mandatory
