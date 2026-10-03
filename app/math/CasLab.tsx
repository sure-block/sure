"use client";

import { useState } from "react";
import { create, all } from "mathjs";
import { Calculator, TrendingUp, Sigma, GitBranch } from "lucide-react";

const math = create(all, {});

interface Result {
  title: string;
  content: string;
  ok: boolean;
}

/* Simpson 数值定积分 */
function simpson(f: (x: number) => number, a: number, b: number, n = 600): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    s += f(x) * (i % 2 === 0 ? 2 : 4);
  }
  return (s * h) / 3;
}

/* 二分法求根 */
function bisection(f: (x: number) => number, lo: number, hi: number): number | null {
  let flo = NaN, fhi = NaN;
  try { flo = f(lo); } catch { return null; }
  try { fhi = f(hi); } catch { return null; }
  if (!isFinite(flo) || !isFinite(fhi)) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    let fm = NaN;
    try { fm = f(mid); } catch { return null; }
    if (!isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-12) return mid;
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/* 美化输出：把 ** 转回 ^，字母斜体由 CSS 处理 */
function pretty(expr: string): string {
  return expr.replace(/\*\*/g, "^");
}

export default function CasLab() {
  const [expr, setExpr] = useState("x^3 - 3*x^2 + 2*x");
  const [eqExpr, setEqExpr] = useState("cos(x) - x");
  const [intRange, setIntRange] = useState<[number, number]>([0, 1]);
  const [results, setResults] = useState<Result[]>([]);

  function push(title: string, content: string, ok = true) {
    setResults((prev) => [{ title, content, ok }, ...prev].slice(0, 12));
  }

  function runEvaluate() {
    try {
      const node = math.parse(expr.replace(/\^/g, "**"));
      const scope: Record<string, number> = {};
      // 尝试给变量赋值演示
      const vars = new Set<string>();
      node.traverse((n: any) => {
        if (n.isSymbolNode && n.name !== "pi" && n.name !== "e" && n.name !== "i") vars.add(n.name);
      });
      let r: any;
      if (vars.size === 0) {
        r = node.evaluate();
      } else {
        const v: Record<string, number> = {};
        [...vars].forEach((name, idx) => { v[name] = idx + 1; });
        r = node.evaluate(v);
        push("表达式", `含变量 ${[...vars].join(", ")}，已代入 1, 2, 3… 求值`, false);
      }
      push("表达式计算", `= ${String(r)}`);
    } catch (e) {
      push("表达式计算", `解析失败: ${(e as Error).message}`, false);
    }
  }

  function runDerivative() {
    try {
      const d = math.derivative(expr.replace(/\^/g, "**"), "x");
      push("符号求导 d/dx", `f(x) = ${pretty(expr)}\nf'(x) = ${pretty(d.toString())}`);
    } catch (e) {
      push("符号求导", `失败: ${(e as Error).message}`, false);
    }
  }

  function runIntegrate() {
    // 尝试符号不定积分（mathjs 实验特性），失败则给数值积分
    try {
      const int = (math as any).integrate(expr.replace(/\^/g, "**"), "x");
      if (int) {
        push("不定积分 ∫", `∫ ${pretty(expr)} dx = ${pretty(int.toString())} + C`);
        return;
      }
    } catch { /* fallthrough */ }
    try {
      const node = math.compile(expr.replace(/\^/g, "**"));
      const f = (x: number) => node.evaluate({ x });
      const [a, b] = intRange;
      const v = simpson(f, a, b);
      push("定积分（数值）", `∫[${a}, ${b}] ${pretty(expr)} dx ≈ ${v.toFixed(6)}`);
    } catch (e) {
      push("定积分", `失败: ${(e as Error).message}`, false);
    }
  }

  function runSimplify() {
    try {
      const s = math.simplify(expr.replace(/\^/g, "**"));
      push("化简 simplify", `${pretty(expr)}\n= ${pretty(s.toString())}`);
    } catch (e) {
      push("化简", `失败: ${(e as Error).message}`, false);
    }
  }

  function runExpand() {
    try {
      const e = (math as any).expand(expr.replace(/\^/g, "**"));
      push("展开 expand", `${pretty(expr)}\n= ${pretty(e.toString())}`);
    } catch (err) {
      push("展开", `失败: ${(err as Error).message}`, false);
    }
  }

  function runSolve() {
    // 数值求根 f(x)=0：在 [-20, 20] 内扫描符号变化区间
    try {
      const node = math.compile(eqExpr.replace(/\^/g, "**"));
      const f = (x: number) => node.evaluate({ x });
      const roots: number[] = [];
      const N = 800;
      const lo = -20, hi = 20;
      const h = (hi - lo) / N;
      let prev = f(lo);
      for (let i = 1; i <= N; i++) {
        const x = lo + i * h;
        let y = NaN;
        try { y = f(x); } catch { prev = NaN; continue; }
        if (!isFinite(y)) { prev = y; continue; }
        if (isFinite(prev) && prev * y <= 0) {
          const root = bisection(f, lo + (i - 1) * h, x);
          if (root !== null && !roots.some((r) => Math.abs(r - root) < 1e-3)) roots.push(root);
        }
        prev = y;
      }
      if (roots.length) {
        push("解方程 f(x)=0", `${pretty(eqExpr)} = 0\nx ≈ ${roots.map((r) => r.toFixed(6)).join(", ")}`);
      } else {
        push("解方程 f(x)=0", "在 [-20, 20] 内未找到实根", false);
      }
    } catch (e) {
      push("解方程", `失败: ${(e as Error).message}`, false);
    }
  }

  const actions = [
    { label: "计算", icon: Calculator, run: runEvaluate, hint: "求值表达式（变量自动代入 1,2,3…）" },
    { label: "求导", icon: TrendingUp, run: runDerivative, hint: "符号求导 f'(x)" },
    { label: "积分", icon: Sigma, run: runIntegrate, hint: "先尝试不定积分，失败则数值定积分" },
    { label: "化简", icon: GitBranch, run: runSimplify, hint: "simplify 化简" },
    { label: "展开", icon: GitBranch, run: runExpand, hint: "expand 展开多项式" },
    { label: "解方程", icon: Calculator, run: runSolve, hint: "对下方方程数值求根（二分法）" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* 输入区 */}
        <div className="space-y-4">
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">表达式 f(x)</label>
            <input
              type="text"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-mono text-slate-700 dark:text-slate-200 outline-none focus:border-sky-400 transition-colors"
              placeholder="例: x^3 - 3*x^2 + 2*x"
            />
            <div className="flex flex-wrap gap-2">
              {actions.filter((a) => a.label !== "解方程").map((a) => (
                <button
                  key={a.label}
                  onClick={a.run}
                  title={a.hint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors"
                >
                  <a.icon className="w-3.5 h-3.5" />
                  {a.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">支持符号求导、化简、展开；不定积分为实验特性，失败自动回退数值定积分</p>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">方程 f(x) = 0（二分法求实根）</label>
            <input
              type="text"
              value={eqExpr}
              onChange={(e) => setEqExpr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-mono text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-400 transition-colors"
              placeholder="例: cos(x) - x"
            />
            <button
              onClick={runSolve}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              解方程（范围 [-20, 20]）
            </button>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">数值定积分区间 [a, b]</label>
            <div className="flex items-center gap-2">
              <input type="number" value={intRange[0]}
                onChange={(e) => setIntRange([Number(e.target.value), intRange[1]])}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
              <span className="text-xs text-slate-400">到</span>
              <input type="number" value={intRange[1]}
                onChange={(e) => setIntRange([intRange[0], Number(e.target.value)])}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none" />
            </div>
            <p className="text-[10px] text-slate-400">“积分”按钮在不支持符号积分时使用此区间做数值积分</p>
          </div>

          {/* 结果区 */}
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">计算结果</h3>
            {results.length === 0 && (
              <p className="text-[10px] text-slate-400">点击上方按钮开始计算</p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all ${r.ok ? "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"}`}>
                  <span className="block text-[10px] font-sans font-medium opacity-60 mb-0.5">{r.title}</span>
                  {r.content}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="space-y-4">
          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">示例</h3>
            {[
              "求导: x^3 → 3*x^2",
              "积分: 3*x^2 → x^3",
              "化简: (x+1)*(x-1) → x^2-1",
              "展开: (x+1)^5 → 多项式",
              "方程: cos(x)-x → 0.739085",
            ].map((s) => (
              <button
                key={s}
                onClick={() => {
                  const [op, val] = s.split(": ");
                  if (op === "方程") setEqExpr(val.split(" → ")[0]);
                  else setExpr(val.split(" → ")[0]);
                }}
                className="block w-full text-left text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-700/30 rounded-lg px-2 py-1.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
              >
                {s}
              </button>
            ))}
            <p className="text-[10px] text-slate-400 pt-1">点击示例可填入输入框；用 ^ 表示幂</p>
          </div>

          <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-200/50 dark:border-white/5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">支持的运算</h3>
            <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
              <li>符号求导 derivative</li>
              <li>化简 simplify / 展开 expand</li>
              <li>不定积分 integrate（实验）</li>
              <li>数值定积分 Simpson</li>
              <li>方程求根 二分法</li>
              <li>表达式求值 compile</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
