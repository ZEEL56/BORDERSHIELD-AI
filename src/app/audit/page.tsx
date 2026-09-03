"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, Link2, Loader2 } from "lucide-react";

export default function AuditPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch("/api/cases?pageSize=50").then((r) => r.json()).then((d) => setCases(d.cases || []));
  }, []);

  useEffect(() => {
    if (!selectedCase) { setEvents([]); return; }
    fetch(`/api/audit/${selectedCase}`).then((r) => r.json()).then((d) => setEvents(d.events || []));
  }, [selectedCase]);

  async function verify() {
    setVerifying(true);
    setVerifyResult(null);
    const res = await fetch("/api/audit/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const d = await res.json();
    setVerifyResult(d);
    setVerifying(false);
  }

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Immutable Audit Trail</h1>
        <p className="text-xs text-slate-500">SHA-256 hash-chained event log — every action is cryptographically linked to the one before it</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Chain Integrity</h2>
            <button
              onClick={verify}
              disabled={verifying}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-security-cyan py-2 text-xs font-semibold text-black hover:bg-security-cyan/90 disabled:opacity-60"
            >
              {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Verify Full Chain
            </button>
            {verifyResult && (
              <div className={`mt-3 flex items-start gap-2 rounded-md border p-2.5 text-xs ${verifyResult.valid ? "border-security-low/40 bg-security-low/10 text-security-low" : "border-security-critical/40 bg-security-critical/10 text-security-critical"}`}>
                {verifyResult.valid ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{verifyResult.message}</span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Select a Case</h2>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${selectedCase === c.id ? "border-security-cyan/50 bg-security-cyan/10 text-security-cyan" : "border-security-border text-slate-400 hover:bg-white/5"}`}
                >
                  <div className="font-mono">{c.caseNumber}</div>
                  <div className="text-[10px] text-slate-600">{formatDate(c.createdAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-lg border border-security-border bg-security-panel/60">
            <div className="border-b border-security-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-300">Event Chain {selectedCase && `— ${events.length} events`}</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4">
              {!selectedCase && <div className="text-xs text-slate-600">Select a case to view its audit event chain.</div>}
              {selectedCase && events.length === 0 && <div className="text-xs text-slate-600">No events recorded.</div>}
              <div className="space-y-3">
                {events.map((e, i) => (
                  <div key={e.id} className="relative rounded-md border border-security-border bg-black/20 p-3 text-xs">
                    {i > 0 && <Link2 className="absolute -top-3.5 left-4 h-3 w-3 text-slate-700" />}
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{e.eventType.replace(/_/g, " ")}</span>
                      <span className="text-slate-600">{formatDate(e.timestamp)}</span>
                    </div>
                    {e.user && <div className="mb-1 text-slate-500">by {e.user.name} ({e.user.role})</div>}
                    <div className="mono-tabular truncate text-[10px] text-slate-600">hash: {e.hash}</div>
                    <div className="mono-tabular truncate text-[10px] text-slate-700">prev: {e.previousHash}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
