import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { genCaseNumber } from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { saveUploadedFile } from "@/lib/upload";
import {
  runOcrStage,
  runValidationStage,
  runTamperingStage,
  runFaceStage,
  runWatchlistStage,
  runRiskStage,
} from "@/lib/pipeline";

/**
 * Runs the full screening pipeline in one call:
 * upload -> OCR -> validation -> tampering forensics -> face verification
 * -> watchlist -> explainable risk score. Each stage still writes its own
 * DB record + hash-chained audit event, identically to the granular routes.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const documentType = form.get("documentType") as string | null;
    const country = form.get("country") as string | null;
    const isDemo = form.get("isDemo") === "true";
    const docFile = form.get("document") as File | null;
    const selfieFile = form.get("selfie") as File | null;

    if (!documentType || !docFile) {
      return NextResponse.json({ error: "documentType and a document image are required." }, { status: 400 });
    }

    const scase = await prisma.screeningCase.create({
      data: {
        caseNumber: genCaseNumber(),
        documentType: documentType as any,
        country: country || null,
        isDemo,
        createdById: auth.sub,
        status: "PROCESSING",
      },
    });
    await recordAuditEvent({
      caseId: scase.id,
      userId: auth.sub,
      eventType: "CASE_CREATED",
      eventData: { caseNumber: scase.caseNumber, documentType, isDemo },
    });

    // --- Upload document ---
    const docSave = await saveUploadedFile(docFile, scase.id);
    if (!docSave.ok) return NextResponse.json({ error: docSave.reason }, { status: 400 });
    const documentRecord = await prisma.document.create({
      data: {
        caseId: scase.id,
        documentType: documentType as any,
        role: "DOCUMENT",
        fileName: docFile.name,
        storedName: docSave.storedName,
        filePath: docSave.filePath,
        mimeType: docFile.type,
        sizeBytes: docFile.size,
        sha256: docSave.sha256,
      },
    });
    await recordAuditEvent({
      caseId: scase.id,
      userId: auth.sub,
      eventType: "DOCUMENT_UPLOADED",
      eventData: { documentId: documentRecord.id, role: "DOCUMENT", sha256: docSave.sha256 },
    });

    // --- Upload selfie (optional but required for face verification) ---
    let selfieRecord: { id: string } | null = null;
    if (selfieFile && selfieFile.size > 0) {
      const selfieSave = await saveUploadedFile(selfieFile, scase.id);
      if (!selfieSave.ok) return NextResponse.json({ error: selfieSave.reason }, { status: 400 });
      selfieRecord = await prisma.document.create({
        data: {
          caseId: scase.id,
          documentType: documentType as any,
          role: "SELFIE",
          fileName: selfieFile.name,
          storedName: selfieSave.storedName,
          filePath: selfieSave.filePath,
          mimeType: selfieFile.type,
          sizeBytes: selfieFile.size,
          sha256: selfieSave.sha256,
        },
      });
      await recordAuditEvent({
        caseId: scase.id,
        userId: auth.sub,
        eventType: "DOCUMENT_UPLOADED",
        eventData: { documentId: selfieRecord!.id, role: "SELFIE", sha256: selfieSave.sha256 },
      });
    }

    // --- OCR ---
    const ocr = await runOcrStage(scase.id, documentRecord.id, auth.sub);

    // --- Validation ---
    await runValidationStage(scase.id, documentType, ocr.fields as any, auth.sub);

    // --- Tampering forensics ---
    await runTamperingStage(scase.id, documentRecord.id, auth.sub);

    // --- Face verification (only if a selfie was provided) ---
    if (selfieRecord) {
      await runFaceStage(scase.id, documentRecord.id, selfieRecord.id, auth.sub);
    } else {
      const noSelfie = await prisma.faceVerification.create({
        data: {
          caseId: scase.id,
          docFaceFound: false,
          selfieFaceFound: false,
          multipleFaces: false,
          similarity: null,
          matchDecision: "INCONCLUSIVE",
          confidenceBand: "LOW",
          explanation: "No presented-person photo was captured for this screening — face verification skipped.",
        },
      });
      await recordAuditEvent({
        caseId: scase.id,
        userId: auth.sub,
        eventType: "FACE_VERIFICATION_COMPLETED",
        eventData: { matchDecision: "INCONCLUSIVE", skipped: true },
      });
      void noSelfie;
    }

    // --- Watchlist (name pulled from OCR fields where available) ---
    const nameField = (ocr.fields as any[]).find((f) => f.field === "Full Name")?.value as string | undefined;
    const docNumField = (ocr.fields as any[]).find((f) =>
      ["Passport Number", "Visa Number", "Document Number"].includes(f.field)
    )?.value as string | undefined;
    await runWatchlistStage(scase.id, nameField, docNumField, auth.sub);

    // --- Explainable risk score ---
    await runRiskStage(scase.id, auth.sub);

    const fullCase = await prisma.screeningCase.findUnique({
      where: { id: scase.id },
      include: {
        documents: true,
        ocrResults: true,
        validationResults: true,
        tamperingResults: true,
        faceVerifications: true,
        watchlistChecks: true,
        riskAssessments: true,
      },
    });

    return NextResponse.json({ case: fullCase });
  } catch (err: any) {
    console.error("Screening pipeline error:", err);
    return NextResponse.json({ error: err?.message || "Screening pipeline failed." }, { status: 500 });
  }
}
