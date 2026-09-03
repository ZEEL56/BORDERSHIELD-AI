"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RiskBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Search, Repeat, Fingerprint, ShieldAlert, Globe2, TrendingUp } from "lucide-react";

export default function AnalystPage() {
  const [data, setData] = useState<any>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/intelligence").then(async (r) => {
      if (r.status === 403) {
        setForbidden(true);
        return;
      }
      setData(await r.json());
    });
  }, []);

  if (forbidden) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-security-critical">You do not have permission to view the intelligence dashboard.</div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-slate-500">Loading intelligence data…</div>
      </AppShell>
    );
  }

  const riskTrendData = data.riskTrend.map((r: any, i: number) => ({ idx: i + 1, score: r.score }));

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Intelligence &amp; Investigation</h1>
        <p className="text-xs text-slate-500">Cross-case patterns, repeated identifiers, and forensic trends — derived from live screening data</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-security-border bg-security-panel/60">
            <div className="flex items-center gap-2 border-b border-security-border px-4 py-3">
              <ShieldAlert className="h-4 w-4 text-security-critical" />
              <h2 className="text-sm font-semibold text-slate-200">Investigation Queue — High/Critical Risk, Awaiting Decision</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-security-border text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Case</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 font-medium">Tampering</th>
                  <th className="px-4 py-2 font-medium">Face</th>
                  <th className="px-4 py-2 font-medium">Officer</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.suspiciousCases.map((c: any) => (
                  <tr key={c.id} className="border-b border-security-border/50 hover:bg-white/5">
                    <td className="px-4 py-2">
                      <Link href={`/cases/${c.id}`} className="font-mono text-xs text-security-cyan hover:underline">{c.caseNumber}</Link>
                    </td>
                    <td className="px-4 py-2">{c.risk ? <RiskBadge level={c.risk.level} score={c.risk.score} /> : "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.tamperingDetected ? <span className="text-security-critical font-semibold">DETECTED</span> : <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{c.faceMatch || "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{c.createdBy}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
                {data.suspiciousCases.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">No high/critical-risk cases currently awaiting decision.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-security-cyan" />
              <h2 className="text-sm font-semibold text-slate-200">Recurring Tampering Indicators</h2>
              <span className="text-xs text-slate-500">({data.tamperingCaseCount} flagged case(s) analyzed)</span>
            </div>
            {data.topIndicators.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, data.topIndicators.length * 32)}>
                <BarChart data={data.topIndicators} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="indicator" type="category" width={260} stroke="#64748b" fontSize={10} tickFormatter={(v: string) => (v.length > 45 ? v.slice(0, 45) + "…" : v)} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 11 }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-600">No tampering indicators recorded yet.</div>
            )}
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-security-cyan" />
              <h2 className="text-sm font-semibold text-slate-200">Risk Score Trend (recent screenings)</h2>
            </div>
            {riskTrendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={riskTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="idx" stroke="#64748b" fontSize={11} label={{ value: "screenings (oldest → newest)", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-600">Not enough data yet for a trend line.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-security-medium" />
              <h2 className="text-sm font-semibold text-slate-200">Repeated Identifiers</h2>
            </div>
            <p className="mb-2 text-[11px] text-slate-500">Same name or document number appearing across multiple screening cases.</p>
            <div className="space-y-1.5">
              {data.repeatedIdentifiers.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-security-border bg-black/20 px-3 py-2 text-xs">
                  <div>
                    <div className="text-slate-200">{r.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-600">{r.type.replace("_", " ")}</div>
                  </div>
                  <span className="rounded border border-security-medium/40 bg-security-medium/10 px-1.5 py-0.5 text-security-medium">{r.caseCount}× cases</span>
                </div>
              ))}
              {data.repeatedIdentifiers.length === 0 && <div className="text-xs text-slate-600">No repeated identifiers detected yet.</div>}
            </div>
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-security-critical" />
              <h2 className="text-sm font-semibold text-slate-200">Watchlist Activity</h2>
            </div>
            <div className="space-y-1.5">
              {data.watchlistActivity.map((w: any) => (
                <Link key={w.id} href={`/cases/${w.id}`} className="block rounded-md border border-security-border bg-black/20 px-3 py-2 text-xs hover:border-security-cyan/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-300">{w.caseNumber}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${w.result === "MATCH_FOUND" ? "bg-security-critical/15 text-security-critical" : "bg-security-medium/15 text-security-medium"}`}>{w.result.replace("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-slate-500">{w.queryName || "—"} · {formatDate(w.createdAt)}</div>
                </Link>
              ))}
              {data.watchlistActivity.length === 0 && <div className="text-xs text-slate-600">No watchlist activity recorded yet.</div>}
            </div>
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-security-blue" />
              <h2 className="text-sm font-semibold text-slate-200">Country Trend</h2>
            </div>
            <div className="space-y-1">
              {data.countryTrend.sort((a: any, b: any) => b.count - a.count).slice(0, 8).map((c: any) => (
                <div key={c.country} className="flex justify-between text-xs">
                  <span className="text-slate-400">{c.country}</span>
                  <span className="mono-tabular text-slate-200">{c.count}</span>
                </div>
              ))}
              {data.countryTrend.length === 0 && <div className="text-xs text-slate-600">No country data yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
