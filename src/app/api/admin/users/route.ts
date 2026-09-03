import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, badgeId: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, password, role, badgeId } = await req.json();
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "name, email, password and role are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role, badgeId: badgeId || null },
  });

  await recordAuditEvent({
    userId: auth!.sub,
    eventType: "USER_CREATED",
    eventData: { createdUserId: user.id, email: user.email, role: user.role },
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
