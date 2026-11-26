# Contributing to GVI

Thanks for your interest in improving GVI. This guide covers how to get set up
and the conventions the project follows. By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requires **Node 20+**. No API keys are needed to develop — everything runs in
mock mode.

```bash
# backend  →  ws://localhost:8787
cd server && npm install && npm start

# frontend →  http://localhost:5173   (second terminal)
cd web && npm install && npm run dev
```

Both packages are independent (their own `package.json`). Type-check each
before opening a pull request:

```bash
cd web    && npx tsc --noEmit
cd server && npx tsc --noEmit
```

The frontend also lints with `npm run lint` (oxlint).

## Branching & pull requests

- **Never commit directly to `main`.** Branch for every change:
  `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `chore/…`.
- Open a pull request into `main`. Keep it focused — one concern per PR.
- Make sure both type-checks pass, and verify UI changes in the browser
  (the scene is visual; a screenshot in the PR helps).
- Squash or keep history tidy; delete the branch after merge.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope:

```
feat(web): pull the needed organism toward the core
fix(server): guard against a missing deadline in the monitor beat
docs: add contribution guide
```

One logical change per commit. Explain the *why* in the body when it isn't
obvious. If a commit was co-authored by an AI agent, keep the trailer the
agent adds (e.g. `Co-Authored-By: …`).

## Code style

- **Comment the *why*, not the *what*.** The code says what it does.
- Prefer small, composable helpers over duplication.
- Keep the visual/design system restrained and consistent — color carries
  meaning (gold = actionable, red = flagged, cool = far/safe); motion means
  work. Don't add decoration that doesn't carry information.
- Match the surrounding style; no drive-by reformatting.

## For AI coding agents

This repository carries its own persistent memory and operating protocol in
[`.context_ledger/`](.context_ledger/). If you are an AI agent working here,
**start by reading [`.context_ledger/kickoff.md`](.context_ledger/kickoff.md)
and follow it**: read the ledger (sessions, tasks, decisions, preferences),
check in, do the work, update the memory, and commit. Ledger-only commits use
the `chore(ledger):` scope. The condensed rules also live in
[`AGENTS.md`](AGENTS.md).

## Reporting bugs & proposing features

Open an issue describing what you expected, what happened, and how to
reproduce it. For features, describe the problem first — the "so what" — not
just the solution.
