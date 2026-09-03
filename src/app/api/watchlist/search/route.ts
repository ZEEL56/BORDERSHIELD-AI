import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkWatchlist } from "@/services/watchlist.service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fullName = searchParams.get("fullName") || undefined;
  const documentNumber = searchParams.get("documentNumber") || undefined;

  if (!fullName && !documentNumber) {
    return NextResponse.json({ error: "Provide fullName or documentNumber to search." }, { status: 400 });
  }

  const result = await checkWatchlist({ fullName, documentNumber });
  return NextResponse.json(result);
}
