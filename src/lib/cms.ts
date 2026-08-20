import "server-only";
import { createServiceClient } from "./supabase/server";
import { EVENT_SLUG } from "./tickets";
import type { Speaker } from "./types";

export const SPEAKER_BUCKET = "speaker-photos";

// Re-export client-safe config for server code.
export {
  SESSION_TYPES,
  SESSION_TYPE_LABEL,
  STREAMS,
  STREAM_LABEL,
  EVENT_DAYS,
  DAY_LABEL,
  type SessionType,
  type Stream,
} from "./cms-config";

/** Vendors as {id, company_name} for the speaker→vendor link dropdown. */
export async function listVendorOptions(): Promise<
  { id: string; company_name: string }[]
> {
  const sb = createServiceClient();
  const eventId = await getEventId();
  if (!eventId) return [];
  const { data } = await sb
    .from("vendors")
    .select("id, company_name")
    .eq("event_id", eventId)
    .order("company_name", { ascending: true });
  return (data ?? []) as { id: string; company_name: string }[];
}

/** The Phase-1 event id (single event for now). */
export async function getEventId(): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** All speakers for the event (admin — includes inactive), ordered. */
export async function listSpeakers(): Promise<Speaker[]> {
  const sb = createServiceClient();
  const eventId = await getEventId();
  if (!eventId) return [];
  const { data } = await sb
    .from("speakers")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as Speaker[];
}

/** Whether a speaker is registered (has an attendee/check-in pass). */
export async function isSpeakerRegistered(speakerId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { count } = await sb
    .from("attendees")
    .select("id", { count: "exact", head: true })
    .eq("speaker_id", speakerId);
  return (count ?? 0) > 0;
}

export async function getSpeaker(id: string): Promise<Speaker | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("speakers")
    .select("*")
    .eq("id", id)
    .maybeSingle<Speaker>();
  return data ?? null;
}

/** All rooms for the event, ordered. */
export async function listRooms(): Promise<import("./types").Room[]> {
  const sb = createServiceClient();
  const eventId = await getEventId();
  if (!eventId) return [];
  const { data } = await sb
    .from("rooms")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as import("./types").Room[];
}

export type AdminSession = import("./types").SessionRow & {
  room_name: string | null;
  speaker_names: string[];
};

// PostgREST may type an embedded to-one relation as an array — normalise.
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** All sessions with room name + speaker names (admin list), day/time ordered. */
export async function listSessions(): Promise<AdminSession[]> {
  const sb = createServiceClient();
  const eventId = await getEventId();
  if (!eventId) return [];
  const { data } = await sb
    .from("sessions")
    .select(
      "*, rooms(name), session_speakers(speaker_id, sort_order, speakers(name))",
    )
    .eq("event_id", eventId)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true });

  type Row = import("./types").SessionRow & {
    rooms: { name: string } | { name: string }[] | null;
    session_speakers:
      | { sort_order: number; speakers: { name: string } | { name: string }[] | null }[]
      | null;
  };
  return ((data ?? []) as Row[]).map((r) => {
    const links = [...(r.session_speakers ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return {
      ...r,
      room_name: one(r.rooms)?.name ?? null,
      speaker_names: links
        .map((l) => one(l.speakers)?.name)
        .filter((n): n is string => !!n),
    };
  });
}

/** One session with its linked speaker ids (for the edit form). */
export async function getSession(id: string): Promise<
  | (import("./types").SessionRow & { speaker_ids: string[] })
  | null
> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("sessions")
    .select("*, session_speakers(speaker_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as import("./types").SessionRow & {
    session_speakers: { speaker_id: string }[] | null;
  };
  return {
    ...row,
    speaker_ids: (row.session_speakers ?? []).map((s) => s.speaker_id),
  };
}

export type SpeakerSession = {
  id: string;
  title: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

/** Sessions a given speaker is linked to (for their edit page). */
export async function getSpeakerSessions(
  speakerId: string,
): Promise<SpeakerSession[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("session_speakers")
    .select("sessions(id, title, session_date, start_time, end_time)")
    .eq("speaker_id", speakerId);
  type Row = {
    sessions: SpeakerSession | SpeakerSession[] | null;
  };
  const rows = ((data ?? []) as Row[])
    .map((r) => one(r.sessions))
    .filter((s): s is SpeakerSession => !!s);
  return rows.sort((a, b) => {
    const d = (a.session_date ?? "").localeCompare(b.session_date ?? "");
    if (d !== 0) return d;
    return (a.start_time ?? "").localeCompare(b.start_time ?? "");
  });
}

/** Slug helper (shared shape with vendors). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
