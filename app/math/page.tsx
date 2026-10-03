"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sigma, TrendingUp, Shapes, Box, Calculator, BarChart3, Clock,
} from "lucide-react";
import GraphingLab from "./GraphingLab";
import GeometryLab from "./GeometryLab";
import ThreeDLab from "./ThreeDLab";
import CasLab from "./CasLab";
import StatsLab from "./StatsLab";

const fadeIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 20 } },
};

type Tab = "graphing" | "geometry" | "3d" | "cas" | "stats";

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: "graphing", label: "图形计算器", icon: TrendingUp, desc: "函数绘图 · 动态参数 · 零点极值" },
  { id: "geometry", label: "几何作图", icon: Shapes, desc: "点线圆多边形 · 可拖动联动" },
  { id: "3d", label: "3D 空间", icon: Box, desc: "三维坐标系 · 点线面曲面" },
  { id: "cas", label: "CAS 计算", icon: Calculator, desc: "符号求导 · 积分 · 解方程" },
  { id: "stats", label: "概率统计", icon: BarChart3, desc: "分布曲线 · 随机模拟" },
];

export default function MathPage() {
  const [tab, setTab] = useState<Tab>("graphing");

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sigma className="w-5 h-5 text-sky-500" />
            数学实验室
          </h1>
          <p className="text-xs text-slate-400">函数可视化 · 几何作图 · 3D 空间 · 符号计算 · 概率统计</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          Math Lab
        </div>
      </div>

      {/* 功能 Tab */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.desc}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                : "bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 hover:border-sky-300 dark:hover:border-sky-500/30"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div key={tab}>
        {tab === "graphing" && <GraphingLab />}
        {tab === "geometry" && <GeometryLab />}
        {tab === "3d" && <ThreeDLab />}
        {tab === "cas" && <CasLab />}
        {tab === "stats" && <StatsLab />}
      </div>
    </motion.div>
  );
}
