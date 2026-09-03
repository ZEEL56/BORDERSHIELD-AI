import { prisma } from "./prisma";
import { recordAuditEvent } from "./audit";
import { runOCR } from "@/services/ocr.service";
import { validateDocument } from "@/services/validation.service";
import { analyzeTampering } from "@/services/tampering.service";
import { verifyFaces } from "@/services/face.service";
import { checkWatchlist } from "@/services/watchlist.service";
import { calculateRisk } from "@/services/risk.service";

export async function runOcrStage(caseId: string, documentId: string, userId?: string) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const result = await runOCR(doc.filePath, doc.documentType as any);

  const saved = await prisma.oCRResult.create({
    data: {
      caseId,
      documentId,
      rawText: result.rawText,
      fields: result.fields as any,
      overallConfidence: result.overallConfidence,
      engine: result.engine,
    },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "OCR_COMPLETED",
    eventData: { documentId, overallConfidence: result.overallConfidence, fieldCount: result.fields.length },
  });

  return saved;
}

export async function runValidationStage(caseId: string, documentType: string, fields: any[], userId?: string) {
  const outcome = validateDocument(documentType, fields);
  const saved = await prisma.validationResult.create({
    data: {
      caseId,
      checks: outcome.checks as any,
      passed: outcome.passed,
      warnings: outcome.warnings,
      failed: outcome.failed,
      isValid: outcome.isValid,
    },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "VALIDATION_COMPLETED",
    eventData: { isValid: outcome.isValid, passed: outcome.passed, warnings: outcome.warnings, failed: outcome.failed },
  });

  return saved;
}

export async function runTamperingStage(caseId: string, documentId: string, userId?: string) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const result = await analyzeTampering(doc.filePath);

  const saved = await prisma.tamperingResult.create({
    data: {
      caseId,
      documentId,
      tamperingDetected: result.tamperingDetected,
      confidence: result.confidence,
      indicators: result.indicators as any,
      suspiciousRegions: result.suspiciousRegions as any,
      metadataAnalysis: result.metadataAnalysis as any,
      elaScore: result.elaScore,
      noiseScore: result.noiseScore,
      compressionScore: result.compressionScore,
      explanation: result.explanation,
      method: result.method,
    },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "TAMPERING_ANALYSIS_COMPLETED",
    eventData: { tamperingDetected: result.tamperingDetected, confidence: result.confidence, indicatorCount: result.indicators.length },
  });

  return saved;
}

export async function runFaceStage(caseId: string, docDocumentId: string, selfieDocumentId: string, userId?: string) {
  const [docFile, selfieFile] = await Promise.all([
    prisma.document.findUniqueOrThrow({ where: { id: docDocumentId } }),
    prisma.document.findUniqueOrThrow({ where: { id: selfieDocumentId } }),
  ]);
  const result = await verifyFaces(docFile.filePath, selfieFile.filePath);

  const saved = await prisma.faceVerification.create({
    data: {
      caseId,
      docFaceFound: result.docFaceFound,
      selfieFaceFound: result.selfieFaceFound,
      multipleFaces: result.multipleFaces,
      similarity: result.similarity,
      matchDecision: result.matchDecision,
      confidenceBand: result.confidenceBand,
      explanation: result.explanation,
    },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "FACE_VERIFICATION_COMPLETED",
    eventData: { matchDecision: result.matchDecision, similarity: result.similarity, confidenceBand: result.confidenceBand },
  });

  return saved;
}

export async function runWatchlistStage(caseId: string, fullName?: string, documentNumber?: string, userId?: string) {
  const result = await checkWatchlist({ fullName, documentNumber });

  const saved = await prisma.watchlistCheck.create({
    data: {
      caseId,
      queryName: fullName,
      queryDocNum: documentNumber,
      result: result.result,
      matchedEntryId: result.matchedEntryId,
      matchScore: result.matchScore,
    },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "WATCHLIST_CHECKED",
    eventData: { result: result.result, matchScore: result.matchScore },
  });

  return { saved, matchedEntry: result.matchedEntry };
}

export async function runRiskStage(caseId: string, userId?: string) {
  const [ocr, validation, tampering, face, watchlist] = await Promise.all([
    prisma.oCRResult.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    prisma.validationResult.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    prisma.tamperingResult.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    prisma.faceVerification.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    prisma.watchlistCheck.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!ocr || !validation || !tampering || !face || !watchlist) {
    throw new Error("Cannot calculate risk: one or more pipeline stages have not completed for this case.");
  }

  const outcome = calculateRisk({
    ocrFields: ocr.fields as any,
    ocrConfidence: ocr.overallConfidence,
    validation: {
      checks: validation.checks as any,
      passed: validation.passed,
      warnings: validation.warnings,
      failed: validation.failed,
      isValid: validation.isValid,
    },
    tampering: {
      tamperingDetected: tampering.tamperingDetected,
      confidence: tampering.confidence,
      indicators: tampering.indicators as any,
      suspiciousRegions: tampering.suspiciousRegions as any,
      metadataAnalysis: tampering.metadataAnalysis as any,
      elaScore: tampering.elaScore,
      noiseScore: tampering.noiseScore,
      compressionScore: tampering.compressionScore,
      explanation: tampering.explanation,
      method: "Forensic / Heuristic Analysis",
    },
    face: {
      docFaceFound: face.docFaceFound,
      selfieFaceFound: face.selfieFaceFound,
      multipleFaces: face.multipleFaces,
      similarity: face.similarity,
      matchDecision: face.matchDecision as any,
      confidenceBand: face.confidenceBand as any,
      explanation: face.explanation,
      method: "Heuristic Visual Similarity Analysis",
    },
    watchlist: {
      result: watchlist.result as any,
      matchedEntryId: watchlist.matchedEntryId,
      matchScore: watchlist.matchScore,
      matchedEntry: null,
    },
  });

  const saved = await prisma.riskAssessment.create({
    data: {
      caseId,
      score: outcome.score,
      level: outcome.level,
      factors: outcome.factors as any,
      recommendation: outcome.recommendation,
    },
  });

  await prisma.screeningCase.update({
    where: { id: caseId },
    data: { status: "AWAITING_DECISION", completedAt: new Date() },
  });

  await recordAuditEvent({
    caseId,
    userId,
    eventType: "RISK_CALCULATED",
    eventData: { score: outcome.score, level: outcome.level, factorCount: outcome.factors.length },
  });

  return saved;
}
