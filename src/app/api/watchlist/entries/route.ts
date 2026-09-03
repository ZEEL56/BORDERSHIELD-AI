import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.watchlistEntry.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ADMIN", "ANALYST"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, documentNumber, nationality, reason, severity } = await req.json();
  if (!fullName || !reason) return NextResponse.json({ error: "fullName and reason are required." }, { status: 400 });

  const entry = await prisma.watchlistEntry.create({
    data: { fullName, documentNumber: documentNumber || null, nationality: nationality || null, reason, severity: severity || "HIGH", isDemo: true },
  });

  await recordAuditEvent({
    userId: auth!.sub,
    eventType: "WATCHLIST_ENTRY_ADDED",
    eventData: { entryId: entry.id, fullName },
  });

  return NextResponse.json({ entry });
}
