"use client";

import { useRef, useEffect, useState, useCallback, type ElementType } from "react";
import { motion } from "framer-motion";
import {
  Sigma, Calculator, Shapes, Box, BarChart3,
  FunctionSquare, TrendingUp, Clock,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 20 } },
};

/* ── 函数可视化：预设 ── */
interface Preset {
  name: string;
  fn: string;
  derivative?: string;
  description: string;
}

const PRESETS: Preset[] = [
  { name: "sin(x)", fn: "sin(x)", derivative: "cos(x)", description: "正弦函数与导数" },
  { name: "x²", fn: "x^2", derivative: "2x", description: "二次函数与导数" },
  { name: "x³-3x", fn: "x^3 - 3*x", derivative: "3*x^2 - 3", description: "三次函数，有极值点" },
  { name: "eˣ", fn: "e^x", derivative: "e^x", description: "指数函数，导数等于自身" },
  { name: "ln(x)", fn: "log(x)", derivative: "1/x", description: "对数函数与导数" },
  { name: "1/x", fn: "1/x", derivative: "-1/x^2", description: "反比例函数" },
  { name: "sin(x)/x", fn: "sin(x)/x", description: "sinc 函数，信号处理常用" },
  { name: "x·sin(1/x)", fn: "x*sin(1/x)", description: "x→0 时振荡衰减" },
  { name: "tan(x)", fn: "tan(x)", derivative: "1/cos(x)^2", description: "正切函数与导数" },
  { name: "|x|", fn: "abs(x)", description: "绝对值函数，x=0 不可导" },
  { name: "√x", fn: "sqrt(x)", derivative: "1/(2*sqrt(x))", description: "平方根函数" },
  { name: "泰勒展开", fn: "sin(x)", derivative: "x - x^3/6 + x^5/120", description: "sin(x) 与泰勒多项式近似" },
];

/* ── GeoGebra 应用（官方网页版嵌入） ── */
interface GeoApp {
  id: string;
  label: string;
  desc: string;
  icon: ElementType;
  url: string;
}

const GEO_APPS: GeoApp[] = [
  { id: "calculator", label: "图形计算器", desc: "函数绘图 · 动态探究", icon: FunctionSquare, url: "https://www.geogebra.org/calculator?lang=zh" },
  { id: "geometry", label: "几何", desc: "尺规作图 · 几何变换", icon: Shapes, url: "https://www.geogebra.org/geometry?lang=zh" },
  { id: "3d", label: "3D 计算器", desc: "空间几何 · 曲面", icon: Box, url: "https://www.geogebra.org/3d?lang=zh" },
  { id: "cas", label: "CAS 符号计算", desc: "方程求解 · 因式分解", icon: Calculator, url: "https://www.geogebra.org/cas?lang=zh" },
  { id: "probability", label: "概率统计", desc: "分布 · 模拟实验", icon: BarChart3, url: "https://www.geogebra.org/probability?lang=zh" },
];

type MainTab = "plot" | "geogebra";

export default function MathPage() {
  /* ── 函数可视化状态 ── */
  const plotRef = useRef<HTMLDivElement>(null);
  const fnPlotRef = useRef<any>(null);
  const [expr, setExpr] = useState("sin(x)");
  const [showDerivative, setShowDerivative] = useState(false);
  const [derivativeExpr, setDerivativeExpr] = useState("cos(x)");
  const [showIntegral, setShowIntegral] = useState(false);
  const [integralRange, setIntegralRange] = useState<[number, number]>([0, Math.PI]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);

  /* ── 页面状态 ── */
  const [mainTab, setMainTab] = useState<MainTab>("plot");
  const [geoApp, setGeoApp] = useState<string>(GEO_APPS[0].id);

  const renderPlot = useCallback(async () => {
    if (!plotRef.current) return;
    const fnPlot = (await import("function-plot")).default;

    const width = plotRef.current.clientWidth - 40;
    const height = plotRef.current.clientHeight - 40;

    const data: any[] = [
      { fn: expr, color: "#38bdf8", graphType: "polyline" },
    ];

    if (showDerivative && derivativeExpr) {
      data.push({ fn: derivativeExpr, color: "#f472b6", graphType: "polyline" });
    }

    if (showIntegral) {
      data.push({
        fn: expr,
        range: integralRange,
        closed: true,
        color: "rgba(56,189,248,0.15)",
        graphType: "area",
      });
    }

    try {
      fnPlotRef.current = fnPlot({
        target: plotRef.current,
        width,
        height,
        grid: true,
        xAxis: { domain: [xMin, xMax] },
        data,
        annotations: [
          { x: 0 },
          { y: 0 },
        ],
      });
    } catch {
      // invalid expression, ignore
    }
  }, [expr, showDerivative, derivativeExpr, showIntegral, integralRange, xMin, xMax]);

  useEffect(() => {
    renderPlot();
  }, [renderPlot]);

  // resize handler
  useEffect(() => {
    const onResize = () => renderPlot();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPlot]);

  // 切回绘图 tab 时重绘（iframe 不影响，容器尺寸变化后需要重算）
  useEffect(() => {
    if (mainTab === "plot") {
      const t = setTimeout(renderPlot, 50);
      return () => clearTimeout(t);
    }
  }, [mainTab, renderPlot]);

  function applyPreset(preset: Preset) {
    setExpr(preset.fn);
    if (preset.derivative) {
      setDerivativeExpr(preset.derivative);
      setShowDerivative(true);
    } else {
      setShowDerivative(false);
    }
  }

  const activeGeo = GEO_APPS.find((a) => a.id === geoApp) ?? GEO_APPS[0];

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sigma className="w-5 h-5 text-sky-500" />
            数学实验室
          </h1>
          <p className="text-xs text-slate-400">函数可视化 · GeoGebra 互动数学</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          Math Lab
        </div>
      </div>

      {/* 主 Tab */}
      <div className="flex gap-2">
        <button
          onClick={() => setMainTab("plot")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mainTab === "plot"
              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
              : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          函数可视化
        </button>
        <button
          onClick={() => setMainTab("geogebra")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mainTab === "geogebra"
              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
              : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
          }`}
        >
          <Calculator className="w-4 h-4" />
          GeoGebra 互动
        </button>
      </div>

      {/* ── Tab 1: 函数可视化（原 garden/math 模块） ── */}
      {mainTab === "plot" && (
        <motion.div key="plot" variants={fadeIn} initial="hidden" animate="show" className="space-y-4">
          {/* 预设函数 */}
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

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" style={{ height: "calc(100vh - 340px)", minHeight: "400px" }}>
            {/* 函数图像 */}
            <div ref={plotRef} className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 p-5 [&_.function-plot]:!overflow-visible [&_svg]:!overflow-visible" />

            {/* 控制面板 */}
            <div className="space-y-4">
              {/* 函数输入 */}
              <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">f(x) =</label>
                <input
                  type="text"
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-mono text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 transition-colors"
                  placeholder="例: sin(x), x^2, log(x)"
                />
                <p className="text-[10px] text-slate-400">支持: sin, cos, tan, log, exp, sqrt, abs, asin, acos, atan, pi, e</p>
              </div>

              {/* 导数 */}
              <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">导数 f&apos;(x)</label>
                  <button
                    onClick={() => setShowDerivative(!showDerivative)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${showDerivative ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showDerivative ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                {showDerivative && (
                  <input
                    type="text"
                    value={derivativeExpr}
                    onChange={(e) => setDerivativeExpr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-mono text-pink-500 outline-none focus:border-pink-400 transition-colors"
                    placeholder="导数表达式"
                  />
                )}
              </div>

              {/* 积分面积 */}
              <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">积分面积 ∫</label>
                  <button
                    onClick={() => setShowIntegral(!showIntegral)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${showIntegral ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showIntegral ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                {showIntegral && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={integralRange[0]}
                      onChange={(e) => setIntegralRange([Number(e.target.value), integralRange[1]])}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none"
                    />
                    <span className="text-xs text-slate-400">到</span>
                    <input
                      type="number"
                      value={integralRange[1]}
                      onChange={(e) => setIntegralRange([integralRange[0], Number(e.target.value)])}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 范围 */}
              <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">X 轴范围</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={xMin}
                    onChange={(e) => setXMin(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none"
                  />
                  <span className="text-xs text-slate-400">~</span>
                  <input
                    type="number"
                    value={xMax}
                    onChange={(e) => setXMax(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* 图例 */}
              <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-sky-400 rounded" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">f(x) 函数</span>
                </div>
                {showDerivative && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-pink-400 rounded" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">f&apos;(x) 导数</span>
                  </div>
                )}
                {showIntegral && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-3 rounded" style={{ backgroundColor: "rgba(56,189,248,0.25)" }} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">积分面积</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Tab 2: GeoGebra 互动 ── */}
      {mainTab === "geogebra" && (
        <motion.div key="geogebra" variants={fadeIn} initial="hidden" animate="show" className="space-y-4">
          {/* GeoGebra 应用选择 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {GEO_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => setGeoApp(app.id)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all ${
                  geoApp === app.id
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                    : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
                }`}
              >
                <app.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{app.label}</span>
              </button>
            ))}
          </div>

          {/* 当前应用说明 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl px-4 py-3 border border-slate-200/50 dark:border-white/5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${geoApp === activeGeo.id ? "bg-sky-500/15" : "bg-slate-100 dark:bg-slate-700/50"}`}>
              <activeGeo.icon className={`w-5 h-5 ${geoApp === activeGeo.id ? "text-sky-500" : "text-slate-500 dark:text-slate-400"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activeGeo.label}</p>
              <p className="text-xs text-slate-400">{activeGeo.desc} · 由 GeoGebra 提供</p>
            </div>
          </div>

          {/* GeoGebra 嵌入区 */}
          <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
            <iframe
              key={activeGeo.id}
              src={activeGeo.url}
              title={activeGeo.label}
              width="100%"
              height={700}
              frameBorder="0"
              allow="fullscreen; geolocation; microphone; camera"
              className="block w-full"
            />
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            GeoGebra 互动应用由官方网页版提供，需要联网加载
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
