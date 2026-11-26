import type {
  Agent,
  AgentId,
  Alert,
  AlertSeverity,
  CrawlPing,
  GEdge,
  GNode,
  Metrics,
  NodeKind,
  OppState,
} from "./types";

// The roster. In the orbit, agents are threads of light on the rim — color is
// reserved for STATE, so every agent is drawn in one neutral tone and only
// brightens (to gold) while working. The `color` field is kept for legacy use.
export const AGENT_DEFS: Agent[] = [
  { id: "hunter", name: "Hunter", role: "Discovery", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "researcher", name: "Researcher", role: "Investigation", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "verifier", name: "Verifier", role: "Validation", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "evaluator", name: "Evaluator", role: "Assessment", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "strategist", name: "Strategist", role: "Opportunity dev", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "monitor", name: "Monitor", role: "Continuous intel", color: "#c7a15a", state: "idle", activity: "Standing by", tasksDone: 0 },
];

// State colors used by the CHROME (chips, pipeline, sheet). In the scene the
// body color comes from time-left; these label the lifecycle in the UI.
export const STATE_COLOR: Record<OppState, string> = {
  discovered: "#5e7c86", // cool steel
  investigating: "#9a8f6b", // muted tan
  verified: "#c7a15a", // warm
  actionable: "#f0b545", // gold
  flagged: "#e2553f", // alarm
  expired: "#4a4d40", // ash
};

export const KIND_COLOR: Record<NodeKind, string> = {
  core: "#ede7d3",
  surface: "#8f8b78",
  opportunity: "#f0b545",
  evidence: "#5f5c4e",
  payer: "#9a8f6b",
};

let seq = 0;
export const uid = (p = "n") => `${p}_${(seq++).toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;

// How much leash the presence has. Visible, so the limits are trustable.
export type Autonomy = "watch" | "suggest" | "ask" | "act";

type NodeInput = Pick<GNode, "id" | "kind" | "label"> &
  Partial<Pick<GNode, "state" | "parent" | "ecosystem" | "value" | "deadline" | "score" | "sources">>;

// A small mutable singleton. The orbit canvas reads nodes/edges/pings directly
// (and owns their animated r/a/size); the React chrome subscribes for
// agents/alerts/metrics/mission/selection.
class Store {
  nodes: GNode[] = [];
  edges: GEdge[] = [];
  pings: CrawlPing[] = [];
  agents: Agent[] = AGENT_DEFS.map((a) => ({ ...a }));
  alerts: Alert[] = [];
  metrics: Metrics = { tracked: 0, investigating: 0, verified: 0, actionable: 0, flagged: 0, alertsToday: 0 };
  mission = "Surface survey";
  startedAt = Date.now();
  source: "connecting" | "live" | "sim" = "connecting";
  mode = "";
  lastEventAt = Date.now();
  selectedId: string | null = null;

  // the living layer
  autonomy: Autonomy = "suggest";
  captured = 0; // value the presence (or the user) has banked
  lost = 0; // value that decayed to nothing — the stakes of doing nothing
  lastChangedId: string | null = null; // the opportunity that most recently changed
  lastChangeAt = 0;
  hoverId: string | null = null; // an organism the floating queue is pointing at

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

  private touch() {
    this.lastEventAt = Date.now();
  }

  addNode(input: NodeInput): GNode {
    const node: GNode = {
      ...input,
      x: 0,
      y: 0,
      born: performance.now(),
      r: 0,
      a: Number.NaN, // renderer initializes polar position on first sight
      size: 0,
      wob: Math.random() * Math.PI * 2,
      changedAt: performance.now(),
    };
    this.nodes.push(node);
    this.recount();
    this.touch();
    this.notify();
    return node;
  }

  addEdge(a: string, b: string, active = false): GEdge {
    // avoid duplicate compounding links (mirror pairs)
    if (this.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
      return this.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))!;
    }
    const edge: GEdge = { id: uid("e"), a, b, born: performance.now(), active };
    this.edges.push(edge);
    this.touch();
    return edge;
  }

  setNodeState(id: string, state: OppState, score?: number) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n) return;
    const prev = n.state;
    n.state = state;
    if (score != null) n.score = score;
    n.changedAt = performance.now();
    this.lastChangedId = id;
    this.lastChangeAt = performance.now();
    if (state === "expired" && prev !== "expired") this.lost += n.value ?? 0;
    this.recount();
    this.touch();
    this.notify();
  }

  // The user (or the presence) acts on an opportunity.
  claim(id: string) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n || n.claimAt) return;
    n.claimAt = performance.now();
    this.captured += n.value ?? 0;
    if (this.selectedId === id) this.selectedId = null;
    this.touch();
    this.notify();
  }
  dismiss(id: string) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n || n.dismissAt) return;
    n.dismissAt = performance.now();
    if (this.selectedId === id) this.selectedId = null;
    this.touch();
    this.notify();
  }
  setAutonomy(a: Autonomy) {
    this.autonomy = a;
    this.notify();
  }

  setNodeMeta(id: string, meta: Partial<Pick<GNode, "value" | "deadline" | "ecosystem" | "sources">>) {
    const n = this.nodes.find((x) => x.id === id);
    if (!n) return;
    Object.assign(n, meta);
    this.touch();
  }

  ping(x: number, y: number, color: string) {
    this.pings.push({ id: uid("p"), x, y, born: performance.now(), color });
    if (this.pings.length > 48) this.pings.shift();
  }

  setAgent(id: AgentId, patch: Partial<Pick<Agent, "state" | "activity" | "focus">> & { bump?: boolean }) {
    const a = this.agents.find((x) => x.id === id);
    if (!a) return;
    if (patch.state) a.state = patch.state;
    if (patch.activity) a.activity = patch.activity;
    if ("focus" in patch) a.focus = patch.focus;
    if (patch.bump) a.tasksDone++;
    if (patch.state === "idle") a.focus = undefined;
    this.touch();
    this.notify();
  }

  pushAlert(severity: AlertSeverity, text: string, agent?: AgentId, oppId?: string) {
    this.alerts.unshift({ id: uid("a"), severity, text, at: Date.now(), agent, oppId });
    this.alerts = this.alerts.slice(0, 60);
    if (severity !== "info") this.metrics.alertsToday++;
    this.touch();
    this.notify();
  }

  applyAlert(a: Alert) {
    this.alerts.unshift(a);
    this.alerts = this.alerts.slice(0, 60);
    if (a.severity !== "info") this.metrics.alertsToday++;
    this.touch();
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

  setSelected(id: string | null) {
    this.selectedId = id;
    this.notify();
  }

  setHover(id: string | null) {
    this.hoverId = id;
    this.notify();
  }

  selected(): GNode | null {
    return this.selectedId ? this.nodes.find((n) => n.id === this.selectedId) ?? null : null;
  }

  loadSnapshot(snap: {
    nodes: NodeInput[];
    edges: Array<{ id: string; a: string; b: string; active?: boolean }>;
    agents: Array<{ id: AgentId; state: Agent["state"]; activity: string; tasksDone: number; focus?: string }>;
    alerts: Alert[];
    metrics: Metrics;
    mission: string;
    startedAt: number;
  }) {
    this.nodes = [];
    this.edges = [];
    this.pings = [];
    this.alerts = [];
    this.agents = AGENT_DEFS.map((x) => ({ ...x }));
    this.mission = snap.mission;
    this.startedAt = snap.startedAt;
    for (const n of snap.nodes) this.addNode(n);
    for (const e of snap.edges) this.addEdge(e.a, e.b, e.active ?? true);
    for (const s of snap.agents) {
      const a = this.agents.find((x) => x.id === s.id);
      if (a) {
        a.state = s.state;
        a.activity = s.activity;
        a.tasksDone = s.tasksDone;
        a.focus = s.focus;
      }
    }
    this.alerts = snap.alerts.slice(0, 60);
    this.recount();
    this.metrics.alertsToday = snap.metrics.alertsToday;
    this.touch();
    this.notify();
  }

  private recount() {
    const opp = this.nodes.filter((n) => n.kind === "opportunity");
    this.metrics.tracked = opp.filter((n) => n.state !== "expired").length;
    this.metrics.investigating = opp.filter((n) => n.state === "investigating").length;
    this.metrics.verified = opp.filter((n) => n.state === "verified").length;
    this.metrics.actionable = opp.filter((n) => n.state === "actionable").length;
    this.metrics.flagged = opp.filter((n) => n.state === "flagged").length;
  }

  // Remove fully-expired/faded opportunities (and their satellites) so the
  // scene stays alive rather than crowded with ghosts.
  removeNode(id: string) {
    this.nodes = this.nodes.filter((n) => n.id !== id && n.parent !== id);
    this.edges = this.edges.filter((e) => e.a !== id && e.b !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.recount();
  }
}

export const store = new Store();
