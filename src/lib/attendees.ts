import "server-only";
import { createServiceClient } from "./supabase/server";
import type { AttendeeType } from "./attendee-config";

export type AttendeeListRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  type: AttendeeType;
  ticket_status: string | null;
  ticket_type_name: string | null;
  company: string | null; // vendor company (vendor staff)
  buyer_name: string | null; // purchaser (ticket holders)
  order_id: string | null;
  speaker_id: string | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

function typeOf(kind: string | null): AttendeeType {
  if (kind === "vendor_staff") return "vendor_staff";
  if (kind === "speaker") return "speaker";
  return "ticket_holder";
}

/** The master attendee list — everyone registered, with server-side filters. */
export async function listAttendees(opts: {
  type?: AttendeeType | "all";
  category?: string;
  q?: string;
} = {}): Promise<AttendeeListRow[]> {
  const sb = createServiceClient();
  let query = sb
    .from("attendees")
    .select(
      "id, first_name, last_name, email, phone, category, speaker_id, order_id, tickets(status), ticket_types(name), orders!inner(buyer_name, registration_kind, vendors(company_name))",
    )
    .order("first_name", { ascending: true })
    .limit(1000);

  if (opts.type === "ticket_holder")
    query = query.is("orders.registration_kind", null);
  else if (opts.type === "vendor_staff")
    query = query.eq("orders.registration_kind", "vendor_staff");
  else if (opts.type === "speaker")
    query = query.eq("orders.registration_kind", "speaker");

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.q) {
    const q = opts.q.replace(/[%,()*]/g, "").trim();
    if (q)
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
      );
  }

  const { data } = await query;
  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    category: string | null;
    speaker_id: string | null;
    order_id: string | null;
    tickets: { status: string } | { status: string }[] | null;
    ticket_types: { name: string } | { name: string }[] | null;
    orders:
      | {
          buyer_name: string | null;
          registration_kind: string | null;
          vendors: { company_name: string } | { company_name: string }[] | null;
        }
      | {
          buyer_name: string | null;
          registration_kind: string | null;
          vendors: { company_name: string } | { company_name: string }[] | null;
        }[]
      | null;
  };

  return ((data ?? []) as Row[]).map((r) => {
    const o = one(r.orders);
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      phone: r.phone,
      category: r.category,
      type: typeOf(o?.registration_kind ?? null),
      ticket_status: one(r.tickets)?.status ?? null,
      ticket_type_name: one(r.ticket_types)?.name ?? null,
      company: one(o?.vendors ?? null)?.company_name ?? null,
      buyer_name: o?.buyer_name ?? null,
      order_id: r.order_id,
      speaker_id: r.speaker_id,
    };
  });
}

/** Counts by type for the summary tiles. */
export async function attendeeCounts(): Promise<{
  ticket_holder: number;
  vendor_staff: number;
  speaker: number;
  total: number;
}> {
  const sb = createServiceClient();
  const head = (kind: "vendor_staff" | "speaker" | null) => {
    let q = sb
      .from("attendees")
      .select("id, orders!inner(registration_kind)", {
        count: "exact",
        head: true,
      });
    q = kind
      ? q.eq("orders.registration_kind", kind)
      : q.is("orders.registration_kind", null);
    return q;
  };
  const [th, vs, sp] = await Promise.all([head(null), head("vendor_staff"), head("speaker")]);
  const ticket_holder = th.count ?? 0;
  const vendor_staff = vs.count ?? 0;
  const speaker = sp.count ?? 0;
  return {
    ticket_holder,
    vendor_staff,
    speaker,
    total: ticket_holder + vendor_staff + speaker,
  };
}
