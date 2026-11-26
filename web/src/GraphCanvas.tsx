import { useEffect, useRef } from "react";
import { store, STATE_COLOR, KIND_COLOR } from "./store";
import type { GNode } from "./types";

// A hand-built canvas renderer: force-directed physics + a cinematic draw pass
// (glowing nodes, traveling edge pulses, crawl rings, spawn bursts). Runs its
// own requestAnimationFrame loop and mutates node positions in place.

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function nodeColor(n: GNode): string {
  if (n.kind === "opportunity" && n.state) return STATE_COLOR[n.state];
  return KIND_COLOR[n.kind];
}

export default function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -9999, y: -9999, over: false });
  const size = useRef({ w: 800, h: 600, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const wrap = wrapRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      size.current = { w, h, dpr };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, over: true };
    };
    const onLeave = () => (mouse.current.over = false);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    const restLen = (a: GNode, b: GNode) => {
      if (a.kind === "core" || b.kind === "core") return 128;
      if (a.kind === "surface" || b.kind === "surface") return 72;
      return 46;
    };

    const physics = () => {
      const nodes = store.nodes;
      const n = nodes.length;
      // repulsion
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 0.01;
          }
          const d = Math.sqrt(d2);
          const force = 2600 / d2;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // springs
      for (const e of store.edges) {
        const a = nodes.find((x) => x.id === e.a);
        const b = nodes.find((x) => x.id === e.b);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = restLen(a, b);
        const f = (d - rest) * 0.015;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // gravity to center + integrate
      const maxR = Math.min(size.current.w, size.current.h) * 0.46;
      for (const a of nodes) {
        if (a.kind === "core") {
          a.x = 0;
          a.y = 0;
          a.vx = a.vy = 0;
          continue;
        }
        a.vx += -a.x * 0.0016;
        a.vy += -a.y * 0.0016;
        a.vx *= 0.86;
        a.vy *= 0.86;
        const sp = Math.hypot(a.vx, a.vy);
        if (sp > 6) {
          a.vx = (a.vx / sp) * 6;
          a.vy = (a.vy / sp) * 6;
        }
        a.x += a.vx;
        a.y += a.vy;
        // soft clamp within view
        const dist = Math.hypot(a.x, a.y);
        if (dist > maxR) {
          a.x = (a.x / dist) * maxR;
          a.y = (a.y / dist) * maxR;
        }
      }
    };

    const draw = () => {
      const { w, h, dpr } = size.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // background
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, "#0e1116");
      g.addColorStop(1, "#070809");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // radar scope: faint concentric rings + crosshair, centered on the core
      const bcx = w / 2;
      const bcy = h / 2;
      const maxRing = Math.min(w, h) * 0.46;
      ctx.strokeStyle = "rgba(130,160,190,0.05)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(bcx, bcy, (maxRing / 4) * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(130,160,190,0.03)";
      ctx.beginPath();
      ctx.moveTo(bcx - maxRing, bcy);
      ctx.lineTo(bcx + maxRing, bcy);
      ctx.moveTo(bcx, bcy - maxRing);
      ctx.lineTo(bcx, bcy + maxRing);
      ctx.stroke();

      const cx = w / 2;
      const cy = h / 2;
      const now = performance.now();
      const toScreen = (nx: number, ny: number) => [cx + nx, cy + ny] as const;

      // edges
      ctx.lineWidth = 1;
      for (const e of store.edges) {
        const a = store.nodes.find((x) => x.id === e.a);
        const b = store.nodes.find((x) => x.id === e.b);
        if (!a || !b) continue;
        const [ax, ay] = toScreen(a.x, a.y);
        const [bx, by] = toScreen(b.x, b.y);
        ctx.strokeStyle = e.active ? "rgba(140,175,205,0.15)" : "rgba(110,135,165,0.06)";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        if (e.active) {
          const t = ((now - e.born) % 1600) / 1600;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t;
          ctx.fillStyle = "rgba(180,210,235,0.6)";
          ctx.beginPath();
          ctx.arc(px, py, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // crawl pings (expanding rings)
      store.pings = store.pings.filter((p) => now - p.born < 1000);
      for (const p of store.pings) {
        const t = (now - p.born) / 1000;
        const [px, py] = toScreen(p.x, p.y);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = (1 - t) * 0.38;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(px, py, 5 + t * 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // nodes
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let hovered: GNode | null = null;
      let hoverDist = 1e9;
      for (const node of store.nodes) {
        const [nx, ny] = toScreen(node.x, node.y);
        const age = now - node.born;
        const pop = easeOut(age / 520);
        const color = nodeColor(node);

        // hover detection first, so it works for every kind
        if (mouse.current.over) {
          const dd = Math.hypot(mouse.current.x - nx, mouse.current.y - ny);
          if (dd < node.r + 9 && dd < hoverDist) {
            hoverDist = dd;
            hovered = node;
          }
        }

        if (node.kind === "core") {
          drawReticle(ctx, nx, ny, 15, now);
          continue;
        }

        const r = node.r * (0.35 + 0.65 * pop);
        const actionable = node.state === "actionable";
        const glowPulse = actionable ? 0.5 + 0.3 * Math.sin(now / 420) : 0.4;

        // restrained halo (no glossy highlight blob)
        const haloR = r * 2.2;
        const halo = ctx.createRadialGradient(nx, ny, 0, nx, ny, haloR);
        halo.addColorStop(0, hexA(color, 0.24 * glowPulse));
        halo.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(nx, ny, haloR, 0, Math.PI * 2);
        ctx.fill();

        // subtle spawn ring
        if (age < 520) {
          ctx.strokeStyle = hexA(color, (1 - age / 520) * 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(nx, ny, r + (age / 520) * 13, 0, Math.PI * 2);
          ctx.stroke();
        }

        // body
        ctx.fillStyle = node.kind === "evidence" ? hexA(color, 0.85) : color;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();
        // thin crisp ring (not on evidence dots)
        if (node.kind !== "evidence") {
          ctx.strokeStyle = hexA(color, 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(nx, ny, r + 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        // actionable gets a second, breathing ring
        if (actionable) {
          ctx.strokeStyle = hexA(color, 0.3 + 0.3 * Math.sin(now / 420));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(nx, ny, r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // labels
        if (node.kind === "surface" && pop > 0.6) {
          ctx.font = "500 9px 'Space Grotesk', sans-serif";
          ctx.fillStyle = "rgba(188,203,220,0.7)";
          drawTracked(ctx, node.label.toUpperCase(), nx, ny + r + 11, 0.9);
        } else if ((node.state === "verified" || node.state === "actionable") && pop > 0.6) {
          ctx.font = "500 9.5px 'Space Grotesk', sans-serif";
          ctx.fillStyle = hexA(color, 0.9);
          ctx.fillText(truncate(node.label, 20), nx, ny + r + 10);
        }
      }

      // hover tooltip
      if (hovered) {
        const [hx, hy] = toScreen(hovered.x, hovered.y);
        const lines = [hovered.label];
        if (hovered.state) lines.push(hovered.state + (hovered.score != null ? ` · ${hovered.score}/100` : ""));
        else lines.push(hovered.kind);
        ctx.font = "500 11px 'Space Grotesk', sans-serif";
        const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
        const th = 14 * lines.length + 10;
        let bx = hx + 12;
        let by = hy - th - 8;
        if (bx + tw > w) bx = hx - tw - 12;
        if (by < 0) by = hy + 12;
        ctx.fillStyle = "rgba(12,18,26,0.92)";
        roundRect(ctx, bx, by, tw, th, 6);
        ctx.fill();
        ctx.strokeStyle = hexA(nodeColor(hovered), 0.6);
        ctx.lineWidth = 1;
        roundRect(ctx, bx, by, tw, th, 6);
        ctx.stroke();
        ctx.textAlign = "left";
        lines.forEach((l, i) => {
          ctx.fillStyle = i === 0 ? "#EAF6FF" : hexA(nodeColor(hovered!), 0.95);
          ctx.fillText(l, bx + 8, by + 13 + i * 14);
        });
      }
    };

    const loop = () => {
      physics();
      physics();
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// The core drawn as a command-center reticle: soft glow, a ring, a slow radar
// sweep tick, crosshair ticks and a center point. Intentional, not an orb.
function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, now: number) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, R * 2.4);
  halo.addColorStop(0, "rgba(180,220,235,0.18)");
  halo.addColorStop(1, "rgba(180,220,235,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, R * 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(220,235,245,0.7)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();

  const a = (now / 2400) * Math.PI * 2;
  ctx.strokeStyle = "rgba(70,196,174,0.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, R, a, a + 0.55);
  ctx.stroke();

  ctx.strokeStyle = "rgba(220,235,245,0.45)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const ang = i * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * (R - 3), y + Math.sin(ang) * (R - 3));
    ctx.lineTo(x + Math.cos(ang) * (R + 3), y + Math.sin(ang) * (R + 3));
    ctx.stroke();
  }

  ctx.fillStyle = "#EAF2F8";
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "600 10px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "rgba(230,240,248,0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawTracked(ctx, "GVI", x, y + R + 13, 1.6);
}

// Draw centered text with manual letter-spacing (tracking).
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, tracking: number) {
  const chars = text.split("");
  let total = -tracking;
  for (const c of chars) total += ctx.measureText(c).width + tracking;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - total / 2;
  for (const c of chars) {
    ctx.fillText(c, x, cy);
    x += ctx.measureText(c).width + tracking;
  }
  ctx.textAlign = prevAlign;
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
