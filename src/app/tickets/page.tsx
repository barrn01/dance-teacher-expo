import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TicketSelector } from "@/components/TicketSelector";
import { WaitlistButton } from "@/components/WaitlistModal";
import { ViewContentTracker } from "@/components/PixelTrackers";
import { getEventWithTicketTypes } from "@/lib/tickets";

// Master on-sale switch. Tickets stay gated (waitlist only) until this is
// explicitly set to "true" in the environment — no code change to go live.
const TICKETS_ON_SALE = process.env.TICKETS_ON_SALE === "true";

export const metadata: Metadata = {
  title: "Get tickets — Dance Teacher Expo 2027",
  description:
    "Choose your Two Day All Access tickets for Dance Teacher Expo 2027. Group rate applies automatically as you add attendees.",
};

// Reads ticket config from Supabase per request (admin-editable).
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  // While gated, the page is a pure waitlist landing — never touch the DB, so
  // it can't be brought down by ticket-data availability.
  const data = TICKETS_ON_SALE ? await getEventWithTicketTypes() : null;
  const ticketTypes = data?.ticketTypes ?? [];
  const showSelector = TICKETS_ON_SALE && ticketTypes.length > 0;

  return (
    <>
      {showSelector && (
        <ViewContentTracker
          valueCents={ticketTypes[0].price_cents}
          currency={ticketTypes[0].currency ?? "AUD"}
          contentIds={ticketTypes.map((tt) => tt.key)}
        />
      )}
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="glow">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.5rem,7vw,4.5rem)] text-center">
            <p className="script mb-2 inline-block -rotate-2 text-[clamp(1.5rem,4vw,2.2rem)] text-ballet">
              {showSelector ? "Choose your tickets" : "Coming soon"}
            </p>
            <h1 className="display text-[clamp(2.3rem,10vw,5rem)]">
              Get Your Spot
              <br />
              In The Room
            </h1>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-char">
                Sat 17 &amp; Sun 18 April 2027
              </span>
              <span className="inline-flex items-center rounded-full border-2 border-white/35 px-4 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-white">
                Grand Pavilion · Rosehill Gardens
              </span>
            </div>
            <p className="mx-auto mt-6 max-w-[52ch] text-[1rem] leading-relaxed text-white/80">
              {showSelector
                ? "Two days, 50+ sessions, and the whole industry under one roof. Every ticket includes lunch both days, the Fashion Show and the Cocktail Party. Bringing your team? Buy 4 tickets and the 5th is on us."
                : "Two days, 50+ sessions, and the whole industry under one roof — lunch both days, the Fashion Show and the Cocktail Party all included. Join the waitlist to be first when tickets open."}
            </p>
          </div>
        </section>

        {/* Selection */}
        <section className="bg-paper text-ink">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.5rem,6vw,4.5rem)]">
            <div className="mx-auto mb-8 max-w-[560px] text-center">
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
                Tickets
              </span>
              <h2 className="display mt-2 text-[clamp(1.8rem,5vw,2.8rem)] text-ink">
                Pick your weekend
              </h2>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/70">
                {showSelector
                  ? "Prices in AUD, including GST. Add one attendee or your whole studio — buy 4 and the 5th is free."
                  : "Full weekend all access — both days, 50+ sessions, lunch, the Fashion Show and the Cocktail Party. Tickets open soon."}
              </p>
            </div>

            {showSelector ? (
              <TicketSelector ticketTypes={ticketTypes} />
            ) : (
              <div className="mx-auto max-w-[520px] rounded-[14px] border border-black/10 bg-white p-8 text-center">
                <h3 className="display text-[1.6rem] text-ink">
                  Tickets aren&apos;t on sale just yet
                </h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/70">
                  We&apos;re putting the finishing touches on ticketing. Join the
                  waitlist and you&apos;ll be first to know the moment they open.
                </p>
                <div className="mt-6 flex justify-center">
                  <WaitlistButton
                    variant="primary"
                    label="Join the ticket waitlist"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Closer */}
        <section className="glow bg-ink text-center">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.5rem,6vw,4rem)]">
            <span className="script text-[clamp(1.4rem,4vw,2rem)] text-ballet">
              See you at Rosehill
            </span>
            <div className="display mt-2 text-[clamp(1.8rem,8vw,4.5rem)]">
              17 &amp; 18 <span className="accent">April</span> 2027
            </div>
            <div className="text-[clamp(0.8rem,2vw,0.95rem)] font-bold uppercase tracking-[0.1em] text-white/80">
              Grand Pavilion · Rosehill Gardens · Sydney
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
