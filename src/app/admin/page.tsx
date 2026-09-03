"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CheckCircle2, XCircle, UserPlus, Loader2, Siren, AlertTriangle, ScanLine, ShieldCheck } from "lucide-react";

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

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [system, setSystem] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "OFFICER", badgeId: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    const [uRes, sRes, statsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/system"),
      fetch("/api/dashboard/stats"),
    ]);
    if (uRes.status === 403) { setForbidden(true); return; }
    setUsers((await uRes.json()).users || []);
    setSystem(await sRes.json());
    setStats(await statsRes.json());
  }

  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setCreating(false);
    if (!res.ok) { setError(d.error); return; }
    setForm({ name: "", email: "", password: "", role: "OFFICER", badgeId: "" });
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  if (forbidden) {
    return <AppShell><div className="p-8 text-sm text-security-critical">You do not have permission to view the admin panel.</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Admin Overview</h1>
        <p className="text-xs text-slate-500">System-wide screening statistics, users, roles, and service health</p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-8 pt-8 md:grid-cols-4">
        <StatCard icon={ScanLine} label="Total Screenings" value={stats?.totalScreenings ?? "—"} tone="text-security-cyan" />
        <StatCard icon={AlertTriangle} label="High Risk Cases" value={stats?.highRiskCases ?? "—"} tone="text-security-high" />
        <StatCard icon={Siren} label="Critical Alerts" value={stats?.criticalAlerts ?? "—"} tone="text-security-critical" />
        <StatCard
          icon={ShieldCheck}
          label="Audit Chain"
          value={system?.auditChain?.valid ? "INTACT" : system ? "COMPROMISED" : "—"}
          tone={system?.auditChain?.valid === false ? "text-security-critical" : "text-security-low"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-security-border bg-security-panel/60">
            <div className="border-b border-security-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-300">Users ({users.length})</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-security-border text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-security-border/50">
                    <td className="px-4 py-2 text-xs text-slate-200">{u.name}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{u.email}</td>
                    <td className="px-4 py-2 text-xs"><span className="rounded border border-security-cyan/40 bg-security-cyan/10 px-1.5 py-0.5 text-security-cyan">{u.role}</span></td>
                    <td className="px-4 py-2 text-xs">{u.isActive ? <span className="text-security-low">Active</span> : <span className="text-security-critical">Disabled</span>}</td>
                    <td className="px-4 py-2 text-xs">
                      <button onClick={() => toggleActive(u.id, u.isActive)} className="text-security-cyan hover:underline">
                        {u.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300"><UserPlus className="h-4 w-4" /> Create User</h2>
            <form onSubmit={createUser} className="grid grid-cols-2 gap-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none" />
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none" />
              <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 8 chars)" className="rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none">
                <option value="OFFICER">Officer</option>
                <option value="ANALYST">Analyst</option>
                <option value="ADMIN">Admin</option>
              </select>
              <input value={form.badgeId} onChange={(e) => setForm({ ...form, badgeId: e.target.value })} placeholder="Badge ID (optional)" className="col-span-2 rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none" />
              {error && <div className="col-span-2 text-xs text-security-critical">{error}</div>}
              <button disabled={creating} type="submit" className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-security-cyan py-2 text-xs font-semibold text-black hover:bg-security-cyan/90">
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create User
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">System Health</h2>
          <div className="space-y-2">
            {system?.services?.map((s: any) => (
              <div key={s.name} className="flex items-center justify-between rounded-md border border-security-border bg-black/20 px-3 py-2 text-xs">
                <span className="text-slate-300">{s.name}</span>
                <span className={`flex items-center gap-1 font-semibold ${s.status === "OPERATIONAL" || s.status === "INTACT" ? "text-security-low" : "text-security-critical"}`}>
                  {s.status === "OPERATIONAL" || s.status === "INTACT" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          {system?.counts && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-md border border-security-border bg-black/20 py-2"><div className="mono-tabular font-bold text-white">{system.counts.caseCount}</div><div className="text-slate-500">Cases</div></div>
              <div className="rounded-md border border-security-border bg-black/20 py-2"><div className="mono-tabular font-bold text-white">{system.counts.auditCount}</div><div className="text-slate-500">Audit Events</div></div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
