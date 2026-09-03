import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET as string;
const TOKEN_COOKIE = "bordershield_token";
const TOKEN_TTL = "8h";

if (!JWT_SECRET) {
  // Fail loudly at boot rather than silently issuing insecure tokens.
  console.error("JWT_SECRET is not set. Authentication will not function correctly.");
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: "ADMIN" | "OFFICER" | "ANALYST";
  name: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = TOKEN_COOKIE;

/** Extract & verify the current user from a request's cookie or Authorization header. */
export function getAuthFromRequest(req: NextRequest): AuthTokenPayload | null {
  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = cookieToken || headerToken;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return null;
  // Confirm user still exists & is active (handles disabled accounts immediately).
  const user = await prisma.user.findUnique({ where: { id: auth.sub } });
  if (!user || !user.isActive) return null;
  return auth;
}

export function requireRole(auth: AuthTokenPayload | null, roles: Array<AuthTokenPayload["role"]>) {
  if (!auth) return false;
  return roles.includes(auth.role);
}
