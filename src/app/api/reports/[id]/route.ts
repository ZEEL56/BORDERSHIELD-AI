import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scase = await prisma.screeningCase.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, role: true, badgeId: true } },
      documents: true,
      ocrResults: { orderBy: { createdAt: "desc" }, take: 1 },
      validationResults: { orderBy: { createdAt: "desc" }, take: 1 },
      tamperingResults: { orderBy: { createdAt: "desc" }, take: 1 },
      faceVerifications: { orderBy: { createdAt: "desc" }, take: 1 },
      watchlistChecks: { orderBy: { createdAt: "desc" }, take: 1 },
      riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
      decisions: { include: { officer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
      auditLogs: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  if (!scase) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  return NextResponse.json({
    report: {
      caseNumber: scase.caseNumber,
      timestamp: scase.createdAt,
      officer: scase.createdBy?.name,
      documentType: scase.documentType,
      country: scase.country,
      identity: scase.ocrResults[0]?.fields || [],
      validation: scase.validationResults[0] || null,
      tampering: scase.tamperingResults[0] || null,
      face: scase.faceVerifications[0] || null,
      watchlist: scase.watchlistChecks[0] || null,
      risk: scase.riskAssessments[0] || null,
      decision: scase.decisions[0] || null,
      latestAuditHash: scase.auditLogs[0]?.hash || null,
      isDemo: scase.isDemo,
    },
  });
}
