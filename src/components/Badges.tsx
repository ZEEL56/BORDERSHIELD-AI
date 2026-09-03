import { cn, riskColors } from "@/lib/utils";

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide", riskColors[level] || "text-slate-300 border-slate-600 bg-slate-800")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
      {typeof score === "number" && <span className="mono-tabular opacity-80">· {score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-slate-300 border-slate-600 bg-slate-800/60",
  PROCESSING: "text-security-cyan border-security-cyan/40 bg-security-cyan/10",
  AWAITING_DECISION: "text-security-medium border-security-medium/40 bg-security-medium/10",
  CLEARED: "text-security-low border-security-low/40 bg-security-low/10",
  SECONDARY_INSPECTION: "text-security-high border-security-high/40 bg-security-high/10",
  REJECTED: "text-security-critical border-security-critical/40 bg-security-critical/10",
  REFERRED: "text-security-critical border-security-critical/40 bg-security-critical/10",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", STATUS_STYLES[status] || "text-slate-300 border-slate-600")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
