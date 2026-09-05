"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, Mail, Loader2 } from "lucide-react";

const LANDING_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin",
  ANALYST: "/analyst",
  OFFICER: "/dashboard",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }
      router.push(params.get("next") || LANDING_BY_ROLE[data.user?.role] || "/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-security-dark px-4">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-security-cyan/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-security-blue/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-security-cyan/30 bg-security-cyan/10">
            <ShieldCheck className="h-7 w-7 text-security-cyan" />
          </div>
          <h1 className="text-xl font-bold text-white">BorderShield AI</h1>
          <p className="mt-1 text-xs text-slate-500">AI-Powered Identity &amp; Document Screening for Secure Borders</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-security-border bg-security-panel/70 p-6 shadow-2xl">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
            <div className="flex items-center gap-2 rounded-md border border-security-border bg-black/30 px-3 py-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@bordershield.gov.in"
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
            <div className="flex items-center gap-2 rounded-md border border-security-border bg-black/30 px-3 py-2">
              <Lock className="h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          {error && <div className="rounded-md border border-security-critical/40 bg-security-critical/10 px-3 py-2 text-xs text-security-critical">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-security-cyan py-2.5 text-sm font-semibold text-black transition hover:bg-security-cyan/90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          <div className="rounded-md border border-security-border bg-black/20 p-3 text-[11px] leading-relaxed text-slate-500">
            <div className="mb-1 font-semibold text-slate-400">Demo accounts</div>
            admin@bordershield.gov.in / Admin@12345<br />
            officer@bordershield.gov.in / Officer@12345<br />
            analyst@bordershield.gov.in / Analyst@12345
          </div>
        </form>
      </div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
