import { calculateRisk } from "../../src/services/risk.service";
import { assertEqual, assertTrue, test } from "./_harness";

const baseValidation = { checks: [], passed: 5, warnings: 0, failed: 0, isValid: true };
const baseTampering = {
  tamperingDetected: false,
  confidence: 0.05,
  indicators: [],
  suspiciousRegions: [],
  metadataAnalysis: {},
  elaScore: 0.05,
  noiseScore: 0.05,
  compressionScore: 0.05,
  explanation: "clean",
  method: "Forensic / Heuristic Analysis" as const,
};
const baseFace = {
  docFaceFound: true,
  selfieFaceFound: true,
  multipleFaces: false,
  similarity: 92,
  matchDecision: "MATCH" as const,
  confidenceBand: "HIGH" as const,
  explanation: "match",
  method: "Heuristic Visual Similarity Analysis" as const,
};
const baseWatchlist = { result: "CLEAR" as const, matchedEntryId: null, matchScore: null, matchedEntry: null };

export function run() {
  test("clean case scores LOW risk", () => {
    const outcome = calculateRisk({
      ocrFields: [],
      ocrConfidence: 95,
      validation: baseValidation,
      tampering: baseTampering,
      face: baseFace,
      watchlist: baseWatchlist,
    });
    assertEqual(outcome.level, "LOW", "expected LOW risk level");
    assertTrue(outcome.score < 30, "expected score under 30");
  });

  test("watchlist match significantly raises score", () => {
    const outcome = calculateRisk({
      ocrFields: [],
      ocrConfidence: 95,
      validation: baseValidation,
      tampering: baseTampering,
      face: baseFace,
      watchlist: { result: "MATCH_FOUND", matchedEntryId: "x", matchScore: 1, matchedEntry: { fullName: "Test", reason: "demo", severity: "HIGH" } },
    });
    assertTrue(outcome.score >= 40, "expected score to reflect the +40 watchlist factor");
    assertTrue(outcome.factors.some((f) => f.label === "Watchlist match"), "expected a watchlist factor entry");
  });

  test("tampering + face mismatch + watchlist match reaches CRITICAL", () => {
    const outcome = calculateRisk({
      ocrFields: [],
      ocrConfidence: 60,
      validation: baseValidation,
      tampering: { ...baseTampering, tamperingDetected: true, confidence: 0.9, indicators: ["fake edit"] },
      face: { ...baseFace, matchDecision: "NO_MATCH", confidenceBand: "HIGH" },
      watchlist: { result: "MATCH_FOUND", matchedEntryId: "x", matchScore: 1, matchedEntry: { fullName: "Test", reason: "demo", severity: "CRITICAL" } },
    });
    assertEqual(outcome.level, "CRITICAL", "expected CRITICAL risk level");
  });

  test("risk score is always clamped to 0-100", () => {
    const outcome = calculateRisk({
      ocrFields: [],
      ocrConfidence: 10,
      validation: { checks: [], passed: 0, warnings: 5, failed: 5, isValid: false },
      tampering: { ...baseTampering, tamperingDetected: true, confidence: 1, indicators: ["a", "b"], metadataAnalysis: { editingSoftwareDetected: true } },
      face: { ...baseFace, matchDecision: "NO_MATCH", confidenceBand: "HIGH" },
      watchlist: { result: "MATCH_FOUND", matchedEntryId: "x", matchScore: 1, matchedEntry: { fullName: "Test", reason: "demo", severity: "CRITICAL" } },
    });
    assertTrue(outcome.score <= 100, "score must not exceed 100");
  });
}
