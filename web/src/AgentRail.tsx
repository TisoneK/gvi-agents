import { Radar, Microscope, ShieldCheck, Scale, Swords, Eye } from "lucide-react";
import type { Agent, AgentId } from "./types";
import { store } from "./store";
import { useStoreVersion } from "./useStore";

const ICON: Record<AgentId, typeof Radar> = {
  hunter: Radar,
  researcher: Microscope,
  verifier: ShieldCheck,
  evaluator: Scale,
  strategist: Swords,
  monitor: Eye,
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 54;
  const h = 16;
  const pts = data.length
    ? data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - v * h}`).join(" ")
    : `0,${h} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function AgentRow({ a }: { a: Agent }) {
  const Icon = ICON[a.id];
  const working = a.state === "working";
  return (
    <div className={"agent-row" + (working ? " is-working" : "")}>
      <div className="agent-icon" style={{ color: a.color, borderColor: hexA(a.color, working ? 0.6 : 0.2), background: hexA(a.color, working ? 0.12 : 0.04) }}>
        <Icon size={17} strokeWidth={1.7} />
        {working && <span className="agent-ring" style={{ borderColor: a.color }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="agent-top">
          <span className="agent-name">{a.name}</span>
          <span className="agent-role">{a.role}</span>
        </div>
        <div className="agent-activity" style={{ color: working ? hexA(a.color, 0.95) : undefined }}>
          <span className="agent-dot" style={{ background: working ? a.color : "#3a4150", boxShadow: working ? `0 0 4px ${a.color}99` : "none" }} />
          {a.activity}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <Sparkline data={a.pulse} color={a.color} />
        <div className="agent-count">{a.tasksDone}</div>
      </div>
    </div>
  );
}

export default function AgentRail() {
  useStoreVersion();
  return (
    <div className="rail">
      <div className="rail-head">
        <span>Agents</span>
        <span className="rail-sub">{store.agents.filter((a) => a.state === "working").length} active</span>
      </div>
      {store.agents.map((a) => (
        <AgentRow key={a.id} a={a} />
      ))}
    </div>
  );
}

function hexA(hex: string, al: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${al})`;
}
