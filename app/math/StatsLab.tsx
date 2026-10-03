"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Dices } from "lucide-react";

/* 常见概率分布（连续 PDF / 离散 PMF） */
type Dist = "normal" | "exponential" | "uniform" | "binomial" | "poisson";

const canvasW = 800;
const canvasH = 480;

/* 正态 PDF */
function normalPdf(x: number, mu: number, sigma: number) {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
}
/* 指数 PDF */
function expPdf(x: number, lambda: number) {
  return x >= 0 ? lambda * Math.exp(-lambda * x) : 0;
}
/* 均匀 PDF */
function unifPdf(x: number, a: number, b: number) {
  return x >= a && x <= b ? 1 / (b - a) : 0;
}
/* 二项 PMF */
function binomPmf(k: number, n: number, p: number) {
  const comb = (a: number, b: number) => {
    let r = 1;
    for (let i = 0; i < b; i++) r *= (a - i) / (i + 1);
    return r;
  };
  return k >= 0 && k <= n ? comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k) : 0;
}
/* 泊松 PMF */
function poisPmf(k: number, lambda: number) {
  return k >= 0 ? (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k) : 0;
}
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/* 随机数 */
function randNormal(mu: number, sigma: number) {
  // Box-Muller
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function randExp(lambda: number) {
  return -Math.log(1 - Math.random()) / lambda;
}
function randUnif(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function randBinom(n: number, p: number) {
  let s = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) s++;
  return s;
}
function randPois(lambda: number) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export default function StatsLab() {
  const [dist, setDist] = useState<Dist>("normal");
  const [params, setParams] = useState({ mu: 0, sigma: 1, lambda: 1, a: 0, b: 1, n: 20, p: 0.5 });
  const [samples, setSamples] = useState<number[]>([]);
  const [sampleN, setSampleN] = useState(2000);
  const [stats, setStats] = useState<{ mean: number; var: number; std: number; med: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setP = (k: keyof typeof params) => (v: number) => setParams((prev) => ({ ...prev, [k]: v }));

  function genSamples() {
    const { mu, sigma, lambda, a, b, n, p } = params;
    const arr: number[] = [];
    for (let i = 0; i < sampleN; i++) {
      switch (dist) {
        case "normal": arr.push(randNormal(mu, sigma)); break;
        case "exponential": arr.push(randExp(lambda)); break;
        case "uniform": arr.push(randUnif(a, b)); break;
        case "binomial": arr.push(randBinom(n, p)); break;
        case "poisson": arr.push(randPois(lambda)); break;
      }
    }
    setSamples(arr);
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const varr = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    const sorted = [...arr].sort((x, y) => x - y);
    const med = sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    setStats({ mean, var: varr, std: Math.sqrt(varr), med });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvasW, H = canvasH;
    ctx.clearRect(0, 0, W, H);
    const padL = 50, padR = 14, padT = 16, padB = 34;

    /* 确定 x 范围与理论曲线 */
    const { mu, sigma, lambda, a, b, n, p } = params;
    let xMin = 0, xMax = 1;
    let yMax = 0.5;
    let theory: (x: number) => number;
    let discrete = false;
    switch (dist) {
      case "normal":
        xMin = mu - 4 * sigma; xMax = mu + 4 * sigma;
        theory = (x) => normalPdf(x, mu, sigma);
        yMax = normalPdf(mu, mu, sigma) * 1.15;
        break;
      case "exponential":
        xMin = 0; xMax = Math.min(6 / lambda, 12);
        theory = (x) => expPdf(x, lambda);
        yMax = lambda * 1.2;
        break;
      case "uniform":
        xMin = a - 0.1 * (b - a); xMax = b + 0.1 * (b - a);
        theory = (x) => unifPdf(x, a, b);
        yMax = (1 / (b - a)) * 1.3;
        break;
      case "binomial":
        xMin = -0.8; xMax = n + 0.8;
        discrete = true;
        theory = (x) => binomPmf(Math.round(x), n, p);
        yMax = 1;
        for (let k = 0; k <= n; k++) yMax = Math.max(yMax, binomPmf(k, n, p));
        yMax *= 1.2;
        break;
      case "poisson":
        xMin = 0; xMax = Math.max(lambda * 3, 6);
        discrete = true;
        theory = (x) => poisPmf(Math.round(x), lambda);
        yMax = 0.5;
        for (let k = 0; k <= Math.ceil(xMax); k++) yMax = Math.max(yMax, poisPmf(k, lambda));
        yMax *= 1.2;
        break;
    }

    const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * (W - padL - padR);
    const sy = (y: number) => H - padB - (y / yMax) * (H - padT - padB);

    /* 网格 */
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = padL + (i * (W - padL - padR)) / 8;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = padT + (i * (H - padT - padB)) / 6;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    /* 直方图（模拟样本） */
    if (samples.length) {
      const binN = discrete ? Math.max(8, Math.min(50, Math.ceil(xMax - xMin))) : 40;
      const binW = (xMax - xMin) / binN;
      const counts = new Array(binN).fill(0);
      samples.forEach((v) => {
        const idx = Math.min(binN - 1, Math.max(0, Math.floor((v - xMin) / binW)));
        counts[idx]++;
      });
      const total = samples.length;
      // 概率密度估计：count / (total * binW)
      ctx.fillStyle = "rgba(56,189,248,0.25)";
      counts.forEach((c, i) => {
        const px = sx(xMin + i * binW);
        const pw = sx(xMin + (i + 1) * binW) - px - 1;
        const ph = (c / (total * binW)) / yMax * (H - padT - padB);
        if (ph <= 0) return;
        ctx.fillRect(px + 0.5, H - padB - ph, Math.max(pw, 1), ph);
      });
    }

    /* 理论曲线 */
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (discrete) {
      // 离散：竖线 + 点
      const kStart = Math.ceil(xMin), kEnd = Math.floor(xMax);
      for (let k = kStart; k <= kEnd; k++) {
        const px = sx(k);
        const py = sy(theory(k));
        ctx.moveTo(px, H - padB);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = "#f472b6";
      for (let k = kStart; k <= kEnd; k++) {
        ctx.beginPath(); ctx.arc(sx(k), sy(theory(k)), 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const N = 400;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i * (xMax - xMin)) / N;
        const y = theory(x);
        const px = sx(x), py = sy(Math.max(0, y));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    /* 坐标轴与刻度 */
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    for (let i = 0; i <= 4; i++) {
      const x = xMin + (i * (xMax - xMin)) / 4;
      ctx.fillText(x.toFixed(xMax - xMin > 10 ? 0 : 2), sx(x) - 12, H - padB + 14);
    }
    for (let i = 0; i <= 3; i++) {
      const y = (i * yMax) / 3;
      ctx.fillText(y.toFixed(2), padL - 38, sy(y) + 4);
    }

    /* 标题 */
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(`理论分布曲线（粉）与模拟样本直方图（蓝）`, padL, 14);
  }, [dist, params, samples]);

  const slider = (label: string, key: keyof typeof params, min: number, max: number, step: number, show: boolean) =>
    show && (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-sky-600 dark:text-sky-400 w-12">{label}</span>
        <input type="range" min={min} max={max} step={step} value={params[key]}
          onChange={(e) => setP(key)(Number(e.target.value))}
          className="flex-1 accent-sky-500" />
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-12 text-right">{params[key].toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
    );

  const dists: { id: Dist; label: string }[] = [
    { id: "normal", label: "正态分布" },
    { id: "exponential", label: "指数分布" },
    { id: "uniform", label: "均匀分布" },
    { id: "binomial", label: "二项分布" },
    { id: "poisson", label: "泊松分布" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* 画布 */}
        <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden">
          <canvas ref={canvasRef} width={canvasW} height={canvasH} className="w-full h-auto block" />
        </div>

        {/* 控制面板 */}
        <div className="space-y-4">
          {/* 分布选择 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">分布类型</label>
            <div className="flex flex-wrap gap-2">
              {dists.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDist(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dist === d.id
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                      : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 参数 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">分布参数</label>
            {slider("μ", "mu", -5, 5, 0.1, dist === "normal")}
            {slider("σ", "sigma", 0.2, 4, 0.1, dist === "normal")}
            {slider("λ", "lambda", 0.2, 5, 0.1, dist === "exponential" || dist === "poisson")}
            {slider("a", "a", -5, 5, 0.1, dist === "uniform")}
            {slider("b", "b", 0.5, 10, 0.1, dist === "uniform")}
            {slider("n", "n", 2, 50, 1, dist === "binomial")}
            {slider("p", "p", 0.05, 0.95, 0.05, dist === "binomial")}
          </div>

          {/* 模拟 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">随机模拟</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">样本数</span>
              <input type="number" min={100} max={20000} step={100} value={sampleN}
                onChange={(e) => setSampleN(Math.max(100, Number(e.target.value)))}
                className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
            </div>
            <button
              onClick={genSamples}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition-colors"
            >
              <Dices className="w-3.5 h-3.5" />
              生成随机样本
            </button>
            {stats && (
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg px-2 py-1.5">
                  <span className="block text-slate-400">均值</span>
                  <span className="text-slate-700 dark:text-slate-200">{stats.mean.toFixed(4)}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg px-2 py-1.5">
                  <span className="block text-slate-400">方差</span>
                  <span className="text-slate-700 dark:text-slate-200">{stats.var.toFixed(4)}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg px-2 py-1.5">
                  <span className="block text-slate-400">标准差</span>
                  <span className="text-slate-700 dark:text-slate-200">{stats.std.toFixed(4)}</span>
                </div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg px-2 py-1.5">
                  <span className="block text-slate-400">中位数</span>
                  <span className="text-slate-700 dark:text-slate-200">{stats.med.toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <BarChart3 className="w-3 h-3" /> 蓝色为模拟样本直方图，粉色为理论分布
          </p>
        </div>
      </div>
    </div>
  );
}
