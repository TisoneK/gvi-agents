import { store, KIND_COLOR, STATE_COLOR, uid } from "./store";
import type { GNode } from "./types";

// The SimEngine produces a realistic, continuous stream of intelligence
// activity. It is the stand-in for the real autonomous backend: same store,
// same event shapes. The mission on boot is the "surface survey" — the system
// discovering and scoring where value lives, since the operator hasn't picked
// a surface yet.

const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;

const KNOWN_SURFACES = [
  "Airdrops",
  "Bug bounties",
  "Public grants",
  "Arbitrage",
  "Yield / DeFi",
  "Retro funding",
];

// surfaces the Hunter "discovers" beyond the seeded set (capability A)
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
  t.replace("{n}", String(1 + Math.floor(Math.random() * 7))).replace("{x}", rand(X_WORDS));

export function startEngine() {
  // --- seed the core (guard against a double-start) ---
  if (store.nodes.some((n) => n.id === "core")) return () => {};
  const core = store.addNode({ id: "core", kind: "core", label: "GVI", r: 16, x: 0, y: 0 });
  core.vx = core.vy = 0;

  const surfaceNodes: GNode[] = [];
  // stagger-spawn the known surfaces so the graph visibly grows on boot
  KNOWN_SURFACES.forEach((name, i) => {
    setTimeout(() => {
      const s = store.addNode({ id: `surface_${i}`, kind: "surface", label: name, r: 11, parent: "core" });
      surfaceNodes.push(s);
      store.ping(s.x, s.y, KIND_COLOR.surface);
    }, 400 + i * 650);
  });

  store.pushAlert("info", "System online — beginning surface survey", "hunter");

  const opportunities: GNode[] = [];
  const timers: number[] = [];

  // --- Hunter beat: crawl a surface, sometimes surface a new opportunity ---
  timers.push(
    window.setInterval(() => {
      if (!surfaceNodes.length) return;
      const surface = rand(surfaceNodes);
      store.setAgent("hunter", { state: "working", activity: `Crawling ${surface.label.toLowerCase()}` });
      store.ping(surface.x, surface.y, store.agents[0].color);

      // occasionally discover a brand-new surface (beyond known categories)
      if (chance(0.06) && EMERGENT_SURFACES.length) {
        const name = EMERGENT_SURFACES.shift()!;
        const s = store.addNode({ id: `surface_x_${name}`, kind: "surface", label: name, r: 11, parent: "core" });
        surfaceNodes.push(s);
        store.ping(s.x, s.y, store.agents[0].color);
        store.pushAlert("info", `New value surface discovered: ${name}`, "hunter");
      }

      if (chance(0.55)) {
        const opp = store.addNode({
          id: uid("opp"),
          kind: "opportunity",
          label: fillTemplate(rand(OPP_TEMPLATES)),
          state: "discovered",
          r: 7,
          parent: surface.id,
        });
        opportunities.push(opp);
        store.setAgent("hunter", { bump: true });
      }
      setTimeout(() => store.setAgent("hunter", { state: "idle", activity: "Scanning the landscape" }), 900);
    }, 1500)
  );

  // --- Researcher beat: investigate a discovered opp, attach evidence + payer ---
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "discovered"));
      if (!target) return;
      store.setAgent("researcher", { state: "working", activity: `Investigating ${target.label}` });
      store.setNodeState(target.id, "investigating");
      store.ping(target.x, target.y, store.agents[1].color);
      // attach 1-2 evidence nodes
      const ev = 1 + (chance(0.5) ? 1 : 0);
      for (let i = 0; i < ev; i++) {
        store.addNode({ id: uid("ev"), kind: "evidence", label: "evidence", r: 3.5, parent: target.id });
      }
      // attach a payer node (where the money originates)
      if (chance(0.7)) {
        store.addNode({ id: uid("pay"), kind: "payer", label: rand(["Protocol treasury", "Foundation", "Grant DAO", "Market maker"]), r: 6, parent: target.id });
      }
      store.setAgent("researcher", { bump: true });
      setTimeout(() => store.setAgent("researcher", { state: "idle", activity: "Tracing value sources" }), 1100);
    }, 2100)
  );

  // --- Verifier beat: red-team vs blue-team → verified or flagged ---
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "investigating"));
      if (!target) return;
      store.setAgent("verifier", { state: "working", activity: `Red/blue on ${target.label}` });
      store.ping(target.x, target.y, store.agents[2].color);
      setTimeout(() => {
        if (chance(0.72)) {
          store.setNodeState(target.id, "verified");
          store.pushAlert("verified", `${target.label} — payer confirmed, evidence holds`, "verifier");
        } else {
          store.setNodeState(target.id, "flagged");
          store.pushAlert("flagged", `${target.label} — failed red-team, source unverifiable`, "verifier");
        }
        store.setAgent("verifier", { bump: true });
        store.setAgent("verifier", { state: "idle", activity: "Adjudicating claims" });
      }, 850);
    }, 2600)
  );

  // --- Evaluator beat: score a verified opp, maybe promote to actionable ---
  timers.push(
    window.setInterval(() => {
      const target = rand(opportunities.filter((o) => o.state === "verified" && o.score == null));
      if (!target) return;
      store.setAgent("evaluator", { state: "working", activity: `Scoring ${target.label}` });
      store.ping(target.x, target.y, store.agents[3].color);
      const score = 40 + Math.floor(Math.random() * 60);
      setTimeout(() => {
        if (score >= 78) {
          store.setNodeState(target.id, "actionable", score);
          store.pushAlert("verified", `Actionable — ${target.label} scored ${score}/100`, "evaluator");
        } else {
          store.setNodeState(target.id, "verified", score);
        }
        store.setAgent("evaluator", { bump: true });
        store.setAgent("evaluator", { state: "idle", activity: "Weighing returns vs risk" });
      }, 800);
    }, 3100)
  );

  // --- Strategist beat: connect complementary opportunities (stacking) ---
  timers.push(
    window.setInterval(() => {
      const strong = opportunities.filter((o) => o.state === "verified" || o.state === "actionable");
      if (strong.length < 2) return;
      const a = rand(strong);
      let b = rand(strong);
      if (a.id === b.id) return;
      store.setAgent("strategist", { state: "working", activity: `Stacking ${a.label} + ${b.label}` });
      store.addEdge(a.id, b.id, true);
      store.ping(b.x, b.y, store.agents[4].color);
      if (chance(0.5)) store.pushAlert("info", `Stack found — ${a.label} compounds with ${b.label}`, "strategist");
      store.setAgent("strategist", { bump: true });
      setTimeout(() => store.setAgent("strategist", { state: "idle", activity: "Hunting hidden angles" }), 1000);
    }, 4200)
  );

  // --- Monitor beat: watch deadlines, decay / expire opportunities ---
  timers.push(
    window.setInterval(() => {
      const live = opportunities.filter((o) => o.state === "verified" || o.state === "actionable");
      store.setAgent("monitor", { state: "working", activity: `Watching ${live.length} live opportunities` });
      if (live.length && chance(0.5)) {
        const t = rand(live);
        if (chance(0.5)) {
          store.pushAlert("decaying", `${t.label} closing soon — still unclaimed`, "monitor");
        } else {
          store.setNodeState(t.id, "expired");
          store.ping(t.x, t.y, STATE_COLOR.expired);
        }
      }
      setTimeout(() => store.setAgent("monitor", { state: "idle", activity: "Tracking deadlines" }), 1200);
    }, 3800)
  );

  // housekeeping: prune + idle pulse so sparklines breathe
  timers.push(window.setInterval(() => store.prune(), 5000));
  timers.push(window.setInterval(() => store.tickPulses(), 700));

  return () => timers.forEach((t) => clearInterval(t));
}
