import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export const riskColors: Record<string, string> = {
  LOW: "text-security-low border-security-low/40 bg-security-low/10",
  MEDIUM: "text-security-medium border-security-medium/40 bg-security-medium/10",
  HIGH: "text-security-high border-security-high/40 bg-security-high/10",
  CRITICAL: "text-security-critical border-security-critical/40 bg-security-critical/10",
};

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function genCaseNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const ts = Date.now().toString().slice(-6);
  return `BSC-${new Date().getFullYear()}-${ts}${rand}`;
}
