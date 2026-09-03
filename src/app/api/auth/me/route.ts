import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ user: null }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { id: true, name: true, email: true, role: true, badgeId: true },
  });
  return NextResponse.json({ user });
}
