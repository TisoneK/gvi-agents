// Core data model for Global Value Intelligence (GVI).
// These shapes are the contract between the frontend view and the backend
// event stream. The simulated engine emits exactly these events, so a real
// WebSocket source is a drop-in replacement.

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
  color: string;
  state: AgentState;
  activity: string; // what it is doing right now
  tasksDone: number;
  focus?: string; // id of the node it is currently working on (drives the thread)
}

export type NodeKind =
  | "core"
  | "surface"
  | "opportunity"
  | "evidence"
  | "payer";

// The lifecycle an opportunity moves through. Distinct states are a core
// requirement: the system separates discovered vs verified vs actionable.
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
  parent?: string; // id of the node it grew from (surface, or opp for evidence/payer)

  // --- orbit meaning: position & size are data, not physics ---
  ecosystem?: string; // the wedge (angle) this opportunity belongs to
  value?: number; // estimated USD value — drives body size
  deadline?: number; // ms timestamp the opportunity closes — drives radius (time left)
  score?: number; // 0..100 evaluator score
  sources?: number; // evidence count, shown in the detail sheet

  // --- render state (owned by the orbit renderer, kept here for pings/threads) ---
  x: number;
  y: number;
  born: number; // perf timestamp of spawn, for the arrival animation
  r: number; // current animated orbital radius (px from center)
  a: number; // current animated angle (radians)
  tr?: number; // target radius
  ta?: number; // target angle
  size: number; // current body radius in px
  flareAt?: number; // perf timestamp when it crossed the center (expire flare)
  claimAt?: number; // perf timestamp it was claimed — animates into the core
  dismissAt?: number; // perf timestamp it was dismissed — drifts out and fades
  wob: number; // per-organism phase, so none pulse in lockstep
  changedAt?: number; // perf timestamp of its last state change (for "what changed")
}

export interface GEdge {
  id: string;
  a: string;
  b: string;
  born: number;
  active?: boolean; // a compounding relationship between two opportunities
}

export type AlertSeverity = "verified" | "flagged" | "decaying" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  text: string;
  at: number;
  agent?: AgentId;
  oppId?: string; // the opportunity this alert is about, if any
}

export interface Metrics {
  tracked: number;
  investigating: number;
  verified: number;
  actionable: number;
  flagged: number;
  alertsToday: number;
}

// A transient visual effect: a ripple radiating from a point.
export interface CrawlPing {
  id: string;
  x: number;
  y: number;
  born: number;
  color: string;
}
