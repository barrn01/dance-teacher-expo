import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

/**
 * Magic-link landing route (token-hash flow). The sign-in email points here
 * with a token_hash; we verify it server-side with verifyOtp — which, unlike
 * the PKCE code flow, needs no browser-stored verifier, so links work from any
 * device/app. On success the session cookie is set and we forward to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/account";

  if (tokenHash && type) {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth-confirm] verifyOtp failed", error.message);
  }

  // Failed/expired link → back to the page they were signing into, which shows
  // its own sign-in form.
  const dest = next.startsWith("/admin") ? "/admin" : "/account";
  return NextResponse.redirect(`${origin}${dest}?error=link`);
}
