import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Investigation-focused analytics for the Analyst role. Everything here is
 * derived from the same tables the Officer pipeline writes to — there is no
 * separate "analyst dataset". This is what makes the Analyst view genuinely
 * different from the Officer dashboard: it looks *across* cases (patterns,
 * repeats, trends) rather than driving a single case through the pipeline.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ANALYST", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [suspiciousCases, tamperingResults, watchlistActivity, ocrResults, countryTrend, recentRiskAssessments] = await Promise.all([
    // Investigation queue: high/critical risk cases still awaiting an officer decision.
    prisma.screeningCase.findMany({
      where: { status: "AWAITING_DECISION", riskAssessments: { some: { level: { in: ["HIGH", "CRITICAL"] } } } },
      include: {
        createdBy: { select: { name: true } },
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
        tamperingResults: { orderBy: { createdAt: "desc" }, take: 1 },
        faceVerifications: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    // Tampering pattern mining: recent flagged results, to surface recurring indicator phrases.
    prisma.tamperingResult.findMany({
      where: { tamperingDetected: true },
      select: { indicators: true, confidence: true, caseId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // Watchlist activity log: anything that wasn't a clean CLEAR.
    prisma.watchlistCheck.findMany({
      where: { result: { in: ["MATCH_FOUND", "REVIEW_REQUIRED"] } },
      include: { case: { select: { caseNumber: true, documentType: true, country: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    // Repeated-identifier mining: pull recent OCR fields to group by extracted name/doc number in app code
    // (Postgres JSON-array grouping isn't practical through Prisma's query builder for this shape).
    prisma.oCRResult.findMany({
      select: { caseId: true, fields: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.screeningCase.groupBy({ by: ["country"], _count: true, where: { country: { not: null } } }),
    prisma.riskAssessment.findMany({
      select: { score: true, level: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  // --- Tampering indicator frequency ---
  const indicatorFreq = new Map<string, number>();
  for (const t of tamperingResults) {
    for (const ind of t.indicators as unknown as string[]) {
      indicatorFreq.set(ind, (indicatorFreq.get(ind) || 0) + 1);
    }
  }
  const topIndicators = Array.from(indicatorFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([indicator, count]) => ({ indicator, count }));

  // --- Repeated identifiers (same name or same document number across distinct cases) ---
  const nameToCases = new Map<string, Set<string>>();
  const docNumToCases = new Map<string, Set<string>>();
  for (const r of ocrResults) {
    const fields = r.fields as unknown as { field: string; value: string }[];
    const name = fields.find((f) => f.field === "Full Name")?.value?.trim().toUpperCase();
    const docNum = fields.find((f) => ["Passport Number", "Visa Number", "Document Number"].includes(f.field))?.value?.trim().toUpperCase();
    if (name) {
      if (!nameToCases.has(name)) nameToCases.set(name, new Set());
      nameToCases.get(name)!.add(r.caseId);
    }
    if (docNum) {
      if (!docNumToCases.has(docNum)) docNumToCases.set(docNum, new Set());
      docNumToCases.get(docNum)!.add(r.caseId);
    }
  }
  const repeatedNames = Array.from(nameToCases.entries())
    .filter(([, cases]) => cases.size > 1)
    .map(([name, cases]) => ({ value: name, type: "NAME", caseCount: cases.size }));
  const repeatedDocNumbers = Array.from(docNumToCases.entries())
    .filter(([, cases]) => cases.size > 1)
    .map(([docNum, cases]) => ({ value: docNum, type: "DOCUMENT_NUMBER", caseCount: cases.size }));
  const repeatedIdentifiers = [...repeatedNames, ...repeatedDocNumbers].sort((a, b) => b.caseCount - a.caseCount).slice(0, 15);

  // --- Risk trend (chronological, oldest first for charting) ---
  const riskTrend = recentRiskAssessments
    .slice()
    .reverse()
    .map((r: (typeof recentRiskAssessments)[number]) => ({ createdAt: r.createdAt, score: r.score, level: r.level }));

  return NextResponse.json({
    suspiciousCases: suspiciousCases.map((c: (typeof suspiciousCases)[number]) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      documentType: c.documentType,
      country: c.country,
      createdBy: c.createdBy?.name,
      createdAt: c.createdAt,
      risk: c.riskAssessments[0] || null,
      tamperingDetected: c.tamperingResults[0]?.tamperingDetected ?? false,
      faceMatch: c.faceVerifications[0]?.matchDecision ?? null,
    })),
    topIndicators,
    repeatedIdentifiers,
    watchlistActivity: watchlistActivity.map((w: (typeof watchlistActivity)[number]) => ({
      id: w.id,
      caseNumber: w.case.caseNumber,
      documentType: w.case.documentType,
      country: w.case.country,
      queryName: w.queryName,
      result: w.result,
      matchScore: w.matchScore,
      createdAt: w.createdAt,
    })),
    countryTrend: countryTrend.map((c: (typeof countryTrend)[number]) => ({ country: c.country, count: c._count })),
    riskTrend,
    tamperingCaseCount: tamperingResults.length,
  });
}
