import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runWatchlistStage } from "@/lib/pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, fullName, documentNumber } = await req.json();
    if (!caseId) return NextResponse.json({ error: "caseId is required." }, { status: 400 });
    const { saved, matchedEntry } = await runWatchlistStage(caseId, fullName, documentNumber, auth.sub);
    return NextResponse.json({ watchlistCheck: saved, matchedEntry });
  } catch (err) {
    console.error("Watchlist check error:", err);
    return NextResponse.json({ error: "Watchlist check failed due to a server error." }, { status: 500 });
  }
}
