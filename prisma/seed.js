/**
 * BorderShield AI — demo data seed.
 * Creates the three demo accounts, a small labeled DEMO watchlist, and five
 * fully-populated screening-case scenarios so the dashboard/cases/analytics
 * pages have real data to render on first run.
 *
 * All seeded cases are flagged isDemo: true and their documents are
 * synthetic placeholder images generated at seed time (NOT real government
 * documents) — this is stated in the UI wherever demo cases are shown.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");

const prisma = new PrismaClient();
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "demo");

async function makePlaceholderImage(name, bg, label) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  const img = new Jimp(600, 380, bg);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  img.print(font, 20, 20, label);
  const filePath = path.join(UPLOAD_ROOT, name);
  await img.writeAsync(filePath);
  const buf = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  return { filePath, sha256, sizeBytes: buf.length };
}

let hashChainTail = "0".repeat(64);
function computeHash(previousHash, eventType, eventData, timestampIso) {
  const payload = `${previousHash}|${eventType}|${JSON.stringify(eventData)}|${timestampIso}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
async function audit(caseId, userId, eventType, eventData) {
  const timestamp = new Date();
  const hash = computeHash(hashChainTail, eventType, eventData, timestamp.toISOString());
  await prisma.auditLog.create({
    data: { caseId, userId, eventType, eventData, previousHash: hashChainTail, hash, timestamp },
  });
  hashChainTail = hash;
}

async function main() {
  console.log("Seeding BorderShield AI demo data...");

  // ---------- USERS ----------
  const users = await Promise.all([
    upsertUser("Admin Officer", "admin@bordershield.gov.in", "Admin@12345", "ADMIN", "SSB-A001"),
    upsertUser("Ravi Sharma", "officer@bordershield.gov.in", "Officer@12345", "OFFICER", "SSB-O104"),
    upsertUser("Priya Nair", "analyst@bordershield.gov.in", "Analyst@12345", "ANALYST", "SSB-N220"),
  ]);
  const [admin, officer, analyst] = users;

  // ---------- WATCHLIST (demo) ----------
  const existingWatchlist = await prisma.watchlistEntry.count();
  if (existingWatchlist === 0) {
    await prisma.watchlistEntry.createMany({
      data: [
        { fullName: "Arjun Mehta", documentNumber: "K1122334", nationality: "INDIAN", reason: "Flagged for prior document forgery attempt (demo record)", severity: "CRITICAL", isDemo: true },
        { fullName: "Farid Hossain", documentNumber: "P9988776", nationality: "BANGLADESHI", reason: "Reported lost/stolen document reused (demo record)", severity: "HIGH", isDemo: true },
        { fullName: "Elena Petrova", documentNumber: null, nationality: "RUSSIAN", reason: "Name match to demo advisory list", severity: "MEDIUM", isDemo: true },
      ],
    });
    console.log("Seeded demo watchlist entries.");
  }

  const existingCases = await prisma.screeningCase.count({ where: { isDemo: true } });
  if (existingCases > 0) {
    console.log("Demo cases already present — skipping scenario seed.");
    await prisma.$disconnect();
    return;
  }

  // ---------- SCENARIO 1: Genuine document — LOW RISK ----------
  await seedScenario({
    officer,
    caseNumberSuffix: "0001",
    documentType: "PASSPORT",
    country: "India",
    bg: 0x0f172aff,
    label: "DEMO PASSPORT — GENUINE",
    ocrFields: [
      { field: "Full Name", value: "ROHAN VERMA", confidence: 96 },
      { field: "Passport Number", value: "M4521678", confidence: 95 },
      { field: "Nationality", value: "INDIAN", confidence: 97 },
      { field: "Date of Birth", value: "14/03/1990", confidence: 94 },
      { field: "Date of Expiry", value: "10/06/2031", confidence: 93 },
      { field: "Gender", value: "M", confidence: 92 },
    ],
    ocrConfidence: 94.5,
    validation: { checks: [
      { code: "STRUCT_OK", label: "Structural Checks", status: "pass", message: "All required fields present" },
      { code: "LOGIC_DOB_LT_EXPIRY", label: "Date Sequence", status: "pass", message: "Date of birth precedes expiry date" },
      { code: "EXP_OK", label: "Expiration Status", status: "pass", message: "Document valid for 1740 more day(s)" },
    ], passed: 6, warnings: 0, failed: 0, isValid: true },
    tampering: { tamperingDetected: false, confidence: 0.08, indicators: [], suspiciousRegions: [], metadataAnalysis: { hasExif: true, editingSoftwareDetected: false }, elaScore: 0.05, noiseScore: 0.04, compressionScore: 0.06, explanation: "Forensic analysis found no strong indicators of manipulation.", method: "Forensic / Heuristic Analysis" },
    face: { docFaceFound: true, selfieFaceFound: true, multipleFaces: false, similarity: 93.2, matchDecision: "MATCH", confidenceBand: "HIGH", explanation: "Detected face regions compared with 93.2% visual similarity (HIGH confidence)." },
    watchlist: { result: "CLEAR", matchedEntryId: null, matchScore: null },
    riskFactors: [{ label: "No risk indicators", points: 0, reason: "All checks passed with no anomalies detected" }],
    riskScore: 4,
    riskLevel: "LOW",
    recommendation: "NO SIGNIFICANT RISK INDICATORS — standard processing may continue.",
    decision: { decision: "CLEAR", reason: "All checks passed. Genuine, valid, unexpired passport with strong face match.", officerId: officer.id },
  });

  // ---------- SCENARIO 2: Tampered document — CRITICAL RISK ----------
  await seedScenario({
    officer,
    caseNumberSuffix: "0002",
    documentType: "PASSPORT",
    country: "Nepal",
    bg: 0x7f1d1dff,
    label: "DEMO PASSPORT — TAMPERED",
    ocrFields: [
      { field: "Full Name", value: "SURESH THAPA", confidence: 88 },
      { field: "Passport Number", value: "N7734521", confidence: 71 },
      { field: "Nationality", value: "NEPALI", confidence: 85 },
      { field: "Date of Birth", value: "22/11/1985", confidence: 80 },
      { field: "Date of Expiry", value: "05/02/2029", confidence: 66 },
      { field: "Gender", value: "M", confidence: 82 },
    ],
    ocrConfidence: 78.7,
    validation: { checks: [
      { code: "STRUCT_OK", label: "Structural Checks", status: "pass", message: "All required fields present" },
      { code: "STRUCT_DOC_NO_FORMAT", label: "Document Number Format", status: "warn", message: "Document number has an unusual format" },
      { code: "EXP_OK", label: "Expiration Status", status: "pass", message: "Document valid" },
    ], passed: 4, warnings: 2, failed: 0, isValid: true },
    tampering: {
      tamperingDetected: true, confidence: 0.87,
      indicators: [
        "4 region(s) show elevated Error Level Analysis residue, consistent with localized re-saving/editing.",
        "3 region(s) show abnormally smooth/low-noise texture relative to the rest of the document, a possible sign of cloning or digital smoothing.",
        'EXIF metadata records editing software: "Adobe Photoshop 24.0".',
      ],
      suspiciousRegions: [
        { x: 180, y: 60, w: 50, h: 32, label: "Elevated compression-error residue", score: 0.91 },
        { x: 230, y: 60, w: 50, h: 32, label: "Elevated compression-error residue", score: 0.84 },
        { x: 180, y: 92, w: 50, h: 32, label: "Elevated compression-error residue", score: 0.77 },
        { x: 300, y: 150, w: 50, h: 32, label: "Elevated compression-error residue", score: 0.69 },
      ],
      metadataAnalysis: { hasExif: true, software: "Adobe Photoshop 24.0", editingSoftwareDetected: true, timestampMismatch: true },
      elaScore: 0.82, noiseScore: 0.61, compressionScore: 0.74,
      explanation: "Forensic analysis flagged this document. Elevated ELA residue clustered around the photo and document-number fields, combined with EXIF evidence of Photoshop editing, strongly suggests localized manipulation.",
      method: "Forensic / Heuristic Analysis",
    },
    face: { docFaceFound: true, selfieFaceFound: true, multipleFaces: false, similarity: 61.4, matchDecision: "INCONCLUSIVE", confidenceBand: "LOW", explanation: "Similarity is in the borderline range — recommend manual officer review." },
    watchlist: { result: "CLEAR", matchedEntryId: null, matchScore: null },
    riskFactors: [
      { label: "Tampering indicators", points: 42, reason: "Elevated ELA residue and Photoshop metadata detected" },
      { label: "Face verification inconclusive", points: 12, reason: "Borderline similarity score" },
      { label: "Validation warnings", points: 6, reason: "Document number format warning" },
      { label: "Editing software in metadata", points: 10, reason: "EXIF metadata names an image-editing application" },
    ],
    riskScore: 87,
    riskLevel: "CRITICAL",
    recommendation: "SECONDARY INSPECTION REQUIRED — escalate immediately, do not clear without supervisor review.",
    decision: null,
  });

  // ---------- SCENARIO 3: Face mismatch — HIGH RISK ----------
  await seedScenario({
    officer: analyst,
    caseNumberSuffix: "0003",
    documentType: "NATIONAL_ID",
    country: "India",
    bg: 0x78350fff,
    label: "DEMO NATIONAL ID — FACE MISMATCH",
    ocrFields: [
      { field: "Document Number", value: "ID48213390", confidence: 91 },
      { field: "Full Name", value: "AMIT KUMAR", confidence: 90 },
      { field: "Date of Birth", value: "02/07/1993", confidence: 89 },
      { field: "Expiry Date", value: "02/07/2028", confidence: 88 },
    ],
    ocrConfidence: 89.5,
    validation: { checks: [
      { code: "STRUCT_OK", label: "Structural Checks", status: "pass", message: "All required fields present" },
      { code: "EXP_OK", label: "Expiration Status", status: "pass", message: "Document valid" },
    ], passed: 5, warnings: 0, failed: 0, isValid: true },
    tampering: { tamperingDetected: false, confidence: 0.21, indicators: [], suspiciousRegions: [], metadataAnalysis: { hasExif: true, editingSoftwareDetected: false }, elaScore: 0.18, noiseScore: 0.15, compressionScore: 0.2, explanation: "Forensic analysis found no strong indicators of manipulation.", method: "Forensic / Heuristic Analysis" },
    face: { docFaceFound: true, selfieFaceFound: true, multipleFaces: false, similarity: 31.8, matchDecision: "NO_MATCH", confidenceBand: "HIGH", explanation: "Detected face regions compared with 31.8% visual similarity (HIGH confidence). Regions show substantial visual divergence." },
    watchlist: { result: "CLEAR", matchedEntryId: null, matchScore: null },
    riskFactors: [{ label: "Face mismatch", points: 25, reason: "Detected face regions show substantial visual divergence (31.8% similarity)" }],
    riskScore: 25,
    riskLevel: "MEDIUM",
    recommendation: "ADDITIONAL REVIEW SUGGESTED — resolve flagged items, then proceed at officer discretion.",
    decision: { decision: "SECONDARY_INSPECTION", reason: "Face verification returned NO_MATCH with high confidence — traveler referred for manual identity confirmation.", officerId: analyst.id },
  });

  // ---------- SCENARIO 4: Expired visa — MEDIUM/HIGH RISK ----------
  await seedScenario({
    officer,
    caseNumberSuffix: "0004",
    documentType: "VISA",
    country: "United Arab Emirates",
    bg: 0x854d0eff,
    label: "DEMO VISA — EXPIRED",
    ocrFields: [
      { field: "Visa Number", value: "V2233445", confidence: 90 },
      { field: "Visa Type", value: "TOURIST", confidence: 88 },
      { field: "Entry Validity", value: "18/01/2025", confidence: 85 },
      { field: "Stay Duration", value: "30 DAYS", confidence: 87 },
    ],
    ocrConfidence: 87.5,
    validation: { checks: [
      { code: "STRUCT_OK", label: "Structural Checks", status: "pass", message: "All required fields present" },
      { code: "EXP_EXPIRED", label: "Expiration Status", status: "fail", message: "Document expired 227 day(s) ago" },
    ], passed: 3, warnings: 0, failed: 1, isValid: false },
    tampering: { tamperingDetected: false, confidence: 0.14, indicators: [], suspiciousRegions: [], metadataAnalysis: { hasExif: true, editingSoftwareDetected: false }, elaScore: 0.11, noiseScore: 0.1, compressionScore: 0.13, explanation: "Forensic analysis found no strong indicators of manipulation.", method: "Forensic / Heuristic Analysis" },
    face: { docFaceFound: true, selfieFaceFound: true, multipleFaces: false, similarity: 88.9, matchDecision: "MATCH", confidenceBand: "HIGH", explanation: "Detected face regions compared with 88.9% visual similarity (HIGH confidence)." },
    watchlist: { result: "CLEAR", matchedEntryId: null, matchScore: null },
    riskFactors: [
      { label: "Expired document", points: 15, reason: "Document expired 227 day(s) ago" },
      { label: "Document validation failures", points: 10, reason: "1 structural/logical check(s) failed" },
    ],
    riskScore: 25,
    riskLevel: "MEDIUM",
    recommendation: "ADDITIONAL REVIEW SUGGESTED — resolve flagged items, then proceed at officer discretion.",
    decision: { decision: "REJECT", reason: "Visa validity period has lapsed; traveler must obtain a new visa before entry.", officerId: officer.id },
  });

  // ---------- SCENARIO 5: Watchlist match — CRITICAL RISK ----------
  await seedScenario({
    officer: admin,
    caseNumberSuffix: "0005",
    documentType: "PASSPORT",
    country: "Bangladesh",
    bg: 0x450a0aff,
    label: "DEMO PASSPORT — WATCHLIST MATCH",
    ocrFields: [
      { field: "Full Name", value: "FARID HOSSAIN", confidence: 93 },
      { field: "Passport Number", value: "P9988776", confidence: 92 },
      { field: "Nationality", value: "BANGLADESHI", confidence: 91 },
      { field: "Date of Birth", value: "09/09/1988", confidence: 90 },
      { field: "Date of Expiry", value: "01/01/2030", confidence: 89 },
      { field: "Gender", value: "M", confidence: 90 },
    ],
    ocrConfidence: 90.8,
    validation: { checks: [
      { code: "STRUCT_OK", label: "Structural Checks", status: "pass", message: "All required fields present" },
      { code: "EXP_OK", label: "Expiration Status", status: "pass", message: "Document valid" },
    ], passed: 6, warnings: 0, failed: 0, isValid: true },
    tampering: { tamperingDetected: false, confidence: 0.19, indicators: [], suspiciousRegions: [], metadataAnalysis: { hasExif: true, editingSoftwareDetected: false }, elaScore: 0.15, noiseScore: 0.12, compressionScore: 0.17, explanation: "Forensic analysis found no strong indicators of manipulation.", method: "Forensic / Heuristic Analysis" },
    face: { docFaceFound: true, selfieFaceFound: true, multipleFaces: false, similarity: 90.1, matchDecision: "MATCH", confidenceBand: "HIGH", explanation: "Detected face regions compared with 90.1% visual similarity (HIGH confidence)." },
    watchlist: { result: "MATCH_FOUND", matchedEntryId: null, matchScore: 1 },
    riskFactors: [{ label: "Watchlist match", points: 40, reason: "Confirmed match against demo watchlist (Reported lost/stolen document reused (demo record))" }],
    riskScore: 40,
    riskLevel: "MEDIUM",
    recommendation: "ADDITIONAL REVIEW SUGGESTED — resolve flagged items, then proceed at officer discretion.",
    decision: { decision: "REFER_TO_INVESTIGATION", reason: "Positive watchlist match on document number — referred to investigations unit per protocol.", officerId: admin.id },
  });

  console.log("Demo seed complete.");
  console.log("\nDemo accounts:");
  console.log("  admin@bordershield.gov.in   / Admin@12345");
  console.log("  officer@bordershield.gov.in / Officer@12345");
  console.log("  analyst@bordershield.gov.in / Analyst@12345");

  async function upsertUser(name, email, password, role, badgeId) {
    const passwordHash = await bcrypt.hash(password, 12);
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, passwordHash, role, badgeId },
    });
  }

  async function seedScenario(s) {
    const scase = await prisma.screeningCase.create({
      data: {
        caseNumber: `BSC-DEMO-${s.caseNumberSuffix}`,
        documentType: s.documentType,
        country: s.country,
        isDemo: true,
        createdById: s.officer.id,
        status: s.decision ? statusForDecision(s.decision.decision) : "AWAITING_DECISION",
        completedAt: new Date(),
      },
    });
    await audit(scase.id, s.officer.id, "CASE_CREATED", { caseNumber: scase.caseNumber, documentType: s.documentType, isDemo: true });

    const img = await makePlaceholderImage(`${scase.caseNumber}-doc.jpg`, s.bg, s.label);
    const doc = await prisma.document.create({
      data: {
        caseId: scase.id, documentType: s.documentType, role: "DOCUMENT",
        fileName: `${s.label}.jpg`, storedName: path.basename(img.filePath), filePath: img.filePath,
        mimeType: "image/jpeg", sizeBytes: img.sizeBytes, sha256: img.sha256,
      },
    });
    await audit(scase.id, s.officer.id, "DOCUMENT_UPLOADED", { documentId: doc.id, role: "DOCUMENT", sha256: img.sha256 });

    const selfieImg = await makePlaceholderImage(`${scase.caseNumber}-selfie.jpg`, 0x1e293bff, "DEMO PRESENTED PERSON PHOTO");
    const selfieDoc = await prisma.document.create({
      data: {
        caseId: scase.id, documentType: s.documentType, role: "SELFIE",
        fileName: "selfie.jpg", storedName: path.basename(selfieImg.filePath), filePath: selfieImg.filePath,
        mimeType: "image/jpeg", sizeBytes: selfieImg.sizeBytes, sha256: selfieImg.sha256,
      },
    });
    await audit(scase.id, s.officer.id, "DOCUMENT_UPLOADED", { documentId: selfieDoc.id, role: "SELFIE", sha256: selfieImg.sha256 });

    await prisma.oCRResult.create({ data: { caseId: scase.id, documentId: doc.id, rawText: "[demo OCR text]", fields: s.ocrFields, overallConfidence: s.ocrConfidence, engine: "tesseract.js" } });
    await audit(scase.id, s.officer.id, "OCR_COMPLETED", { documentId: doc.id, overallConfidence: s.ocrConfidence, fieldCount: s.ocrFields.length });

    await prisma.validationResult.create({ data: { caseId: scase.id, ...s.validation } });
    await audit(scase.id, s.officer.id, "VALIDATION_COMPLETED", { isValid: s.validation.isValid, passed: s.validation.passed, warnings: s.validation.warnings, failed: s.validation.failed });

    await prisma.tamperingResult.create({ data: { caseId: scase.id, documentId: doc.id, ...s.tampering } });
    await audit(scase.id, s.officer.id, "TAMPERING_ANALYSIS_COMPLETED", { tamperingDetected: s.tampering.tamperingDetected, confidence: s.tampering.confidence, indicatorCount: s.tampering.indicators.length });

    await prisma.faceVerification.create({ data: { caseId: scase.id, ...s.face } });
    await audit(scase.id, s.officer.id, "FACE_VERIFICATION_COMPLETED", { matchDecision: s.face.matchDecision, similarity: s.face.similarity, confidenceBand: s.face.confidenceBand });

    await prisma.watchlistCheck.create({ data: { caseId: scase.id, queryName: s.ocrFields.find((f) => f.field === "Full Name")?.value, result: s.watchlist.result, matchedEntryId: s.watchlist.matchedEntryId, matchScore: s.watchlist.matchScore } });
    await audit(scase.id, s.officer.id, "WATCHLIST_CHECKED", { result: s.watchlist.result, matchScore: s.watchlist.matchScore });

    await prisma.riskAssessment.create({ data: { caseId: scase.id, score: s.riskScore, level: s.riskLevel, factors: s.riskFactors, recommendation: s.recommendation } });
    await audit(scase.id, s.officer.id, "RISK_CALCULATED", { score: s.riskScore, level: s.riskLevel, factorCount: s.riskFactors.length });

    if (s.decision) {
      await prisma.decision.create({ data: { caseId: scase.id, officerId: s.decision.officerId, decision: s.decision.decision, reason: s.decision.reason } });
      await audit(scase.id, s.decision.officerId, "OFFICER_DECISION_RECORDED", { decision: s.decision.decision, reason: s.decision.reason });
    }

    console.log(`  Seeded ${scase.caseNumber} (${s.riskLevel})`);
  }

  function statusForDecision(decision) {
    return { CLEAR: "CLEARED", SECONDARY_INSPECTION: "SECONDARY_INSPECTION", REJECT: "REJECTED", REFER_TO_INVESTIGATION: "REFERRED" }[decision];
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
