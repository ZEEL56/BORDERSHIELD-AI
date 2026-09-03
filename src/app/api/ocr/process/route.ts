import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runOcrStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, documentId } = await req.json();
    if (!caseId || !documentId) return NextResponse.json({ error: "caseId and documentId are required." }, { status: 400 });
    const result = await runOcrStage(caseId, documentId, auth.sub);
    return NextResponse.json({ ocrResult: result });
  } catch (err: any) {
    console.error("OCR error:", err);
    return NextResponse.json({ error: "OCR extraction failed. The document may be unreadable — manual review required." }, { status: 500 });
  }
}
