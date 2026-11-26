import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, modeLabel } from "./config.js";
import type {
  AgentId,
  AgentSnap,
  AlertSeverity,
  AlertSnap,
  Metrics,
  OppState,
  ResearchNote,
  WireEdge,
  WireEvent,
  WireNode,
} from "./types.js";

let seq = 0;
export const uid = (p = "n") => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const AGENTS: AgentSnap[] = [
  { id: "hunter", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "researcher", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "verifier", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "evaluator", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "strategist", state: "idle", activity: "Standing by", tasksDone: 0 },
  { id: "monitor", state: "idle", activity: "Standing by", tasksDone: 0 },
];

// The store is the event log (durable) + its projection (in memory). Agents
// call the high-level methods; each one applies to the projection, persists the
// meaningful events, and broadcasts to connected clients.
export class GviStore {
  nodes = new Map<string, WireNode>();
  edges: WireEdge[] = []; // cross-links only; structural edges are implied by node.parent
  agents: AgentSnap[] = AGENTS.map((a) => ({ ...a }));
  alerts: AlertSnap[] = [];
  metrics: Metrics = { tracked: 0, investigating: 0, verified: 0, actionable: 0, flagged: 0, alertsToday: 0 };
  mission = "Surface survey";
  startedAt = Date.now();

  private clients = new Set<(e: WireEvent) => void>();
  private eventsPath: string;
  private notesPath: string;
  onAlert?: (a: AlertSnap) => void;

  constructor() {
    if (!existsSync(config.dataDir)) mkdirSync(config.dataDir, { recursive: true });
    this.eventsPath = resolve(config.dataDir, "events.jsonl");
    this.notesPath = resolve(config.dataDir, "notes.jsonl");
    this.replay();
  }

  // ---- client plumbing ----
  onClient(send: (e: WireEvent) => void) {
    this.clients.add(send);
    send(this.snapshot());
    return () => this.clients.delete(send);
  }
  private broadcast(e: WireEvent) {
    for (const s of this.clients) {
      try {
        s(e);
      } catch {
        /* client gone */
      }
    }
  }

  // ---- durability ----
  private persist(e: WireEvent) {
    try {
      appendFileSync(this.eventsPath, JSON.stringify(e) + "\n");
    } catch {
      /* best-effort */
    }
  }
  private replay() {
    if (!existsSync(this.eventsPath)) return;
    const lines = readFileSync(this.eventsPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        this.apply(JSON.parse(line) as WireEvent);
      } catch {
        /* skip corrupt line */
      }
    }
    this.recount();
  }

  // ---- projection ----
  private apply(e: WireEvent) {
    switch (e.t) {
      case "node.add":
        this.nodes.set(e.node.id, e.node);
        break;
      case "node.state": {
        const n = this.nodes.get(e.id);
        if (n) {
          n.state = e.state;
          if (e.score != null) n.score = e.score;
        }
        break;
      }
      case "node.meta": {
        const n = this.nodes.get(e.id);
        if (n) {
          if (e.value != null) n.value = e.value;
          if (e.deadline != null) n.deadline = e.deadline;
          if (e.ecosystem != null) n.ecosystem = e.ecosystem;
          if (e.sources != null) n.sources = e.sources;
        }
        break;
      }
      case "node.remove":
        this.nodes.delete(e.id);
        this.edges = this.edges.filter((x) => x.a !== e.id && x.b !== e.id);
        break;
      case "edge.add":
        this.edges.push(e.edge);
        break;
      case "alert":
        this.alerts.unshift({ id: e.id, severity: e.severity, text: e.text, at: e.at, agent: e.agent, oppId: e.oppId });
        this.alerts = this.alerts.slice(0, 100);
        break;
      case "agent": {
        const a = this.agents.find((x) => x.id === e.id);
        if (a) {
          if (e.state) a.state = e.state;
          if (e.activity) a.activity = e.activity;
          if (e.bump) a.tasksDone++;
          if ("focus" in e) a.focus = e.focus;
          if (e.state === "idle") a.focus = undefined;
        }
        break;
      }
      case "mission":
        this.mission = e.mission;
        break;
    }
  }

  private recount() {
    const opp = [...this.nodes.values()].filter((n) => n.kind === "opportunity");
    this.metrics.tracked = opp.filter((n) => n.state !== "expired").length;
    this.metrics.investigating = opp.filter((n) => n.state === "investigating").length;
    this.metrics.verified = opp.filter((n) => n.state === "verified").length;
    this.metrics.actionable = opp.filter((n) => n.state === "actionable").length;
    this.metrics.flagged = opp.filter((n) => n.state === "flagged").length;
  }

  private emit(e: WireEvent, persist: boolean) {
    this.apply(e);
    if (persist) this.persist(e);
    this.broadcast(e);
  }

  // ---- high-level API used by agents ----
  addNode(node: WireNode) {
    this.emit({ t: "node.add", node }, true);
    this.recount();
    return node;
  }
  setNodeState(id: string, state: OppState, score?: number) {
    this.emit({ t: "node.state", id, state, score }, true);
    this.recount();
  }
  setNodeMeta(id: string, meta: { value?: number; deadline?: number; ecosystem?: string; sources?: number }) {
    this.emit({ t: "node.meta", id, ...meta }, true);
  }
  removeNode(id: string) {
    if (!this.nodes.has(id)) return;
    this.emit({ t: "node.remove", id }, true);
    this.recount();
  }
  addEdge(a: string, b: string, active = true) {
    const edge: WireEdge = { id: uid("e"), a, b, active };
    this.emit({ t: "edge.add", edge }, true);
    return edge;
  }
  ping(nodeId: string, color: string) {
    this.emit({ t: "ping", nodeId, color }, false);
  }
  setAgent(id: AgentId, patch: { state?: AgentSnap["state"]; activity?: string; bump?: boolean; focus?: string }) {
    this.emit({ t: "agent", id, ...patch }, false);
  }
  setMission(mission: string) {
    this.emit({ t: "mission", mission }, true);
  }
  pushAlert(severity: AlertSeverity, text: string, agent?: AgentId, oppId?: string): AlertSnap {
    const a: AlertSnap = { id: uid("a"), severity, text, at: Date.now(), agent, oppId };
    if (severity !== "info") this.metrics.alertsToday++;
    this.emit({ t: "alert", ...a }, true);
    this.onAlert?.(a);
    return a;
  }
  addNote(note: Omit<ResearchNote, "id" | "at">) {
    const full: ResearchNote = { ...note, id: uid("note"), at: Date.now() };
    try {
      appendFileSync(this.notesPath, JSON.stringify(full) + "\n");
    } catch {
      /* best-effort */
    }
    return full;
  }

  nodesOf(kind: WireNode["kind"]) {
    return [...this.nodes.values()].filter((n) => n.kind === kind);
  }
  opportunities(state?: OppState) {
    return this.nodesOf("opportunity").filter((n) => !state || n.state === state);
  }

  snapshot(): WireEvent {
    return {
      t: "snapshot",
      nodes: [...this.nodes.values()],
      edges: this.edges,
      agents: this.agents,
      alerts: this.alerts.slice(0, 24),
      metrics: this.metrics,
      mission: this.mission,
      startedAt: this.startedAt,
      mode: modeLabel(),
    };
  }
}
