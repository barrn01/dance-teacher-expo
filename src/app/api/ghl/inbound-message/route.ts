import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getContactConversation } from "@/lib/ghl";

export const runtime = "nodejs";

/**
 * Inbound webhook from GoHighLevel: when a prospect replies (SMS/email), a GHL
 * workflow POSTs here and we log it as an inbound touch on the matching
 * prospect (by ghl_contact_id). Keeps the pipeline's last-touch / gone-quiet
 * accurate for replies. Secured by the shared GHL_INBOUND_SECRET
 * (header `x-webhook-secret` or `?token=`). Field names are matched flexibly.
 */
type Body = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

function pick(body: Body, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = str(body[k]);
    if (v) return v;
  }
  return undefined;
}

function channelOf(raw?: string): "sms" | "email" | "note" {
  const t = (raw ?? "").toLowerCase();
  if (t.includes("sms") || t.includes("text")) return "sms";
  if (t.includes("email") || t.includes("mail")) return "email";
  return "note";
}

export async function POST(request: Request) {
  const secret = process.env.GHL_INBOUND_SECRET;
  if (!secret) {
    console.error("[inbound] GHL_INBOUND_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const contactId = pick(body, [
    "contactId",
    "contact_id",
    "ghl_contact_id",
    "contact.id",
  ]);
  if (!contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  let messageId = pick(body, ["messageId", "message_id", "id"]);
  const conversationId = pick(body, ["conversationId", "conversation_id"]);
  let messageBody = pick(body, ["body", "message", "message_body", "text"]);
  let channel = channelOf(pick(body, ["type", "messageType", "channel"]));

  const sb = createServiceClient();

  // Only log for a known prospect (ignore replies from non-pipeline contacts).
  const { data: prospect } = await sb
    .from("prospects")
    .select("id")
    .eq("ghl_contact_id", contactId)
    .maybeSingle<{ id: string }>();
  if (!prospect) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // GHL's "Customer Replied" trigger doesn't reliably expose the message body/
  // type as merge fields, so the webhook only needs to send contactId — we fetch
  // the actual reply (channel + body + id) from GHL here.
  if (!messageBody) {
    const conv = await getContactConversation(contactId);
    const lastInbound = [...conv.messages]
      .reverse()
      .find((m) => m.direction === "in");
    if (lastInbound) {
      channel = lastInbound.channel === "other" ? channel : lastInbound.channel;
      messageBody = lastInbound.body || messageBody;
      messageId = messageId ?? lastInbound.id;
    }
  }

  // De-dupe on the GHL message id if we have one.
  if (messageId) {
    const { data: existing } = await sb
      .from("prospect_touches")
      .select("id")
      .eq("ghl_message_id", messageId)
      .maybeSingle<{ id: string }>();
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error } = await sb.from("prospect_touches").insert({
    prospect_id: prospect.id,
    channel,
    direction: "in",
    body: messageBody ?? null,
    by: "ghl",
    ghl_message_id: messageId ?? null,
    ghl_conversation_id: conversationId ?? null,
  });
  if (error) {
    console.error("[inbound] insert failed", error);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  revalidatePath("/admin/pipeline");
  return NextResponse.json({ ok: true, matched: true });
}
