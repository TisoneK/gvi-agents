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
  // explaining a clicked organism takes priority
  const sel = store.selected();
  if (sel && sel.kind === "opportunity") {
    const st = sel.state ?? "discovered";
    const advice = st === "actionable" ? " I'd claim it." : st === "flagged" ? " I wouldn't touch it." : "";
    return `${sel.label} — I put this near ${fmtUSD(sel.value)}, ${st}, ${close(sel.deadline)}.${advice}`;
  }
  // otherwise, the most recent finding — but only while it's fresh (~6s)
  const a = store.alerts[0];
  if (a && Date.now() - a.at < 6000) {
    const n = a.oppId ? store.nodes.find((x) => x.id === a.oppId) : null;
    const label = n?.label ?? "";
    if (a.severity === "verified") return label ? `Confirmed ${label}. It holds up.` : a.text;
    if (a.severity === "flagged") return label ? `${label} doesn't hold up — I flagged it.` : a.text;
    if (a.severity === "decaying") return label ? `${label} is slipping away, ${close(n?.deadline)}.` : a.text;
    return a.text; // stacks, new surfaces, coming online
  }
  return null;
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
