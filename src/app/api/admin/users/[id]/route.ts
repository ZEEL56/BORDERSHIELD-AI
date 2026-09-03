import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!requireRole(auth, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role, isActive } = await req.json();
  const data: any = {};
  if (role) data.role = role;
  if (typeof isActive === "boolean") data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });

  await recordAuditEvent({
    userId: auth!.sub,
    eventType: "USER_UPDATED",
    eventData: { targetUserId: params.id, changes: data },
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role, isActive: user.isActive } });
}
