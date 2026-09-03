import { prisma } from "@/lib/prisma";

export { similarity as watchlistSimilarity };

export interface WatchlistOutcome {
  result: "CLEAR" | "MATCH_FOUND" | "REVIEW_REQUIRED";
  matchedEntryId: string | null;
  matchScore: number | null;
  matchedEntry: { fullName: string; reason: string; severity: string } | null;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function similarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Token overlap (Jaccard) — fast, dependency-free approximate matcher.
  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = tokensA.filter((t) => setB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks a case's identity/document details against the DEMO watchlist table.
 * This is a local, demo-labeled dataset — NOT a connection to any real
 * government or law-enforcement watchlist system.
 */
export async function checkWatchlist(params: { fullName?: string; documentNumber?: string }): Promise<WatchlistOutcome> {
  const { fullName, documentNumber } = params;

  if (documentNumber) {
    const exact = await prisma.watchlistEntry.findFirst({ where: { documentNumber } });
    if (exact) {
      return {
        result: "MATCH_FOUND",
        matchedEntryId: exact.id,
        matchScore: 1,
        matchedEntry: { fullName: exact.fullName, reason: exact.reason, severity: exact.severity },
      };
    }
  }

  if (fullName) {
    const entries = await prisma.watchlistEntry.findMany();
    let best: { entry: (typeof entries)[number]; score: number } | null = null;
    for (const entry of entries) {
      const score = similarity(fullName, entry.fullName);
      if (!best || score > best.score) best = { entry, score };
    }
    if (best && best.score >= 0.8) {
      return {
        result: "MATCH_FOUND",
        matchedEntryId: best.entry.id,
        matchScore: best.score,
        matchedEntry: { fullName: best.entry.fullName, reason: best.entry.reason, severity: best.entry.severity },
      };
    }
    if (best && best.score >= 0.4) {
      return {
        result: "REVIEW_REQUIRED",
        matchedEntryId: best.entry.id,
        matchScore: best.score,
        matchedEntry: { fullName: best.entry.fullName, reason: best.entry.reason, severity: best.entry.severity },
      };
    }
  }

  return { result: "CLEAR", matchedEntryId: null, matchScore: null, matchedEntry: null };
}
