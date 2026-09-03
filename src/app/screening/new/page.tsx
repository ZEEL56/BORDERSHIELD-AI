"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Loader2, ScanFace, FileText } from "lucide-react";

const DOC_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "VISA", label: "Visa" },
  { value: "NATIONAL_ID", label: "National ID" },
  { value: "DRIVING_LICENSE", label: "Driving License" },
  { value: "PERMIT", label: "Permit" },
];

const STAGES = [
  "Uploading documents",
  "Running OCR extraction",
  "Validating document fields",
  "Running tampering forensics",
  "Verifying face match",
  "Checking watchlist",
  "Calculating risk score",
];

export default function NewScreeningPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("PASSPORT");
  const [country, setCountry] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile) {
      setError("A document image is required.");
      return;
    }
    setError("");
    setLoading(true);

    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 900);

    try {
      const form = new FormData();
      form.set("documentType", documentType);
      form.set("country", country);
      form.set("document", docFile);
      if (selfieFile) form.set("selfie", selfieFile);

      const res = await fetch("/api/screening/run", { method: "POST", body: form });
      const data = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        setError(data.error || "Screening pipeline failed.");
        setLoading(false);
        return;
      }
      router.push(`/screening/${data.case.id}`);
    } catch {
      clearInterval(interval);
      setError("Network error while running the screening pipeline.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="border-b border-security-border bg-security-panel/40 px-8 py-5">
        <h1 className="text-lg font-bold text-white">New Screening</h1>
        <p className="text-xs text-slate-500">Upload a travel document to run the full AI screening pipeline</p>
      </div>

      <div className="mx-auto max-w-2xl p-8">
        {!loading ? (
          <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-security-border bg-security-panel/60 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none focus:border-security-cyan"
              >
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Country / Issuing Authority (optional)</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India"
                className="w-full rounded-md border border-security-border bg-black/30 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-security-cyan"
              />
            </div>

            <FileDrop label="Document Image" icon={FileText} file={docFile} onChange={setDocFile} required />
            <FileDrop label="Presented Person Photo (for face verification)" icon={ScanFace} file={selfieFile} onChange={setSelfieFile} />

            {error && <div className="rounded-md border border-security-critical/40 bg-security-critical/10 px-3 py-2 text-xs text-security-critical">{error}</div>}

            <button
              type="submit"
              className="w-full rounded-md bg-security-cyan py-2.5 text-sm font-semibold text-black transition hover:bg-security-cyan/90"
            >
              Run Screening Pipeline
            </button>
          </form>
        ) : (
          <div className="rounded-lg border border-security-border bg-security-panel/60 p-8 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-security-cyan" />
            <h2 className="mb-1 text-sm font-semibold text-white">Running AI screening pipeline…</h2>
            <p className="mb-6 text-xs text-slate-500">OCR → Validation → Tampering Forensics → Face Verification → Watchlist → Risk Score</p>
            <div className="space-y-2 text-left">
              {STAGES.map((s, i) => (
                <div key={s} className={`flex items-center gap-2 text-xs ${i <= stageIdx ? "text-slate-200" : "text-slate-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${i <= stageIdx ? "bg-security-cyan" : "bg-slate-700"}`} />
                  {s}
                  {i === stageIdx && <Loader2 className="h-3 w-3 animate-spin text-security-cyan" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FileDrop({
  label,
  icon: Icon,
  file,
  onChange,
  required,
}: {
  label: string;
  icon: any;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">
        {label} {required && <span className="text-security-critical">*</span>}
      </label>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-security-border bg-black/20 px-4 py-6 text-center transition hover:border-security-cyan/50">
        <Icon className="h-5 w-5 text-slate-500" />
        <span className="text-xs text-slate-400">{file ? file.name : "Click to select JPEG / PNG / WEBP (max 10MB)"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}
