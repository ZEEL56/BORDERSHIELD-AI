import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const caseId = form.get("caseId") as string | null;
  const documentType = form.get("documentType") as string | null;
  const role = (form.get("role") as string | null) || "DOCUMENT";
  const file = form.get("file") as File | null;

  if (!caseId || !documentType || !file) {
    return NextResponse.json({ error: "caseId, documentType and file are required." }, { status: 400 });
  }

  const scase = await prisma.screeningCase.findUnique({ where: { id: caseId } });
  if (!scase) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const result = await saveUploadedFile(file, caseId);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  const doc = await prisma.document.create({
    data: {
      caseId,
      documentType: documentType as any,
      role,
      fileName: file.name,
      storedName: result.storedName,
      filePath: result.filePath,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256: result.sha256,
    },
  });

  await recordAuditEvent({
    caseId,
    userId: auth.sub,
    eventType: "DOCUMENT_UPLOADED",
    eventData: { documentId: doc.id, role, documentType, fileName: file.name, sha256: result.sha256 },
  });

  return NextResponse.json({ document: { id: doc.id, fileName: doc.fileName, role: doc.role, documentType: doc.documentType } });
}
