import { Webhook } from "standardwebhooks";
import { sendAuthSignInEmail } from "@/lib/email";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * Supabase "send email" auth hook. Supabase calls this for every auth email
 * (magic link / signup confirmation) instead of sending its own, so we render
 * and send via Resend with our own branded, role-aware templates. Verified
 * with the Standard Webhooks signature using SEND_EMAIL_HOOK_SECRET.
 */
type HookPayload = {
  user: { email: string };
  email_data: {
    token_hash: string;
    email_action_type: string;
    redirect_to: string;
    site_url?: string;
  };
};

export async function POST(request: Request) {
  // Supabase's hook framework requires a JSON response (with Content-Type),
  // otherwise it fails the auth request with "Invalid Content-Type".
  const ok = () => Response.json({});
  const fail = (status: number, message: string) =>
    Response.json({ error: { http_code: status, message } }, { status });

  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("[auth-hook] SEND_EMAIL_HOOK_SECRET not set");
    return fail(500, "email hook not configured");
  }

  const raw = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  let payload: HookPayload;
  try {
    // The lib accepts a "whsec_<base64>" secret; strip Supabase's "v1," prefix.
    const wh = new Webhook(secret.replace(/^v1,/, ""));
    payload = wh.verify(raw, headers) as HookPayload;
  } catch (e) {
    console.error("[auth-hook] signature verification failed", e);
    return fail(401, "invalid signature");
  }

  const email = payload.user?.email;
  const { token_hash, email_action_type, redirect_to } =
    payload.email_data ?? {};
  if (!email || !token_hash) {
    return fail(400, "bad payload");
  }

  // Link points straight at our /auth/confirm route (redirect_to) carrying the
  // token_hash — the token-hash flow, which works from any device.
  const actionUrl = (() => {
    try {
      const u = new URL(redirect_to);
      u.searchParams.set("token_hash", token_hash);
      u.searchParams.set("type", email_action_type);
      return u.toString();
    } catch {
      return redirect_to;
    }
  })();

  // Role decides the email copy. Admins are matched by allowlist (regardless of
  // page); vendors are inferred from the sign-in destination (?next=/vendor),
  // since they aren't on any allowlist; everyone else gets the buyer copy.
  const nextPath = (() => {
    try {
      return new URL(redirect_to).searchParams.get("next") ?? "";
    } catch {
      return "";
    }
  })();
  const role = isAdminEmail(email)
    ? "admin"
    : nextPath.startsWith("/vendor")
      ? "vendor"
      : "buyer";

  const result = await sendAuthSignInEmail({ to: email, actionUrl, role });

  if (!result.sent) {
    return fail(500, "email send failed");
  }
  return ok();
}
