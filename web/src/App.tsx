import { Fragment, useEffect } from "react";
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

// The stakes, in context — not a counter row. What can you grab, what have
// you banked, what has already slipped away.
function Ledger() {
  useStoreVersion();
  useTick(1000);
  const ready = store.nodes.filter((n) => n.kind === "opportunity" && n.state === "actionable" && !n.claimAt && !n.dismissAt).length;
  const parts: { cls: string; text: string }[] = [];
  if (ready > 0) parts.push({ cls: "ledger-ready", text: `${ready} ready to claim` });
  if (store.captured > 0) parts.push({ cls: "ledger-pos", text: `${fmtUSD(store.captured)} banked` });
  if (store.lost > 0) parts.push({ cls: "ledger-neg", text: `${fmtUSD(store.lost)} lost so far` });
  return (
    <div className="ledger mono">
      {parts.length === 0 ? (
        <span className="ledger-quiet">surveying…</span>
      ) : (
        parts.map((p, i) => (
          <Fragment key={p.cls}>
            {i > 0 && <span className="ledger-sep">·</span>}
            <span className={p.cls}>{p.text}</span>
          </Fragment>
        ))
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => startDataSource(), []);
  return (
    <div className="app">
      <Presence />
      <div className="top-scrim" />
      <div className="wordmark">GVI</div>
      <Ledger />
      <Voice />
      <Queue />
      <Autonomy />
    </div>
  );
}
