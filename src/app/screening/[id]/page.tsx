"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RiskBadge, StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";
import {
  FileSearch,
  ShieldCheck,
  ScanFace,
  Fingerprint,
  AlertOctagon,
  Gavel,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-security-border bg-security-panel/60">
      <div className="flex items-center gap-2 border-b border-security-border px-4 py-3">
        <Icon className="h-4 w-4 text-security-cyan" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CheckRow({ status, label, message }: { status: string; label: string; message: string }) {
  const Icon = status === "pass" ? CheckCircle2 : status === "warn" ? AlertTriangle : XCircle;
  const color = status === "pass" ? "text-security-low" : status === "warn" ? "text-security-medium" : "text-security-critical";
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
      <div>
        <span className="font-medium text-slate-300">{label}:</span> <span className="text-slate-400">{message}</span>
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [decision, setDecision] = useState("CLEAR");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  async function load() {
    const res = await fetch(`/api/screening/${id}`);
    const d = await res.json();
    setData(d.case);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function submitDecision(e: React.FormEvent) {
    e.preventDefault();
    setDecisionError("");
    if (reason.trim().length < 5) {
      setDecisionError("Please provide a reason (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/cases/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setDecisionError(d.error || "Failed to record decision.");
      return;
    }
    await load();
  }

  async function downloadReport() {
    const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
    await import("jspdf-autotable");
    const res = await fetch(`/api/reports/${id}`);
    const { report } = await res.json();

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("BorderShield AI — Screening Report", 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(report.isDemo ? "DEMO DATA — NOT A REAL GOVERNMENT DOCUMENT" : "OFFICIAL SCREENING RECORD", 14, 24);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Case: ${report.caseNumber}`, 14, 34);
    doc.text(`Timestamp: ${new Date(report.timestamp).toLocaleString()}`, 14, 40);
    doc.text(`Officer: ${report.officer || "—"}`, 14, 46);
    doc.text(`Document Type: ${report.documentType}`, 14, 52);

    // @ts-ignore autotable plugin attaches to jsPDF prototype
    doc.autoTable({
      startY: 58,
      head: [["Extracted Field", "Value"]],
      body: (report.identity || []).map((f: any) => [f.field, f.value || "—"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    let y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text("Risk Assessment", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Score: ${report.risk?.score ?? "—"}  |  Level: ${report.risk?.level ?? "—"}`, 14, y);
    y += 6;
    doc.text(`Recommendation: ${report.risk?.recommendation ?? "—"}`, 14, y, { maxWidth: 180 });
    y += 12;

    doc.text(`Tampering: ${report.tampering?.tamperingDetected ? "DETECTED" : "Not detected"} (confidence ${report.tampering ? Math.round(report.tampering.confidence * 100) : "—"}%)`, 14, y);
    y += 6;
    doc.text(`Face Verification: ${report.face?.matchDecision ?? "—"} (${report.face?.similarity ?? "—"}%)`, 14, y);
    y += 6;
    doc.text(`Watchlist: ${report.watchlist?.result ?? "—"}`, 14, y);
    y += 6;
    doc.text(`Decision: ${report.decision?.decision ?? "PENDING"}`, 14, y);
    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Audit Hash: ${report.latestAuditHash || "—"}`, 14, y);

    doc.save(`${report.caseNumber}-report.pdf`);
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-slate-500">Loading case…</div>
      </AppShell>
    );
  }

  const ocr = data.ocrResults[0];
  const validation = data.validationResults[0];
  const tampering = data.tamperingResults[0];
  const face = data.faceVerifications[0];
  const watchlist = data.watchlistChecks[0];
  const risk = data.riskAssessments[0];
  const currentDecision = data.decisions[0];

  return (
    <AppShell>
      <div className="flex items-center justify-between border-b border-security-border bg-security-panel/40 px-8 py-5">
        <div>
          <h1 className="font-mono text-lg font-bold text-white">{data.caseNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={data.status} />
            {data.isDemo && <span className="rounded border border-security-medium/40 bg-security-medium/10 px-1.5 py-0.5 text-[10px] font-semibold text-security-medium">DEMO DATA</span>}
            <span className="text-xs text-slate-500">{data.documentType.replace(/_/g, " ")} · {data.country || "—"} · {formatDate(data.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {risk && <RiskBadge level={risk.level} score={risk.score} />}
          <button onClick={downloadReport} className="flex items-center gap-1.5 rounded-md border border-security-border bg-black/20 px-3 py-1.5 text-xs text-slate-300 hover:border-security-cyan/50 hover:text-security-cyan">
            <Download className="h-3.5 w-3.5" /> Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="OCR — Identity Information" icon={FileSearch}>
            {ocr ? (
              <>
                <div className="mb-2 text-xs text-slate-500">Overall confidence: <span className="mono-tabular text-slate-300">{ocr.overallConfidence}%</span> · Engine: {ocr.engine}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {ocr.fields.map((f: any) => (
                    <div key={f.field} className="flex justify-between border-b border-security-border/40 py-1 text-xs">
                      <span className="text-slate-500">{f.field}</span>
                      <span className="mono-tabular text-slate-200">{f.value || "—"} {f.value && <span className="text-slate-600">({f.confidence}%)</span>}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyNote text="OCR has not run for this case." />}
          </Section>

          <Section title="Document Validation" icon={ShieldCheck}>
            {validation ? (
              <>
                <div className="mb-2 flex gap-4 text-xs">
                  <span className="text-security-low">✓ {validation.passed} passed</span>
                  <span className="text-security-medium">⚠ {validation.warnings} warnings</span>
                  <span className="text-security-critical">✕ {validation.failed} failed</span>
                </div>
                {validation.checks.map((c: any) => <CheckRow key={c.code} status={c.status} label={c.label} message={c.message} />)}
              </>
            ) : <EmptyNote text="Validation has not run for this case." />}
          </Section>

          <Section title="AI Forensics — Tampering Detection" icon={Fingerprint}>
            {tampering ? (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <span className={`rounded px-2 py-1 text-xs font-bold ${tampering.tamperingDetected ? "bg-security-critical/15 text-security-critical" : "bg-security-low/15 text-security-low"}`}>
                    {tampering.tamperingDetected ? "TAMPERING DETECTED" : "NO TAMPERING DETECTED"}
                  </span>
                  <span className="mono-tabular text-xs text-slate-400">Confidence: {Math.round(tampering.confidence * 100)}%</span>
                  <span className="rounded border border-security-border px-1.5 py-0.5 text-[10px] text-slate-500">{tampering.method}</span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <MetricBox label="ELA Score" value={tampering.elaScore} />
                  <MetricBox label="Noise Score" value={tampering.noiseScore} />
                  <MetricBox label="Compression Score" value={tampering.compressionScore} />
                </div>
                {tampering.indicators.length > 0 && (
                  <ul className="mb-2 list-inside list-disc space-y-1 text-xs text-slate-400">
                    {tampering.indicators.map((ind: string, i: number) => <li key={i}>{ind}</li>)}
                  </ul>
                )}
                <p className="text-xs text-slate-500">{tampering.explanation}</p>
                {tampering.suspiciousRegions?.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">{tampering.suspiciousRegions.length} suspicious region(s) flagged in the image grid.</div>
                )}
              </>
            ) : <EmptyNote text="Tampering analysis has not run for this case." />}
          </Section>

          <Section title="Face Verification" icon={ScanFace}>
            {face ? (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="mono-tabular text-3xl font-bold text-white">{face.similarity != null ? `${face.similarity}%` : "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Similarity</div>
                </div>
                <div>
                  <span className={`rounded px-2 py-1 text-xs font-bold ${face.matchDecision === "MATCH" ? "bg-security-low/15 text-security-low" : face.matchDecision === "NO_MATCH" ? "bg-security-critical/15 text-security-critical" : "bg-security-medium/15 text-security-medium"}`}>
                    {face.matchDecision.replace("_", " ")}
                  </span>
                  <div className="mt-1 text-xs text-slate-500">Confidence: {face.confidenceBand}</div>
                  <p className="mt-2 max-w-md text-xs text-slate-500">{face.explanation}</p>
                </div>
              </div>
            ) : <EmptyNote text="Face verification has not run for this case." />}
          </Section>

          <Section title="Watchlist" icon={AlertOctagon}>
            {watchlist ? (
              <span className={`rounded px-2 py-1 text-xs font-bold ${watchlist.result === "CLEAR" ? "bg-security-low/15 text-security-low" : watchlist.result === "MATCH_FOUND" ? "bg-security-critical/15 text-security-critical" : "bg-security-medium/15 text-security-medium"}`}>
                {watchlist.result.replace("_", " ")}
              </span>
            ) : <EmptyNote text="Watchlist check has not run for this case." />}
            <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-600">Demo watchlist dataset — not a real government database</div>
          </Section>
        </div>

        <div className="space-y-4">
          {risk && (
            <Section title="Explainable Risk Score" icon={AlertOctagon}>
              <div className="mb-3 text-center">
                <div className="mono-tabular text-4xl font-black text-white">{risk.score}</div>
                <RiskBadge level={risk.level} />
              </div>
              <div className="space-y-1.5">
                {risk.factors.map((f: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-2 border-b border-security-border/40 py-1 text-xs">
                    <span className="text-slate-400">{f.label}</span>
                    <span className={`mono-tabular font-semibold ${f.points > 0 ? "text-security-critical" : "text-slate-500"}`}>{f.points > 0 ? `+${f.points}` : "0"}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-md border border-security-border bg-black/20 p-2 text-xs font-medium text-slate-300">{risk.recommendation}</p>
            </Section>
          )}

          <Section title="Officer Decision" icon={Gavel}>
            {currentDecision ? (
              <div className="text-xs">
                <div className="mb-1 font-bold text-white">{currentDecision.decision.replace(/_/g, " ")}</div>
                <div className="text-slate-400">by {currentDecision.officer?.name} · {formatDate(currentDecision.createdAt)}</div>
                <div className="mt-2 rounded-md border border-security-border bg-black/20 p-2 text-slate-400">{currentDecision.reason}</div>
              </div>
            ) : (
              <form onSubmit={submitDecision} className="space-y-3">
                <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none">
                  <option value="CLEAR">Clear</option>
                  <option value="SECONDARY_INSPECTION">Secondary Inspection</option>
                  <option value="REJECT">Reject</option>
                  <option value="REFER_TO_INVESTIGATION">Refer to Investigation</option>
                </select>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for this decision (required)"
                  rows={3}
                  className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600"
                />
                {decisionError && <div className="text-xs text-security-critical">{decisionError}</div>}
                <button disabled={submitting} type="submit" className="w-full rounded-md bg-security-cyan py-2 text-xs font-semibold text-black hover:bg-security-cyan/90 disabled:opacity-60">
                  {submitting ? "Recording…" : "Record Decision"}
                </button>
              </form>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="text-xs text-slate-600">{text}</div>;
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-security-border bg-black/20 py-2">
      <div className="mono-tabular text-sm font-bold text-slate-200">{Math.round(value * 100)}%</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
