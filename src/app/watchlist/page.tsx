"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Search, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function WatchlistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [docNum, setDocNum] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/watchlist/entries").then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!name && !docNum) return;
    setSearching(true);
    const params = new URLSearchParams();
    if (name) params.set("fullName", name);
    if (docNum) params.set("documentNumber", docNum);
    const res = await fetch(`/api/watchlist/search?${params}`);
    const d = await res.json();
    setResult(d);
    setSearching(false);
  }

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Watchlist</h1>
        <p className="text-xs text-slate-500">
          <span className="rounded border border-security-medium/40 bg-security-medium/10 px-1.5 py-0.5 text-[10px] font-semibold text-security-medium">DEMO WATCHLIST DATABASE</span>{" "}
          — a local demo dataset, not a connection to any real government or law-enforcement watchlist
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Manual Search</h2>
            <form onSubmit={search} className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600" />
              <input value={docNum} onChange={(e) => setDocNum(e.target.value)} placeholder="Document number" className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600" />
              <button type="submit" disabled={searching} className="flex w-full items-center justify-center gap-2 rounded-md bg-security-cyan py-2 text-xs font-semibold text-black hover:bg-security-cyan/90">
                <Search className="h-3.5 w-3.5" /> Search
              </button>
            </form>

            {result && (
              <div className={`mt-3 rounded-md border p-3 text-xs ${result.result === "CLEAR" ? "border-security-low/40 bg-security-low/10 text-security-low" : result.result === "MATCH_FOUND" ? "border-security-critical/40 bg-security-critical/10 text-security-critical" : "border-security-medium/40 bg-security-medium/10 text-security-medium"}`}>
                <div className="mb-1 flex items-center gap-1.5 font-bold">
                  {result.result === "CLEAR" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {result.result?.replace("_", " ")}
                </div>
                {result.matchedEntry && (
                  <div className="mt-1 text-slate-400">
                    Matched: {result.matchedEntry.fullName} — {result.matchedEntry.reason} (score {(result.matchScore * 100).toFixed(0)}%)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-security-border bg-security-panel/60">
            <div className="border-b border-security-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-300">Demo Watchlist Entries ({entries.length})</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-security-border text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Doc Number</th>
                  <th className="px-4 py-2 font-medium">Nationality</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-security-border/50">
                    <td className="px-4 py-2 text-xs text-slate-200">{e.fullName}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{e.documentNumber || "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{e.nationality || "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{e.reason}</td>
                    <td className="px-4 py-2 text-xs"><span className="rounded border border-security-critical/40 bg-security-critical/10 px-1.5 py-0.5 text-security-critical">{e.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
