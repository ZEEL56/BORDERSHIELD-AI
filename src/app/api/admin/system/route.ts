import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyChain } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  const chain = await verifyChain();
  const [userCount, caseCount, auditCount, watchlistCount] = await Promise.all([
    prisma.user.count(),
    prisma.screeningCase.count(),
    prisma.auditLog.count(),
    prisma.watchlistEntry.count(),
  ]);

  return NextResponse.json({
    services: [
      { name: "Database", status: dbOk ? "OPERATIONAL" : "DOWN" },
      { name: "OCR Engine (Tesseract.js)", status: "OPERATIONAL" },
      { name: "Tampering Forensics (Heuristic)", status: "OPERATIONAL" },
      { name: "Face Verification (Heuristic)", status: "OPERATIONAL" },
      { name: "Watchlist Service (Demo Dataset)", status: "OPERATIONAL" },
      { name: "Risk Engine", status: "OPERATIONAL" },
      { name: "Audit Chain", status: chain.valid ? "INTACT" : "COMPROMISED" },
    ],
    counts: { userCount, caseCount, auditCount, watchlistCount },
    auditChain: chain,
  });
}
