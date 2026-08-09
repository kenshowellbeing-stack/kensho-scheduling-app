import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

// Simple single-admin auth. There's only one provider, so there's one password
// (ADMIN_PASSWORD in .env). On login we set an httpOnly cookie whose value is a
// hash of the password; every admin page/action re-checks that the cookie
// matches. No database sessions to manage.

export const ADMIN_COOKIE = "admin_session";

export function tokenForPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function isAuthed(): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false; // no password set = admin locked until configured
  const cookie = cookies().get(ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  const expected = tokenForPassword(password);
  // Constant-time compare to avoid leaking via timing.
  const a = Buffer.from(cookie);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Call at the top of any admin page/action; bounces to the login screen if the
// visitor isn't authenticated.
export function requireAdmin(): void {
  if (!isAuthed()) redirect("/admin/login");
}
