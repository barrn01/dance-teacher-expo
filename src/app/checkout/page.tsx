import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { formatAud, priceBreakdown } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Checkout — Dance Teacher Expo 2027",
};

export const dynamic = "force-dynamic";

// Parses "key:qty,key:qty" from the ?items= param.
function parseItems(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [key, qty] = part.split(":");
    const n = Number(qty);
    if (key && Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const { items } = await searchParams;
  const selection = parseItems(items);
  const data = await getEventWithTicketTypes();
  const ticketTypes = data?.ticketTypes ?? [];

  const lines = ticketTypes
    .filter((tt) => (selection[tt.key] ?? 0) > 0)
    .map((tt) => ({ tt, ...priceBreakdown(tt, selection[tt.key]) }));

  const totalCents = lines.reduce((sum, l) => sum + l.subtotalCents, 0);
  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const savingsCents = lines.reduce((sum, l) => sum + l.savingsCents, 0);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[560px] py-[clamp(2.5rem,7vw,4.5rem)]">
          <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
            Checkout
          </span>
          <h1 className="display mt-2 text-[clamp(2rem,7vw,3rem)] text-ink">
            Almost there
          </h1>

          {lines.length === 0 ? (
            <div className="mt-6 rounded-[14px] border border-black/10 bg-white p-6">
              <p className="text-ink/70">
                Your selection is empty.{" "}
                <Link href="/tickets" className="font-bold text-pink underline">
                  Choose your tickets
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="relative mt-6 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
                <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
                <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
                  Order summary
                </h2>
                <ul className="mt-4 grid gap-3">
                  {lines.map((l) => (
                    <li
                      key={l.tt.id}
                      className="flex items-baseline justify-between gap-3 border-b border-black/5 pb-3 last:border-0"
                    >
                      <span>
                        <span className="font-bold text-ink">{l.tt.name}</span>
                        <span className="block text-[0.82rem] text-ink/55">
                          {l.segments
                            .map((s) =>
                              s.unitPriceCents === 0
                                ? `${s.count} free`
                                : `${s.count} × ${formatAud(s.unitPriceCents)}`,
                            )
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="font-extrabold text-ink">
                        {formatAud(l.subtotalCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                  <span className="text-[0.9rem] font-bold uppercase tracking-[0.08em] text-ink/60">
                    Total · {totalQty} attendee{totalQty === 1 ? "" : "s"}
                  </span>
                  <span className="display text-[2rem] leading-none text-ink">
                    {formatAud(totalCents)}
                  </span>
                </div>
                {savingsCents > 0 && (
                  <p className="mt-1 text-right text-[0.82rem] font-bold text-pink">
                    You saved {formatAud(savingsCents)}
                  </p>
                )}
              </div>

              {/* Placeholder for the Stripe Payment Element (Phase 1, step 4) */}
              <div className="mt-5 rounded-[14px] border border-dashed border-pink/40 bg-paper-2 p-6 text-center">
                <p className="text-[0.9rem] font-bold text-ink">
                  Secure card payment is coming next.
                </p>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-ink/65">
                  This is where the Stripe Payment Element and attendee details
                  will live — card details are entered on this page and never
                  touch our servers. Wiring it up is the next build step.
                </p>
              </div>
            </>
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
