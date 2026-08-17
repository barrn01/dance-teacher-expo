import "server-only";
import { createAuthServerClient } from "./supabase/auth-server";
import type { User } from "@supabase/supabase-js";

/**
 * Admin access is a simple email allowlist (ADMIN_EMAILS, comma-separated).
 * Admins sign in with the same magic-link flow as buyers; only allowlisted
 * emails get past the /admin gate. Admin data reads use the service client
 * (bypassing RLS) — always gate with getAdminUser() first.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type AdminGate =
  | { status: "anon" }
  | { status: "denied"; email: string | null }
  | { status: "admin"; user: User };

/** Resolve the current admin session state for gating /admin pages. */
export async function getAdminGate(): Promise<AdminGate> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };
  if (!isAdminEmail(user.email)) return { status: "denied", email: user.email ?? null };
  return { status: "admin", user };
}
