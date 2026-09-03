import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { caseId: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.auditLog.findMany({
    where: { caseId: params.caseId },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json({ events });
}
