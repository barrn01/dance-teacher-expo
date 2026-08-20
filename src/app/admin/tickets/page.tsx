import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_SLUG } from "@/lib/tickets";
import type { TicketType } from "@/lib/types";
import { TicketTypeEditor } from "@/components/admin/TicketTypeEditor";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle();

  const { data: types } = event
    ? await sb
        .from("ticket_types")
        .select("*")
        .eq("event_id", event.id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const ticketTypes = (types ?? []) as TicketType[];

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Orders
        </Link>
        <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.2rem)]">
          Ticket types &amp; pricing
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink/55">
          Edits apply to new orders immediately. Existing orders are unaffected.
        </p>
      </div>

      {ticketTypes.length === 0 ? (
        <p className="rounded-[12px] border border-black/10 bg-white px-4 py-10 text-center text-ink/50">
          No ticket types found.
        </p>
      ) : (
        ticketTypes.map((tt) => <TicketTypeEditor key={tt.id} tt={tt} />)
      )}
    </div>
  );
}
