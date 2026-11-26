import { useEffect } from "react";
import Presence from "./Presence";
import Voice from "./Voice";
import Queue from "./Queue";
import Autonomy from "./Autonomy";
import { startDataSource } from "./wsClient";
import { store } from "./store";
import { useStoreVersion, useTick } from "./useStore";

function fmtUSD(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

// The stakes: value banked vs value lost to decay. Quiet, not a counter row.
function Ledger() {
  useStoreVersion();
  useTick(1000);
  return (
    <div className="ledger mono">
      <span className="ledger-pos">{fmtUSD(store.captured)} banked</span>
      {store.lost > 0 && <span className="ledger-neg">{fmtUSD(store.lost)} lost to decay</span>}
    </div>
  );
}

export default function App() {
  useEffect(() => startDataSource(), []);
  return (
    <div className="app">
      <Presence />
      <div className="wordmark">GVI</div>
      <Ledger />
      <Voice />
      <Queue />
      <Autonomy />
    </div>
  );
}
