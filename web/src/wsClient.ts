import { store } from "./store";
import { startEngine } from "./engine";
import type { AgentId, Alert, Metrics, OppState } from "./types";

// Wire protocol mirror (kept in sync with server/src/types.ts WireEvent).
type WireNode = {
  id: string;
  kind: string;
  label: string;
  state?: OppState;
  parent?: string;
  ecosystem?: string;
  value?: number;
  deadline?: number;
  score?: number;
  sources?: number;
};
type WireEdge = { id: string; a: string; b: string; active?: boolean };
type WireAgent = { id: AgentId; state: "idle" | "working" | "blocked"; activity: string; tasksDone: number; focus?: string };
type WireAlert = { id: string; severity: Alert["severity"]; text: string; at: number; agent?: AgentId; oppId?: string };
type WireEvent =
  | { t: "snapshot"; nodes: WireNode[]; edges: WireEdge[]; agents: WireAgent[]; alerts: WireAlert[]; metrics: Metrics; mission: string; startedAt: number; mode: string }
  | { t: "node.add"; node: WireNode }
  | { t: "node.state"; id: string; state: OppState; score?: number }
  | { t: "node.meta"; id: string; value?: number; deadline?: number; ecosystem?: string; sources?: number }
  | { t: "edge.add"; edge: WireEdge }
  | { t: "ping"; nodeId: string; color: string }
  | { t: "agent"; id: AgentId; state?: "idle" | "working" | "blocked"; activity?: string; bump?: boolean; focus?: string }
  | { t: "alert"; id: string; severity: Alert["severity"]; text: string; at: number; agent?: AgentId; oppId?: string }
  | { t: "mission"; mission: string };

// Derive the wedge (ecosystem) from the parent surface if the backend did not
// send one — keeps older/replayed events placed correctly.
function withEcosystem(n: WireNode): WireNode {
  if (n.ecosystem || n.kind !== "opportunity" || !n.parent) return n;
  const parent = store.nodes.find((x) => x.id === n.parent);
  return parent ? { ...n, ecosystem: parent.label } : n;
}

function applyEvent(e: WireEvent) {
  switch (e.t) {
    case "snapshot":
      store.loadSnapshot({
        nodes: e.nodes.map(withEcosystem) as never,
        edges: e.edges,
        agents: e.agents,
        alerts: e.alerts as Alert[],
        metrics: e.metrics,
        mission: e.mission,
        startedAt: e.startedAt,
      });
      store.setSource("live", e.mode);
      break;
    case "node.add":
      store.addNode(withEcosystem(e.node) as never);
      break;
    case "node.state":
      store.setNodeState(e.id, e.state, e.score);
      break;
    case "node.meta":
      store.setNodeMeta(e.id, { value: e.value, deadline: e.deadline, ecosystem: e.ecosystem, sources: e.sources });
      break;
    case "edge.add":
      store.addEdge(e.edge.a, e.edge.b, e.edge.active ?? true);
      break;
    case "ping": {
      const n = store.nodes.find((x) => x.id === e.nodeId);
      if (n) store.ping(n.x, n.y, e.color);
      break;
    }
    case "agent":
      store.setAgent(e.id, { state: e.state, activity: e.activity, bump: e.bump, focus: e.focus });
      break;
    case "alert":
      store.applyAlert({ id: e.id, severity: e.severity, text: e.text, at: e.at, agent: e.agent, oppId: e.oppId });
      break;
    case "mission":
      store.setMission(e.mission);
      break;
  }
}

// Connect to the backend; if it can't be reached, fall back to the in-browser
// sim engine so the view is never blank. If the backend connects later, live
// data takes over and the sim is stopped.
export function startDataSource(url = `ws://${location.hostname}:8787`) {
  let ws: WebSocket | null = null;
  let stopSim: (() => void) | null = null;
  let live = false;

  const fallback = () => {
    if (stopSim || live) return;
    store.setSource("sim");
    stopSim = startEngine();
  };
  const fallbackTimer = window.setTimeout(fallback, 2500);

  try {
    ws = new WebSocket(url);
  } catch {
    fallback();
    return () => stopSim?.();
  }

  ws.onopen = () => window.clearTimeout(fallbackTimer);
  ws.onmessage = (ev) => {
    live = true;
    window.clearTimeout(fallbackTimer);
    if (stopSim) {
      stopSim();
      stopSim = null;
    }
    try {
      applyEvent(JSON.parse(ev.data) as WireEvent);
    } catch {
      /* ignore malformed frame */
    }
  };
  ws.onclose = () => {
    if (!live) fallback();
    else store.setSource("sim");
  };
  ws.onerror = () => ws?.close();

  return () => {
    window.clearTimeout(fallbackTimer);
    ws?.close();
    stopSim?.();
  };
}
