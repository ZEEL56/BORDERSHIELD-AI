import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runFaceStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, docDocumentId, selfieDocumentId } = await req.json();
    if (!caseId || !docDocumentId || !selfieDocumentId) {
      return NextResponse.json({ error: "caseId, docDocumentId and selfieDocumentId are required." }, { status: 400 });
    }
    const result = await runFaceStage(caseId, docDocumentId, selfieDocumentId, auth.sub);
    return NextResponse.json({ faceVerification: result });
  } catch (err) {
    console.error("Face verification error:", err);
    return NextResponse.json({ error: "Face verification unavailable — please retry with clearer images." }, { status: 500 });
  }
}
