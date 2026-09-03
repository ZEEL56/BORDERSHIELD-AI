import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface UploadValidationError {
  ok: false;
  reason: string;
}
export interface UploadValidationOk {
  ok: true;
  storedName: string;
  filePath: string;
  sha256: string;
}

/** Validates MIME/extension/size, writes the file with a safe random name, returns its hash. */
export async function saveUploadedFile(file: File, caseId: string): Promise<UploadValidationOk | UploadValidationError> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, reason: `Unsupported file type "${file.type}". Only JPEG, PNG, or WEBP images are accepted.` };
  }
  const ext = path.extname(file.name || "").toLowerCase();
  if (ext && !ALLOWED_EXT.has(ext)) {
    return { ok: false, reason: `Unsupported file extension "${ext}".` };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, reason: `File exceeds the 10MB size limit.` };
  }
  if (file.size === 0) {
    return { ok: false, reason: "Uploaded file is empty." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic-byte sniff — reject files whose content doesn't match a declared image type
  // (prevents disguised executables / path-traversal-via-extension tricks).
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP";
  if (!isJpeg && !isPng && !isWebp) {
    return { ok: false, reason: "File content does not match a valid image signature." };
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const safeExt = isJpeg ? ".jpg" : isPng ? ".png" : ".webp";
  const storedName = `${crypto.randomUUID()}${safeExt}`;

  const caseDir = path.join(UPLOAD_DIR, sanitizeSegment(caseId));
  await fs.mkdir(caseDir, { recursive: true });
  const filePath = path.join(caseDir, storedName);
  await fs.writeFile(filePath, buffer);

  return { ok: true, storedName, filePath, sha256 };
}

function sanitizeSegment(s: string) {
  return s.replace(/[^a-zA-Z0-9_-]/g, "");
}
