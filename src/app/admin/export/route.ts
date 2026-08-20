import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PostgREST may type an embedded to-one relation as an array — normalise.
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const dollars = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toFixed(2);

/** Sydney-local "YYYY-MM-DD HH:mm" for spreadsheet-friendly timestamps. */
const sydney = (iso: string | null) => {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

const csvResponse = (csv: string, filename: string) =>
  new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });

const STATUSES = [
  "paid",
  "pending",
  "refunded",
  "partially_refunded",
  "cancelled",
];

export async function GET(request: Request) {
  const gate = await getAdminGate();
  if (gate.status !== "admin")
    return new Response("Not authorised", { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "attendees" ? "attendees" : "orders";
  const today = sydney(new Date().toISOString()).slice(0, 10);
  const sb = createServiceClient();

  if (type === "attendees") {
    // Door check-in list: one row per attendee whose order has live tickets.
    const { data } = await sb
      .from("attendees")
      .select(
        "first_name, last_name, email, phone, category, created_at, tickets(qr_token, status), ticket_types(name), orders!inner(order_number, status, buyer_name, buyer_email, registration_kind, vendors(company_name))",
      )
      .in("orders.status", ["paid", "partially_refunded"])
      .order("created_at", { ascending: true });

    type CompanyEmbed = { company_name: string } | { company_name: string }[] | null;
    type Row = {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      category: string | null;
      tickets: { qr_token: string; status: string } | { qr_token: string; status: string }[] | null;
      ticket_types: { name: string } | { name: string }[] | null;
      orders:
        | { order_number: string; status: string; buyer_name: string | null; buyer_email: string; registration_kind: string | null; vendors: CompanyEmbed }
        | { order_number: string; status: string; buyer_name: string | null; buyer_email: string; registration_kind: string | null; vendors: CompanyEmbed }[]
        | null;
    };
    const typeLabel = (kind: string | null) =>
      kind === "vendor_staff"
        ? "Vendor staff"
        : kind === "speaker"
          ? "Speaker"
          : "Ticket holder";
    const catLabel: Record<string, string> = {
      studio_owner: "Studio Owner",
      teacher: "Teacher",
      admin: "Admin Superstar",
    };

    const rows: (string | number | null)[][] = [
      [
        "First name",
        "Last name",
        "Type",
        "Role",
        "Email",
        "Phone",
        "Ticket type",
        "Ticket status",
        "QR token",
        "Exhibitor",
        "Order",
        "Order status",
        "Buyer name",
        "Buyer email",
        "Details complete",
      ],
    ];
    for (const a of (data ?? []) as Row[]) {
      const t = one(a.tickets);
      const tt = one(a.ticket_types);
      const o = one(a.orders);
      const company = one(o?.vendors ?? null)?.company_name ?? "";
      const complete = a.first_name && a.last_name && a.email ? "yes" : "no";
      rows.push([
        a.first_name ?? "",
        a.last_name ?? "",
        typeLabel(o?.registration_kind ?? null),
        a.category ? (catLabel[a.category] ?? a.category) : "",
        a.email ?? "",
        a.phone ?? "",
        tt?.name ?? "",
        t?.status ?? "",
        t?.qr_token ?? "",
        company,
        o?.order_number ?? "",
        o?.status ?? "",
        o?.buyer_name ?? "",
        o?.buyer_email ?? "",
        complete,
      ]);
    }
    return csvResponse(toCsv(rows), `dte-attendees-${today}.csv`);
  }

  // Orders export — honours the same status/q filters as the orders page.
  const status = url.searchParams.get("status") ?? "all";
  const q = (url.searchParams.get("q") ?? "").replace(/[%,()*]/g, "").trim();

  let query = sb
    .from("orders")
    .select(
      "order_number, created_at, status, buyer_name, buyer_email, buyer_phone, subtotal_cents, discount_cents, total_cents, amount_refunded_cents, currency, metadata, stripe_payment_intent_id, promo_codes(code), tickets(count)",
    )
    // Sales only — registration ($0) orders are excluded.
    .is("registration_kind", null)
    .order("created_at", { ascending: false });
  if (STATUSES.includes(status)) query = query.eq("status", status);
  if (q)
    query = query.or(
      `order_number.ilike.%${q}%,buyer_email.ilike.%${q}%,buyer_name.ilike.%${q}%`,
    );

  const { data } = await query;

  type OrderRow = {
    order_number: string;
    created_at: string;
    status: string;
    buyer_name: string | null;
    buyer_email: string;
    buyer_phone: string | null;
    subtotal_cents: number;
    discount_cents: number;
    total_cents: number;
    amount_refunded_cents: number;
    currency: string;
    metadata: { comp?: boolean } | null;
    stripe_payment_intent_id: string | null;
    promo_codes: { code: string } | { code: string }[] | null;
    tickets: { count: number }[] | null;
  };

  const rows: (string | number | null)[][] = [
    [
      "Order",
      "Date (Sydney)",
      "Status",
      "Buyer name",
      "Buyer email",
      "Buyer phone",
      "Tickets",
      "Subtotal",
      "Discount",
      "Promo code",
      "Total",
      "Refunded",
      "Currency",
      "Comp",
      "Stripe payment intent",
    ],
  ];
  for (const o of (data ?? []) as OrderRow[]) {
    rows.push([
      o.order_number,
      sydney(o.created_at),
      o.status,
      o.buyer_name ?? "",
      o.buyer_email,
      o.buyer_phone ?? "",
      o.tickets?.[0]?.count ?? 0,
      dollars(o.subtotal_cents),
      dollars(o.discount_cents),
      one(o.promo_codes)?.code ?? "",
      dollars(o.total_cents),
      dollars(o.amount_refunded_cents),
      o.currency,
      o.metadata?.comp ? "yes" : "",
      o.stripe_payment_intent_id ?? "",
    ]);
  }
  return csvResponse(toCsv(rows), `dte-orders-${today}.csv`);
}
