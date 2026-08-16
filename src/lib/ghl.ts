import "server-only";

/**
 * Go High Level — marketing contact sync (upsert on purchase only).
 *
 * On a paid order we upsert the buyer and each named attendee as GHL contacts
 * and tag them, so the existing GHL marketing/reminder automations can pick
 * them up. Per the brief, the platform does NOT send marketing email/SMS
 * itself — GHL owns that. This is a one-way upsert.
 *
 * Uses the LeadConnector v2 API. `GHL_API_KEY` is a Private Integration token
 * (Settings → Private Integrations, scoped to contacts write). No-op (returns
 * {synced:false}) when unconfigured, so fulfillment never blocks on GHL.
 */

const API_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export type GhlUpsertInput = {
  email: string;
  name?: string | null;
  phone?: string | null;
  tags: string[];
  source?: string;
};

type SyncResult = { synced: boolean; contactId?: string; reason?: string };

/**
 * GHL only accepts phone numbers in E.164 (+…). Australian buyers type local
 * format (0488…), so normalise: strip non-digits, turn a leading 0 into +61,
 * accept an existing country code, else leave a already-plus number as-is.
 * Returns undefined when there's nothing usable.
 */
function toE164Au(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  let d = trimmed.replace(/\D/g, "");
  if (!d) return undefined;
  if (d.startsWith("0")) d = "61" + d.slice(1);
  else if (!d.startsWith("61")) d = "61" + d;
  return "+" + d;
}

export async function upsertContact(
  input: GhlUpsertInput,
): Promise<SyncResult> {
  const token = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    return { synced: false, reason: "GHL not configured" };
  }

  const [firstName, ...rest] = (input.name ?? "").trim().split(/\s+/);
  const lastName = rest.join(" ");
  const phone = toE164Au(input.phone);

  const body: Record<string, unknown> = {
    locationId,
    email: input.email,
    // Only send names when we actually have them.
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(phone ? { phone } : {}),
    tags: input.tags,
    source: input.source ?? "DTE 2027 ticketing",
  };

  try {
    const res = await fetch(`${API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ghl] upsert failed", res.status, text.slice(0, 500));
      return { synced: false, reason: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      contact?: { id?: string };
    };
    return { synced: true, contactId: data.contact?.id };
  } catch (e) {
    console.error("[ghl] upsert error", e);
    return { synced: false, reason: "network error" };
  }
}
