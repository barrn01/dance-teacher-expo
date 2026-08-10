import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CheckoutForm, type CheckoutSummary } from "@/components/CheckoutForm";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { computeOrder, parseItemsParam } from "@/lib/order";

export const metadata: Metadata = {
  title: "Checkout — Dance Teacher Expo 2027",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const { items } = await searchParams;
  const selection = parseItemsParam(items);
  const data = await getEventWithTicketTypes();
  const order = data
    ? computeOrder(data.ticketTypes, selection)
    : { lines: [], totalQuantity: 0, subtotalCents: 0, totalCents: 0, savingsCents: 0, currency: "AUD" };

  const summary: CheckoutSummary = {
    lines: order.lines.map((l) => ({
      name: l.ticketType.name,
      quantity: l.breakdown.quantity,
      segments: l.breakdown.segments,
      subtotalCents: l.breakdown.subtotalCents,
    })),
    totalQuantity: order.totalQuantity,
    totalCents: order.totalCents,
    savingsCents: order.savingsCents,
    currency: order.currency,
  };

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[560px] py-[clamp(2.5rem,7vw,4.5rem)]">
          <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
            Checkout
          </span>
          <h1 className="display mt-2 mb-6 text-[clamp(2rem,7vw,3rem)] text-ink">
            Almost there
          </h1>

          {summary.totalQuantity === 0 ? (
            <div className="rounded-[14px] border border-black/10 bg-white p-6">
              <p className="text-ink/70">
                Your selection is empty.{" "}
                <Link href="/tickets" className="font-bold text-pink underline">
                  Choose your tickets
                </Link>
                .
              </p>
            </div>
          ) : (
            <CheckoutForm
              publishableKey={publishableKey}
              itemsParam={items ?? ""}
              summary={summary}
            />
          )}

          <div className="mt-6 text-center">
            <Link
              href="/tickets"
              className="text-[0.85rem] font-bold uppercase tracking-[0.08em] text-ink/60 underline hover:text-ink"
            >
              ← Back to tickets
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
