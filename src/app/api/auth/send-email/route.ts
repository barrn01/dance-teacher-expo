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
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("[auth-hook] SEND_EMAIL_HOOK_SECRET not set");
    return new Response("not configured", { status: 500 });
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
    return new Response("invalid signature", { status: 401 });
  }

  const email = payload.user?.email;
  const { token_hash, email_action_type, redirect_to } =
    payload.email_data ?? {};
  if (!email || !token_hash) {
    return new Response("bad payload", { status: 400 });
  }

  // The verification link lives on the Supabase auth server; it consumes the
  // token then bounces to redirect_to (our /auth/callback?next=...).
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const actionUrl = `${base}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;

  const result = await sendAuthSignInEmail({
    to: email,
    actionUrl,
    isAdmin: isAdminEmail(email),
  });

  if (!result.sent) {
    return new Response("send failed", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
