import "server-only";
import { createServiceClient } from "./supabase/server";
import type { EventRow, TicketType } from "./types";

export const EVENT_SLUG = "dte-2027";

export type EventWithTickets = {
  event: EventRow;
  ticketTypes: TicketType[];
};

/** Load an event and its active ticket types (ordered), or null if missing. */
export async function getEventWithTicketTypes(
  slug: string = EVENT_SLUG,
): Promise<EventWithTickets | null> {
  const sb = createServiceClient();

  const { data: event, error: eventError } = await sb
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event) return null;

  const { data: ticketTypes, error: ttError } = await sb
    .from("ticket_types")
    .select("*")
    .eq("event_id", event.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (ttError) throw ttError;

  return {
    event: event as EventRow,
    ticketTypes: (ticketTypes ?? []) as TicketType[],
  };
}
