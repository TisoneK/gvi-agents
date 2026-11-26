// Core data model for Global Value Intelligence (GVI).
// These shapes are the contract between the frontend view and the (future)
// backend event stream. The simulated engine emits exactly these events, so
// swapping in a real WebSocket source is a drop-in replacement.

export type AgentId =
  | "hunter"
  | "researcher"
  | "verifier"
  | "evaluator"
  | "strategist"
  | "monitor";

export type AgentState = "idle" | "working" | "blocked";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  icon: string; // tabler-like glyph name rendered via our inline icon set
  color: string;
  state: AgentState;
  activity: string; // what it is doing right now
  tasksDone: number;
  pulse: number[]; // recent activity intensity, for the sparkline
}

export type NodeKind =
  | "core"
  | "surface"
  | "opportunity"
  | "evidence"
  | "payer";

// The lifecycle an opportunity moves through. Distinct states are a core
// requirement: the system must separate discovered vs verified vs actionable.
export type OppState =
  | "discovered"
  | "investigating"
  | "verified"
  | "flagged"
  | "actionable"
  | "expired";

export interface GNode {
  id: string;
  kind: NodeKind;
  label: string;
  state?: OppState;
  // physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number; // radius
  // animation
  born: number; // timestamp of spawn, for the spawn-in animation
  parent?: string; // id of the node it grew from
  score?: number; // 0..100 evaluator score, if assessed
}

export interface GEdge {
  id: string;
  a: string;
  b: string;
  born: number;
  active?: boolean; // currently carrying a pulse of activity
}

export type AlertSeverity = "verified" | "flagged" | "decaying" | "info";

export interface Alert {
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

// A transient visual effect: a crawl ping radiating from a point.
export interface CrawlPing {
  id: string;
  x: number;
  y: number;
  born: number;
  color: string;
}
