import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TicketSelector } from "@/components/TicketSelector";
import { getEventWithTicketTypes } from "@/lib/tickets";

export const metadata: Metadata = {
  title: "Get tickets — Dance Teacher Expo 2027",
  description:
    "Choose your Two Day All Access tickets for Dance Teacher Expo 2027. Group rate applies automatically as you add attendees.",
};

// Reads ticket config from Supabase per request (admin-editable).
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const data = await getEventWithTicketTypes();
  const ticketTypes = data?.ticketTypes ?? [];

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="glow">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.5rem,7vw,4.5rem)] text-center">
            <p className="script mb-2 inline-block -rotate-2 text-[clamp(1.5rem,4vw,2.2rem)] text-ballet">
              Choose your tickets
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
              Two days, 50+ sessions, and the whole industry under one roof.
              Every ticket includes lunch both days, the Fashion Show and the
              Cocktail Party. Bringing your team? Buy 4 tickets and the 5th is
              on us.
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
                Prices in AUD, including GST. Add one attendee or your whole
                studio — buy 4 and the 5th is free.
              </p>
            </div>

            {ticketTypes.length > 0 ? (
              <TicketSelector ticketTypes={ticketTypes} />
            ) : (
              <div className="mx-auto max-w-[520px] rounded-[14px] border border-black/10 bg-white p-8 text-center">
                <h3 className="display text-[1.6rem] text-ink">
                  Tickets aren&apos;t on sale just yet
                </h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/70">
                  We&apos;re putting the finishing touches on ticketing. Check
                  back very soon — or follow{" "}
                  <a
                    href="https://danceteacherexpo.com.au"
                    className="font-bold text-pink underline"
                  >
                    danceteacherexpo.com.au
                  </a>{" "}
                  for the on-sale date.
                </p>
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
