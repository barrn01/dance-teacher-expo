import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PurchaseTracker } from "@/components/PixelTrackers";
import { GaPurchase } from "@/components/GaEcommerce";
import type { EcommerceItem } from "@/lib/dataLayer";
import { priceBreakdown } from "@/lib/pricing";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Order confirmed — Dance Teacher Expo 2027",
};

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; order?: string }>;
}) {
  const { payment_intent, order } = await searchParams;

  let orderNumber = order ?? null;
  let status: string | null = null;
  let email: string | null = null;
  let ticketCount = 0;
  let totalCents = 0;
  let currency = "AUD";
  let contentIds: string[] = [];
  let gaItems: EcommerceItem[] = [];

  if (payment_intent) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("orders")
      .select("id, order_number, status, buyer_email, total_cents, currency")
      .eq("stripe_payment_intent_id", payment_intent)
      .maybeSingle();
    if (data) {
      orderNumber = data.order_number;
      status = data.status;
      email = data.buyer_email;
      totalCents = data.total_cents;
      currency = data.currency ?? "AUD";
      const { count } = await sb
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("order_id", data.id);
      ticketCount = count ?? 0;
      const { data: its } = await sb
        .from("order_items")
        .select("quantity, unit_price_cents, ticket_type:ticket_types(key, name)")
        .eq("order_id", data.id);
      type OrderItemRow = {
        quantity: number;
        unit_price_cents: number | null;
        ticket_type:
          | { key: string; name: string }
          | { key: string; name: string }[]
          | null;
      };
      const rows = (its ?? []) as OrderItemRow[];
      const ticketTypeOf = (r: OrderItemRow) =>
        Array.isArray(r.ticket_type) ? r.ticket_type[0] : r.ticket_type;
      // Sum quantities as a fallback for numItems when no tickets issued yet.
      const qtySum = rows.reduce((n, r) => n + (r.quantity ?? 0), 0);
      if (ticketCount === 0) ticketCount = qtySum;
      contentIds = Array.from(
        new Set(
          rows.map((r) => ticketTypeOf(r)?.key).filter((k): k is string => !!k),
        ),
      );
      // GA4 ecommerce items (item_name = ticket type name, per Soup's spec).
      // Recompute the blended marginal per-ticket price from the pricing rules
      // so item prices stay accurate for multi-ticket orders (buy-4-get-5th-free,
      // $249 from the 6th) — order_items stores only the base $329 unit price.
      const ev = await getEventWithTicketTypes();
      const ttByKey = new Map((ev?.ticketTypes ?? []).map((t) => [t.key, t]));
      gaItems = rows
        .map((r): EcommerceItem | null => {
          const t = ticketTypeOf(r);
          if (!t) return null;
          const qty = r.quantity ?? 1;
          const tt = ttByKey.get(t.key);
          const blendedCents = tt
            ? Math.round(priceBreakdown(tt, qty).subtotalCents / Math.max(1, qty))
            : (r.unit_price_cents ?? 0);
          return {
            item_id: t.key,
            item_name: t.name ?? t.key,
            quantity: qty,
            price: blendedCents / 100,
          };
        })
        .filter((x): x is EcommerceItem => x !== null);
    }
  }

  const paid = status === "paid";

  return (
    <>
      {orderNumber && payment_intent && (
        <>
          <PurchaseTracker
            orderNumber={orderNumber}
            valueCents={totalCents}
            currency={currency}
            numItems={ticketCount}
            contentIds={contentIds}
          />
          <GaPurchase
            transactionId={orderNumber}
            valueCents={totalCents}
            currency={currency}
            items={gaItems}
          />
        </>
      )}
      <SiteHeader />

      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[560px] py-[clamp(3rem,8vw,5rem)] text-center">
          <p className="script text-[clamp(1.6rem,4vw,2.2rem)] text-pink">
            You&apos;re in!
          </p>
          <h1 className="display mt-1 text-[clamp(2.2rem,7vw,3.4rem)] text-ink">
            See You At Rosehill
          </h1>

          <div className="relative mt-6 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6 text-left">
            <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
            {orderNumber && (
              <p className="text-[0.82rem] font-bold uppercase tracking-[0.12em] text-ink/55">
                Order {orderNumber}
              </p>
            )}
            <p className="mt-3 leading-relaxed text-ink/75">
              {paid ? (
                <>
                  Payment received — {ticketCount > 0 ? `${ticketCount} ` : ""}
                  ticket{ticketCount === 1 ? "" : "s"} confirmed. Your QR
                  ticket{ticketCount === 1 ? "" : "s"}{" "}
                  {ticketCount === 1 ? "is" : "are"} on the way to{" "}
                  <span className="font-bold text-ink">{email}</span>.
                </>
              ) : (
                <>
                  Thanks — your payment is being confirmed. Your QR tickets will
                  arrive by email at{" "}
                  <span className="font-bold text-ink">
                    {email ?? "your inbox"}
                  </span>{" "}
                  within a few minutes.
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-[0.85rem] text-ink/55">
            Sat 17 &amp; Sun 18 April 2027 · Grand Pavilion, Rosehill Gardens,
            Sydney
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/account"
              className="inline-flex items-center rounded-full bg-pink px-7 py-3.5 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot"
            >
              Manage your tickets
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-ink px-7 py-3.5 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-char-2"
            >
              Done
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
