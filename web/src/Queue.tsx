import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { GNode, OppState } from "./types";
import { store, STATE_COLOR } from "./store";
import { presenceState } from "./Presence";
import { useStoreVersion, useTick } from "./useStore";

// The action queue is a LIVING OBJECT, not a docked column. Three states:
//   collapsed — one line + count, pulsing faster the more urgent things are
//   peek      — top items; opens itself when the presence needs a decision
//   expanded  — a floating sheet over the dimmed scene, filters inside
// It stays linked to the scene (hovering an item lifts its organism; acting
// on it visibly moves the node) and it collapses itself after you act.

type Mode = "collapsed" | "peek" | "expanded";
type Filter = "all" | "actionable" | "decaying" | "flagged";

function hoursLeft(n: GNode): number | null {
  return n.deadline != null ? (n.deadline - Date.now()) / 3600000 : null;
}
function fmtUSD(v?: number): string {
  if (!v) return "—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}
function fmtClose(h: number | null): string {
  if (h == null) return "no deadline";
  if (h <= 0) return "closing now";
  if (h < 1) return `${Math.round(h * 60)}m left`;
  if (h < 48) return `${Math.round(h)}h left`;
  return `${Math.round(h / 24)}d left`;
}
const STAGE: Record<OppState, string> = {
  discovered: "Discovered",
  investigating: "Investigating",
  verified: "Verified",
  actionable: "Ready",
  flagged: "Flagged",
  expired: "Expired",
};

function queueItems() {
  const opps = store.nodes.filter(
    (n) => n.kind === "opportunity" && !n.claimAt && !n.dismissAt && n.state !== "expired" && n.state !== "discovered"
  );
  const needs = opps
    .filter((n) => n.state === "actionable" || (hoursLeft(n) != null && hoursLeft(n)! <= 24 && n.state !== "flagged"))
    .sort((a, b) => (hoursLeft(a) ?? 1e9) - (hoursLeft(b) ?? 1e9));
  const needIds = new Set(needs.map((n) => n.id));
  const watching = opps
    .filter((n) => !needIds.has(n.id))
    .sort((a, b) => (hoursLeft(a) ?? 1e9) - (hoursLeft(b) ?? 1e9));
  return { needs, watching };
}

export default function Queue() {
  useStoreVersion();
  useTick(1000);
  const [mode, setMode] = useState<Mode>("collapsed");
  const [filter, setFilter] = useState<Filter>("all");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const lastNeed = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { needs, watching } = queueItems();
  const { need } = presenceState();

  // place the object out of the way initially (bottom-right), measured against
  // the chip that actually renders so it hugs the corner on any width
  useEffect(() => {
    if (pos) return;
    const w = Math.min(130, window.innerWidth - 20);
    setPos({ x: window.innerWidth - w - 16, y: window.innerHeight - 150 });
  }, [pos]);

  // the queue opens ITSELF only when a decision newly appears (null → need),
  // never on every follow-up — so at rest the scene is the only thing on screen.
  // It sits on the side away from the node so it never covers what it's about.
  useEffect(() => {
    const id = need?.id ?? null;
    const prev = lastNeed.current;
    if (id && !prev) {
      setMode((m) => (m === "expanded" ? m : "peek"));
      const onRight = Math.cos(need!.a) > 0;
      const w = Math.min(300, window.innerWidth - 20);
      setPos({ x: onRight ? 20 : window.innerWidth - w - 12, y: Math.max(96, window.innerHeight * 0.3) });
    }
    lastNeed.current = id;
  }, [need?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // drag by the handle
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos(fitPos(panelRef.current, e.clientX - drag.current.dx, e.clientY - drag.current.dy));
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);
  const startDrag = (e: React.MouseEvent) => {
    if (!pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  // opening a bigger sheet, filtering, or the window changing size can all push
  // the panel past an edge — re-fit it against its measured size afterwards
  useEffect(() => {
    const fit = () => setPos((p) => (p ? fitPos(panelRef.current, p.x, p.y) : p));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [mode, filter]);

  const act = (id: string, kind: "claim" | "dismiss") => {
    kind === "claim" ? store.claim(id) : store.dismiss(id);
    store.setHover(null);
    setMode("collapsed"); // collapses itself after use
  };

  if (!pos) return null;
  const urgentCount = needs.length;
  const soonest = needs.length ? hoursLeft(needs[0]) : null;
  // pulse faster the closer the soonest deadline
  const pulseDur = soonest == null ? 3.4 : clamp(soonest / 12, 0.5, 3.4);

  const style: React.CSSProperties = { left: pos.x, top: pos.y };

  // ---------- collapsed ----------
  if (mode === "collapsed") {
    return (
      <div ref={panelRef} className="q-float collapsed" style={style} onMouseDown={startDrag} onClick={() => setMode(urgentCount ? "peek" : "expanded")}>
        <span
          className={"q-pulse" + (urgentCount ? " live" : "")}
          style={{ animationDuration: `${pulseDur}s` }}
        />
        {urgentCount ? (
          <span>
            <b>{urgentCount}</b> need{urgentCount > 1 ? "" : "s"} you
          </span>
        ) : (
          <span className="q-quiet">all clear</span>
        )}
      </div>
    );
  }

  const topId = needs[0]?.id; // the single most urgent — the only gold button

  const renderItem = (n: GNode, compact = false) => {
    const h = hoursLeft(n);
    const st = n.state ?? "discovered";
    const urgent = st === "flagged" || (h != null && h <= 24);
    const isTop = n.id === topId;
    // time-left as a heat color, so urgency has a gradient
    const ageColor = h == null ? "var(--text-faint)" : h <= 6 ? "var(--alarm)" : h <= 24 ? "var(--gold)" : "var(--steel)";
    return (
      <div
        key={n.id}
        className={"q-item" + (urgent ? " urgent" : "") + (isTop ? " ready" : "")}
        onMouseEnter={() => store.setHover(n.id)}
        onMouseLeave={() => store.setHover(null)}
        onClick={() => store.setSelected(n.id)}
      >
        <div className="q-item-top">
          <span className="q-stage">
            <span className="q-dot" style={{ background: STATE_COLOR[st] }} /> {STAGE[st]}
          </span>
          <span className="q-age" style={{ color: ageColor }}>{fmtClose(h)}</span>
        </div>
        <div className="q-title">{n.label}</div>
        {!compact && (
          <div className="q-meta mono">
            {fmtUSD(n.value)} · {n.sources ?? 0} src{n.score != null ? ` · ${n.score}/100` : ""}
          </div>
        )}
        <div className="q-actions">
          {(st === "actionable" || st === "verified") && (
            <button
              className={"q-btn" + (isTop ? " primary" : "")}
              onClick={(e) => {
                e.stopPropagation();
                act(n.id, "claim");
              }}
            >
              Claim
            </button>
          )}
          <button
            className="q-btn"
            onClick={(e) => {
              e.stopPropagation();
              act(n.id, "dismiss");
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  // ---------- peek ----------
  if (mode === "peek") {
    const top = [...needs, ...watching].slice(0, 2); // only one or two, never a panel
    const extra = needs.length + watching.length - top.length;
    return (
      <div ref={panelRef} className="q-float peek" style={style}>
        <div className="q-handle" onMouseDown={startDrag}>
          <span className="q-handle-title">{need ? "Needs your call" : "On watch"}</span>
          <div className="q-handle-btns">
            <button className="q-mini" onClick={() => setMode("expanded")}>⤢</button>
            <button className="q-mini" onClick={() => setMode("collapsed")}>✕</button>
          </div>
        </div>
        {top.length === 0 && <div className="q-empty">Nothing yet — still surveying.</div>}
        {top.map((n) => renderItem(n, true))}
        {extra > 0 && (
          <button className="q-more" onClick={() => setMode("expanded")}>
            {extra} more
          </button>
        )}
      </div>
    );
  }

  // ---------- expanded ----------
  const match = (n: GNode) => {
    if (filter === "all") return true;
    if (filter === "actionable") return n.state === "actionable";
    if (filter === "flagged") return n.state === "flagged";
    const h = hoursLeft(n);
    return h != null && h <= 72;
  };
  const eNeeds = needs.filter(match);
  const eWatch = watching.filter(match);
  return (
    <>
      <div className="q-backdrop" onClick={() => setMode("collapsed")} />
      <div ref={panelRef} className="q-float expanded" style={style}>
        <div className="q-handle" onMouseDown={startDrag}>
          <span className="q-handle-title">Action queue</span>
          <div className="q-handle-btns">
            <button className="q-mini" onClick={() => setMode("peek")}>▾</button>
            <button className="q-mini" onClick={() => setMode("collapsed")}>✕</button>
          </div>
        </div>
        <div className="q-filters">
          {(["all", "actionable", "decaying", "flagged"] as Filter[]).map((f) => (
            <button key={f} className={"q-chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="q-list">
          {eNeeds.length === 0 && eWatch.length === 0 && <div className="q-empty">Nothing matches — still surveying.</div>}
          {eNeeds.length > 0 && <div className="q-sec hot">Needs action</div>}
          {eNeeds.map((n) => renderItem(n))}
          {eWatch.length > 0 && <div className="q-sec">Watching</div>}
          {eWatch.map((n) => renderItem(n))}
        </div>
      </div>
    </>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Keep the queue fully inside the viewport, using the panel's real size when it
// is mounted (a hardcoded width left the sheet hanging off narrow screens).
function fitPos(el: HTMLElement | null, x: number, y: number) {
  const w = el?.offsetWidth ?? Math.min(300, window.innerWidth - 20);
  const h = el?.offsetHeight ?? 120;
  return {
    x: clamp(x, 8, Math.max(8, window.innerWidth - w - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - h - 8)),
  };
}
