"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const RISK_COLORS: Record<string, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#f97316", CRITICAL: "#ef4444" };
const DECISION_COLORS: Record<string, string> = {
  CLEAR: "#10b981",
  SECONDARY_INSPECTION: "#f97316",
  REJECT: "#ef4444",
  REFER_TO_INVESTIGATION: "#ef4444",
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <AppShell><div className="p-8 text-sm text-slate-500">Loading analytics…</div></AppShell>;

  const riskData = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((l) => ({ name: l, value: stats.riskDistribution[l] || 0 }));
  const decisionData = stats.decisionDistribution.map((d: any) => ({ name: d.decision.replace(/_/g, " "), value: d.count, raw: d.decision }));
  const docTypeData = stats.documentTypeDistribution.map((d: any) => ({ name: d.type.replace(/_/g, " "), count: d.count }));

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Analytics</h1>
        <p className="text-xs text-slate-500">Screening volume, risk trends and outcome breakdowns</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-2">
        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Risk Level Distribution</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={riskData} dataKey="value" nameKey="name" outerRadius={90} label>
                {riskData.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Officer Decisions</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={decisionData} dataKey="value" nameKey="name" outerRadius={90} label>
                {decisionData.map((d: any) => <Cell key={d.name} fill={DECISION_COLORS[d.raw] || "#64748b"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Document Type Volume</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={docTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4 lg:col-span-2">
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4 text-center">
            <div className="mono-tabular text-2xl font-bold text-white">{stats.tamperingDetectedCount}</div>
            <div className="text-xs text-slate-500">Tampering Cases Detected</div>
          </div>
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4 text-center">
            <div className="mono-tabular text-2xl font-bold text-white">{stats.faceMismatchCount}</div>
            <div className="text-xs text-slate-500">Face Mismatches</div>
          </div>
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4 text-center">
            <div className="mono-tabular text-2xl font-bold text-white">{stats.avgScreeningSeconds}s</div>
            <div className="text-xs text-slate-500">Avg. Screening Time</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
