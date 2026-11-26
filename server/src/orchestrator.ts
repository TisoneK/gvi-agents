import { config } from "./config.js";
import { reason } from "./llm.js";
import { search } from "./search.js";
import { GviStore, uid } from "./store.js";

const KNOWN_SURFACES = ["Airdrops", "Bug bounties", "Public grants", "Arbitrage", "Yield / DeFi", "Retro funding"];
const EMERGENT = ["Depin networks", "Prediction markets", "RWA incentives", "Data markets"];
const PING = "#f0b545";
const HOUR = 3600_000;

const rand = <T>(a: T[]): T | undefined => a[Math.floor(Math.random() * a.length)];
const chance = (p: number) => Math.random() < p;
const pairKey = (a: string, b: string) => [a, b].sort().join("::");

// a plausible value (log-distributed, ~$120 .. ~$180k) and deadline
const randValue = () => Math.round(10 ** (2.1 + Math.random() * 3.2));
const randDeadline = (): number | undefined => {
  if (chance(0.35)) return undefined;
  const r = Math.random();
  const hours = r < 0.25 ? 1 + Math.random() * 23 : 24 + Math.random() * 690;
  return Date.now() + hours * HOUR;
};

interface OppMeta {
  snippet: string;
  url: string;
  surface: string;
}

// The orchestrator runs the six agents continuously against the shared store.
// Each opportunity carries real orbit meaning (value, deadline, ecosystem). In
// live mode it reasons with the LLM and searches the web; in mock mode the same
// code path uses synthetic fallbacks.
export function startOrchestrator(store: GviStore) {
  const meta = new Map<string, OppMeta>();
  const seenLabels = new Set<string>();
  const surfaceIds = new Map<string, string>();
  const stacked = new Set<string>();
  const emergent = [...EMERGENT];
  const timers: NodeJS.Timeout[] = [];
  const t = config.tempo;

  if (!store.nodes.has("core")) store.addNode({ id: "core", kind: "core", label: "GVI" });
  KNOWN_SURFACES.forEach((name, i) => {
    timers.push(
      setTimeout(() => {
        if (surfaceIds.has(name)) return;
        const id = `surface_${i}`;
        store.addNode({ id, kind: "surface", label: name, parent: "core" });
        surfaceIds.set(name, id);
        store.ping(id, PING);
      }, 400 + i * 700)
    );
  });
  store.pushAlert("info", "System online — beginning surface survey", "hunter");

  const idle = (id: Parameters<typeof store.setAgent>[0], activity: string, ms = 1000) =>
    timers.push(setTimeout(() => store.setAgent(id, { state: "idle", activity }), ms));

  // ---- Hunter: discover opportunities on a surface ----
  timers.push(
    setInterval(async () => {
      const surfaces = store.nodesOf("surface");
      const surface = rand(surfaces);
      if (!surface) return;
      store.setAgent("hunter", { state: "working", activity: `Crawling ${surface.label.toLowerCase()}` });
      store.ping(surface.id, PING);

      if (chance(0.07) && emergent.length) {
        const name = emergent.shift()!;
        const id = `surface_x_${name.replace(/\s+/g, "_")}`;
        store.addNode({ id, kind: "surface", label: name, parent: "core" });
        surfaceIds.set(name, id);
        store.ping(id, PING);
        store.pushAlert("info", `New value surface discovered: ${name}`, "hunter");
      }

      const results = await search.query(`new ${surface.label} opportunities to earn or claim`, 4);
      const hit = results.find((r) => !seenLabels.has(r.title));
      if (hit) {
        seenLabels.add(hit.title);
        const id = uid("opp");
        store.addNode({
          id,
          kind: "opportunity",
          label: hit.title.slice(0, 48),
          state: "discovered",
          parent: surface.id,
          ecosystem: surface.label,
          value: randValue(),
          deadline: randDeadline(),
          sources: 0,
        });
        meta.set(id, { snippet: hit.snippet, url: hit.url, surface: surface.label });
        store.setAgent("hunter", { bump: true });
      }
      idle("hunter", "Scanning the landscape", 900);
    }, t)
  );

  // ---- Researcher: investigate a discovered opportunity ----
  timers.push(
    setInterval(async () => {
      const target = rand(store.opportunities("discovered"));
      if (!target) return;
      const m = meta.get(target.id);
      store.setAgent("researcher", { state: "working", activity: `Investigating ${target.label}`, focus: target.id });
      store.setNodeState(target.id, "investigating");
      store.ping(target.id, PING);

      const res = await reason<{ payer: string; mechanism: string; evidence: string[] }>({
        system: "You are an investigator mapping how an economic opportunity works. Reply ONLY with JSON.",
        prompt: `Opportunity: "${target.label}". Context: ${m?.snippet ?? "n/a"} (${m?.url ?? ""}).\nReturn JSON {"payer": who ultimately pays, "mechanism": how value is obtained in one line, "evidence": [up to 2 short evidence descriptions]}.`,
        maxTokens: 400,
        fallback: {
          payer: rand(["Protocol treasury", "Foundation", "Grant DAO", "Market maker"])!,
          mechanism: "Rewards distributed to qualifying participants",
          evidence: ["official announcement", "on-chain distribution record"].slice(0, 1 + (chance(0.5) ? 1 : 0)),
        },
      });

      const sources = res.evidence.slice(0, 2).length;
      store.setNodeMeta(target.id, { sources, value: Math.round((target.value ?? randValue()) * (0.8 + Math.random() * 0.6)) });
      store.addNote({ oppId: target.id, agent: "researcher", summary: `Payer: ${res.payer}. ${res.mechanism}`, sources: m?.url ? [m.url] : [] });
      store.setAgent("researcher", { bump: true });
      idle("researcher", "Tracing value sources", 1100);
    }, Math.round(t * 1.25))
  );

  // ---- Verifier: red-team vs blue-team ----
  timers.push(
    setInterval(async () => {
      const target = rand(store.opportunities("investigating"));
      if (!target) return;
      const m = meta.get(target.id);
      store.setAgent("verifier", { state: "working", activity: `Red/blue on ${target.label}`, focus: target.id });
      store.ping(target.id, PING);

      const res = await reason<{ verdict: "verified" | "flagged"; reason: string }>({
        system: "You are an adversarial verifier. A red team argues the opportunity is a scam; a blue team defends it. Decide. Reply ONLY with JSON.",
        prompt: `Opportunity: "${target.label}". Context: ${m?.snippet ?? "n/a"}.\nReturn JSON {"verdict": "verified" | "flagged", "reason": one short line}.`,
        maxTokens: 300,
        fallback: chance(0.82)
          ? { verdict: "verified", reason: "Payer confirmed, evidence consistent" }
          : { verdict: "flagged", reason: "Payment source unverifiable" },
      });

      store.setNodeState(target.id, res.verdict);
      store.addNote({ oppId: target.id, agent: "verifier", summary: `${res.verdict}: ${res.reason}`, sources: m?.url ? [m.url] : [] });
      store.pushAlert(res.verdict === "verified" ? "verified" : "flagged", `${target.label} — ${res.reason}`, "verifier", target.id);
      // a flagged dead-end lingers briefly, then is pruned so it doesn't crust up
      if (res.verdict === "flagged") timers.push(setTimeout(() => store.removeNode(target.id), 16000));
      store.setAgent("verifier", { bump: true });
      idle("verifier", "Adjudicating claims", 900);
    }, Math.round(t * 1.5))
  );

  // ---- Evaluator: score, maybe promote to actionable ----
  timers.push(
    setInterval(async () => {
      const target = rand(store.opportunities("verified").filter((o) => o.score == null));
      if (!target) return;
      store.setAgent("evaluator", { state: "working", activity: `Scoring ${target.label}`, focus: target.id });
      store.ping(target.id, PING);

      const res = await reason<{ score: number; rationale: string }>({
        system: "You estimate the realistic, risk-adjusted value of an opportunity on a 0-100 scale. Reply ONLY with JSON.",
        prompt: `Opportunity: "${target.label}".\nReturn JSON {"score": 0-100 integer, "rationale": one short line}.`,
        maxTokens: 200,
        fallback: { score: 40 + Math.floor(Math.random() * 60), rationale: "Moderate return, moderate effort" },
      });
      const score = Math.max(0, Math.min(100, Math.round(res.score)));
      if (score >= 78) {
        store.setNodeState(target.id, "actionable", score);
        store.pushAlert("verified", `Actionable — ${target.label} scored ${score}/100`, "evaluator", target.id);
      } else {
        store.setNodeState(target.id, "verified", score);
      }
      store.addNote({ oppId: target.id, agent: "evaluator", summary: `Score ${score}: ${res.rationale}`, sources: [] });
      store.setAgent("evaluator", { bump: true });
      idle("evaluator", "Weighing returns vs risk", 900);
    }, Math.round(t * 1.75))
  );

  // ---- Strategist: connect complementary opportunities (dedup mirror pairs) ----
  timers.push(
    setInterval(async () => {
      const strong = [...store.opportunities("verified"), ...store.opportunities("actionable")];
      if (strong.length < 2) return;
      const a = rand(strong)!;
      const b = rand(strong.filter((x) => x.id !== a.id && x.ecosystem !== a.ecosystem));
      if (!b) return;
      const key = pairKey(a.id, b.id);
      if (stacked.has(key)) return;
      stacked.add(key);
      store.setAgent("strategist", { state: "working", activity: `Stacking ${a.label} + ${b.label}`, focus: b.id });
      store.ping(b.id, PING);
      const res = await reason<{ stackable: boolean; note: string }>({
        system: "You find ways to stack complementary opportunities for compounding value. Reply ONLY with JSON.",
        prompt: `A: "${a.label}". B: "${b.label}". Can one position or effort capture both?\nReturn JSON {"stackable": boolean, "note": one short line}.`,
        maxTokens: 200,
        fallback: { stackable: chance(0.6), note: "Shared eligibility — one wallet qualifies for both" },
      });
      if (res.stackable) {
        store.addEdge(a.id, b.id, true);
        store.pushAlert("info", `Stack found — ${a.label} compounds with ${b.label}`, "strategist", a.id);
      }
      store.setAgent("strategist", { bump: true });
      idle("strategist", "Hunting hidden angles", 1000);
    }, Math.round(t * 2.1))
  );

  // ---- Monitor: track deadlines, decay / expire ----
  timers.push(
    setInterval(() => {
      const live = [...store.opportunities("verified"), ...store.opportunities("actionable")];
      store.setAgent("monitor", { state: "working", activity: `Watching ${live.length} live opportunities`, focus: live[0]?.id });
      if (live.length && chance(0.4)) {
        const target = rand(live)!;
        // mostly just warn + pull the deadline in (creates "needs you" moments);
        // only occasionally let one actually expire, so the field stays alive
        if (chance(0.82)) {
          store.pushAlert("decaying", `${target.label} closing soon — still unclaimed`, "monitor", target.id);
          store.setNodeMeta(target.id, { deadline: Date.now() + (2 + Math.random() * 10) * HOUR });
        } else {
          store.setNodeState(target.id, "expired");
          store.ping(target.id, "#4a4d40");
          timers.push(setTimeout(() => store.removeNode(target.id), 2500));
        }
      }
      idle("monitor", "Tracking deadlines", 1100);
    }, Math.round(t * 1.9))
  );

  return () => timers.forEach((timer) => clearTimeout(timer as NodeJS.Timeout));
}
