import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runValidationStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, ocrResultId } = await req.json();
    if (!caseId || !ocrResultId) return NextResponse.json({ error: "caseId and ocrResultId are required." }, { status: 400 });

    const ocr = await prisma.oCRResult.findUnique({ where: { id: ocrResultId } });
    const scase = await prisma.screeningCase.findUnique({ where: { id: caseId } });
    if (!ocr || !scase) return NextResponse.json({ error: "Case or OCR result not found." }, { status: 404 });

    const result = await runValidationStage(caseId, scase.documentType, ocr.fields as any, auth.sub);
    return NextResponse.json({ validationResult: result });
  } catch (err) {
    console.error("Validation error:", err);
    return NextResponse.json({ error: "Validation failed due to a server error." }, { status: 500 });
  }
}
