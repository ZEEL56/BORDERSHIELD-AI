import { riskLevelFromScore } from "@/lib/utils";
import { ValidationOutcome } from "./validation.service";
import { TamperingAnalysisResult } from "./tampering.service";
import { FaceVerificationResult } from "./face.service";
import { WatchlistOutcome } from "./watchlist.service";
import { OCRField } from "./ocr.service";

export interface RiskFactor {
  label: string;
  points: number;
  reason: string;
}

export interface RiskOutcome {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  recommendation: string;
}

export function calculateRisk(params: {
  ocrFields: OCRField[];
  ocrConfidence: number;
  validation: ValidationOutcome;
  tampering: TamperingAnalysisResult;
  face: FaceVerificationResult;
  watchlist: WatchlistOutcome;
}): RiskOutcome {
  const { ocrConfidence, validation, tampering, face, watchlist } = params;
  const factors: RiskFactor[] = [];

  // --- Watchlist (heaviest weight) ---
  if (watchlist.result === "MATCH_FOUND") {
    factors.push({ label: "Watchlist match", points: 40, reason: `Confirmed match against demo watchlist (${watchlist.matchedEntry?.reason ?? "reason on file"})` });
  } else if (watchlist.result === "REVIEW_REQUIRED") {
    factors.push({ label: "Watchlist partial match", points: 15, reason: "Partial name similarity to a watchlist entry — needs manual review" });
  }

  // --- Tampering ---
  if (tampering.tamperingDetected) {
    const pts = Math.round(20 + tampering.confidence * 25); // 20-45
    factors.push({ label: "Tampering indicators", points: pts, reason: tampering.indicators[0] || "Forensic analysis flagged manipulation indicators" });
  } else if (tampering.confidence > 0.3) {
    factors.push({ label: "Minor forensic anomalies", points: 8, reason: "Some forensic signals present but below the tampering threshold" });
  }

  // --- Face verification ---
  if (face.matchDecision === "NO_MATCH") {
    factors.push({ label: "Face mismatch", points: 25, reason: face.explanation });
  } else if (face.matchDecision === "INCONCLUSIVE") {
    factors.push({ label: "Face verification inconclusive", points: 12, reason: face.explanation });
  }

  // --- Document validation ---
  if (!validation.isValid) {
    const pts = Math.min(25, validation.failed * 10);
    factors.push({ label: "Document validation failures", points: pts, reason: `${validation.failed} structural/logical check(s) failed` });
  }
  const expiredCheck = validation.checks.find((c) => c.code === "EXP_EXPIRED");
  if (expiredCheck) {
    factors.push({ label: "Expired document", points: 15, reason: expiredCheck.message });
  } else {
    const soonCheck = validation.checks.find((c) => c.code === "EXP_SOON");
    if (soonCheck) factors.push({ label: "Expiry approaching", points: 6, reason: soonCheck.message });
  }
  if (validation.warnings > 0 && validation.failed === 0) {
    factors.push({ label: "Validation warnings", points: Math.min(10, validation.warnings * 3), reason: `${validation.warnings} field(s) flagged for review` });
  }

  // --- OCR confidence / document-number anomaly ---
  if (ocrConfidence < 50) {
    factors.push({ label: "Low OCR confidence", points: 10, reason: `Overall extraction confidence only ${ocrConfidence.toFixed(0)}%` });
  }

  // --- Metadata anomalies from tampering module ---
  if (tampering.metadataAnalysis?.editingSoftwareDetected) {
    factors.push({ label: "Editing software in metadata", points: 10, reason: "EXIF metadata names an image-editing application" });
  }

  const rawScore = factors.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const level = riskLevelFromScore(score);

  const recommendation =
    level === "CRITICAL"
      ? "SECONDARY INSPECTION REQUIRED — escalate immediately, do not clear without supervisor review."
      : level === "HIGH"
      ? "SECONDARY INSPECTION RECOMMENDED — verify discrepancies with the traveler before clearance."
      : level === "MEDIUM"
      ? "ADDITIONAL REVIEW SUGGESTED — resolve flagged items, then proceed at officer discretion."
      : "NO SIGNIFICANT RISK INDICATORS — standard processing may continue.";

  if (factors.length === 0) {
    factors.push({ label: "No risk indicators", points: 0, reason: "All checks passed with no anomalies detected" });
  }

  return { score, level, factors: factors.sort((a, b) => b.points - a.points), recommendation };
}
