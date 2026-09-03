import Jimp from "jimp";
import fs from "fs/promises";
import ExifReader from "exifreader";

export interface SuspiciousRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  score: number; // 0-1
}

export interface TamperingAnalysisResult {
  tamperingDetected: boolean;
  confidence: number; // 0-1
  indicators: string[];
  suspiciousRegions: SuspiciousRegion[];
  metadataAnalysis: Record<string, unknown>;
  elaScore: number;
  noiseScore: number;
  compressionScore: number;
  explanation: string;
  method: "Forensic / Heuristic Analysis";
}

const GRID = 12; // divide image into GRID x GRID analysis blocks

/**
 * Modular forensic pipeline. NOTE: this is heuristic / classical image-forensics
 * analysis (Error Level Analysis, noise-consistency, compression-artifact and
 * EXIF metadata checks) — NOT a trained/certified ML tampering-detection model.
 * It is architected so a trained model service can be substituted behind the
 * same `analyzeTampering()` interface without touching callers.
 */
export async function analyzeTampering(filePath: string): Promise<TamperingAnalysisResult> {
  const indicators: string[] = [];
  const original = await Jimp.read(filePath);
  const { width, height } = original.bitmap;

  // ---------- 1. ERROR LEVEL ANALYSIS ----------
  const recompressed = original.clone();
  recompressed.quality(90);
  const recompressedBuffer = await recompressed.getBufferAsync(Jimp.MIME_JPEG);
  const recompressedImg = await Jimp.read(recompressedBuffer);

  const blockW = Math.max(1, Math.floor(width / GRID));
  const blockH = Math.max(1, Math.floor(height / GRID));

  const blockErrors: number[][] = [];
  let sumErr = 0;
  let countErr = 0;

  for (let by = 0; by < GRID; by++) {
    const row: number[] = [];
    for (let bx = 0; bx < GRID; bx++) {
      let blockSum = 0;
      let blockCount = 0;
      const x0 = bx * blockW;
      const y0 = by * blockH;
      for (let y = y0; y < Math.min(y0 + blockH, height); y += 2) {
        for (let x = x0; x < Math.min(x0 + blockW, width); x += 2) {
          const p1 = Jimp.intToRGBA(original.getPixelColor(x, y));
          const p2 = Jimp.intToRGBA(recompressedImg.getPixelColor(x, y));
          const diff = Math.abs(p1.r - p2.r) + Math.abs(p1.g - p2.g) + Math.abs(p1.b - p2.b);
          blockSum += diff;
          blockCount++;
        }
      }
      const avg = blockCount ? blockSum / blockCount : 0;
      row.push(avg);
      sumErr += avg;
      countErr++;
    }
    blockErrors.push(row);
  }

  const meanErr = sumErr / countErr;
  const variance = blockErrors.flat().reduce((s, v) => s + (v - meanErr) ** 2, 0) / countErr;
  const stdErr = Math.sqrt(variance);
  const elaThreshold = meanErr + 1.75 * stdErr;

  const suspiciousRegions: SuspiciousRegion[] = [];
  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const val = blockErrors[by][bx];
      if (val > elaThreshold && val > 8) {
        suspiciousRegions.push({
          x: bx * blockW,
          y: by * blockH,
          w: blockW,
          h: blockH,
          label: "Elevated compression-error residue",
          score: Math.min(1, val / (elaThreshold * 2)),
        });
      }
    }
  }

  const elaScore = Math.min(1, stdErr / 30); // higher spread = more localized editing signature
  if (suspiciousRegions.length > 0) {
    indicators.push(`${suspiciousRegions.length} region(s) show elevated Error Level Analysis residue, consistent with localized re-saving/editing.`);
  }

  // ---------- 2. NOISE INCONSISTENCY ----------
  const grayscale = original.clone().greyscale();
  const noiseByBlock: number[] = [];
  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const x0 = bx * blockW;
      const y0 = by * blockH;
      const vals: number[] = [];
      for (let y = y0; y < Math.min(y0 + blockH, height); y += 2) {
        for (let x = x0; x < Math.min(x0 + blockW, width); x += 2) {
          vals.push(Jimp.intToRGBA(grayscale.getPixelColor(x, y)).r);
        }
      }
      if (vals.length < 2) {
        noiseByBlock.push(0);
        continue;
      }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const v = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
      noiseByBlock.push(Math.sqrt(v));
    }
  }
  const meanNoise = noiseByBlock.reduce((a, b) => a + b, 0) / noiseByBlock.length;
  const noiseStd = Math.sqrt(noiseByBlock.reduce((s, v) => s + (v - meanNoise) ** 2, 0) / noiseByBlock.length);
  const lowNoiseOutliers = noiseByBlock.filter((n) => n < meanNoise - 1.5 * noiseStd).length;
  const noiseScore = Math.min(1, (lowNoiseOutliers / noiseByBlock.length) * 3);
  if (lowNoiseOutliers > 2) {
    indicators.push(`${lowNoiseOutliers} region(s) show abnormally smooth/low-noise texture relative to the rest of the document, a possible sign of cloning or digital smoothing.`);
  }

  // ---------- 3. COMPRESSION ARTIFACT CONSISTENCY ----------
  // Blockiness proxy: variance of block-average ELA error itself.
  const compressionScore = Math.min(1, stdErr / 25);
  if (compressionScore > 0.6) {
    indicators.push("Compression-error variance across the document is high, suggesting portions were saved at different quality levels (double-compression).");
  }

  // ---------- 4. METADATA ANALYSIS ----------
  const metadataAnalysis: Record<string, unknown> = {};
  try {
    const buf = await fs.readFile(filePath);
    const tags = ExifReader.load(buf, { expanded: true });
    const software = tags.exif?.Software?.description;
    const dateTime = tags.exif?.DateTime?.description;
    const dateTimeOriginal = tags.exif?.DateTimeOriginal?.description;
    const make = tags.exif?.Make?.description;
    const model = tags.exif?.Model?.description;

    metadataAnalysis.software = software || null;
    metadataAnalysis.camera = make && model ? `${make} ${model}` : make || model || null;
    metadataAnalysis.dateTime = dateTime || null;
    metadataAnalysis.dateTimeOriginal = dateTimeOriginal || null;
    metadataAnalysis.hasExif = Object.keys(tags).length > 0;

    const editingTools = /photoshop|gimp|paint\.net|snapseed|lightroom|illustrator|pixlr/i;
    if (software && editingTools.test(software)) {
      indicators.push(`EXIF metadata records editing software: "${software}".`);
      metadataAnalysis.editingSoftwareDetected = true;
    } else {
      metadataAnalysis.editingSoftwareDetected = false;
    }

    if (dateTime && dateTimeOriginal && dateTime !== dateTimeOriginal) {
      indicators.push("EXIF modification timestamp differs from the original capture timestamp.");
      metadataAnalysis.timestampMismatch = true;
    } else {
      metadataAnalysis.timestampMismatch = false;
    }

    if (!metadataAnalysis.hasExif) {
      indicators.push("No EXIF metadata present — image may have been re-saved, screenshotted, or stripped of origin data.");
    }
  } catch {
    metadataAnalysis.hasExif = false;
    metadataAnalysis.error = "EXIF metadata could not be parsed";
    indicators.push("EXIF metadata could not be parsed — file may have been stripped or converted.");
  }

  // ---------- 5. AGGREGATE CONFIDENCE ----------
  const metaPenalty =
    (metadataAnalysis.editingSoftwareDetected ? 0.35 : 0) + (metadataAnalysis.timestampMismatch ? 0.15 : 0);

  const confidence = Math.min(
    1,
    elaScore * 0.4 + noiseScore * 0.25 + compressionScore * 0.2 + metaPenalty
  );

  const tamperingDetected = confidence >= 0.5 || suspiciousRegions.length >= 4;

  const explanation = tamperingDetected
    ? `Forensic analysis flagged this document. ${indicators.join(" ")}`.trim()
    : `Forensic analysis found no strong indicators of manipulation. ELA and noise-consistency signatures are within normal bounds for a single-capture, unedited document.${
        indicators.length ? " Minor notes: " + indicators.join(" ") : ""
      }`;

  return {
    tamperingDetected,
    confidence: Math.round(confidence * 1000) / 1000,
    indicators,
    suspiciousRegions: suspiciousRegions.slice(0, 8),
    metadataAnalysis,
    elaScore: Math.round(elaScore * 1000) / 1000,
    noiseScore: Math.round(noiseScore * 1000) / 1000,
    compressionScore: Math.round(compressionScore * 1000) / 1000,
    explanation,
    method: "Forensic / Heuristic Analysis",
  };
}
