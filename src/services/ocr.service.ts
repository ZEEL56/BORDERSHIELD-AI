import { createWorker } from "tesseract.js";

export interface OCRField {
  field: string;
  value: string;
  confidence: number;
}

export interface OCRExtractionResult {
  rawText: string;
  fields: OCRField[];
  overallConfidence: number;
  engine: "tesseract.js";
}

/**
 * Runs OCR on a document image and parses document-type-specific fields
 * out of the raw text using pattern heuristics (MRZ-style and label-based).
 */
export async function runOCR(
  imagePath: string,
  documentType: "PASSPORT" | "VISA" | "NATIONAL_ID" | "DRIVING_LICENSE" | "PERMIT"
): Promise<OCRExtractionResult> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(imagePath);
    const rawText = data.text || "";
    const overallConfidence = Math.round((data.confidence || 0) * 10) / 10;

    const fields = parseFields(rawText, documentType, overallConfidence);

    return { rawText, fields, overallConfidence, engine: "tesseract.js" };
  } finally {
    await worker.terminate();
  }
}

function conf(base: number, hit: boolean) {
  // Field-level confidence derives from whether the pattern matched cleanly,
  // scaled by the OCR engine's own word-confidence for this page.
  return hit ? Math.min(99, Math.round(base * 0.95 + 5)) : 0;
}

function parseFields(text: string, docType: string, base: number): OCRField[] {
  const clean = text.replace(/[^\S\r\n]+/g, " ");
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(" | ");

  const find = (regex: RegExp, group = 1) => {
    const m = joined.match(regex);
    return m ? m[group].trim() : "";
  };

  const fields: OCRField[] = [];

  if (docType === "PASSPORT") {
    // MRZ line 2 pattern: <docNum><checkdigit><nationality><DOB><sex><expiry>...
    const mrz = clean.match(/P<[A-Z0-9<]{5,}/);
    const passportNo = find(/([A-Z][0-9]{7,8})\b/) || find(/PASSPORT\s*NO\.?\s*:?\s*([A-Z0-9]+)/i);
    const name = find(/(?:SURNAME|NAME)\s*:?\s*([A-Z\s]+?)(?:\s{2,}|GIVEN|$)/i);
    const dob = find(/(?:DATE\s*OF\s*BIRTH|DOB)\s*:?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{2,4})/i);
    const doe = find(/(?:DATE\s*OF\s*EXPIRY|EXPIRY|VALID\s*UNTIL)\s*:?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{2,4})/i);
    const nationality = find(/NATIONALITY\s*:?\s*([A-Z]+)/i);
    const gender = find(/(?:SEX|GENDER)\s*:?\s*([MF])\b/i);

    fields.push(
      { field: "Full Name", value: name, confidence: conf(base, !!name) },
      { field: "Passport Number", value: passportNo, confidence: conf(base, !!passportNo) },
      { field: "Nationality", value: nationality, confidence: conf(base, !!nationality) },
      { field: "Date of Birth", value: dob, confidence: conf(base, !!dob) },
      { field: "Date of Expiry", value: doe, confidence: conf(base, !!doe) },
      { field: "Gender", value: gender, confidence: conf(base, !!gender) },
      { field: "MRZ Detected", value: mrz ? "Yes" : "No", confidence: mrz ? 90 : 40 }
    );
  } else if (docType === "VISA") {
    const visaNo = find(/VISA\s*NO\.?\s*:?\s*([A-Z0-9]+)/i);
    const visaType = find(/(?:VISA\s*TYPE|CATEGORY)\s*:?\s*([A-Z0-9\-]+)/i);
    const entryValidity = find(/(?:ENTRY|VALID(?:ITY)?)\s*(?:UNTIL|TO)?\s*:?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{2,4})/i);
    const stayDuration = find(/(?:DURATION\s*OF\s*STAY|STAY)\s*:?\s*([0-9]+\s*(?:DAYS|MONTHS|YEARS))/i);

    fields.push(
      { field: "Visa Number", value: visaNo, confidence: conf(base, !!visaNo) },
      { field: "Visa Type", value: visaType, confidence: conf(base, !!visaType) },
      { field: "Entry Validity", value: entryValidity, confidence: conf(base, !!entryValidity) },
      { field: "Stay Duration", value: stayDuration, confidence: conf(base, !!stayDuration) }
    );
  } else {
    // NATIONAL_ID / DRIVING_LICENSE / PERMIT — generic identity fields
    const idNo = find(/(?:ID\s*NO\.?|NUMBER|LICENSE\s*NO\.?)\s*:?\s*([A-Z0-9\-]+)/i);
    const name = find(/(?:NAME)\s*:?\s*([A-Z\s]+?)(?:\s{2,}|DOB|$)/i);
    const dob = find(/(?:DATE\s*OF\s*BIRTH|DOB)\s*:?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{2,4})/i);
    const expiry = find(/(?:EXPIRY|VALID\s*(?:UNTIL|TILL))\s*:?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{2,4})/i);
    const address = find(/ADDRESS\s*:?\s*([A-Z0-9,\s]+?)(?:\s{2,}|$)/i);

    fields.push(
      { field: "Document Number", value: idNo, confidence: conf(base, !!idNo) },
      { field: "Full Name", value: name, confidence: conf(base, !!name) },
      { field: "Date of Birth", value: dob, confidence: conf(base, !!dob) },
      { field: "Expiry Date", value: expiry, confidence: conf(base, !!expiry) },
      { field: "Address", value: address, confidence: conf(base, !!address) }
    );
  }

  return fields;
}
