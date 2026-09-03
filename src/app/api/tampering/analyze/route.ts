import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runTamperingStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, documentId } = await req.json();
    if (!caseId || !documentId) return NextResponse.json({ error: "caseId and documentId are required." }, { status: 400 });
    const result = await runTamperingStage(caseId, documentId, auth.sub);
    return NextResponse.json({ tamperingResult: result });
  } catch (err) {
    console.error("Tampering analysis error:", err);
    return NextResponse.json({ error: "ANALYSIS UNAVAILABLE — forensic service could not process this image." }, { status: 500 });
  }
}
