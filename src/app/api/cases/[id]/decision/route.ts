import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

const VALID_DECISIONS = ["CLEAR", "SECONDARY_INSPECTION", "REJECT", "REFER_TO_INVESTIGATION"];
const STATUS_BY_DECISION: Record<string, string> = {
  CLEAR: "CLEARED",
  SECONDARY_INSPECTION: "SECONDARY_INSPECTION",
  REJECT: "REJECTED",
  REFER_TO_INVESTIGATION: "REFERRED",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { decision, reason } = await req.json();
  if (!decision || !VALID_DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "A valid decision is required." }, { status: 400 });
  }
  if (!reason || String(reason).trim().length < 5) {
    return NextResponse.json({ error: "A reason (at least 5 characters) is required for the final decision." }, { status: 400 });
  }

  const scase = await prisma.screeningCase.findUnique({ where: { id: params.id } });
  if (!scase) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const saved = await prisma.decision.create({
    data: { caseId: params.id, officerId: auth.sub, decision, reason },
  });

  await prisma.screeningCase.update({
    where: { id: params.id },
    data: { status: STATUS_BY_DECISION[decision] as any },
  });

  await recordAuditEvent({
    caseId: params.id,
    userId: auth.sub,
    eventType: "OFFICER_DECISION_RECORDED",
    eventData: { decision, reason, officer: auth.name },
  });

  return NextResponse.json({ decision: saved });
}
