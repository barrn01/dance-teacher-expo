import { NextResponse } from "next/server";
import { keepAlive } from "@/lib/xero/client";
import { verifyWebhookSecret } from "@/lib/webhook-auth";

export const runtime = "nodejs";

/**
 * Weekly token keep-alive (Vercel cron). Xero refresh tokens lapse after 60
 * days of non-use; vendor signings are sporadic, so we refresh on a schedule to
 * keep the connection alive. Secured by CRON_SECRET (Vercel sends it as a
 * Bearer header on cron invocations). Fails CLOSED when CRON_SECRET is unset so
 * the endpoint is never world-callable; constant-time secret compare.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[xero] CRON_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (!verifyWebhookSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const refreshed = await keepAlive();
    return NextResponse.json({ ok: true, refreshed });
  } catch (err) {
    console.error("[xero] keepalive failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
