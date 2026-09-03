import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

const LANDING_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin",
  ANALYST: "/analyst",
  OFFICER: "/dashboard",
};

export default function Home() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  const auth = token ? verifyToken(token) : null;
  redirect(auth ? LANDING_BY_ROLE[auth.role] || "/dashboard" : "/login");
}
