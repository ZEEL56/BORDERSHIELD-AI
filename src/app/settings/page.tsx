"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
  }, []);

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">Settings</h1>
        <p className="text-xs text-slate-500">Account and platform information</p>
      </div>

      <div className="mx-auto max-w-xl space-y-4 p-8">
        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Profile</h2>
          {me ? (
            <div className="space-y-2 text-xs">
              <Row label="Name" value={me.name} />
              <Row label="Email" value={me.email} />
              <Row label="Role" value={me.role} />
              <Row label="Badge ID" value={me.badgeId || "—"} />
            </div>
          ) : <div className="text-xs text-slate-500">Loading…</div>}
        </div>

        <div className="rounded-lg border border-security-border bg-security-panel/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">About BorderShield AI</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            AI-Powered Identity &amp; Document Screening for Secure Borders. Built for SIH 2026, Problem Statement 26188
            (Ministry of Home Affairs — Sashastra Seema Bal, Police II Division). Tampering detection and face verification
            in this build use classical forensic / heuristic image-analysis techniques, clearly labeled as such — they are
            not certified biometric or ML-trained models, and the platform is not connected to any real government database.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-security-border/40 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
