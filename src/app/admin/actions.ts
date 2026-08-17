"use server";

import { isAdminEmail } from "@/lib/admin";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Admin sign-in request. Unlike the buyer login (open to anyone), this checks
 * the admin allowlist BEFORE sending — a non-admin email gets a clear error and
 * no email at all. The magic link uses the token-hash flow (see /auth/confirm).
 */
export async function requestAdminLink(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim();
  if (!isEmail(e)) return { ok: false, error: "Please enter a valid email." };
  if (!isAdminEmail(e))
    return { ok: false, error: "This email doesn't have admin access." };

  const supabase = await createAuthServerClient();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dance-teacher-expo.vercel.app";
  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: `${site}/auth/confirm?next=/admin` },
  });
  if (error) {
    console.error("[admin] signInWithOtp failed", error.message);
    return { ok: false, error: "Couldn't send the link — please try again." };
  }
  return { ok: true };
}
