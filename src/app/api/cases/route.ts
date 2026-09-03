import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { genCaseNumber } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentType, country, isDemo } = await req.json();
  if (!documentType) return NextResponse.json({ error: "documentType is required." }, { status: 400 });

  const scase = await prisma.screeningCase.create({
    data: {
      caseNumber: genCaseNumber(),
      documentType,
      country: country || null,
      isDemo: !!isDemo,
      createdById: auth.sub,
      status: "PROCESSING",
    },
  });

  await recordAuditEvent({
    caseId: scase.id,
    userId: auth.sub,
    eventType: "CASE_CREATED",
    eventData: { caseNumber: scase.caseNumber, documentType },
  });

  return NextResponse.json({ case: scase });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: any = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { caseNumber: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, cases] = await Promise.all([
    prisma.screeningCase.count({ where }),
    prisma.screeningCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { name: true } },
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
        decisions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  return NextResponse.json({
    cases: cases.map((c: (typeof cases)[number]) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      documentType: c.documentType,
      country: c.country,
      status: c.status,
      isDemo: c.isDemo,
      createdBy: c.createdBy?.name,
      createdAt: c.createdAt,
      risk: c.riskAssessments[0] || null,
      decision: c.decisions[0] || null,
    })),
    total,
    page,
    pageSize,
  });
}
