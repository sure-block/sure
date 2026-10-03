"use client";

import { useState, useRef, useCallback, type ElementType } from "react";
import {
  MousePointer2, CircleDot, Minus, Circle, Hexagon, Trash2, Undo2,
} from "lucide-react";

/* ── 类型 ── */
interface Pt { id: number; label: string; x: number; y: number; }
interface Seg { id: number; p1: number; p2: number; }
interface Circ { id: number; c: number; rp: number; }
interface Poly { id: number; pts: number[]; }

type Mode = "drag" | "point" | "segment" | "circle" | "polygon";

const W = 800;
const H = 560;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let uid = 1;

export default function GeometryLab() {
  const [mode, setMode] = useState<Mode>("drag");
  const [pts, setPts] = useState<Pt[]>([]);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [circs, setCircs] = useState<Circ[]>([]);
  const [polys, setPolys] = useState<Poly[]>([]);
  const [pending, setPending] = useState<number[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);

  const toSvg = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }, []);

  const addPoint = useCallback((x: number, y: number): number => {
    const id = uid++;
    const label = LETTERS[pts.length % LETTERS.length] + (Math.floor(pts.length / LETTERS.length) || "");
    setPts((prev) => [...prev, { id, label, x, y }]);
    return id;
  }, [pts.length]);

  function handlePointerDown(e: React.PointerEvent) {
    if (mode === "drag") {
      const { x, y } = toSvg(e);
      const hit = pts.find((p) => Math.hypot(p.x - x, p.y - y) < 14);
      if (hit) {
        dragRef.current = { id: hit.id, dx: hit.x - x, dy: hit.y - y };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      return;
    }
    if (mode === "point") {
      const { x, y } = toSvg(e);
      addPoint(x, y);
      return;
    }
    // 连线 / 圆 / 多边形：选点或新建点
    const { x, y } = toSvg(e);
    let id = pts.find((p) => Math.hypot(p.x - x, p.y - y) < 14)?.id;
    if (id === undefined) id = addPoint(x, y);
    const seq = [...pending, id];

    if (mode === "segment" && seq.length === 2) {
      setSegs((prev) => [...prev, { id: uid++, p1: seq[0], p2: seq[1] }]);
      setPending([]);
      return;
    }
    if (mode === "circle" && seq.length === 2) {
      setCircs((prev) => [...prev, { id: uid++, c: seq[0], rp: seq[1] }]);
      setPending([]);
      return;
    }
    if (mode === "polygon" && seq.length >= 3) {
      setPolys((prev) => [...prev, { id: uid++, pts: [...seq] }]);
      setPending([]);
      return;
    }
    setPending(seq);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const { x, y } = toSvg(e);
    if (dragRef.current) {
      setPts((prev) => prev.map((p) =>
        p.id === dragRef.current!.id ? { ...p, x: x + dragRef.current!.dx, y: y + dragRef.current!.dy } : p
      ));
      return;
    }
    const hit = pts.find((p) => Math.hypot(p.x - x, p.y - y) < 14);
    setHover(hit ?? null);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function undo() {
    if (pending.length) { setPending([]); return; }
    if (polys.length) { setPolys((p) => p.slice(0, -1)); return; }
    if (circs.length) { setCircs((c) => c.slice(0, -1)); return; }
    if (segs.length) { setSegs((s) => s.slice(0, -1)); return; }
    if (pts.length) {
      const last = pts[pts.length - 1].id;
      setPts((p) => p.filter((pt) => pt.id !== last));
      setSegs((s) => s.filter((seg) => seg.p1 !== last && seg.p2 !== last));
      setCircs((c) => c.filter((cc) => cc.c !== last && cc.rp !== last));
      setPolys((pl) => pl.filter((py) => !py.pts.includes(last)));
    }
  }

  function clearAll() {
    setPts([]); setSegs([]); setCircs([]); setPolys([]); setPending([]);
  }

  /* 度量计算 */
  const getPt = (id: number) => pts.find((p) => p.id === id)!;
  const segLen = (s: Seg) => {
    const a = getPt(s.p1), b = getPt(s.p2);
    return Math.hypot(a.x - b.x, a.y - b.y) * 2; // 1px ≈ 2 单位
  };
  const circRad = (c: Circ) => {
    const o = getPt(c.c), r = getPt(c.rp);
    return Math.hypot(o.x - r.x, o.y - r.y) * 2;
  };
  const polyArea = (p: Poly) => {
    const arr = p.pts.map(getPt);
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i], b = arr[(i + 1) % arr.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s / 2) * 4;
  };

  const modes: { id: Mode; label: string; icon: any }[] = [
    { id: "drag", label: "拖动", icon: MousePointer2 },
    { id: "point", label: "点", icon: CircleDot },
    { id: "segment", label: "线段", icon: Minus },
    { id: "circle", label: "圆", icon: Circle },
    { id: "polygon", label: "多边形", icon: Hexagon },
  ];

  const gridLines = [];
  for (let i = -6; i <= 6; i++) {
    gridLines.push(<line key={`v${i}`} x1={W / 2 + i * 60} y1={0} x2={W / 2 + i * 60} y2={H} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />);
    gridLines.push(<line key={`h${i}`} x1={0} y1={H / 2 + i * 60} x2={W} y2={H / 2 + i * 60} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />);
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setPending([]); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === m.id
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
            }`}
          >
            <m.icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={undo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-amber-300 transition-all">
          <Undo2 className="w-3.5 h-3.5" /> 撤销
        </button>
        <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-rose-300 transition-all">
          <Trash2 className="w-3.5 h-3.5" /> 清空
        </button>
      </div>

      {/* 画布 */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block touch-none cursor-crosshair select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* 网格与坐标轴 */}
          <rect x={0} y={0} width={W} height={H} className="fill-transparent" />
          {gridLines}
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#94a3b8" strokeWidth="1.5" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#94a3b8" strokeWidth="1.5" />

          {/* 多边形 */}
          {polys.map((p) => {
            const arr = p.pts.map(getPt);
            return (
              <polygon
                key={p.id}
                points={arr.map((a) => `${a.x},${a.y}`).join(" ")}
                fill="rgba(56,189,248,0.12)"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            );
          })}
          {/* 线段 */}
          {segs.map((s) => {
            const a = getPt(s.p1), b = getPt(s.p2);
            return (
              <g key={s.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#38bdf8" strokeWidth="2" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="11" fill="#0ea5e9" className="font-mono">
                  {segLen(s).toFixed(1)}
                </text>
              </g>
            );
          })}
          {/* 圆 */}
          {circs.map((c) => {
            const o = getPt(c.c), rp = getPt(c.rp);
            const r = Math.hypot(o.x - rp.x, o.y - rp.y);
            return (
              <g key={c.id}>
                <circle cx={o.x} cy={o.y} r={r} fill="rgba(244,114,182,0.1)" stroke="#f472b6" strokeWidth="2" />
                <text x={o.x} y={o.y - r - 6} textAnchor="middle" fontSize="11" fill="#ec4899" className="font-mono">
                  r = {circRad(c).toFixed(1)}
                </text>
              </g>
            );
          })}
          {/* 待完成连线预览 */}
          {mode === "polygon" && pending.length >= 2 && (
            <polyline
              points={pending.map((id) => {
                const p = getPt(id);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.6"
            />
          )}

          {/* 点 */}
          {pts.map((p) => (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={pending.includes(p.id) ? 7 : 5} fill={pending.includes(p.id) ? "#f59e0b" : "#0ea5e9"} stroke="#fff" strokeWidth="1.5" />
              <text x={p.x + 8} y={p.y - 8} fontSize="12" fontWeight="600" fill="#0f172a" className="dark:fill-slate-100 font-mono">
                {p.label}
              </text>
              <text x={p.x + 8} y={p.y + 6} fontSize="9" fill="#64748b" className="font-mono">
                ({((p.x - W / 2) / 60).toFixed(1)}, {((H / 2 - p.y) / 60).toFixed(1)})
              </text>
            </g>
          ))}
          {/* 悬停高亮 */}
          {hover && (
            <circle cx={hover.x} cy={hover.y} r={10} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
          )}
          {/* 多边形面积显示 */}
          {polys.length > 0 && (
            <text x={12} y={H - 12} fontSize="12" fill="#059669" className="font-mono">
              {polys.map((p, i) => `P${i + 1} 面积 ${polyArea(p).toFixed(1)}`).join("　")}
            </text>
          )}
        </svg>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        {mode === "drag" ? "拖动模式下可拖动任意点，实时联动所有图形" :
          mode === "point" ? "点击画布放置点" :
          mode === "segment" ? "依次点击两个点创建线段（点击空白处可新建点）" :
          mode === "circle" ? "依次点击圆心与圆上一点创建圆" :
          "依次点击至少 3 个点创建多边形，自动计算面积"}
        ，网格每格为 1 个单位
      </p>
    </div>
  );
}
