import { useEffect, useRef } from "react";
import { store } from "./store";
import type { AgentId, GNode } from "./types";

// ──────────────────────────────────────────────────────────────────────────
// THE PRESENCE — not a screen you read, a thing you watch.
//
// One living presence hunts for value in a dark world. Its state is shown by
// how it MOVES, never by a label: resting breathes slow and dim, hunting is
// quick and reaches out, waiting-on-you leans toward what it needs. Each
// opportunity is a small organism — its heartbeat is its urgency, it dims and
// flickers as it decays, it firms up when the presence verifies it. Your
// actions are physical: claim and it's pulled in and absorbed; dismiss and it
// drifts away. The whole scene warms as deadlines stack up. Position still
// means something — close to the core is closing soon — but there is no grid.
// ──────────────────────────────────────────────────────────────────────────

const GOLD = "#f0b545";

const AGENT_ORDER: AgentId[] = ["hunter", "researcher", "verifier", "evaluator", "strategist", "monitor"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

// temperature: t=1 far/cool (steel-blue) → t=0 near/hot (gold). Three clear
// bands so the cool→hot gradient actually reads instead of a muddy middle.
function temp(t: number): [number, number, number] {
  const gold: [number, number, number] = [242, 185, 74];
  const tan: [number, number, number] = [205, 158, 96];
  const steel: [number, number, number] = [78, 142, 172];
  if (t <= 0.3) {
    const k = t / 0.3;
    return [lerp(gold[0], tan[0], k), lerp(gold[1], tan[1], k), lerp(gold[2], tan[2], k)];
  }
  if (t <= 0.6) {
    const k = (t - 0.3) / 0.3;
    return [lerp(tan[0], steel[0], k), lerp(tan[1], steel[1], k), lerp(tan[2], steel[2], k)];
  }
  return steel;
}
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

function valueToSize(v: number | undefined): number {
  if (!v || v <= 0) return 5;
  return clamp(3.5 + Math.log10(Math.max(v, 100)) * 2.1, 4, 16);
}

export type PresenceState = "resting" | "hunting" | "waiting";

// exported so the Voice overlay can read the same derived state
export function presenceState(): { state: PresenceState; need: GNode | null } {
  const now = Date.now();
  const opps = store.nodes.filter((n) => n.kind === "opportunity" && !n.claimAt && !n.dismissAt && n.state !== "expired");
  const need =
    opps
      .filter((n) => (n.state === "actionable" || n.state === "verified") && n.deadline != null && n.deadline - now < 24 * 3600_000)
      .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0))[0] ?? null;
  if (need) return { state: "waiting", need };
  if (store.agents.some((a) => a.state === "working")) return { state: "hunting", need: null };
  return { state: "resting", need: null };
}

export default function Presence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -9999, y: -9999, over: false, lastMove: 0 });
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const cam = useRef({ scale: 1, ox: 0, oy: 0, dragging: false, lastX: 0, lastY: 0, moved: 0 });
  const att = useRef({ x: 0, y: 0 }); // attention point (world coords)
  const core = useRef({ x: 0, y: 0, glow: 0 });
  const startle = useRef(0); // perf time of a "noticed you came back" reaction

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const wrap = wrapRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { w: wrap.clientWidth, h: wrap.clientHeight, dpr };
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = wrap.clientWidth + "px";
      canvas.style.height = wrap.clientHeight + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const toWorld = (mx: number, my: number) => {
      const cx = size.current.w / 2;
      const cy = size.current.h / 2;
      const c = cam.current;
      return { x: (mx - (cx + c.ox)) / c.scale, y: (my - (cy + c.oy)) / c.scale };
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // a return after being away makes it startle
      if (performance.now() - mouse.current.lastMove > 14000 && mouse.current.lastMove > 0) {
        startle.current = performance.now();
      }
      mouse.current.x = mx;
      mouse.current.y = my;
      mouse.current.over = true;
      mouse.current.lastMove = performance.now();
      const c = cam.current;
      if (c.dragging) {
        c.ox += mx - c.lastX;
        c.oy += my - c.lastY;
        c.moved += Math.abs(mx - c.lastX) + Math.abs(my - c.lastY);
        c.lastX = mx;
        c.lastY = my;
      }
    };
    const onLeave = () => (mouse.current.over = false);
    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const c = cam.current;
      c.dragging = true;
      c.moved = 0;
      c.lastX = e.clientX - rect.left;
      c.lastY = e.clientY - rect.top;
    };
    const onUp = (e: MouseEvent) => {
      const c = cam.current;
      const wasDrag = c.moved > 5;
      c.dragging = false;
      if (wasDrag) return;
      const rect = canvas.getBoundingClientRect();
      const { x: wx, y: wy } = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      let hitId: string | null = null;
      let hd = 1e9;
      for (const n of store.nodes) {
        if (n.kind !== "opportunity" || n.state === "expired" || n.claimAt || n.dismissAt || Number.isNaN(n.a)) continue;
        const d = Math.hypot(wx - n.x, wy - n.y);
        if (d < Math.max(n.size, 8) + 8 && d < hd) {
          hd = d;
          hitId = n.id;
        }
      }
      store.setSelected(hitId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = size.current.w / 2;
      const cy = size.current.h / 2;
      const c = cam.current;
      const before = { x: (mx - (cx + c.ox)) / c.scale, y: (my - (cy + c.oy)) / c.scale };
      c.scale = clamp(c.scale * Math.exp(-e.deltaY * 0.0014), 0.5, 5);
      c.ox = mx - cx - before.x * c.scale;
      c.oy = my - cy - before.y * c.scale;
    };
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // polar position (no visible grid): radius = time left, angle = ecosystem
    const timeToRadius = (hoursLeft: number | null, maxR: number, rMin: number): number => {
      if (hoursLeft == null) return maxR * 0.98;
      const anchors: [number, number][] = [
        [0, rMin],
        [24, rMin + (maxR - rMin) * 0.34],
        [72, rMin + (maxR - rMin) * 0.58],
        [168, rMin + (maxR - rMin) * 0.78],
        [720, maxR * 0.96],
      ];
      const h = clamp(hoursLeft, 0, 720);
      for (let i = 0; i < anchors.length - 1; i++) {
        if (h <= anchors[i + 1][0]) {
          const lo = Math.log1p(anchors[i][0]);
          const hi = Math.log1p(anchors[i + 1][0]);
          const t = (Math.log1p(h) - lo) / (hi - lo || 1);
          return lerp(anchors[i][1], anchors[i + 1][1], clamp(t, 0, 1));
        }
      }
      return maxR * 0.96;
    };

    const frame = () => {
      const { w, h, dpr } = size.current;
      const cx = w / 2;
      const cy = h / 2;
      const now = performance.now();
      const nowMs = Date.now();
      const maxR = Math.min(w, h) * 0.42;
      const coreR = 24;
      const rMin = coreR + 26;

      const { state, need } = presenceState();
      const userActive = now - mouse.current.lastMove < 4000;
      const idleFor = now - (mouse.current.lastMove || now);

      // overall urgency drives the mood (sum of value closing within 48h)
      let urgentValue = 0;
      const live = store.nodes.filter((n) => n.kind === "opportunity" && !n.claimAt && !n.dismissAt && n.state !== "expired");
      for (const n of live) {
        if (n.deadline != null && n.deadline - nowMs < 48 * 3600_000) urgentValue += n.value ?? 0;
      }
      const mood = clamp(urgentValue / 160000, 0, 1); // 0 calm → 1 tense (stays calm unless real value is closing)

      // ---------- autonomy: in "act" the presence claims what's about to vanish ----------
      if (store.autonomy === "act") {
        for (const n of live) {
          if (n.state === "actionable" && n.deadline != null && n.deadline - nowMs < 2 * 3600_000) store.claim(n.id);
        }
      }

      // ---------- layout + life for every organism ----------
      const toRemove: string[] = [];
      const toExpire: string[] = [];
      for (const n of store.nodes) {
        if (n.kind !== "opportunity") {
          if (n.kind === "surface" || n.kind === "evidence" || n.kind === "payer") continue;
          // core node (data) — the presence is drawn separately; park it at center
          n.x = 0;
          n.y = 0;
          n.a = 0;
          continue;
        }
        const base = hash01(n.ecosystem ?? n.id) * Math.PI * 2;
        const slot = (hash01(n.id) * 2 - 1) * 0.5;
        const sway = Math.sin(now / 2600 + n.wob) * 0.06;
        const ta = base + slot + sway;
        const hoursLeft = n.deadline != null ? (n.deadline - nowMs) / 3600000 : null;
        if (n.state !== "expired" && hoursLeft != null && hoursLeft <= 0 && !n.claimAt) toExpire.push(n.id);
        let tr = timeToRadius(hoursLeft, maxR, rMin);
        tr += Math.sin(now / 2000 + n.wob * 2) * 5; // gentle breathing drift

        if (Number.isNaN(n.a)) {
          n.a = ta;
          n.r = maxR * 1.15;
          n.size = 0;
          store.ping(Math.cos(ta) * maxR, Math.sin(ta) * maxR, GOLD);
        }

        // claimed: pulled into the core and absorbed
        if (n.claimAt) {
          const k = clamp((now - n.claimAt) / 850, 0, 1);
          n.r = lerp(n.r, 0, k * 0.18 + 0.02);
          n.size = lerp(n.size, 0, 0.06);
          if (k >= 1) {
            core.current.glow = Math.min(core.current.glow + 0.6, 1.6);
            store.ping(0, 0, GOLD);
            toRemove.push(n.id);
          }
        } else if (n.dismissAt) {
          const k = clamp((now - n.dismissAt) / 800, 0, 1);
          n.r = lerp(n.r, maxR * 1.3, 0.05);
          n.size = lerp(n.size, 0, 0.05);
          if (k >= 1) toRemove.push(n.id);
        } else {
          let da = ta - n.a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          n.a += da * 0.06;
          n.r += (tr - n.r) * 0.05;
          n.size += (valueToSize(n.value) - n.size) * 0.1;
          if (n.state === "expired") {
            if (!n.flareAt) n.flareAt = now;
            n.size = lerp(n.size, 0, 0.04);
            if (now - n.flareAt > 1200) toRemove.push(n.id);
          }
          // flagged is a dead end — it lingers a while, then sinks away so the
          // scene stays readable rather than crusting over with rejects
          if (n.state === "flagged" && n.changedAt && now - n.changedAt > 16000) n.dismissAt = now;
        }
        // flagged organisms twitch
        const jitter = n.state === "flagged" ? Math.sin(now / 90 + n.wob) * 1.4 : 0;
        n.x = Math.cos(n.a) * n.r + jitter;
        n.y = Math.sin(n.a) * n.r;
      }
      for (const id of toExpire) store.setNodeState(id, "expired");
      for (const id of toRemove) store.removeNode(id);

      // ---------- attention: what the presence is looking at ----------
      const hovered = (() => {
        if (!mouse.current.over) return null;
        const mw = toWorld(mouse.current.x, mouse.current.y);
        let best: GNode | null = null;
        let bd = 1e9;
        for (const n of store.nodes) {
          if (n.kind !== "opportunity" || n.claimAt || n.dismissAt || n.state === "expired" || Number.isNaN(n.a)) continue;
          const d = Math.hypot(mw.x - n.x, mw.y - n.y);
          if (d < n.size + 10 && d < bd) {
            bd = d;
            best = n;
          }
        }
        return best;
      })();
      // an item the floating queue is pointing at counts as attention too
      const linked = store.hoverId ? store.nodes.find((n) => n.id === store.hoverId) ?? null : null;
      const spot = hovered ?? (linked && !Number.isNaN(linked.a) ? linked : null);

      // choose the attention target (world coords)
      let tx = 0;
      let ty = 0;
      const focusNode = store.agents.map((a) => (a.state === "working" ? store.nodes.find((n) => n.id === a.focus) : null)).find(Boolean) as GNode | undefined;
      const changed = store.lastChangedId ? store.nodes.find((n) => n.id === store.lastChangedId) : null;
      if (spot) {
        tx = spot.x;
        ty = spot.y;
      } else if (now - startle.current < 2200 && changed && !Number.isNaN(changed.a)) {
        tx = changed.x;
        ty = changed.y; // it rushes to what changed while you were away
      } else if (need && !Number.isNaN(need.a)) {
        tx = need.x;
        ty = need.y;
      } else if (focusNode && !Number.isNaN(focusNode.a)) {
        tx = focusNode.x;
        ty = focusNode.y;
      } else if (userActive) {
        const mw = toWorld(mouse.current.x, mouse.current.y);
        tx = mw.x * 0.5;
        ty = mw.y * 0.5;
      } else {
        // restless wander when left alone — grows the longer you're gone
        const wander = clamp(idleFor / 20000, 0.2, 1.4);
        tx = Math.cos(now / 3200) * maxR * 0.4 * wander;
        ty = Math.sin(now / 2600) * maxR * 0.35 * wander;
      }
      att.current.x += (tx - att.current.x) * 0.06;
      att.current.y += (ty - att.current.y) * 0.06;
      // the core leans toward its attention
      core.current.x += (att.current.x * 0.12 - core.current.x) * 0.05;
      core.current.y += (att.current.y * 0.12 - core.current.y) * 0.05;
      core.current.glow = lerp(core.current.glow, 0, 0.02);

      // ---------- draw ----------
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // mood background: calm cool-neutral → tense warm (only when value is actually closing)
      const bgInner = [lerp(12, 30, mood), lerp(14, 16, mood), lerp(14, 10, mood)] as [number, number, number];
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.9);
      grad.addColorStop(0, rgba(bgInner, 1));
      grad.addColorStop(1, "#080908");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const c = cam.current;
      ctx.save();
      ctx.translate(cx + c.ox, cy + c.oy);
      ctx.scale(c.scale, c.scale);

      const attS = att.current;

      // faint "closing soon" zone near the core — a felt warm glow, not a red ring
      const dangerR = rMin + (maxR - rMin) * 0.3;
      const dg = ctx.createRadialGradient(0, 0, dangerR * 0.5, 0, 0, dangerR);
      dg.addColorStop(0, hexA(GOLD, 0));
      dg.addColorStop(1, hexA(GOLD, 0.02 + mood * 0.05));
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(0, 0, dangerR, 0, Math.PI * 2);
      ctx.fill();

      // attention light — softly lifts whatever it rests on
      const alight = ctx.createRadialGradient(attS.x, attS.y, 0, attS.x, attS.y, 120);
      alight.addColorStop(0, hexA("#ede7d3", state === "resting" ? 0.03 : 0.06));
      alight.addColorStop(1, hexA("#ede7d3", 0));
      ctx.fillStyle = alight;
      ctx.beginPath();
      ctx.arc(attS.x, attS.y, 120, 0, Math.PI * 2);
      ctx.fill();

      // work threads: a facet of the presence reaching out to what it's checking
      for (const ag of store.agents) {
        if (ag.state !== "working" || !ag.focus) continue;
        const target = store.nodes.find((n) => n.id === ag.focus);
        if (!target || Number.isNaN(target.a) || target.claimAt) continue;
        const g2 = ctx.createLinearGradient(core.current.x, core.current.y, target.x, target.y);
        g2.addColorStop(0, hexA(GOLD, 0.4));
        g2.addColorStop(1, hexA(GOLD, 0.05));
        ctx.strokeStyle = g2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(core.current.x, core.current.y);
        ctx.quadraticCurveTo(core.current.x * 0.3, core.current.y * 0.3, target.x, target.y);
        ctx.stroke();
        const tt = ((now - ag.focus.length * 11) % 1300) / 1300;
        ctx.fillStyle = hexA(GOLD, 0.85 * (1 - tt));
        ctx.beginPath();
        ctx.arc(lerp(core.current.x, target.x, tt), lerp(core.current.y, target.y, tt), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // compounding bonds (the only lines between organisms)
      for (const e of store.edges) {
        const a = store.nodes.find((x) => x.id === e.a);
        const b = store.nodes.find((x) => x.id === e.b);
        if (!a || !b || a.kind !== "opportunity" || b.kind !== "opportunity") continue;
        if (a.claimAt || b.claimAt || a.dismissAt || b.dismissAt || a.state === "expired" || b.state === "expired") continue;
        ctx.strokeStyle = hexA(GOLD, 0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) * 0.35, (a.y + b.y) * 0.35, b.x, b.y);
        ctx.stroke();
      }

      // ripples
      store.pings = store.pings.filter((p) => now - p.born < 1200);
      for (const p of store.pings) {
        const t = (now - p.born) / 1200;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = (1 - t) * 0.4;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + t * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ---------- organisms ----------
      const sel = store.selectedId;
      for (const n of store.nodes) {
        if (n.kind !== "opportunity" || Number.isNaN(n.a)) continue;
        const stt = n.state ?? "discovered";
        const frac = clamp(n.r / maxR, 0, 1);
        const hoursLeft = n.deadline != null ? (n.deadline - nowMs) / 3600000 : null;
        // heartbeat: fast when closing soon
        const urg = hoursLeft == null ? 0.1 : clamp(1 - hoursLeft / 72, 0, 1);
        const beatFreq = 0.0012 + urg * 0.012;
        const beat = 0.5 + 0.5 * Math.sin(now * beatFreq + n.wob);
        const pulse = 1 + beat * (0.12 + urg * 0.28);

        let col = temp(frac);
        if (stt === "flagged") col = [176, 80, 66]; // muted brick — present but recessive
        else if (stt === "expired") col = [74, 77, 64];
        else if (stt === "actionable") col = [242, 185, 74];

        // confidence → how firm/bright the body is
        const firm = stt === "discovered" ? 0.42 : stt === "investigating" ? 0.58 : stt === "verified" ? 0.82 : stt === "actionable" ? 1 : stt === "flagged" ? 0.4 : 0.3;
        // attention proximity lifts it
        const attBoost = clamp(1 - Math.hypot(n.x - attS.x, n.y - attS.y) / 120, 0, 1) * 0.5;
        // flagged flicker
        const flick = stt === "flagged" ? 0.7 + 0.3 * Math.sin(now / 70 + n.wob * 3) : 1;
        const r = Math.max(n.size, 1.5) * pulse;

        // heartbeat halo
        const haloA = (0.1 + urg * 0.26 + attBoost) * beat * flick;
        if (haloA > 0.02) {
          const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.4);
          halo.addColorStop(0, rgba(col, haloA));
          halo.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // body — a small light, bright enough to read as alive
        ctx.globalAlpha = n.dismissAt ? clamp(1 - (now - n.dismissAt) / 800, 0, 1) : flick;
        const bodyA = clamp(0.4 + firm * 0.5 + attBoost * 0.3, 0, 1);
        const bg2 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        bg2.addColorStop(0, rgba(col, bodyA));
        bg2.addColorStop(1, rgba(col, bodyA * 0.55));
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(col, 0.55 + firm * 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // selection / hover gets a soft name, nothing else labeled
        const named = n.id === sel || (hovered && hovered.id === n.id) || n.id === store.hoverId;
        if (named) {
          ctx.font = "500 10px 'Space Grotesk', sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = hexA("#ede7d3", 0.85);
          ctx.fillText(n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label, n.x, n.y + r + 13);
        }
      }

      // ---------- the presence (core) ----------
      drawPresence(ctx, core.current.x, core.current.y, coreR, now, state, mood, core.current.glow, need ? att.current : null);

      ctx.restore();

      canvas.style.cursor = cam.current.dragging ? "grabbing" : hovered ? "pointer" : "default";
      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div ref={wrapRef} className="stage">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

// The presence: a breathing, wobbling nucleus. Its behavior IS its state —
// resting breathes slow and dim, hunting is quicker and brighter, waiting
// leans and beckons toward what it needs.
function drawPresence(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  now: number,
  state: PresenceState,
  mood: number,
  glow: number,
  lean: { x: number; y: number } | null
) {
  const cfg =
    state === "resting"
      ? { speed: 900, amp: 0.05, bright: 0.5, wob: 0.06 }
      : state === "hunting"
      ? { speed: 360, amp: 0.1, bright: 0.85, wob: 0.12 }
      : { speed: 520, amp: 0.16, bright: 1, wob: 0.14 }; // waiting — insistent bob

  // irregular breath (two periods so it never looks like a loop)
  const breath = 1 + Math.sin(now / cfg.speed) * cfg.amp + Math.sin(now / (cfg.speed * 1.7) + 1.3) * cfg.amp * 0.5;
  const base = R * breath;
  const warm = lerp(0.0, 1.0, mood);
  const coreCol: [number, number, number] = [lerp(237, 240, warm), lerp(231, 181, warm), lerp(211, 69, warm)];

  // lean toward what it wants
  let lx = x;
  let ly = y;
  if (lean && state === "waiting") {
    const bob = (Math.sin(now / 300) * 0.5 + 0.5) * 10;
    const ang = Math.atan2(lean.y - y, lean.x - x);
    lx += Math.cos(ang) * bob;
    ly += Math.sin(ang) * bob;
  }

  // outer aura
  const auraR = base * (state === "resting" ? 2.6 : 3.4) + glow * 20;
  const aura = ctx.createRadialGradient(lx, ly, 0, lx, ly, auraR);
  aura.addColorStop(0, rgba(coreCol, (0.14 + glow * 0.2) * cfg.bright));
  aura.addColorStop(1, rgba(coreCol, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(lx, ly, auraR, 0, Math.PI * 2);
  ctx.fill();

  // wobbling membrane (ameboid)
  const N = 48;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob =
      1 +
      Math.sin(a * 3 + now / 700) * cfg.wob +
      Math.sin(a * 5 - now / 900) * cfg.wob * 0.6 +
      Math.sin(a * 2 + now / 1300) * cfg.wob * 0.4;
    const rr = base * wob;
    const px = lx + Math.cos(a) * rr;
    const py = ly + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  const body = ctx.createRadialGradient(lx, ly, 0, lx, ly, base * 1.2);
  body.addColorStop(0, rgba(coreCol, 0.9 * cfg.bright));
  body.addColorStop(0.6, rgba(coreCol, 0.25 * cfg.bright));
  body.addColorStop(1, rgba(coreCol, 0.05));
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = rgba(coreCol, 0.5 * cfg.bright);
  ctx.lineWidth = 1;
  ctx.stroke();

  // bright nucleus
  ctx.fillStyle = rgba(coreCol, cfg.bright);
  ctx.beginPath();
  ctx.arc(lx, ly, 3 + glow * 2, 0, Math.PI * 2);
  ctx.fill();

  // a few drifting motes — the presence's quiet life
  for (let i = 0; i < 5; i++) {
    const a = now / (1400 + i * 300) + i * 1.7;
    const rr = base * (1.5 + (i % 3) * 0.4) + Math.sin(now / 800 + i) * 6;
    ctx.fillStyle = rgba(coreCol, 0.3 * cfg.bright);
    ctx.beginPath();
    ctx.arc(lx + Math.cos(a) * rr, ly + Math.sin(a) * rr, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}
