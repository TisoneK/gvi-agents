import { useEffect } from "react";
import TopBar from "./TopBar";
import AgentRail from "./AgentRail";
import AlertFeed from "./AlertFeed";
import GraphCanvas from "./GraphCanvas";
import { startDataSource } from "./wsClient";
import { store } from "./store";
import { useStoreVersion } from "./useStore";

const LEGEND: { label: string; color: string }[] = [
  { label: "surface", color: "#8AA4B8" },
  { label: "discovered", color: "#6B7585" },
  { label: "investigating", color: "#6089C2" },
  { label: "verified", color: "#46C4AE" },
  { label: "actionable", color: "#D4A24E" },
  { label: "flagged", color: "#CC6E5C" },
  { label: "payer", color: "#9484C0" },
];

function StatusBar() {
  useStoreVersion();
  const surfaces = store.nodes.filter((n) => n.kind === "surface").length;
  const lastAt = store.alerts[0]?.at;
  const lastAgo = lastAt ? Math.floor((Date.now() - lastAt) / 1000) : null;
  return (
    <div className="statusbar">
      <div className="legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="status-right">
        <span className="live-dot" style={store.source === "sim" ? { background: "#D4A24E" } : undefined} />
        <b>{store.source === "live" ? "LIVE BACKEND" : store.source === "sim" ? "SIM (offline)" : "CONNECTING"}</b>
        {store.mode ? ` · ${store.mode}` : ""} · {surfaces} surfaces{lastAgo != null ? ` · last event ${lastAgo}s` : ""}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => startDataSource(), []);

  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <aside className="col-left">
          <AgentRail />
        </aside>

        <main className="col-center">
          <GraphCanvas />
          <div className="graph-overlay-top">
            <span className="overlay-label">Opportunity graph</span>
            <span className="overlay-hint">live · hover a node to inspect</span>
          </div>
          <StatusBar />
        </main>

        <aside className="col-right">
          <AlertFeed />
        </aside>
      </div>
    </div>
  );
}
