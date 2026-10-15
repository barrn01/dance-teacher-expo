import { NextResponse } from "next/server";
import { keepAlive } from "@/lib/xero/client";

export const runtime = "nodejs";

/**
 * Weekly token keep-alive (Vercel cron). Xero refresh tokens lapse after 60
 * days of non-use; vendor signings are sporadic, so we refresh on a schedule to
 * keep the connection alive. Secured by CRON_SECRET (Vercel sends it as a
 * Bearer header on cron invocations).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
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
