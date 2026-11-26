import { store } from "./store";
import { useStoreVersion, useTick } from "./useStore";

// The presence speaks rarely, in first person, and only when it has something
// to say — a fresh finding, or an explanation when you click an organism.
// Otherwise it is silent (resting). No log, no narration.

function fmtUSD(v?: number): string {
  if (!v) return "some value";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}
function close(deadline?: number): string {
  if (deadline == null) return "no fixed deadline";
  const h = (deadline - Date.now()) / 3600000;
  if (h <= 0) return "closing now";
  if (h < 1) return `closing in ${Math.round(h * 60)} minutes`;
  if (h < 48) return `closing in ${Math.round(h)} hours`;
  return `closing in ${Math.round(h / 24)} days`;
}

function line(): string | null {
  // explaining a clicked organism takes priority — a direct answer to you
  const sel = store.selected();
  if (sel && sel.kind === "opportunity") {
    const st = sel.state ?? "discovered";
    const advice = st === "actionable" ? " I'd claim it." : st === "flagged" ? " I wouldn't touch it." : "";
    return `${sel.label} — I put this near ${fmtUSD(sel.value)}, ${st}, ${close(sel.deadline)}.${advice}`;
  }
  // otherwise it speaks ONLY when something needs you, and only while fresh.
  // It never narrates confirmations, flags, stacks or surfaces.
  const a = store.alerts[0];
  if (a && Date.now() - a.at < 5000) {
    const n = a.oppId ? store.nodes.find((x) => x.id === a.oppId) : null;
    if (!n) return null;
    if (a.severity === "decaying") return `${n.label} is slipping away, ${close(n.deadline)}. I'd grab it.`;
    if (n.state === "actionable") return `I've got ${n.label} ready — around ${fmtUSD(n.value)}. Worth claiming.`;
  }
  return null; // silence is resting
}

export default function Voice() {
  useStoreVersion();
  useTick(1000);
  const text = line();
  return (
    <div className="voice">
      {text && (
        <span key={text} className="voice-line">
          {text}
        </span>
      )}
    </div>
  );
}
