import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminGate } from "@/lib/admin";
import { completeConnection } from "@/lib/xero/client";

export const runtime = "nodejs";

/**
 * Xero OAuth2 redirect target. Verifies the CSRF state, exchanges the code for
 * tokens, resolves the org tenant and persists the connection. Admin-only.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expected = cookieStore.get("xero_oauth_state")?.value;
  cookieStore.delete("xero_oauth_state");

  const gate = await getAdminGate();
  if (gate.status !== "admin") return NextResponse.redirect(`${origin}/admin`);

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${origin}/admin/xero?error=state`);
  }

  try {
    await completeConnection(code, gate.user.email ?? null);
    return NextResponse.redirect(`${origin}/admin/xero?connected=1`);
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message.slice(0, 200) : "connect_failed",
    );
    return NextResponse.redirect(`${origin}/admin/xero?error=${msg}`);
  }
}
