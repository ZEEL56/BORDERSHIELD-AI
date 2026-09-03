"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RiskBadge, StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

const STATUSES = ["", "PENDING", "PROCESSING", "AWAITING_DECISION", "CLEARED", "SECONDARY_INSPECTION", "REJECTED", "REFERRED"];

export default function CasesPage() {
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/cases?${params}`);
    const d = await res.json();
    setCases(d.cases || []);
    setTotal(d.total || 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Cases</h1>
        <p className="text-xs text-slate-500">{total} screening case(s) on record</p>
      </div>

      <div className="p-8">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-md border border-security-border bg-black/20 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
              placeholder="Search case number or country…"
              className="w-56 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-security-border bg-black/20 px-3 py-2 text-xs text-slate-300 outline-none"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-security-border bg-security-panel/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-security-border text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Case ID</th>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Country</th>
                <th className="px-4 py-2.5 font-medium">Risk</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Decision</th>
                <th className="px-4 py-2.5 font-medium">Officer</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-security-border/50 hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <Link href={`/cases/${c.id}`} className="font-mono text-xs text-security-cyan hover:underline">{c.caseNumber}</Link>
                    {c.isDemo && <span className="ml-1.5 rounded border border-security-medium/40 px-1 text-[9px] text-security-medium">DEMO</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-300">{c.documentType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.country || "—"}</td>
                  <td className="px-4 py-2.5">{c.risk ? <RiskBadge level={c.risk.level} score={c.risk.score} /> : <span className="text-xs text-slate-600">Pending</span>}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.decision?.decision.replace(/_/g, " ") || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{c.createdBy}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-500">No cases match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-security-border px-3 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="rounded border border-security-border px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
