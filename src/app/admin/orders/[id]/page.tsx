import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { formatAud } from "@/lib/pricing";
import { RefundPanel } from "@/components/admin/RefundPanel";

export const dynamic = "force-dynamic";

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink/45">
        {label}
      </div>
      <div className="mt-0.5 text-[0.95rem] text-ink">{value || "—"}</div>
    </div>
  );
}

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { id } = await params;
  const sb = createServiceClient();

  const { data: order } = await sb
    .from("orders")
    .select(
      "id, order_number, status, buyer_name, buyer_email, buyer_phone, subtotal_cents, discount_cents, total_cents, amount_refunded_cents, currency, stripe_payment_intent_id, metadata, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const [{ data: tickets }, { data: items }] = await Promise.all([
    sb
      .from("tickets")
      .select(
        "qr_token, status, attendee:attendees(first_name, last_name, email, phone), ticket_type:ticket_types(name)",
      )
      .eq("order_id", id),
    sb
      .from("order_items")
      .select("quantity, unit_price_cents, line_total_cents, ticket_type:ticket_types(name)")
      .eq("order_id", id),
  ]);

  const meta = (order.metadata ?? {}) as {
    details_deferred?: boolean;
    attribution?: Record<string, string | null>;
  };
  const attr = meta.attribution ?? {};

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Orders
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">
            {order.order_number}
          </h1>
          <span className="text-[0.85rem] text-ink/55">
            {fmtDate(order.created_at)}
          </span>
        </div>
      </div>

      {/* Buyer + payment */}
      <div className="grid gap-4 rounded-[12px] border border-black/10 bg-white p-5 sm:grid-cols-2">
        <Field label="Buyer" value={order.buyer_name} />
        <Field label="Status" value={order.status.replace(/_/g, " ")} />
        <Field label="Email" value={order.buyer_email} />
        <Field label="Phone" value={order.buyer_phone} />
        <Field
          label="Stripe payment intent"
          value={
            order.stripe_payment_intent_id ? (
              <span className="break-all font-mono text-[0.8rem]">
                {order.stripe_payment_intent_id}
              </span>
            ) : null
          }
        />
        <Field
          label="Attendee details"
          value={meta.details_deferred ? "Deferred by buyer" : "Provided"}
        />
      </div>

      {/* Totals */}
      <div className="rounded-[12px] border border-black/10 bg-white p-5">
        <div className="grid gap-2 text-[0.95rem]">
          {(items ?? []).map((it, i) => {
            const tt = one(
              it.ticket_type as { name: string } | { name: string }[] | null,
            );
            return (
              <div key={i} className="flex justify-between">
                <span className="text-ink/70">
                  {tt?.name ?? "Ticket"} × {it.quantity}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatAud(it.line_total_cents)}
                </span>
              </div>
            );
          })}
          <div className="mt-1 flex justify-between border-t border-black/10 pt-2">
            <span className="font-bold">Total</span>
            <span className="font-extrabold tabular-nums">
              {formatAud(order.total_cents)} {order.currency}
            </span>
          </div>
          {order.amount_refunded_cents > 0 && (
            <div className="flex justify-between text-orange-700">
              <span className="font-bold">Refunded</span>
              <span className="font-extrabold tabular-nums">
                −{formatAud(order.amount_refunded_cents)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Refund (only when there's something to refund) */}
      {(order.status === "paid" || order.status === "partially_refunded") &&
        order.total_cents - order.amount_refunded_cents > 0 && (
          <RefundPanel
            orderId={order.id}
            totalCents={order.total_cents}
            amountRefundedCents={order.amount_refunded_cents}
            currency={order.currency}
          />
        )}

      {/* Tickets / attendees */}
      <div className="rounded-[12px] border border-black/10 bg-white p-5">
        <h2 className="mb-3 text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Tickets ({tickets?.length ?? 0})
        </h2>
        <div className="grid gap-2">
          {(tickets ?? []).map((t, i) => {
            const a = one(
              t.attendee as
                | {
                    first_name: string | null;
                    last_name: string | null;
                    email: string | null;
                    phone: string | null;
                  }
                | {
                    first_name: string | null;
                    last_name: string | null;
                    email: string | null;
                    phone: string | null;
                  }[]
                | null,
            );
            const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ");
            return (
              <div
                key={t.qr_token}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-paper-2 px-3.5 py-2.5"
              >
                <div>
                  <div className="font-semibold text-ink">
                    {name || (
                      <span className="text-pink">Not assigned yet</span>
                    )}
                  </div>
                  <div className="text-[0.8rem] text-ink/55">
                    {a?.email || "no email"}
                    {a?.phone ? ` · ${a.phone}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[0.72rem] text-ink/45">
                    {t.qr_token.slice(0, 12)}…
                  </div>
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-ink/40">
                    Ticket {i + 1} · {t.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribution (for debugging tracking) */}
      <details className="rounded-[12px] border border-black/10 bg-white p-5">
        <summary className="cursor-pointer text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Tracking attribution
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="fbp" value={attr.fbp} />
          <Field label="fbc" value={attr.fbc} />
          <Field label="Client IP" value={attr.ip} />
          <Field
            label="Landing URL"
            value={
              attr.url ? (
                <span className="break-all text-[0.8rem]">{attr.url}</span>
              ) : null
            }
          />
        </div>
      </details>
    </div>
  );
}
