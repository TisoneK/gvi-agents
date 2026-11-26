import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { store } from "./store";
import { useStoreVersion } from "./useStore";

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat">
      <div className="stat-val" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function TopBar() {
  useStoreVersion();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const up = Math.floor((now - store.startedAt) / 1000);
  const upStr = `${String(Math.floor(up / 3600)).padStart(2, "0")}:${String(Math.floor((up % 3600) / 60)).padStart(2, "0")}:${String(up % 60).padStart(2, "0")}`;
  const clock = new Date(now).toUTCString().slice(17, 25);
  const m = store.metrics;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Radar size={20} strokeWidth={1.7} />
        </div>
        <div>
          <div className="brand-name">
            GLOBAL VALUE INTELLIGENCE
          </div>
          <div className="brand-sub">
            <span className="live-dot" /> autonomous · live · mission: <b>{store.mission}</b>
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat label="tracked" value={m.tracked} />
        <Stat label="investigating" value={m.investigating} color="#4F9BFF" />
        <Stat label="verified" value={m.verified} color="#2EE6C9" />
        <Stat label="flagged" value={m.flagged} color="#FF4D4D" />
        <Stat label="alerts" value={m.alertsToday} color="#FFC24B" />
      </div>

      <div className="clock">
        <div className="clock-time">{clock} UTC</div>
        <div className="clock-up">uptime {upStr}</div>
      </div>
    </header>
  );
}
