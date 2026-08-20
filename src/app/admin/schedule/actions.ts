"use server";

import { revalidatePath } from "next/cache";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { getEventId, slugify } from "@/lib/cms";
import { SESSION_TYPES, EVENT_DAYS, STREAMS } from "@/lib/cms-config";
import { parseCsv } from "@/lib/csv";
import type { BulkResult, BulkRowResult } from "@/lib/bulk";

export type CmsResult = { ok: boolean; error?: string; id?: string };

// ---------- Rooms ----------

export async function createRoom(input: {
  name: string;
  level?: string;
  capacity?: string;
}): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Room name is required." };

  const eventId = await getEventId();
  if (!eventId) return { ok: false, error: "Event not found." };
  const cap = parseInt(input.capacity ?? "", 10);

  const sb = createServiceClient();
  const { error } = await sb.from("rooms").insert({
    event_id: eventId,
    name,
    level: input.level?.trim() || null,
    capacity: Number.isFinite(cap) && cap > 0 ? cap : null,
  });
  if (error) return { ok: false, error: "Could not create the room." };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function deleteRoom(id: string): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const sb = createServiceClient();
  // Sessions referencing the room have room_id set to null (FK on delete).
  const { error } = await sb.from("rooms").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the room." };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

// ---------- Sessions ----------

export async function createSession(title: string): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const t = title.trim();
  if (!t) return { ok: false, error: "Session title is required." };

  const eventId = await getEventId();
  if (!eventId) return { ok: false, error: "Event not found." };
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("sessions")
    .insert({ event_id: eventId, title: t, slug: slugify(t) || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not create session." };
  revalidatePath("/admin/schedule");
  return { ok: true, id: data.id };
}

export async function updateSession(formData: FormData): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const id = String(formData.get("id") ?? "");
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const title = str("title");
  if (!title) return { ok: false, error: "Session title is required." };

  const type = str("session_type");
  const session_type = SESSION_TYPES.some((s) => s.key === type)
    ? type
    : "workshop";
  const dateVal = str("session_date");
  const session_date = EVENT_DAYS.some((d) => d.date === dateVal)
    ? dateVal
    : null;
  const streamVal = str("stream");
  const stream = STREAMS.some((s) => s.key === streamVal) ? streamVal : null;
  const roomId = str("room_id");
  const sortRaw = parseInt(str("sort_order"), 10);

  const sb = createServiceClient();
  const { error } = await sb
    .from("sessions")
    .update({
      title,
      description: str("description") || null,
      session_type,
      stream,
      room_id: roomId || null,
      session_date,
      start_time: str("start_time") || null,
      end_time: str("end_time") || null,
      is_featured: formData.get("is_featured") === "on",
      is_published: formData.get("is_published") === "on",
      sort_order: Number.isFinite(sortRaw) ? sortRaw : 0,
    })
    .eq("id", id);
  if (error) {
    console.error("[admin] updateSession failed", error);
    return { ok: false, error: "Could not save the session." };
  }

  // Reconcile speaker links: clear then insert the selected set.
  const speakerIds = formData.getAll("speaker_ids").map(String).filter(Boolean);
  await sb.from("session_speakers").delete().eq("session_id", id);
  if (speakerIds.length > 0) {
    const rows = speakerIds.map((speaker_id, i) => ({
      session_id: id,
      speaker_id,
      sort_order: i,
    }));
    const { error: linkErr } = await sb.from("session_speakers").insert(rows);
    if (linkErr) console.error("[admin] session_speakers insert failed", linkErr);
  }

  revalidatePath("/admin/schedule");
  revalidatePath(`/admin/schedule/${id}`);
  return { ok: true, id };
}

/** Clone a session (fields + speaker links) as a new draft-friendly copy. */
export async function duplicateSession(id: string): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const sb = createServiceClient();

  const { data: src } = await sb
    .from("sessions")
    .select(
      "event_id, title, description, session_type, stream, room_id, session_date, start_time, end_time, is_featured, is_published, sort_order, session_speakers(speaker_id, sort_order)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!src) return { ok: false, error: "Session not found." };

  const links =
    (src.session_speakers as { speaker_id: string; sort_order: number }[] | null) ??
    [];
  const {
    session_speakers: _omit,
    ...fields
  } = src as Record<string, unknown> & { session_speakers?: unknown };
  void _omit;

  const { data: copy, error } = await sb
    .from("sessions")
    .insert({
      ...fields,
      title: `${src.title} (copy)`,
      slug: null,
    })
    .select("id")
    .single();
  if (error || !copy) return { ok: false, error: "Could not duplicate." };

  if (links.length > 0) {
    await sb.from("session_speakers").insert(
      links.map((l) => ({
        session_id: copy.id,
        speaker_id: l.speaker_id,
        sort_order: l.sort_order,
      })),
    );
  }

  revalidatePath("/admin/schedule");
  return { ok: true, id: copy.id };
}

export async function deleteSession(id: string): Promise<CmsResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const sb = createServiceClient();
  const { error } = await sb.from("sessions").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the session." };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

/** Map a free-text day cell to one of the two event dates. */
function matchDay(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const exact = EVENT_DAYS.find((d) => d.date === t);
  if (exact) return exact.date;
  if (t.includes("sat") || t.includes("17")) return EVENT_DAYS[0].date;
  if (t.includes("sun") || t.includes("18")) return EVENT_DAYS[1].date;
  return null;
}

/** Normalise a time cell to "HH:MM" (24h) or null. */
function matchTime(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0");
  return `${h}:${m[2]}`;
}

/**
 * Bulk-create sessions from CSV (admin). Columns (header optional, matched by
 * name or position): title, type, stream, day, start, end, room, description.
 * Room is matched to an existing room by name; speakers are linked in the UI.
 */
export async function createSessionsBulk(csv: string): Promise<BulkResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin")
    return { ok: false, error: "Not authorised.", created: 0, failed: 0, results: [] };

  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0)
    return { ok: false, error: "The file is empty.", created: 0, failed: 0, results: [] };

  let cols = { title: 0, type: 1, stream: 2, day: 3, start: 4, end: 5, room: 6, description: 7 };
  let start = 0;
  const first = rows[0].map((c) => c.trim().toLowerCase());
  if (first.includes("title")) {
    const f = (names: string[]) => first.findIndex((h) => names.includes(h));
    cols = {
      title: f(["title", "session", "name"]),
      type: f(["type", "session_type"]),
      stream: f(["stream", "track"]),
      day: f(["day", "date"]),
      start: f(["start", "start_time", "from"]),
      end: f(["end", "end_time", "to"]),
      room: f(["room", "location"]),
      description: f(["description", "desc"]),
    };
    start = 1;
  }
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const eventId = await getEventId();
  if (!eventId)
    return { ok: false, error: "Event not found.", created: 0, failed: 0, results: [] };
  const sb = createServiceClient();

  // Room name → id (case-insensitive).
  const { data: roomRows } = await sb
    .from("rooms")
    .select("id, name")
    .eq("event_id", eventId);
  const roomByName = new Map(
    (roomRows ?? []).map((r) => [r.name.trim().toLowerCase(), r.id]),
  );

  const results: BulkRowResult[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const title = cell(r, cols.title);
    if (!title) {
      results.push({ line, label: "", ok: false, error: "Missing title." });
      continue;
    }
    const typeRaw = cell(r, cols.type).toLowerCase();
    const session_type =
      SESSION_TYPES.find(
        (s) => s.key === typeRaw || s.label.toLowerCase() === typeRaw,
      )?.key ?? "workshop";
    const streamRaw = cell(r, cols.stream).toLowerCase();
    const stream =
      STREAMS.find((s) => s.key === streamRaw || s.label.toLowerCase() === streamRaw)
        ?.key ?? null;
    const roomName = cell(r, cols.room).toLowerCase();
    const room_id = roomName ? (roomByName.get(roomName) ?? null) : null;

    const { error } = await sb.from("sessions").insert({
      event_id: eventId,
      title,
      slug: slugify(title) || null,
      description: cell(r, cols.description) || null,
      session_type,
      stream,
      room_id,
      session_date: matchDay(cell(r, cols.day)),
      start_time: matchTime(cell(r, cols.start)),
      end_time: matchTime(cell(r, cols.end)),
    });
    if (error) {
      results.push({ line, label: title, ok: false, error: "Database error." });
      continue;
    }
    results.push({ line, label: title, ok: true });
  }

  const created = results.filter((x) => x.ok).length;
  if (created > 0) revalidatePath("/admin/schedule");
  return { ok: true, created, failed: results.length - created, results };
}
