"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RiskBadge, StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";
import {
  ScanLine,
  AlertTriangle,
  Siren,
  FileStack,
  Fingerprint,
  UserX,
  Timer,
  Activity,
  Gavel,
  CalendarCheck,
} from "lucide-react";
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
} from "recharts";

interface Stats {
  totalScreenings: number;
  documentsProcessed: number;
  highRiskCases: number;
  criticalAlerts: number;
  tamperingDetectedCount: number;
  faceMismatchCount: number;
  avgScreeningSeconds: number;
  activeScreenings: number;
  pendingDecisions: number;
  todayScreenings: number;
  watchlistMatches: number;
  riskDistribution: Record<string, number>;
  documentTypeDistribution: { type: string; count: number }[];
  decisionDistribution: { decision: string; count: number }[];
  recentCases: any[];
}

const RISK_COLORS: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-2 mono-tabular text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats);
  }, []);

  const riskData = stats
    ? (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level) => ({ name: level, value: stats.riskDistribution[level] || 0 }))
    : [];
  const docTypeData = stats?.documentTypeDistribution.map((d) => ({ name: d.type.replace(/_/g, " "), count: d.count })) || [];

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Screening Operations</h1>
        <p className="text-xs text-slate-500">Your active queue, pending decisions, and today's screening activity</p>
      </div>

      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={CalendarCheck} label="Today's Screenings" value={stats?.todayScreenings ?? "—"} tone="text-security-cyan" />
          <StatCard icon={Activity} label="Active Screenings" value={stats?.activeScreenings ?? "—"} tone="text-security-blue" />
          <StatCard icon={Gavel} label="Pending Decisions" value={stats?.pendingDecisions ?? "—"} tone="text-security-medium" />
          <Link href="/screening/new" className="flex flex-col items-center justify-center rounded-lg border border-dashed border-security-cyan/40 bg-security-cyan/5 p-4 text-center text-xs font-semibold text-security-cyan transition hover:bg-security-cyan/10">
            + New Screening
          </Link>
          <StatCard icon={AlertTriangle} label="High Risk Cases" value={stats?.highRiskCases ?? "—"} tone="text-security-high" />
          <StatCard icon={Siren} label="Critical Alerts" value={stats?.criticalAlerts ?? "—"} tone="text-security-critical" />
          <StatCard icon={Fingerprint} label="Tampering Detected" value={stats?.tamperingDetectedCount ?? "—"} tone="text-security-critical" />
          <StatCard icon={UserX} label="Face Mismatches" value={stats?.faceMismatchCount ?? "—"} tone="text-security-high" />
        </div>

        {stats && stats.pendingDecisions > 0 && (
          <Link
            href="/cases?status=AWAITING_DECISION"
            className="flex items-center justify-between rounded-lg border border-security-medium/40 bg-security-medium/10 px-4 py-3 text-sm text-security-medium transition hover:bg-security-medium/15"
          >
            <span className="font-semibold">{stats.pendingDecisions} case(s) are awaiting your decision</span>
            <span className="text-xs underline">Go to queue →</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={ScanLine} label="Total Screenings" value={stats?.totalScreenings ?? "—"} tone="text-security-cyan" />
          <StatCard icon={FileStack} label="Documents Processed" value={stats?.documentsProcessed ?? "—"} tone="text-security-blue" />
          <StatCard icon={Timer} label="Avg. Screening Time" value={stats ? `${stats.avgScreeningSeconds}s` : "—"} tone="text-security-medium" />
          <StatCard icon={AlertTriangle} label="Watchlist Matches" value={stats?.watchlistMatches ?? "—"} tone="text-security-critical" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Documents by Type</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={docTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Risk Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {riskData.map((d) => (
                    <Cell key={d.name} fill={RISK_COLORS[d.name]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px]">
              {riskData.map((d) => (
                <span key={d.name} className="flex items-center gap-1 text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[d.name] }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-security-border bg-security-panel/60">
          <div className="flex items-center justify-between border-b border-security-border px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-300">Recent Cases</h2>
            <Link href="/cases" className="text-xs text-security-cyan hover:underline">View all</Link>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-security-border text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Case ID</th>
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Country</th>
                <th className="px-4 py-2 font-medium">Risk</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Officer</th>
                <th className="px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentCases.map((c) => (
                <tr key={c.id} className="border-b border-security-border/50 hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <Link href={`/screening/${c.id}`} className="font-mono text-xs text-security-cyan hover:underline">{c.caseNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-300">{c.documentType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.country || "—"}</td>
                  <td className="px-4 py-2.5">{c.risk ? <RiskBadge level={c.risk.level} score={c.risk.score} /> : <span className="text-xs text-slate-600">Pending</span>}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.officer}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {stats && stats.recentCases.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">No screenings yet. Start a new screening to see data here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
