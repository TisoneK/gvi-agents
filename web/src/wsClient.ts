import { store } from "./store";
import { startEngine } from "./engine";
import type { AgentId, OppState } from "./types";

// Wire protocol mirror (kept in sync with server/src/types.ts WireEvent).
type WireNode = { id: string; kind: string; label: string; state?: OppState; parent?: string; score?: number; r: number };
type WireEdge = { id: string; a: string; b: string; active?: boolean };
type WireEvent =
  | { t: "snapshot"; nodes: WireNode[]; edges: WireEdge[]; agents: { id: AgentId; state: "idle" | "working" | "blocked"; activity: string; tasksDone: number }[]; alerts: { id: string; severity: "verified" | "flagged" | "decaying" | "info"; text: string; at: number; agent?: AgentId }[]; metrics: { tracked: number; investigating: number; verified: number; flagged: number; alertsToday: number }; mission: string; startedAt: number; mode: string }
  | { t: "node.add"; node: WireNode }
  | { t: "node.state"; id: string; state: OppState; score?: number }
  | { t: "edge.add"; edge: WireEdge }
  | { t: "ping"; nodeId: string; color: string }
  | { t: "agent"; id: AgentId; state?: "idle" | "working" | "blocked"; activity?: string; bump?: boolean }
  | { t: "alert"; id: string; severity: "verified" | "flagged" | "decaying" | "info"; text: string; at: number; agent?: AgentId }
  | { t: "mission"; mission: string };

function applyEvent(e: WireEvent) {
  switch (e.t) {
    case "snapshot":
      store.loadSnapshot({ nodes: e.nodes as never, edges: e.edges, agents: e.agents, alerts: e.alerts, metrics: e.metrics, mission: e.mission, startedAt: e.startedAt });
      store.setSource("live", e.mode);
      break;
    case "node.add":
      store.addNode(e.node as never);
      break;
    case "node.state":
      store.setNodeState(e.id, e.state, e.score);
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
      store.setAgent(e.id, { state: e.state, activity: e.activity, bump: e.bump });
      break;
    case "alert":
      store.applyAlert({ id: e.id, severity: e.severity, text: e.text, at: e.at, agent: e.agent });
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
    else store.setSource("sim"); // backend dropped; keep showing last state
  };
  ws.onerror = () => ws?.close();

  return () => {
    window.clearTimeout(fallbackTimer);
    ws?.close();
    stopSim?.();
  };
}
