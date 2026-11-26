// Domain + wire types for the GVI backend. The wire events are the contract
// with the frontend: the server emits these over WebSocket and the browser
// applies them to its render store.

export type AgentId =
  | "hunter"
  | "researcher"
  | "verifier"
  | "evaluator"
  | "strategist"
  | "monitor";

export type AgentState = "idle" | "working" | "blocked";
export type NodeKind = "core" | "surface" | "opportunity" | "evidence" | "payer";
export type OppState =
  | "discovered"
  | "investigating"
  | "verified"
  | "flagged"
  | "actionable"
  | "expired";
export type AlertSeverity = "verified" | "flagged" | "decaying" | "info";

// A wire node carries only domain data — render positions live in the browser.
export interface WireNode {
  id: string;
  kind: NodeKind;
  label: string;
  state?: OppState;
  parent?: string;
  score?: number;
  r: number;
}

export interface WireEdge {
  id: string;
  a: string;
  b: string;
  active?: boolean;
}

export interface AgentSnap {
  id: AgentId;
  state: AgentState;
  activity: string;
  tasksDone: number;
}

export interface AlertSnap {
  id: string;
  severity: AlertSeverity;
  text: string;
  at: number;
  agent?: AgentId;
}

export interface Metrics {
  tracked: number;
  investigating: number;
  verified: number;
  flagged: number;
  alertsToday: number;
}

// Events appended to the log AND broadcast to clients (discriminated on `t`).
export type WireEvent =
  | { t: "snapshot"; nodes: WireNode[]; edges: WireEdge[]; agents: AgentSnap[]; alerts: AlertSnap[]; metrics: Metrics; mission: string; startedAt: number; mode: string }
  | { t: "node.add"; node: WireNode }
  | { t: "node.state"; id: string; state: OppState; score?: number }
  | { t: "edge.add"; edge: WireEdge }
  | { t: "ping"; nodeId: string; color: string }
  | { t: "agent"; id: AgentId; state?: AgentState; activity?: string; bump?: boolean }
  | { t: "alert"; id: string; severity: AlertSeverity; text: string; at: number; agent?: AgentId }
  | { t: "mission"; mission: string };

// A research note is the persistent, auditable record of what an agent found,
// with the evidence sources it relied on. This is the "research history".
export interface ResearchNote {
  id: string;
  oppId: string;
  agent: AgentId;
  at: number;
  summary: string;
  sources: string[];
}
