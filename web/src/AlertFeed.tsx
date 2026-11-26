import { Bell, ShieldCheck, AlertTriangle, Clock, Info } from "lucide-react";
import type { Alert, AlertSeverity } from "./types";
import { store } from "./store";
import { useStoreVersion } from "./useStore";

const SEV: Record<AlertSeverity, { color: string; label: string; icon: typeof Info }> = {
  verified: { color: "#2EE6C9", label: "verified", icon: ShieldCheck },
  flagged: { color: "#FF4D4D", label: "flagged", icon: AlertTriangle },
  decaying: { color: "#FFC24B", label: "decaying", icon: Clock },
  info: { color: "#7FA8C9", label: "intel", icon: Info },
};

function ago(at: number) {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function Row({ a }: { a: Alert }) {
  const s = SEV[a.severity];
  const Icon = s.icon;
  return (
    <div className="alert-row">
      <span className="alert-tag" style={{ color: s.color, background: hexA(s.color, 0.12), borderColor: hexA(s.color, 0.3) }}>
        <Icon size={11} strokeWidth={2} /> {s.label}
      </span>
      <span className="alert-text">{a.text}</span>
      <span className="alert-time">{ago(a.at)}</span>
    </div>
  );
}

export default function AlertFeed() {
  useStoreVersion();
  return (
    <div className="feed">
      <div className="feed-head">
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Bell size={14} strokeWidth={1.8} style={{ color: "#7FA8C9" }} /> Live alert feed
        </span>
        <span className="feed-sub">
          <span className="tg-dot" /> pushed to Telegram
        </span>
      </div>
      <div className="feed-body">
        {store.alerts.length === 0 && <div className="feed-empty">Listening…</div>}
        {store.alerts.map((a) => (
          <Row key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function hexA(hex: string, al: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${al})`;
}
