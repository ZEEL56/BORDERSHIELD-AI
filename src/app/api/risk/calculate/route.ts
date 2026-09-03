import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runRiskStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId } = await req.json();
    if (!caseId) return NextResponse.json({ error: "caseId is required." }, { status: 400 });
    const result = await runRiskStage(caseId, auth.sub);
    return NextResponse.json({ riskAssessment: result });
  } catch (err: any) {
    console.error("Risk calculation error:", err);
    return NextResponse.json({ error: err?.message || "Risk calculation failed." }, { status: 500 });
  }
}
