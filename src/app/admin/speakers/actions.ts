"use server";

import { revalidatePath } from "next/cache";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { getEventId, getSpeaker, slugify, SPEAKER_BUCKET } from "@/lib/cms";
import { parseCsv } from "@/lib/csv";
import type { BulkResult, BulkRowResult } from "@/lib/bulk";

export type SpeakerResult = { ok: boolean; error?: string; id?: string };

const PHOTO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

function normalizeUrl(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Create a speaker (name required; other fields via edit). Admin. */
export async function createSpeaker(name: string): Promise<SpeakerResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const n = name.trim();
  if (!n) return { ok: false, error: "Speaker name is required." };

  const eventId = await getEventId();
  if (!eventId) return { ok: false, error: "Event not found." };
  const sb = createServiceClient();

  const base = slugify(n) || "speaker";
  for (const slug of [base, `${base}-${crypto.randomUUID().slice(0, 4)}`]) {
    const { data, error } = await sb
      .from("speakers")
      .insert({ event_id: eventId, name: n, slug })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/admin/speakers");
      return { ok: true, id: data.id };
    }
    if (error && error.code !== "23505") {
      console.error("[admin] createSpeaker failed", error);
      return { ok: false, error: "Could not create the speaker." };
    }
  }
  return { ok: false, error: "Could not create a unique speaker slug." };
}

/** Update a speaker's fields + optional headshot upload. Admin. */
export async function updateSpeaker(
  formData: FormData,
): Promise<SpeakerResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const id = String(formData.get("id") ?? "");
  const speaker = await getSpeaker(id);
  if (!speaker) return { ok: false, error: "Speaker not found." };

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const name = str("name");
  if (!name) return { ok: false, error: "Speaker name is required." };

  const sb = createServiceClient();

  let headshot_url = speaker.headshot_url;
  if (formData.get("remove_headshot") === "on") headshot_url = null;
  const file = formData.get("headshot");
  if (file instanceof File && file.size > 0) {
    const ext = PHOTO_TYPES[file.type];
    if (!ext) return { ok: false, error: "Photo must be a PNG, JPG or WEBP." };
    if (file.size > MAX_PHOTO_BYTES)
      return { ok: false, error: "Photo must be under 5 MB." };
    const path = `${speaker.id}/${crypto.randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from(SPEAKER_BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) {
      console.error("[admin] headshot upload failed", upErr);
      return { ok: false, error: "Photo upload failed — try again." };
    }
    headshot_url = sb.storage.from(SPEAKER_BUCKET).getPublicUrl(path).data
      .publicUrl;
  }

  // Registration (check-in pass) — create/remove the speaker's attendee row.
  await syncSpeakerRegistration(
    sb,
    speaker.id,
    speaker.event_id,
    name,
    formData.get("register_pass") === "on",
  );

  const sortRaw = parseInt(str("sort_order"), 10);
  const { error } = await sb
    .from("speakers")
    .update({
      name,
      title: str("title") || null,
      company: str("company") || null,
      tagline: str("tagline") || null,
      pronouns: str("pronouns") || null,
      bio: str("bio") || null,
      website_url: normalizeUrl(str("website_url")),
      instagram: str("instagram").replace(/^@/, "") || null,
      vendor_id: str("vendor_id") || null,
      headshot_url,
      is_featured: formData.get("is_featured") === "on",
      is_homepage_featured: formData.get("is_homepage_featured") === "on",
      is_active: formData.get("is_active") === "on",
      sort_order: Number.isFinite(sortRaw) ? sortRaw : 0,
    })
    .eq("id", speaker.id);
  if (error) {
    console.error("[admin] updateSpeaker failed", error);
    return { ok: false, error: "Could not save the speaker." };
  }

  revalidatePath("/admin/speakers");
  revalidatePath(`/admin/speakers/${speaker.id}`);
  return { ok: true, id: speaker.id };
}

/**
 * Bulk-create speakers from CSV (admin). Columns (header optional, matched by
 * name or position): name, title, company, tagline, pronouns, bio, instagram,
 * website. Each row validated independently; bad rows skipped + reported.
 */
export async function createSpeakersBulk(csv: string): Promise<BulkResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin")
    return { ok: false, error: "Not authorised.", created: 0, failed: 0, results: [] };

  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0)
    return { ok: false, error: "The file is empty.", created: 0, failed: 0, results: [] };

  let cols = { name: 0, title: 1, company: 2, tagline: 3, pronouns: 4, bio: 5, instagram: 6, website: 7 };
  let start = 0;
  const first = rows[0].map((c) => c.trim().toLowerCase());
  if (first.includes("name")) {
    const f = (names: string[]) => first.findIndex((h) => names.includes(h));
    cols = {
      name: f(["name"]),
      title: f(["title", "role"]),
      company: f(["company", "studio"]),
      tagline: f(["tagline"]),
      pronouns: f(["pronouns"]),
      bio: f(["bio", "biography"]),
      instagram: f(["instagram", "ig"]),
      website: f(["website", "url"]),
    };
    start = 1;
  }
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const eventId = await getEventId();
  if (!eventId)
    return { ok: false, error: "Event not found.", created: 0, failed: 0, results: [] };
  const sb = createServiceClient();
  const results: BulkRowResult[] = [];

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const name = cell(r, cols.name);
    if (!name) {
      results.push({ line, label: "", ok: false, error: "Missing name." });
      continue;
    }
    const website = cell(r, cols.website);
    const insert = {
      event_id: eventId,
      name,
      slug: `${slugify(name) || "speaker"}-${crypto.randomUUID().slice(0, 4)}`,
      title: cell(r, cols.title) || null,
      company: cell(r, cols.company) || null,
      tagline: cell(r, cols.tagline) || null,
      pronouns: cell(r, cols.pronouns) || null,
      bio: cell(r, cols.bio) || null,
      instagram: cell(r, cols.instagram).replace(/^@/, "") || null,
      website_url: website
        ? /^https?:\/\//i.test(website)
          ? website
          : `https://${website}`
        : null,
    };
    const { error } = await sb.from("speakers").insert(insert);
    if (error) {
      results.push({ line, label: name, ok: false, error: "Database error." });
      continue;
    }
    results.push({ line, label: name, ok: true });
  }

  const created = results.filter((x) => x.ok).length;
  if (created > 0) revalidatePath("/admin/speakers");
  return { ok: true, created, failed: results.length - created, results };
}

/** Move a speaker up/down in the manual sort order. Admin. */
export async function moveSpeaker(
  id: string,
  dir: "up" | "down",
): Promise<SpeakerResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const eventId = await getEventId();
  if (!eventId) return { ok: false, error: "Event not found." };
  const sb = createServiceClient();

  const { data: rows } = await sb
    .from("speakers")
    .select("id")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const order = (rows ?? []).map((r) => r.id);
  const i = order.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return { ok: true }; // no-op at edge

  [order[i], order[j]] = [order[j], order[i]];
  // Renumber sequentially so the new order sticks.
  await Promise.all(
    order.map((sid, idx) =>
      sb.from("speakers").update({ sort_order: idx }).eq("id", sid),
    ),
  );
  revalidatePath("/admin/speakers");
  return { ok: true };
}

const SPEAKER_ORDER_EMAIL = "speakers@registrations.danceteacherexpo.com.au";

/** Find (or create) the event's single $0 speaker-registration order. */
async function speakerOrderId(
  sb: ReturnType<typeof createServiceClient>,
  eventId: string,
): Promise<string | null> {
  const { data: existing } = await sb
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .eq("registration_kind", "speaker")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;
  const { data: created } = await sb
    .from("orders")
    .insert({
      event_id: eventId,
      status: "paid",
      registration_kind: "speaker",
      buyer_name: "Speakers",
      buyer_email: SPEAKER_ORDER_EMAIL,
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      currency: "AUD",
      metadata: { speaker_registration: true },
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

/** Create or remove a speaker's attendee registration (check-in pass). */
async function syncSpeakerRegistration(
  sb: ReturnType<typeof createServiceClient>,
  speakerId: string,
  eventId: string,
  name: string,
  wantRegistered: boolean,
): Promise<void> {
  const { data: existing } = await sb
    .from("attendees")
    .select("id")
    .eq("speaker_id", speakerId)
    .maybeSingle<{ id: string }>();

  const [first, ...rest] = name.trim().split(/\s+/);
  const firstName = first || name;
  const lastName = rest.join(" ") || null;

  if (wantRegistered && !existing) {
    const orderId = await speakerOrderId(sb, eventId);
    const { data: tt } = await sb
      .from("ticket_types")
      .select("id")
      .eq("event_id", eventId)
      .eq("key", "speaker_pass")
      .maybeSingle<{ id: string }>();
    if (!orderId || !tt) return;
    const { data: att } = await sb
      .from("attendees")
      .insert({
        order_id: orderId,
        ticket_type_id: tt.id,
        speaker_id: speakerId,
        first_name: firstName,
        last_name: lastName,
      })
      .select("id")
      .single();
    if (att)
      await sb.from("tickets").insert({
        order_id: orderId,
        attendee_id: att.id,
        ticket_type_id: tt.id,
        event_id: eventId,
      });
  } else if (!wantRegistered && existing) {
    await sb.from("attendees").delete().eq("id", existing.id); // cascades ticket
  } else if (existing) {
    // Keep the pass name in sync with the speaker record.
    await sb
      .from("attendees")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", existing.id);
  }
}

/** Delete a speaker (also unlinks their sessions via FK cascade). Admin. */
export async function deleteSpeaker(id: string): Promise<SpeakerResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const sb = createServiceClient();
  const { error } = await sb.from("speakers").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the speaker." };
  revalidatePath("/admin/speakers");
  return { ok: true };
}
