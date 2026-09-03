import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name });

    await recordAuditEvent({
      userId: user.id,
      eventType: "USER_LOGIN",
      eventData: { email: user.email, role: user.role },
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, badgeId: user.badgeId },
    });
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed due to a server error." }, { status: 500 });
  }
}
