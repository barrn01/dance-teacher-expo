import "server-only";
import { createHash } from "node:crypto";

/**
 * Meta (Facebook) Conversions API — server-side events.
 *
 * Every server event carries an `event_id` that matches the browser Pixel's
 * `eventID` for the same action, so Meta de-duplicates the pair and attribution
 * survives ad-blockers, iOS and lost cookies. Purchase is the event that must
 * always reach Meta, so it is sent here (from the Stripe webhook) as the source
 * of truth as well as from the browser.
 *
 * No-op (returns {sent:false}) when the Pixel id or access token is unset, so
 * checkout/fulfillment never block on tracking config.
 */

const GRAPH_VERSION = "v21.0";

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  fbp?: string | null; // _fbp cookie
  fbc?: string | null; // _fbc cookie
  clientIp?: string | null;
  userAgent?: string | null;
};

export type MetaEvent = {
  eventName: "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase";
  eventId: string; // dedup key shared with the browser Pixel
  eventTimeSec?: number; // unix seconds; defaults to now
  eventSourceUrl?: string | null;
  user: MetaUserData;
  customData?: {
    currency?: string;
    value?: number; // major units (e.g. dollars)
    numItems?: number;
    contentIds?: string[];
    contentType?: string;
  };
};

type SendResult = { sent: boolean; reason?: string };

const sha256 = (v: string) =>
  createHash("sha256").update(v).digest("hex");

/** Normalise + hash per Meta's advanced-matching rules. Empty → undefined. */
const hashEmail = (email?: string | null) => {
  const e = email?.trim().toLowerCase();
  return e ? sha256(e) : undefined;
};

const hashPhone = (phone?: string | null) => {
  // Digits only, keep country code; assume AU (61) when a local 0-lead number.
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.startsWith("0")) d = "61" + d.slice(1);
  return sha256(d);
};

export async function sendMetaEvent(event: MetaEvent): Promise<SendResult> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return { sent: false, reason: "Meta CAPI not configured" };
  }

  const userData: Record<string, unknown> = {};
  const em = hashEmail(event.user.email);
  const ph = hashPhone(event.user.phone);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (event.user.fbp) userData.fbp = event.user.fbp;
  if (event.user.fbc) userData.fbc = event.user.fbc;
  if (event.user.clientIp) userData.client_ip_address = event.user.clientIp;
  if (event.user.userAgent) userData.client_user_agent = event.user.userAgent;

  const customData: Record<string, unknown> = {};
  const c = event.customData ?? {};
  if (c.currency) customData.currency = c.currency;
  if (c.value != null) customData.value = c.value;
  if (c.numItems != null) customData.num_items = c.numItems;
  if (c.contentIds?.length) customData.content_ids = c.contentIds;
  if (c.contentType) customData.content_type = c.contentType;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTimeSec ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        ...(event.eventSourceUrl
          ? { event_source_url: event.eventSourceUrl }
          : {}),
        user_data: userData,
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
  };
  // Only while testing events in Events Manager.
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[meta] CAPI send failed", res.status, text.slice(0, 500));
      return { sent: false, reason: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[meta] CAPI send error", e);
    return { sent: false, reason: "network error" };
  }
}
