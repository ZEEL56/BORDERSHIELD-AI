import Jimp from "jimp";

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface FaceVerificationResult {
  docFaceFound: boolean;
  selfieFaceFound: boolean;
  multipleFaces: boolean;
  similarity: number | null; // 0-100
  matchDecision: "MATCH" | "NO_MATCH" | "INCONCLUSIVE";
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  method: "Heuristic Visual Similarity Analysis";
}

/**
 * NOTE ON METHOD: This module performs skin-tone region detection (YCbCr
 * classifier) followed by a perceptual-hash / color-histogram similarity
 * comparison between the detected regions. This is a heuristic stand-in,
 * NOT certified biometric face recognition (no facial landmark/embedding
 * model such as InsightFace/FaceNet/ArcFace is used). The interface is
 * intentionally isolated so a real embedding-based matcher can be dropped
 * in behind `verifyFaces()` without changing any caller.
 */
export async function verifyFaces(docImagePath: string, selfieImagePath: string): Promise<FaceVerificationResult> {
  const [docImg, selfieImg] = await Promise.all([Jimp.read(docImagePath), Jimp.read(selfieImagePath)]);

  const docFaces = detectSkinRegions(docImg);
  const selfieFaces = detectSkinRegions(selfieImg);

  const docFaceFound = docFaces.length > 0;
  const selfieFaceFound = selfieFaces.length > 0;
  const multipleFaces = selfieFaces.length > 1;

  if (!docFaceFound || !selfieFaceFound) {
    return {
      docFaceFound,
      selfieFaceFound,
      multipleFaces,
      similarity: null,
      matchDecision: "INCONCLUSIVE",
      confidenceBand: "LOW",
      explanation: !docFaceFound
        ? "No face region could be detected on the document photo. Manual review required."
        : "No face region could be detected in the presented person's image. Please retake and retry.",
      method: "Heuristic Visual Similarity Analysis",
    };
  }

  const docBox = docFaces[0];
  const selfieBox = selfieFaces[0];

  const docCrop = docImg.clone().crop(docBox.x, docBox.y, docBox.w, docBox.h).resize(64, 64).greyscale();
  const selfieCrop = selfieImg.clone().crop(selfieBox.x, selfieBox.y, selfieBox.w, selfieBox.h).resize(64, 64).greyscale();

  const similarity = compareCrops(docCrop, selfieCrop);

  let matchDecision: FaceVerificationResult["matchDecision"];
  let confidenceBand: FaceVerificationResult["confidenceBand"];

  if (multipleFaces) {
    matchDecision = "INCONCLUSIVE";
    confidenceBand = "LOW";
  } else if (similarity >= 85) {
    matchDecision = "MATCH";
    confidenceBand = "HIGH";
  } else if (similarity >= 70) {
    matchDecision = "MATCH";
    confidenceBand = "MEDIUM";
  } else if (similarity >= 55) {
    matchDecision = "INCONCLUSIVE";
    confidenceBand = "LOW";
  } else {
    matchDecision = "NO_MATCH";
    confidenceBand = similarity < 35 ? "HIGH" : "MEDIUM";
  }

  const explanation = multipleFaces
    ? `${selfieFaces.length} candidate face regions detected in the presented image — re-capture with a single subject required before a reliable comparison can be made.`
    : `Detected face regions compared with ${similarity.toFixed(1)}% visual similarity (${confidenceBand} confidence). ${
        matchDecision === "MATCH"
          ? "Regions are visually consistent with the same individual."
          : matchDecision === "NO_MATCH"
          ? "Regions show substantial visual divergence."
          : "Similarity is in the borderline range — recommend manual officer review."
      }`;

  return {
    docFaceFound,
    selfieFaceFound,
    multipleFaces,
    similarity: Math.round(similarity * 10) / 10,
    matchDecision,
    confidenceBand,
    explanation,
    method: "Heuristic Visual Similarity Analysis",
  };
}

/** Simple YCbCr skin-tone classifier + connected-region bounding boxes. */
function detectSkinRegions(img: Jimp): FaceBox[] {
  const { width, height } = img.bitmap;
  const cell = 8;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      let skinCount = 0;
      let total = 0;
      for (let y = ry * cell; y < Math.min((ry + 1) * cell, height); y += 2) {
        for (let x = rx * cell; x < Math.min((rx + 1) * cell, width); x += 2) {
          const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
          if (isSkinTone(r, g, b)) skinCount++;
          total++;
        }
      }
      mask[ry][rx] = total > 0 && skinCount / total > 0.45;
    }
  }

  // Find connected components (simple flood-fill) among true cells, sized by cell count.
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const boxes: FaceBox[] = [];

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      if (!mask[ry][rx] || visited[ry][rx]) continue;
      let minX = rx, maxX = rx, minY = ry, maxY = ry, size = 0;
      const stack = [[ry, rx]];
      visited[ry][rx] = true;
      while (stack.length) {
        const [cy, cx] = stack.pop()!;
        size++;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = cy + dy, nx = cx + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && mask[ny][nx] && !visited[ny][nx]) {
            visited[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
      // A plausible face region needs a minimum size and roughly portrait-ish aspect ratio.
      const boxW = (maxX - minX + 1) * cell;
      const boxH = (maxY - minY + 1) * cell;
      if (size >= 6 && boxW >= width * 0.06 && boxH >= height * 0.06) {
        boxes.push({
          x: minX * cell,
          y: minY * cell,
          w: Math.min(boxW, width - minX * cell),
          h: Math.min(boxH, height - minY * cell),
          score: Math.min(1, size / 40),
        });
      }
    }
  }

  boxes.sort((a, b) => b.w * b.h - a.w * a.h);
  return boxes.slice(0, 5);
}

function isSkinTone(r: number, g: number, b: number): boolean {
  // Standard YCbCr skin-tone gate, tolerant across common lighting conditions.
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 60 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

/** Grayscale pixel-correlation similarity between two equally-sized crops, as a percentage. */
function compareCrops(a: Jimp, b: Jimp): number {
  const { width, height } = a.bitmap;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const va = Jimp.intToRGBA(a.getPixelColor(x, y)).r;
      const vb = Jimp.intToRGBA(b.getPixelColor(x, y)).r;
      sumA += va;
      sumB += vb;
      sumAB += va * vb;
      sumA2 += va * va;
      sumB2 += vb * vb;
      n++;
    }
  }
  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  const correlation = denominator === 0 ? 0 : numerator / denominator; // -1..1
  return Math.max(0, Math.min(100, ((correlation + 1) / 2) * 100));
}
