"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ScanLine,
  FolderKanban,
  BarChart3,
  ShieldAlert,
  ListChecks,
  Settings,
  ShieldCheck,
  LogOut,
  Radar,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}

const NAV_BY_ROLE: Record<string, { href: string; label: string; icon: any }[]> = {
  OFFICER: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/screening/new", label: "New Screening", icon: ScanLine },
    { href: "/cases", label: "Cases", icon: FolderKanban },
    { href: "/watchlist", label: "Watchlist", icon: ShieldAlert },
    { href: "/audit", label: "Audit Trail", icon: ListChecks },
  ],
  ANALYST: [
    { href: "/analyst", label: "Intelligence", icon: Radar },
    { href: "/cases", label: "Cases", icon: FolderKanban },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/watchlist", label: "Watchlist", icon: ShieldAlert },
    { href: "/audit", label: "Audit Trail", icon: ListChecks },
  ],
  ADMIN: [
    { href: "/admin", label: "Admin Overview", icon: LayoutGrid },
    { href: "/dashboard", label: "Screening Ops", icon: LayoutDashboard },
    { href: "/screening/new", label: "New Screening", icon: ScanLine },
    { href: "/cases", label: "Cases", icon: FolderKanban },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/analyst", label: "Intelligence", icon: Radar },
    { href: "/watchlist", label: "Watchlist", icon: ShieldAlert },
    { href: "/audit", label: "Audit Trail", icon: ListChecks },
  ],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setMe(d.user));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-security-dark text-slate-200">
      <aside className="flex w-60 flex-col border-r border-security-border bg-security-panel/60">
        <div className="flex items-center gap-2 border-b border-security-border px-5 py-4">
          <ShieldCheck className="h-6 w-6 text-security-cyan" />
          <div>
            <div className="text-sm font-bold tracking-wide text-white">BorderShield AI</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Border Security Intel</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {(NAV_BY_ROLE[me?.role || "OFFICER"] || NAV_BY_ROLE.OFFICER).map((n) => {
            const active = pathname === n.href || (n.href !== "/dashboard" && n.href !== "/admin" && pathname.startsWith(n.href));
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-security-cyan/10 text-security-cyan border border-security-cyan/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-security-border p-3">
          {me && (
            <div className="mb-2 rounded-md bg-white/5 px-3 py-2">
              <div className="truncate text-xs font-medium text-slate-200">{me.name}</div>
              <div className="text-[10px] uppercase tracking-wide text-security-cyan">{me.role}</div>
            </div>
          )}
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === "/settings" ? "text-security-cyan" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-security-critical"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
