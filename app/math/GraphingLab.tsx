"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { create, all, type MathNode } from "mathjs";
import { TrendingUp, RotateCw } from "lucide-react";

const math = create(all, {});

/* ── 预设 ── */
interface Preset {
  name: string;
  fn: string;
  description: string;
}

const PRESETS: Preset[] = [
  { name: "sin(x)", fn: "sin(x)", description: "正弦函数" },
  { name: "x²", fn: "x^2", description: "二次函数" },
  { name: "x³-3x", fn: "x^3 - 3*x", description: "三次函数，有极值点" },
  { name: "eˣ", fn: "exp(x)", description: "指数函数" },
  { name: "ln(x)", fn: "log(x)", description: "对数函数" },
  { name: "1/x", fn: "1/x", description: "反比例函数" },
  { name: "sin(x)/x", fn: "sin(x)/x", description: "sinc 函数" },
  { name: "tan(x)", fn: "tan(x)", description: "正切函数" },
  { name: "|x|", fn: "abs(x)", description: "绝对值函数" },
  { name: "√x", fn: "sqrt(x)", description: "平方根函数" },
  { name: "抛物线", fn: "a*x^2 + b*x + c", description: "带滑块参数的二次函数" },
  { name: "正弦波", fn: "a*sin(b*x + c)", description: "带滑块参数的正弦波" },
];

interface Point { x: number; y: number; kind: "root" | "max" | "min"; }

/* Simpson 数值积分 */
function simpson(f: (x: number) => number, a: number, b: number, n = 400): number {
  if (!isFinite(a) || !isFinite(b)) return 0;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    s += f(x) * (i % 2 === 0 ? 2 : 4);
  }
  return (s * h) / 3;
}

/* 零点 + 极值点数值分析 */
function analyze(fn: (x: number) => number, xMin: number, xMax: number): Point[] {
  const pts: Point[] = [];
  const N = 600;
  const h = (xMax - xMin) / N;
  let prevY = fn(xMin);
  let prevSlope = NaN;
  let prevX = xMin;

  for (let i = 1; i <= N; i++) {
    const x = xMin + i * h;
    let y = NaN;
    try { y = fn(x); } catch { /* ignore */ }
    if (!isFinite(y)) { prevY = y; prevX = x; continue; }

    // 零点：符号变化或恰好为 0
    if ((prevY === 0) || (isFinite(prevY) && prevY * y < 0)) {
      let lo = prevX, hi = x, flo = prevY, fhi = y;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        let fm = NaN;
        try { fm = fn(mid); } catch { /* ignore */ }
        if (!isFinite(fm)) break;
        if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      }
      const root = (lo + hi) / 2;
      if (pts.filter((p) => Math.abs(p.x - root) < h * 2).length === 0) {
        pts.push({ x: root, y: 0, kind: "root" });
      }
    }

    // 极值点：一阶差分符号变化
    const slope = y - prevY;
    if (isFinite(prevSlope) && prevSlope !== 0 && slope !== 0 && prevSlope * slope < 0) {
      // 二次插值精化
      const x0 = prevX - h, x1 = prevX, x2 = x;
      const y0v = fn(x0), y1v = fn(x1), y2v = fn(x2);
      const denom = (x0 - x1) * (x0 - x2) * (x1 - x2);
      const A = (x2 * (y1v - y0v) + x1 * (y0v - y2v) + x0 * (y2v - y1v)) / denom;
      const B = (x2 * x2 * (y0v - y1v) + x1 * x1 * (y2v - y0v) + x0 * x0 * (y1v - y2v)) / denom;
      const extX = -B / (2 * A);
      let extY = NaN;
      try { extY = fn(extX); } catch { /* ignore */ }
      if (isFinite(extY) && extX > xMin && extX < xMax) {
        const kind = prevSlope > 0 ? "max" : "min";
        if (pts.filter((p) => Math.abs(p.x - extX) < h * 3).length === 0) {
          pts.push({ x: extX, y: extY, kind });
        }
      }
    }
    prevSlope = slope;
    prevY = y;
    prevX = x;
  }
  return pts.sort((a, b) => a.x - b.x);
}

export default function GraphingLab() {
  const plotRef = useRef<HTMLDivElement>(null);
  const [expr, setExpr] = useState("a*sin(b*x + c)");
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [c, setC] = useState(0);
  const [showDerivative, setShowDerivative] = useState(true);
  const [showIntegral, setShowIntegral] = useState(false);
  const [integralRange, setIntegralRange] = useState<[number, number]>([0, Math.PI]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [integralVal, setIntegralVal] = useState<number | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  /* 编译表达式 → 函数（支持 a/b/c 参数） */
  const compileFn = useCallback((src: string) => {
    let node: MathNode | null = null;
    try {
      node = math.parse(src);
    } catch {
      return null;
    }
    return (x: number) => (node ? node.evaluate({ x, a, b, c }) : NaN);
  }, [a, b, c]);

  /* 自动求导（符号） */
  const derivativeSrc = useCallback((src: string) => {
    try {
      return math.derivative(src, "x").toString();
    } catch {
      return null;
    }
  }, []);

  const renderPlot = useCallback(() => {
    if (!plotRef.current) return;
    const fn = compileFn(expr);
    if (!fn) return;

    const width = plotRef.current.clientWidth - 40;
    const height = plotRef.current.clientHeight - 40;
    const data: any[] = [{ fn, color: "#38bdf8", graphType: "polyline" }];

    if (showDerivative) {
      const dSrc = derivativeSrc(expr);
      if (dSrc) {
        const dfn = compileFn(dSrc);
        if (dfn) data.push({ fn: dfn, color: "#f472b6", graphType: "polyline" });
      }
    }

    if (showIntegral) {
      const [ia, ib] = integralRange;
      data.push({ fn, range: [ia, ib] as [number, number], closed: true, color: "rgba(56,189,248,0.15)", graphType: "area" });
      setIntegralVal(simpson(fn, ia, ib));
    } else {
      setIntegralVal(null);
    }

    const annotations: any[] = [{ x: 0 }, { y: 0 }];
    points.forEach((p) => {
      annotations.push({
        x: p.x,
        text: `${p.kind === "root" ? "零点" : p.kind === "max" ? "极大" : "极小"} ${p.x.toFixed(2)}`,
        color: p.kind === "root" ? "#10b981" : "#f59e0b",
      });
    });

    try {
      // @ts-ignore function-plot 无类型定义，动态导入
      import("function-plot").then(({ default: fnPlot }) => {
        plotRef.current!.innerHTML = "";
        fnPlot({
          target: plotRef.current!,
          width,
          height,
          grid: true,
          xAxis: { domain: [xMin, xMax] },
          data,
          annotations,
        });
      });
    } catch { /* ignore */ }
  }, [expr, a, b, c, showDerivative, showIntegral, integralRange, xMin, xMax, points, compileFn, derivativeSrc]);

  useEffect(() => {
    renderPlot();
  }, [renderPlot]);

  useEffect(() => {
    const onResize = () => renderPlot();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPlot]);

  function applyPreset(p: Preset) {
    setExpr(p.fn);
    setPoints([]);
  }

  function runAnalysis() {
    const fn = compileFn(expr);
    if (!fn) return;
    setPoints(analyze(fn, xMin, xMax));
  }

  const dPreview = derivativeSrc(expr);

  return (
    <div className="space-y-4">
      {/* 预设 */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => applyPreset(p)}
            title={p.description}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              expr === p.fn
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" style={{ height: "calc(100vh - 340px)", minHeight: "420px" }}>
        {/* 画布 */}
        <div ref={plotRef} className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 [&_.function-plot]:!overflow-visible [&_svg]:!overflow-visible" />

        {/* 控制面板 */}
        <div className="space-y-4">
          {/* 函数输入 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">f(x) =</label>
            <input
              type="text"
              value={expr}
              onChange={(e) => { setExpr(e.target.value); setPoints([]); }}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-mono text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 transition-colors"
              placeholder="例: a*sin(b*x+c), x^2, log(x)"
            />
            <p className="text-[10px] text-slate-400">支持参数 a/b/c（由滑块控制），运算符与常用函数同 GeoGebra</p>

            {/* 参数滑块 */}
            {([["a", a, setA], ["b", b, setB], ["c", c, setC]] as Array<[string, number, (v: number) => void]>).map(([name, val, set]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs font-mono text-sky-600 dark:text-sky-400 w-3">{name}</span>
                <input
                  type="range" min={-10} max={10} step={0.1}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                  className="flex-1 accent-sky-500"
                />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-10 text-right">{val.toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* 导数 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">导数 f&apos;(x)（自动求导）</label>
              <button
                onClick={() => setShowDerivative(!showDerivative)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showDerivative ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showDerivative ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            {showDerivative && dPreview && (
              <p className="text-[10px] font-mono text-pink-500 break-all bg-slate-100 dark:bg-slate-900 rounded-lg px-2 py-1.5">
                f&apos;(x) = {dPreview}
              </p>
            )}
          </div>

          {/* 积分面积 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">定积分 ∫</label>
              <button
                onClick={() => setShowIntegral(!showIntegral)}
                className={`w-9 h-5 rounded-full transition-colors relative ${showIntegral ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showIntegral ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            {showIntegral && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="number" value={integralRange[0]}
                    onChange={(e) => setIntegralRange([Number(e.target.value), integralRange[1]])}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
                  <span className="text-xs text-slate-400">到</span>
                  <input type="number" value={integralRange[1]}
                    onChange={(e) => setIntegralRange([integralRange[0], Number(e.target.value)])}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
                </div>
                {integralVal !== null && (
                  <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    ∫ ≈ {integralVal.toFixed(4)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 范围 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">X 轴范围</label>
            <div className="flex items-center gap-2">
              <input type="number" value={xMin} onChange={(e) => setXMin(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
              <span className="text-xs text-slate-400">~</span>
              <input type="number" value={xMax} onChange={(e) => setXMax(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
            </div>
          </div>

          {/* 零点 / 极值分析 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <button
              onClick={runAnalysis}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              分析零点与极值点
            </button>
            {points.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1">
                {points.map((p, i) => (
                  <p key={i} className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {p.kind === "root" ? "零点" : p.kind === "max" ? "极大值" : "极小值"} x = {p.x.toFixed(4)}, y = {p.y.toFixed(4)}
                  </p>
                ))}
              </div>
            )}
            {points.length === 0 && (
              <p className="text-[10px] text-slate-400">点击后自动求零点、极大值与极小值</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
