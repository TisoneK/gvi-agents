import type {
  Agent,
  AgentId,
  AgentState,
  Alert,
  AlertSeverity,
  CrawlPing,
  GEdge,
  GNode,
  Metrics,
  NodeKind,
  OppState,
} from "./types";

// AGENT_DEFS is the canonical roster. Colors double as the agent's "team color"
// everywhere in the UI (rail, graph activity, feed tags).
// A disciplined, desaturated palette. One cool accent (teal), a warm accent
// (amber) reserved for "actionable", muted supporting hues. No candy neon.
export const AGENT_DEFS: Agent[] = [
  { id: "hunter", name: "Hunter", role: "Discovery", icon: "spider", color: "#46C4AE", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
  { id: "researcher", name: "Researcher", role: "Investigation", icon: "microscope", color: "#6089C2", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
  { id: "verifier", name: "Verifier", role: "Validation", icon: "shield", color: "#CC6E5C", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
  { id: "evaluator", name: "Evaluator", role: "Assessment", icon: "scale", color: "#D4A24E", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
  { id: "strategist", name: "Strategist", role: "Opportunity dev", icon: "chess", color: "#9484C0", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
  { id: "monitor", name: "Monitor", role: "Continuous intel", icon: "eye", color: "#BE6E8E", state: "idle", activity: "Standing by", tasksDone: 0, pulse: [] },
];

export const STATE_COLOR: Record<OppState, string> = {
  discovered: "#6B7585",
  investigating: "#6089C2",
  verified: "#46C4AE",
  flagged: "#CC6E5C",
  actionable: "#D4A24E",
  expired: "#3A404B",
};

export const KIND_COLOR: Record<NodeKind, string> = {
  core: "#E8EEF5",
  surface: "#8AA4B8",
  opportunity: "#D4A24E",
  evidence: "#4E5C78",
  payer: "#9484C0",
};

let seq = 0;
export const uid = (p = "n") => `${p}_${(seq++).toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;

// The Store is a small mutable singleton. The canvas reads nodes/edges/pings
// directly (mutating positions in place for performance); the React chrome
// subscribes for agents/alerts/metrics/mission updates.
class Store {
  nodes: GNode[] = [];
  edges: GEdge[] = [];
  pings: CrawlPing[] = [];
  agents: Agent[] = AGENT_DEFS.map((a) => ({ ...a, pulse: [...a.pulse] }));
  alerts: Alert[] = [];
  metrics: Metrics = { tracked: 0, investigating: 0, verified: 0, flagged: 0, alertsToday: 0 };
  mission = "Surface survey";
  startedAt = Date.now();
  source: "connecting" | "live" | "sim" = "connecting";
  mode = "";

  private listeners = new Set<() => void>();
  private version = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private notify() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  addNode(partial: Omit<GNode, "x" | "y" | "vx" | "vy" | "born"> & { x?: number; y?: number }): GNode {
    const parent = partial.parent ? this.nodes.find((n) => n.id === partial.parent) : undefined;
    const angle = Math.random() * Math.PI * 2;
    const dist = parent ? 60 + Math.random() * 40 : 140 + Math.random() * 120;
    const node: GNode = {
      ...partial,
      x: partial.x ?? (parent ? parent.x : 0) + Math.cos(angle) * dist,
      y: partial.y ?? (parent ? parent.y : 0) + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      born: performance.now(),
    };
    this.nodes.push(node);
    if (partial.parent) this.addEdge(partial.parent, node.id, true);
    this.recount();
    return node;
  }

  addEdge(a: string, b: string, active = false): GEdge {
    const edge: GEdge = { id: uid("e"), a, b, born: performance.now(), active };
    this.edges.push(edge);
    return edge;
  }

  setNodeState(id: string, state: OppState, score?: number) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n) return;
    n.state = state;
    if (score != null) n.score = score;
    if (state === "verified" || state === "actionable") n.r = Math.max(n.r, 9);
    this.recount();
  }

  ping(x: number, y: number, color: string) {
    this.pings.push({ id: uid("p"), x, y, born: performance.now(), color });
    if (this.pings.length > 40) this.pings.shift();
  }

  setAgent(id: AgentId, patch: Partial<Pick<Agent, "state" | "activity">> & { bump?: boolean }) {
    const a = this.agents.find((x) => x.id === id);
    if (!a) return;
    if (patch.state) a.state = patch.state;
    if (patch.activity) a.activity = patch.activity;
    if (patch.bump) {
      a.tasksDone++;
      a.pulse = [...a.pulse, 1].slice(-28);
    } else {
      a.pulse = [...a.pulse, a.state === "working" ? 0.55 : 0.12].slice(-28);
    }
    this.notify();
  }

  tickPulses() {
    // keep the sparklines gently moving even when idle
    this.agents.forEach((a) => {
      const last = a.state === "working" ? 0.4 + Math.random() * 0.5 : 0.08 + Math.random() * 0.12;
      a.pulse = [...a.pulse, last].slice(-28);
    });
    this.notify();
  }

  pushAlert(severity: AlertSeverity, text: string, agent?: AgentId) {
    this.alerts.unshift({ id: uid("a"), severity, text, at: Date.now(), agent });
    this.alerts = this.alerts.slice(0, 24);
    if (severity !== "info") this.metrics.alertsToday++;
    this.notify();
  }

  setMission(m: string) {
    this.mission = m;
    this.notify();
  }

  setSource(s: "connecting" | "live" | "sim", mode = "") {
    this.source = s;
    if (mode) this.mode = mode;
    this.notify();
  }

  // Apply an alert that already has a server id/timestamp (from the backend).
  applyAlert(a: { id: string; severity: AlertSeverity; text: string; at: number; agent?: AgentId }) {
    this.alerts.unshift(a as Alert);
    this.alerts = this.alerts.slice(0, 24);
    if (a.severity !== "info") this.metrics.alertsToday++;
    this.notify();
  }

  // Replace all state from a backend snapshot (on WebSocket connect/reconnect).
  loadSnapshot(snap: {
    nodes: Array<Omit<GNode, "x" | "y" | "vx" | "vy" | "born">>;
    edges: Array<{ id: string; a: string; b: string; active?: boolean }>;
    agents: Array<{ id: AgentId; state: AgentState; activity: string; tasksDone: number }>;
    alerts: Array<{ id: string; severity: AlertSeverity; text: string; at: number; agent?: AgentId }>;
    metrics: Metrics;
    mission: string;
    startedAt: number;
  }) {
    this.nodes = [];
    this.edges = [];
    this.pings = [];
    this.alerts = [];
    this.agents = AGENT_DEFS.map((x) => ({ ...x, pulse: [] }));
    this.mission = snap.mission;
    this.startedAt = snap.startedAt;
    for (const n of snap.nodes) this.addNode(n as Omit<GNode, "x" | "y" | "vx" | "vy" | "born"> & { x?: number; y?: number });
    for (const e of snap.edges) this.addEdge(e.a, e.b, e.active ?? true);
    for (const s of snap.agents) {
      const a = this.agents.find((x) => x.id === s.id);
      if (a) {
        a.state = s.state;
        a.activity = s.activity;
        a.tasksDone = s.tasksDone;
      }
    }
    this.alerts = snap.alerts.slice(0, 24) as Alert[];
    this.recount();
    this.metrics.alertsToday = snap.metrics.alertsToday;
    this.notify();
  }

  private recount() {
    const opp = this.nodes.filter((n) => n.kind === "opportunity");
    this.metrics.tracked = opp.length;
    this.metrics.investigating = opp.filter((n) => n.state === "investigating").length;
    this.metrics.verified = opp.filter((n) => n.state === "verified" || n.state === "actionable").length;
    this.metrics.flagged = opp.filter((n) => n.state === "flagged").length;
    this.notify();
  }

  // prune old evidence nodes so the graph stays alive rather than crowded
  prune(max = 110) {
    if (this.nodes.length <= max) return;
    const removable = this.nodes
      .filter((n) => n.kind === "evidence")
      .sort((a, b) => a.born - b.born);
    while (this.nodes.length > max && removable.length) {
      const victim = removable.shift()!;
      this.nodes = this.nodes.filter((n) => n.id !== victim.id);
      this.edges = this.edges.filter((e) => e.a !== victim.id && e.b !== victim.id);
    }
  }
}

export const store = new Store();
