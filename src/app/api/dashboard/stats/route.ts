import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    totalScreenings,
    documentsProcessed,
    riskCounts,
    tamperingDetectedCount,
    faceMismatchCount,
    byDocType,
    recentCases,
    decisions,
    activeScreenings,
    pendingDecisions,
    todayScreenings,
    watchlistMatches,
  ] = await Promise.all([
    prisma.screeningCase.count(),
    prisma.document.count(),
    prisma.riskAssessment.groupBy({ by: ["level"], _count: true }),
    prisma.tamperingResult.count({ where: { tamperingDetected: true } }),
    prisma.faceVerification.count({ where: { matchDecision: "NO_MATCH" } }),
    prisma.screeningCase.groupBy({ by: ["documentType"], _count: true }),
    prisma.screeningCase.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        createdBy: { select: { name: true } },
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.decision.groupBy({ by: ["decision"], _count: true }),
    prisma.screeningCase.count({ where: { status: "PROCESSING" } }),
    prisma.screeningCase.count({ where: { status: "AWAITING_DECISION" } }),
    prisma.screeningCase.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.watchlistCheck.count({ where: { result: "MATCH_FOUND" } }),
  ]);

  const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
  for (const r of riskCounts) riskDistribution[r.level] = r._count;

  const highRiskCases = riskDistribution.HIGH + riskDistribution.CRITICAL;
  const criticalAlerts = riskDistribution.CRITICAL;

  // Average screening time: completedAt - createdAt for completed cases.
  const completed = await prisma.screeningCase.findMany({
    where: { completedAt: { not: null } },
    select: { createdAt: true, completedAt: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const avgMs =
    completed.length > 0
      ? completed.reduce((s: number, c: (typeof completed)[number]) => s + (c.completedAt!.getTime() - c.createdAt.getTime()), 0) / completed.length
      : 0;

  return NextResponse.json({
    totalScreenings,
    documentsProcessed,
    highRiskCases,
    criticalAlerts,
    tamperingDetectedCount,
    faceMismatchCount,
    avgScreeningSeconds: Math.round(avgMs / 1000),
    activeScreenings,
    pendingDecisions,
    todayScreenings,
    watchlistMatches,
    riskDistribution,
    documentTypeDistribution: byDocType.map((d: (typeof byDocType)[number]) => ({ type: d.documentType, count: d._count })),
    decisionDistribution: decisions.map((d: (typeof decisions)[number]) => ({ decision: d.decision, count: d._count })),
    recentCases: recentCases.map((c: (typeof recentCases)[number]) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      documentType: c.documentType,
      country: c.country,
      status: c.status,
      officer: c.createdBy?.name,
      createdAt: c.createdAt,
      risk: c.riskAssessments[0] || null,
    })),
  });
}
