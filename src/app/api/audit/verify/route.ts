import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { verifyChain } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const result = await verifyChain(body?.caseId);
  return NextResponse.json(result);
}
