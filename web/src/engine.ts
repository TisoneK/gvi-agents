import { store, KIND_COLOR, STATE_COLOR, uid } from "./store";
import type { GNode } from "./types";

// The SimEngine produces a continuous stream of intelligence activity — the
// stand-in for the real autonomous backend (same store, same event shapes).
// Every opportunity carries real orbit meaning: a value, a deadline, and the
// ecosystem (surface) it belongs to, so the scene reads as a live map of where
// money is and how fast it's expiring.

const rand = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;
const HOUR = 3600_000;

const KNOWN_SURFACES = ["Airdrops", "Bug bounties", "Public grants", "Arbitrage", "Yield / DeFi", "Retro funding"];
const EMERGENT_SURFACES = ["Depin networks", "Prediction markets", "RWA incentives", "Data markets"];

const OPP_TEMPLATES = [
  "Season {n} reward epoch",
  "{x} testnet incentive",
  "Retroactive round {n}",
  "{x} liquidity program",
  "Critical-severity bounty",
  "Ecosystem grant wave {n}",
  "{x} points campaign",
  "Referral multiplier event",
];
const X_WORDS = ["Nebula", "Orbit", "Vertex", "Helio", "Quanta", "Axiom", "Pulse", "Cobalt", "Zephyr"];

const fillTemplate = (t: string) =>
  t.replace("{n}", String(1 + Math.floor(Math.random() * 7))).replace("{x}", rand(X_WORDS)!);

// a plausible value: mostly small, a few large (log-distributed, ~$120 .. ~$180k)
const randValue = () => Math.round(10 ** (2.1 + Math.random() * 3.2));
// a plausible deadline: ~20% urgent (<24h), most within a month, some perpetual
const randDeadline = (): number | undefined => {
  if (chance(0.35)) return undefined;
  const r = Math.random();
  const hours = r < 0.25 ? 1 + Math.random() * 23 : 24 + Math.random() * 690;
  return Date.now() + hours * HOUR;
};
const pairKey = (a: string, b: string) => [a, b].sort().join("::");

export function startEngine() {
  if (store.nodes.some((n) => n.id === "core")) return () => {};
  store.addNode({ id: "core", kind: "core", label: "GVI" });

  const surfaceNodes: GNode[] = [];
  KNOWN_SURFACES.forEach((name, i) => {
    setTimeout(() => {
      const s = store.addNode({ id: `surface_${i}`, kind: "surface", label: name });
      surfaceNodes.push(s);
      store.ping(s.x, s.y, KIND_COLOR.surface);
    }, 400 + i * 600);
  });

  store.pushAlert("info", "System online — beginning surface survey", "hunter");

  const opportunities: GNode[] = [];
  const emergent = [...EMERGENT_SURFACES];
  const stacked = new Set<string>();
  const timers: number[] = [];

  // ---- Hunter: crawl a surface, surface opportunities ----
  timers.push(
    window.setInterval(() => {
      if (!surfaceNodes.length) return;
      const surface = rand(surfaceNodes)!;
      store.setAgent("hunter", { state: "working", activity: `Crawling ${surface.label.toLowerCase()}` });
      store.ping(surface.x, surface.y, "#f0b545");

      if (chance(0.06) && emergent.length) {
        const name = emergent.shift()!;
        const s = store.addNode({ id: `surface_x_${name.replace(/\s+/g, "_")}`, kind: "surface", label: name });
        surfaceNodes.push(s);
        store.pushAlert("info", `New value surface discovered: ${name}`, "hunter");
      }

      if (chance(0.6)) {
        const opp = store.addNode({
          id: uid("opp"),
          kind: "opportunity",
          label: fillTemplate(rand(OPP_TEMPLATES)!),
          state: "discovered",
          parent: surface.id,
          ecosystem: surface.label,
          value: randValue(),
          deadline: randDeadline(),
          sources: 0,
        });
        opportunities.push(opp);
        store.setAgent("hunter", { bump: true });
      }
      setTimeout(() => store.setAgent("hunter", { state: "idle", activity: "Scanning the landscape" }), 900);
    }, 1500)
  );

  // ---- Researcher: investigate, gather sources ----
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "discovered"));
      if (!target) return;
      store.setAgent("researcher", { state: "working", activity: `Investigating ${target.label}`, focus: target.id });
      store.setNodeState(target.id, "investigating");
      store.ping(target.x, target.y, "#f0b545");
      store.setNodeMeta(target.id, { sources: 1 + (chance(0.5) ? 1 : 0), value: Math.round((target.value ?? randValue()) * (0.8 + Math.random() * 0.6)) });
      store.setAgent("researcher", { bump: true });
      setTimeout(() => store.setAgent("researcher", { state: "idle", activity: "Tracing value sources" }), 1100);
    }, 2100)
  );

  // ---- Verifier: red-team vs blue-team ----
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "investigating"));
      if (!target) return;
      store.setAgent("verifier", { state: "working", activity: `Red/blue on ${target.label}`, focus: target.id });
      store.ping(target.x, target.y, "#f0b545");
      setTimeout(() => {
        if (chance(0.72)) {
          store.setNodeState(target.id, "verified");
          store.pushAlert("verified", `${target.label} — payer confirmed, evidence holds`, "verifier", target.id);
        } else {
          store.setNodeState(target.id, "flagged");
          store.pushAlert("flagged", `${target.label} — failed red-team, source unverifiable`, "verifier", target.id);
        }
        store.setAgent("verifier", { bump: true });
        store.setAgent("verifier", { state: "idle", activity: "Adjudicating claims" });
      }, 850);
    }, 2600)
  );

  // ---- Evaluator: score, maybe promote to actionable ----
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "verified" && o.score == null));
      if (!target) return;
      store.setAgent("evaluator", { state: "working", activity: `Scoring ${target.label}`, focus: target.id });
      store.ping(target.x, target.y, "#f0b545");
      const score = 40 + Math.floor(Math.random() * 60);
      setTimeout(() => {
        if (score >= 78) {
          store.setNodeState(target.id, "actionable", score);
          store.pushAlert("verified", `Actionable — ${target.label} scored ${score}/100`, "evaluator", target.id);
        } else {
          store.setNodeState(target.id, "verified", score);
        }
        store.setAgent("evaluator", { bump: true });
        store.setAgent("evaluator", { state: "idle", activity: "Weighing returns vs risk" });
      }, 800);
    }, 3100)
  );

  // ---- Strategist: connect complementary opportunities (dedup mirror pairs) ----
  timers.push(
    window.setInterval(() => {
      const strong = opportunities.filter((o) => o.state === "verified" || o.state === "actionable");
      if (strong.length < 2) return;
      const a = rand(strong)!;
      const b = rand(strong.filter((x) => x.id !== a.id && x.ecosystem !== a.ecosystem));
      if (!b) return;
      const key = pairKey(a.id, b.id);
      if (stacked.has(key)) return;
      stacked.add(key);
      store.setAgent("strategist", { state: "working", activity: `Stacking ${a.label} + ${b.label}`, focus: b.id });
      store.addEdge(a.id, b.id, true);
      store.ping(b.x, b.y, "#f0b545");
      store.pushAlert("info", `Stack found — ${a.label} compounds with ${b.label}`, "strategist", a.id);
      store.setAgent("strategist", { bump: true });
      setTimeout(() => store.setAgent("strategist", { state: "idle", activity: "Hunting hidden angles" }), 1000);
    }, 4200)
  );

  // ---- Monitor: watch deadlines, decay / expire ----
  timers.push(
    window.setInterval(() => {
      const live = opportunities.filter((o) => o.state === "verified" || o.state === "actionable");
      store.setAgent("monitor", { state: "working", activity: `Watching ${live.length} live opportunities`, focus: live[0]?.id });
      if (live.length && chance(0.5)) {
        const t = rand(live)!;
        if (chance(0.55)) {
          store.pushAlert("decaying", `${t.label} closing soon — still unclaimed`, "monitor", t.id);
          // pull its deadline inward so it visibly drifts toward the core
          store.setNodeMeta(t.id, { deadline: Date.now() + (2 + Math.random() * 18) * HOUR });
        } else {
          store.setNodeState(t.id, "expired");
          store.ping(t.x, t.y, STATE_COLOR.expired);
        }
      }
      setTimeout(() => store.setAgent("monitor", { state: "idle", activity: "Tracking deadlines" }), 1200);
    }, 3800)
  );

  return () => timers.forEach((t) => clearInterval(t));
}
