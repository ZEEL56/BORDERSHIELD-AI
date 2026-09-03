import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scase = await prisma.screeningCase.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, role: true } },
      documents: true,
      ocrResults: { orderBy: { createdAt: "desc" } },
      validationResults: { orderBy: { createdAt: "desc" } },
      tamperingResults: { orderBy: { createdAt: "desc" } },
      faceVerifications: { orderBy: { createdAt: "desc" } },
      watchlistChecks: { orderBy: { createdAt: "desc" } },
      riskAssessments: { orderBy: { createdAt: "desc" } },
      decisions: { include: { officer: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!scase) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  return NextResponse.json({ case: scase });
}
