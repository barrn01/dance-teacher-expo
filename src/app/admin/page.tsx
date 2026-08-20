import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { formatAud } from "@/lib/pricing";
import { summariseVendors } from "@/lib/vendors";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "paid",
  "pending",
  "refunded",
  "partially_refunded",
  "cancelled",
] as const;

const statusStyle: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  refunded: "bg-gray-200 text-gray-700",
  partially_refunded: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-200 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.04em] ${statusStyle[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string | null;
  buyer_email: string;
  total_cents: number;
  currency: string;
  created_at: string;
  metadata: { comp?: boolean } | null;
  tickets: { count: number }[] | null;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  });

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { q, status } = await searchParams;
  const activeStatus = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as string)
    : "all";
  // Strip characters that would break the PostgREST or() filter.
  const safeQ = (q ?? "").replace(/[%,()*]/g, "").trim();

  const sb = createServiceClient();

  // Registration orders (vendor staff, speakers) are $0 passes, not sales —
  // exclude them from the orders list and the sales metrics below.
  let query = sb
    .from("orders")
    .select(
      "id, order_number, status, buyer_name, buyer_email, total_cents, currency, created_at, metadata, tickets(count)",
    )
    .is("registration_kind", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (activeStatus !== "all") query = query.eq("status", activeStatus);
  if (safeQ)
    query = query.or(
      `order_number.ilike.%${safeQ}%,buyer_email.ilike.%${safeQ}%,buyer_name.ilike.%${safeQ}%`,
    );

  const [
    { data: orders },
    { data: paidRows },
    { count: ticketsSold },
    { data: vendorRows },
  ] = await Promise.all([
    query,
    sb
      .from("orders")
      .select("total_cents")
      .eq("status", "paid")
      .is("registration_kind", null),
    sb
      .from("tickets")
      .select("id, orders!inner(registration_kind)", {
        count: "exact",
        head: true,
      })
      .is("orders.registration_kind", null),
    sb.from("vendors").select("status, package_tier"),
  ]);

  const revenue = (paidRows ?? []).reduce((n, o) => n + o.total_cents, 0);
  const vendors = summariseVendors(
    (vendorRows ?? []) as Pick<Vendor, "status" | "package_tier">[],
  );
  const rows = (orders ?? []) as OrderRow[];

  const qs = (patch: { status?: string; q?: string }) => {
    const p = new URLSearchParams();
    const s = patch.status ?? activeStatus;
    const query = patch.q ?? safeQ;
    if (s && s !== "all") p.set("status", s);
    if (query) p.set("q", query);
    const str = p.toString();
    return str ? `/admin?${str}` : "/admin";
  };

  const ordersExportHref = (() => {
    const p = new URLSearchParams();
    if (activeStatus !== "all") p.set("status", activeStatus);
    if (safeQ) p.set("q", safeQ);
    const str = p.toString();
    return `/admin/export${str ? `?${str}` : ""}`;
  })();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={ordersExportHref}
            className="rounded-full border border-black/15 px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-ink/70 hover:border-ink hover:text-ink"
          >
            ↓ Orders CSV
          </a>
          <a
            href="/admin/export?type=attendees"
            className="rounded-full bg-ink px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-white hover:bg-char-2"
          >
            ↓ Attendees CSV
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Paid orders", value: (paidRows ?? []).length.toString() },
          { label: "Tickets sold", value: (ticketsSold ?? 0).toString() },
          { label: "Revenue", value: formatAud(revenue) },
          { label: "Signed vendors", value: vendors.signed.toString() },
          {
            label: "Committed (ex GST)",
            value: formatAud(vendors.committedExGstCents),
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border border-black/10 bg-white p-4"
          >
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink/45">
              {s.label}
            </div>
            <div className="display mt-1 text-[clamp(1.3rem,4vw,1.9rem)] text-ink">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin" className="flex-1 min-w-[220px]">
          {activeStatus !== "all" && (
            <input type="hidden" name="status" value={activeStatus} />
          )}
          <input
            name="q"
            defaultValue={safeQ}
            placeholder="Search order #, email or name…"
            className="w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2 text-[0.9rem] outline-none focus:border-pink"
          />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={qs({ status: s })}
              className={`rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] ${
                activeStatus === s
                  ? "bg-ink text-white"
                  : "border border-black/15 text-ink/60 hover:border-ink"
              }`}
            >
              {s.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
        <table className="w-full min-w-[680px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-black/10 text-left text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/45">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Tickets</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No orders match.
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-black/5 last:border-0 hover:bg-paper-2"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-bold text-pink hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    {o.metadata?.comp && (
                      <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-white">
                        Comp
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">
                      {o.buyer_name || "—"}
                    </div>
                    <div className="text-[0.8rem] text-ink/55">
                      {o.buyer_email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {o.tickets?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {formatAud(o.total_cents)}
                  </td>
                  <td className="px-4 py-3 text-[0.82rem] text-ink/60">
                    {fmtDate(o.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length >= 200 && (
        <p className="text-center text-[0.8rem] text-ink/45">
          Showing the most recent 200 orders.
        </p>
      )}
    </div>
  );
}
