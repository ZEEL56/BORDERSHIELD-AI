import { OCRField } from "./ocr.service";

export interface ValidationCheck {
  code: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface ValidationOutcome {
  checks: ValidationCheck[];
  passed: number;
  warnings: number;
  failed: number;
  isValid: boolean;
}

function fieldValue(fields: OCRField[], name: string): string {
  return fields.find((f) => f.field.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

function parseFlexDate(v: string): Date | null {
  if (!v) return null;
  const norm = v.replace(/[.\-]/g, "/");
  const parts = norm.split("/").map((p) => p.trim());
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const date = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(date.getTime()) ? null : date;
}

export function validateDocument(
  documentType: string,
  fields: OCRField[]
): ValidationOutcome {
  const checks: ValidationCheck[] = [];
  const now = new Date();

  // --- STRUCTURAL: required fields present ---
  const requiredByType: Record<string, string[]> = {
    PASSPORT: ["Full Name", "Passport Number", "Date of Birth", "Date of Expiry"],
    VISA: ["Visa Number", "Visa Type", "Entry Validity"],
    NATIONAL_ID: ["Document Number", "Full Name", "Date of Birth"],
    DRIVING_LICENSE: ["Document Number", "Full Name", "Date of Birth", "Expiry Date"],
    PERMIT: ["Document Number", "Full Name"],
  };
  const required = requiredByType[documentType] || requiredByType.NATIONAL_ID;

  for (const reqField of required) {
    const val = fieldValue(fields, reqField);
    if (val) {
      checks.push({ code: `STRUCT_${reqField}`, label: reqField, status: "pass", message: `${reqField} present and readable` });
    } else {
      checks.push({ code: `STRUCT_${reqField}`, label: reqField, status: "fail", message: `${reqField} could not be extracted — missing or illegible` });
    }
  }

  // --- STRUCTURAL: document number format ---
  const docNoField = fieldValue(fields, "Passport Number") || fieldValue(fields, "Visa Number") || fieldValue(fields, "Document Number");
  if (docNoField) {
    const validFormat = /^[A-Z0-9]{5,12}$/.test(docNoField.replace(/\s/g, ""));
    checks.push({
      code: "STRUCT_DOC_NO_FORMAT",
      label: "Document Number Format",
      status: validFormat ? "pass" : "warn",
      message: validFormat ? "Document number format valid" : `Document number "${docNoField}" has an unusual format`,
    });
  }

  // --- LOGICAL: DOB < issue/now < expiry ---
  const dobStr = fieldValue(fields, "Date of Birth");
  const expiryStr = fieldValue(fields, "Date of Expiry") || fieldValue(fields, "Entry Validity") || fieldValue(fields, "Expiry Date");
  const dob = parseFlexDate(dobStr);
  const expiry = parseFlexDate(expiryStr);

  if (dob) {
    const age = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (dob > now) {
      checks.push({ code: "LOGIC_DOB_FUTURE", label: "Date of Birth Validity", status: "fail", message: "Date of birth is in the future — invalid" });
    } else if (age > 120) {
      checks.push({ code: "LOGIC_DOB_RANGE", label: "Date of Birth Validity", status: "warn", message: `Computed age (${Math.floor(age)}) is implausibly high` });
    } else {
      checks.push({ code: "LOGIC_DOB_RANGE", label: "Date of Birth Validity", status: "pass", message: "Date of birth is valid" });
    }
  }

  if (dob && expiry) {
    if (expiry <= dob) {
      checks.push({ code: "LOGIC_DOB_LT_EXPIRY", label: "Date Sequence", status: "fail", message: "Expiry date is not after date of birth — inconsistent document" });
    } else {
      checks.push({ code: "LOGIC_DOB_LT_EXPIRY", label: "Date Sequence", status: "pass", message: "Date of birth precedes expiry date" });
    }
  }

  // --- EXPIRATION checks ---
  if (expiry) {
    const daysToExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry < 0) {
      checks.push({ code: "EXP_EXPIRED", label: "Expiration Status", status: "fail", message: `Document expired ${Math.abs(daysToExpiry)} day(s) ago` });
    } else if (daysToExpiry <= 30) {
      checks.push({ code: "EXP_SOON", label: "Expiration Status", status: "warn", message: `Document expires in ${daysToExpiry} day(s)` });
    } else {
      checks.push({ code: "EXP_OK", label: "Expiration Status", status: "pass", message: `Document valid for ${daysToExpiry} more day(s)` });
    }
  }

  // --- CONSISTENCY: name should contain at least two tokens ---
  const name = fieldValue(fields, "Full Name");
  if (name) {
    const tokens = name.split(/\s+/).filter(Boolean);
    checks.push({
      code: "CONS_NAME_TOKENS",
      label: "Name Consistency",
      status: tokens.length >= 2 ? "pass" : "warn",
      message: tokens.length >= 2 ? "Name contains given and family name components" : "Name appears incomplete (single token only)",
    });
  }

  // --- CONSISTENCY: gender field sanity ---
  const gender = fieldValue(fields, "Gender");
  if (gender) {
    const ok = /^(M|F|X)$/i.test(gender);
    checks.push({ code: "CONS_GENDER", label: "Gender Field", status: ok ? "pass" : "warn", message: ok ? "Gender field well-formed" : `Unrecognized gender code "${gender}"` });
  }

  const passed = checks.filter((c) => c.status === "pass").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  return { checks, passed, warnings, failed, isValid: failed === 0 };
}
