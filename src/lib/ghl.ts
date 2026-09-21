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
  company?: string | null;
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

  // IMPORTANT: never send `tags` on upsert — GHL *replaces* the whole tag array,
  // which would wipe a contact's existing (e.g. marketing) tags. We upsert
  // details only, then ADD our tags separately (add-tags unions, non-destructive).
  const body: Record<string, unknown> = {
    locationId,
    email: input.email,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(phone ? { phone } : {}),
    ...(input.company?.trim() ? { companyName: input.company.trim() } : {}),
    source: input.source ?? "DTE 2027 ticketing",
  };

  try {
    const res = await fetch(`${API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: ghlHeaders(token),
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
    const contactId = data.contact?.id;

    // Add our tags without disturbing any the contact already has.
    if (contactId && input.tags.length > 0) {
      await addTagsToContact(token, contactId, input.tags);
    }

    return { synced: true, contactId };
  } catch (e) {
    console.error("[ghl] upsert error", e);
    return { synced: false, reason: "network error" };
  }
}

const ghlHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Version: API_VERSION,
  "Content-Type": "application/json",
  Accept: "application/json",
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Add tags to a contact WITHOUT replacing existing ones. Checks the response
 * status (fetch only rejects on network errors, so a silent 4xx/5xx would
 * otherwise drop the tag) and retries once — a just-created contact can briefly
 * 404 on this endpoint before it's fully propagated.
 */
async function addTagsToContact(
  token: string,
  contactId: string,
  tags: string[],
  attempt = 0,
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/contacts/${contactId}/tags`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) {
      if ((res.status === 404 || res.status >= 500) && attempt < 2) {
        await sleep(600);
        return addTagsToContact(token, contactId, tags, attempt + 1);
      }
      const t = await res.text().catch(() => "");
      console.error("[ghl] addTags failed", res.status, t.slice(0, 300));
    }
  } catch (e) {
    if (attempt < 2) {
      await sleep(600);
      return addTagsToContact(token, contactId, tags, attempt + 1);
    }
    console.error("[ghl] addTags error", e);
  }
}

/** Find a contact id by email in this location. Null if none/unconfigured. */
async function findContactIdByEmail(email: string): Promise<string | null> {
  const token = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) return null;
  try {
    const res = await fetch(
      `${API_BASE}/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}`,
      { headers: ghlHeaders(token) },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      contacts?: { id: string; email?: string }[];
    };
    const match = (data.contacts ?? []).find(
      (c) => (c.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

/** Find a contact id by phone (E.164-normalised) in this location. */
async function findContactIdByPhone(phone: string): Promise<string | null> {
  const token = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) return null;
  const e164 = toE164Au(phone);
  if (!e164) return null;
  try {
    const res = await fetch(
      `${API_BASE}/contacts/?locationId=${locationId}&query=${encodeURIComponent(e164)}`,
      { headers: ghlHeaders(token) },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      contacts?: { id: string; phone?: string }[];
    };
    return (data.contacts ?? [])[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a GHL contact id for a prospect: match by email, then phone; if no
 * match and we have an email, create the contact. Returns null when there's
 * nothing to match/create on (no email and no existing phone match).
 */
export async function resolveGhlContactId(input: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): Promise<string | null> {
  if (input.email) {
    const byEmail = await findContactIdByEmail(input.email);
    if (byEmail) return byEmail;
  }
  if (input.phone) {
    const byPhone = await findContactIdByPhone(input.phone);
    if (byPhone) return byPhone;
  }
  if (input.email) {
    const created = await upsertContact({
      email: input.email,
      name: input.name ?? null,
      phone: input.phone ?? null,
      tags: [],
      source: "DTE 2027 pipeline",
    });
    return created.contactId ?? null;
  }
  return null;
}

export type SendMessageResult = {
  ok: boolean;
  messageId?: string;
  conversationId?: string;
  error?: string;
};

/**
 * Send a message to a contact via GHL Conversations (the location's own number
 * / email domain). Requires the token to have conversations/message write scope.
 */
export async function sendConversationMessage(input: {
  contactId: string;
  type: "SMS" | "Email";
  message?: string;
  subject?: string;
  html?: string;
}): Promise<SendMessageResult> {
  const token = process.env.GHL_API_KEY;
  if (!token) return { ok: false, error: "GHL not configured" };

  const body: Record<string, unknown> = {
    type: input.type,
    contactId: input.contactId,
    ...(input.message ? { message: input.message } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.html ? { html: input.html } : {}),
  };
  try {
    const res = await fetch(`${API_BASE}/conversations/messages`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("[ghl] send failed", res.status, text.slice(0, 300));
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 140)}` };
    }
    const data = (text ? JSON.parse(text) : {}) as {
      messageId?: string;
      conversationId?: string;
    };
    return {
      ok: true,
      messageId: data.messageId,
      conversationId: data.conversationId,
    };
  } catch (e) {
    console.error("[ghl] send error", e);
    return { ok: false, error: "network error" };
  }
}

/** Remove tags from a contact (by email). Best-effort; no-op if not found. */
export async function removeTagsByEmail(
  email: string,
  tags: string[],
): Promise<void> {
  const token = process.env.GHL_API_KEY;
  if (!token || tags.length === 0) return;
  const id = await findContactIdByEmail(email);
  if (!id) return;
  try {
    await fetch(`${API_BASE}/contacts/${id}/tags`, {
      method: "DELETE",
      headers: ghlHeaders(token),
      body: JSON.stringify({ tags }),
    });
  } catch (e) {
    console.error("[ghl] removeTags error", e);
  }
}
