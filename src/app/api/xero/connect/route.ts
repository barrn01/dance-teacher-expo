import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminGate } from "@/lib/admin";
import { buildAuthorizeUrl } from "@/lib/xero/client";

export const runtime = "nodejs";

/**
 * Start the one-time Xero authorisation. Admin-only: generates a CSRF state,
 * stores it in an httpOnly cookie, and redirects to Xero's consent screen.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const gate = await getAdminGate();
  if (gate.status !== "admin") return NextResponse.redirect(`${origin}/admin`);

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("xero_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  try {
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch {
    return NextResponse.redirect(`${origin}/admin/xero?error=not_configured`);
  }
}
