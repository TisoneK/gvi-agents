# GVI — Global Value Intelligence

An autonomous, multi-agent system that continuously discovers, investigates,
verifies, evaluates and develops strategies around ways to capture economic
value — airdrops, bounties, grants, incentive programs, arbitrage and the like
— and surfaces the few that are worth acting on **right now**.

The interface is not a dashboard. It's a **living presence**: a dark world with
one breathing entity at its center that hunts on your behalf. Opportunities are
organisms whose heartbeat is their urgency; they drift toward the core as their
deadline approaches, warm from cool steel to gold as they close, and are pulled
in and *banked* when you claim them. State is shown by behavior, not labels.

> **Status:** working prototype. Runs end-to-end out of the box in **mock
> mode** (no API keys), and flips to live reasoning + web search + Telegram
> alerts when you add keys.

---

## How it works

GVI is two processes that speak over a WebSocket, plus a disciplined data model.

### The autonomous backend (`server/`)

A Node + TypeScript service (zero native dependencies) that runs six agents
continuously against a shared, **event-sourced** store:

| Agent | Role |
|-------|------|
| **Hunter** | Crawls value surfaces and discovers new opportunities |
| **Researcher** | Maps the payer, the mechanism and the evidence |
| **Verifier** | Red-team vs blue-team — verified or flagged |
| **Evaluator** | Scores risk-adjusted value; promotes to *actionable* |
| **Strategist** | Finds opportunities that compound when stacked |
| **Monitor** | Watches deadlines; warns on decay; expires the dead |

Everything the agents do is appended to `events.jsonl` (an append-only log);
the opportunity graph is a replayable projection of that log, and research
findings are written as auditable notes. The backend broadcasts a small
[wire protocol](server/src/types.ts) of events to any connected client.

- **Provider-agnostic reasoning.** An `LLMProvider` interface with an Anthropic
  adapter and an OpenAI-compatible adapter (works with OpenAI, OpenRouter,
  Together, Groq, Ollama, vLLM, … via `OPENAI_BASE_URL`). A mock provider keeps
  the full pipeline running with no keys.
- **Pluggable search.** A `SearchProvider` interface with a Tavily adapter and a
  mock. Alerts can be pushed to **Telegram**.

### The living presence (`web/`)

A React + Vite + TypeScript app with a hand-built HTML-canvas renderer (its own
`requestAnimationFrame` scene — no chart library). It connects to the backend
over WebSocket and, if the backend is offline, falls back to an in-browser
simulation so the view is never blank. Scroll to zoom, drag to pan, click an
organism to have the presence explain it.

---

## Quick start

Requires **Node 20+** (developed on Node 24). No API keys needed for mock mode.

```bash
# 1. the autonomous backend  →  ws://localhost:8787
cd server
npm install
npm start

# 2. the presence  →  http://localhost:5173   (in a second terminal)
cd web
npm install
npm run dev
```

Open http://localhost:5173. The scene comes alive in mock mode immediately.

### Going live

Copy the example env and add the keys you have — each is optional and the
system degrades gracefully to mock for anything missing:

```bash
cd server
cp .env.example .env
# edit .env, then restart `npm start`
```

See [`server/.env.example`](server/.env.example) for every variable (Anthropic
**or** any OpenAI-compatible endpoint for reasoning, Tavily for search, a
Telegram bot token + chat id for alerts, plus tuning knobs).

---

## Project layout

```text
gvi-agents/
├── web/                 React + Vite frontend (the living presence)
│   └── src/
│       ├── Presence.tsx   the canvas scene — core, organisms, threads
│       ├── Queue.tsx      the floating action queue (collapsed/peek/expanded)
│       ├── Voice.tsx      the presence's first-person line
│       ├── store.ts       mutable render store (the canvas reads it per frame)
│       └── wsClient.ts    WebSocket client + sim fallback
├── server/              Node + TypeScript autonomous backend
│   └── src/
│       ├── orchestrator.ts  the six agents
│       ├── store.ts         event-sourced store + projection
│       ├── llm.ts           provider-agnostic reasoning
│       ├── search.ts        pluggable search
│       └── server.ts        HTTP health + WebSocket server
├── .context_ledger/     persistent, repo-native agent memory (see CONTRIBUTING)
├── AGENTS.md · CLAUDE.md  entry points for AI coding agents
├── CONTRIBUTING.md · CODE_OF_CONDUCT.md
└── LICENSE
```

---

## Tech stack

- **Frontend:** React 18, Vite, TypeScript, canvas 2D, `lucide-react`.
- **Backend:** Node + TypeScript via `tsx`, `ws`, `@anthropic-ai/sdk`; the
  OpenAI-compatible and Telegram integrations use plain `fetch` (no extra deps).
- **Data:** event-sourced JSONL log + in-memory projection; no database.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the dev
setup, branch/PR flow and commit conventions, and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). AI coding agents should start by
reading [`.context_ledger/kickoff.md`](.context_ledger/kickoff.md).

## License

[MIT](LICENSE) © 2026 Tisone Kironget
