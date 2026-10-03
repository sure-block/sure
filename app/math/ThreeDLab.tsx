"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { create, all, type MathNode } from "mathjs";
import { Box, RefreshCw } from "lucide-react";

const math = create(all, {});

/* 简易 3D 引擎：旋转矩阵 + 透视投影，canvas 2D 渲染 */
type Vec3 = [number, number, number];

const canvasW = 800;
const canvasH = 560;

export default function ThreeDLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(0.45);
  const [autoRotate, setAutoRotate] = useState(true);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  /* 显示对象 */
  const [showPoint, setShowPoint] = useState(true);
  const [pt, setPt] = useState<Vec3>([1, 1, 1]);
  const [showLine, setShowLine] = useState(true);
  const [line, setLine] = useState({ x0: 0, y0: 0, z0: 0, a: 1, b: 1, c: 1 });
  const [showPlane, setShowPlane] = useState(true);
  const [plane, setPlane] = useState({ a: 1, b: 1, c: 1, d: 3 });
  const [showSurface, setShowSurface] = useState(false);
  const [surfaceExpr, setSurfaceExpr] = useState("x^2 + y^2");

  /* 旋转矩阵 + 投影 */
  const project = useCallback((v: Vec3, y: number, p: number): [number, number] => {
    const [x0, y0, z0] = v;
    // 绕 Y 轴旋转
    const x1 = x0 * Math.cos(y) + z0 * Math.sin(y);
    const z1 = -x0 * Math.sin(y) + z0 * Math.cos(y);
    // 绕 X 轴旋转
    const y2 = y0 * Math.cos(p) - z1 * Math.sin(p);
    const z2 = y0 * Math.sin(p) + z1 * Math.cos(p);
    // 透视投影
    const scale = 42;
    const f = 5;
    const persp = f / (f + z2);
    return [canvasW / 2 + x1 * scale * persp, canvasH / 2 - y2 * scale * persp];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvasW, H = canvasH;
    ctx.clearRect(0, 0, W, H);

    /* 背景网格（XZ 平面） */
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const p1 = project([i, 0, -5], yaw, pitch);
      const p2 = project([i, 0, 5], yaw, pitch);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      const q1 = project([-5, 0, i], yaw, pitch);
      const q2 = project([5, 0, i], yaw, pitch);
      ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
    }

    /* 坐标轴 */
    const axes: Array<[Vec3, Vec3, string]> = [
      [[-5, 0, 0], [5, 0, 0], "#ef4444"],
      [[0, -5, 0], [0, 5, 0], "#22c55e"],
      [[0, 0, -5], [0, 0, 5], "#3b82f6"],
    ];
    ctx.font = "11px monospace";
    axes.forEach(([a, b, color]) => {
      const pa = project(a, yaw, pitch);
      const pb = project(b, yaw, pitch);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    });
    // 轴标签
    const labels: Array<[Vec3, string, string]> = [
      [[5.3, 0, 0], "X", "#ef4444"],
      [[0, 5.3, 0], "Y", "#22c55e"],
      [[0, 0, 5.3], "Z", "#3b82f6"],
    ];
    labels.forEach(([v, t, c]) => {
      const p = project(v, yaw, pitch);
      ctx.fillStyle = c;
      ctx.font = "bold 13px monospace";
      ctx.fillText(t, p[0] + 4, p[1] - 4);
    });

    /* 平面 ax+by+cz=d（在 [-3,3]³ 内） */
    if (showPlane && Math.abs(plane.a) + Math.abs(plane.b) + Math.abs(plane.c) > 1e-9) {
      const { a: A, b: B, c: C, d: D } = plane;
      ctx.strokeStyle = "rgba(139,92,246,0.75)";
      ctx.fillStyle = "rgba(139,92,246,0.12)";
      ctx.lineWidth = 1.5;
      const step = 1;
      for (let i = -3; i <= 3; i += step) {
        const row: [number, number][] = [];
        for (let j = -3; j <= 3; j += step) {
          if (Math.abs(C) > 1e-9) {
            const z = (D - A * i - B * j) / C;
            if (z < -3 || z > 3) continue;
            const p = project([i, j, z], yaw, pitch);
            row.push(p);
          } else if (Math.abs(B) > 1e-9) {
            const yy = (D - A * i - C * j) / B;
            if (yy < -3 || yy > 3) continue;
            const p = project([i, yy, j], yaw, pitch);
            row.push(p);
          } else if (Math.abs(A) > 1e-9) {
            const xx = (D - B * i - C * j) / A;
            if (xx < -3 || xx > 3) continue;
            const p = project([xx, i, j], yaw, pitch);
            row.push(p);
          }
        }
        if (row.length > 1) {
          ctx.beginPath();
          ctx.moveTo(row[0][0], row[0][1]);
          for (const [px, py] of row.slice(1)) ctx.lineTo(px, py);
          ctx.stroke();
        }
      }
    }

    /* 直线参数方程 */
    if (showLine) {
      const { x0, y0, z0, a, b, c } = line;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      const path: [number, number][] = [];
      for (let t = -3.5; t <= 3.5; t += 0.1) {
        path.push(project([x0 + a * t, y0 + b * t, z0 + c * t], yaw, pitch));
      }
      ctx.beginPath();
      ctx.moveTo(path[0][0], path[0][1]);
      for (const [px, py] of path) ctx.lineTo(px, py);
      ctx.stroke();
    }

    /* 曲面 z = f(x,y) 线框 */
    if (showSurface) {
      let node: MathNode | null = null;
      try { node = math.parse(surfaceExpr.replace(/\^/g, "**")); } catch { node = null; }
      ctx.strokeStyle = "rgba(34,211,238,0.65)";
      ctx.lineWidth = 1.2;
      const N = 28;
      const range = 3;
      const ev = (x: number, y: number) => {
        if (!node) return NaN;
        try { return node.evaluate({ x, y }); } catch { return NaN; }
      };
      const grid: Array<Array<[number, number] | null>> = [];
      for (let i = 0; i <= N; i++) {
        const row: Array<[number, number] | null> = [];
        for (let j = 0; j <= N; j++) {
          const x = -range + (2 * range * i) / N;
          const y = -range + (2 * range * j) / N;
          const z = ev(x, y);
          if (!isFinite(z) || Math.abs(z) > 6) { row.push(null); continue; }
          row.push(project([x, z, y], yaw, pitch));
        }
        grid.push(row);
      }
      // 横向线
      for (let i = 0; i <= N; i++) {
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= N; j++) {
          const p = grid[i][j];
          if (!p) { started = false; continue; }
          if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
      // 纵向线
      for (let j = 0; j <= N; j++) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= N; i++) {
          const p = grid[i][j];
          if (!p) { started = false; continue; }
          if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }

    /* 空间点 */
    if (showPoint) {
      const [px, py] = project(pt, yaw, pitch);
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0ea5e9";
      ctx.font = "12px monospace";
      ctx.fillText(`P(${pt[0]}, ${pt[1]}, ${pt[2]})`, px + 10, py - 8);
    }

    /* 图例 */
    ctx.font = "11px monospace";
    let ly = 16;
    const legend: Array<[string, string]> = [
      ["X 轴", "#ef4444"], ["Y 轴", "#22c55e"], ["Z 轴", "#3b82f6"],
      ["空间点", "#38bdf8"], ["直线", "#f59e0b"], ["平面", "#8b5cf6"], ["曲面", "#22d3ee"],
    ];
    legend.forEach(([t, c]) => {
      ctx.fillStyle = c;
      ctx.fillRect(12, ly - 8, 12, 4);
      ctx.fillStyle = "#64748b";
      ctx.fillText(t, 30, ly);
      ly += 18;
    });
  }, [yaw, pitch, showPoint, pt, showLine, line, showPlane, plane, showSurface, surfaceExpr, project]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* 自动旋转 */
  useEffect(() => {
    if (!autoRotate) return;
    const t = setInterval(() => setYaw((y) => y + 0.01), 50);
    return () => clearInterval(t);
  }, [autoRotate]);

  /* 拖动旋转视角 */
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setYaw((y) => y + dx * 0.01);
    setPitch((p) => Math.max(-1.4, Math.min(1.4, p + dy * 0.01)));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const numInput = (label: string, value: number, set: (v: number) => void, key: string) => (
    <div key={key} className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 w-6">{label}</span>
      <input type="number" step={0.1} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* 3D 画布 */}
        <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            className="w-full h-auto block touch-none cursor-grab active:cursor-grabbing select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>

        {/* 控制面板 */}
        <div className="space-y-4">
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">视角</label>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} />
                {autoRotate ? "自动旋转中" : "手动视角"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">在画布上拖动可旋转视角，网格单位 1</p>
          </div>

          {/* 点 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">空间点 P(x, y, z)</label>
              <button onClick={() => setShowPoint(!showPoint)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showPoint ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showPoint ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              {numInput("x", pt[0], (v) => setPt([v, pt[1], pt[2]]), "px")}
              {numInput("y", pt[1], (v) => setPt([pt[0], v, pt[2]]), "py")}
              {numInput("z", pt[2], (v) => setPt([pt[0], pt[1], v]), "pz")}
            </div>
          </div>

          {/* 直线 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">直线 L: P₀ + t·d</label>
              <button onClick={() => setShowLine(!showLine)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showLine ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showLine ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              {numInput("x₀", line.x0, (v) => setLine({ ...line, x0: v }), "lx0")}
              {numInput("y₀", line.y0, (v) => setLine({ ...line, y0: v }), "ly0")}
              {numInput("z₀", line.z0, (v) => setLine({ ...line, z0: v }), "lz0")}
              {numInput("a", line.a, (v) => setLine({ ...line, a: v }), "lda")}
              {numInput("b", line.b, (v) => setLine({ ...line, b: v }), "ldb")}
              {numInput("c", line.c, (v) => setLine({ ...line, c: v }), "ldc")}
            </div>
          </div>

          {/* 平面 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">平面 ax+by+cz=d</label>
              <button onClick={() => setShowPlane(!showPlane)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showPlane ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showPlane ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              {numInput("a", plane.a, (v) => setPlane({ ...plane, a: v }), "na")}
              {numInput("b", plane.b, (v) => setPlane({ ...plane, b: v }), "nb")}
              {numInput("c", plane.c, (v) => setPlane({ ...plane, c: v }), "nc")}
              {numInput("d", plane.d, (v) => setPlane({ ...plane, d: v }), "nd")}
            </div>
          </div>

          {/* 曲面 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">曲面 z = f(x, y)</label>
              <button onClick={() => setShowSurface(!showSurface)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showSurface ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showSurface ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <input
              type="text"
              value={surfaceExpr}
              onChange={(e) => setSurfaceExpr(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none"
              placeholder="例: x^2 + y^2, sin(x)*cos(y), x*y"
            />
            <p className="text-[10px] text-slate-400">x, y ∈ [-3, 3] 线框网格</p>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
        <Box className="w-3 h-3" /> 三维坐标系：X 红 / Y 绿 / Z 蓝，拖动画布旋转视角
      </p>
    </div>
  );
}
