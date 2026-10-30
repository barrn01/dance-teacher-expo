import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistButton } from "@/components/WaitlistModal";

export const metadata: Metadata = {
  title: "Last Year's Program — Dance Teacher Expo 2027",
  description:
    "A taste of DTE: the full 2026 program — 50+ sessions across Movement and Business tracks, led by the industry's most respected educators. See what Dance Teacher Expo 2027 has in store.",
};

// Reads TICKETS_ON_SALE at request time so the CTA stays in step with the rest
// of the site (waitlist while gated, buy once open).
export const dynamic = "force-dynamic";

const TICKET_CTA_CLASS =
  "inline-flex items-center rounded-full bg-pink px-8 py-4 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_12px_28px_rgba(226,52,128,0.35)] transition-transform hover:-translate-y-0.5";

const DAYS: { label: string; src: string; alt: string }[] = [
  {
    label: "Day One",
    src: "/media/schedule/dte-2026-day-1.png",
    alt: "Dance Teacher Expo 2026 Day One schedule — Movement and Business track sessions across the day.",
  },
  {
    label: "Day Two",
    src: "/media/schedule/dte-2026-day-2.png",
    alt: "Dance Teacher Expo 2026 Day Two schedule — Movement and Business track sessions across the day.",
  },
];

export default function SchedulePage() {
  const ticketsOnSale = process.env.TICKETS_ON_SALE === "true";

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="glow">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.5rem,7vw,4.5rem)] text-center">
            <p className="script mb-1 inline-block -rotate-2 text-[clamp(1.4rem,4vw,2rem)] text-ballet">
              A taste of DTE
            </p>
            <h1 className="display text-[clamp(2.2rem,9vw,4.6rem)]">
              Last Year&apos;s <span className="accent">Program</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[62ch] text-[1.02rem] leading-relaxed text-white/80">
              Here&apos;s the full schedule from DTE 2026 — two days, 50+
              sessions across our Movement and Business tracks, led by some of
              the industry&apos;s most respected educators and studio owners.
              It&apos;s the best way to picture what&apos;s in store for 2027 —
              only bigger, at our new home at Rosehill Gardens.
            </p>
          </div>
        </section>

        {/* ---------- Schedule images ---------- */}
        <section className="bg-paper text-ink">
          <div className="mx-auto w-[min(1140px,92vw)] space-y-14 py-[clamp(2.5rem,7vw,4.5rem)]">
            {DAYS.map((d) => (
              <figure key={d.src}>
                <h2 className="display mb-5 text-center text-[clamp(1.6rem,5vw,2.4rem)] text-ink">
                  {d.label}
                </h2>
                <a
                  href={d.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-black/10 shadow-[0_18px_45px_rgba(23,17,20,0.18)] transition-transform hover:-translate-y-0.5"
                >
                  <Image
                    src={d.src}
                    alt={d.alt}
                    width={2000}
                    height={1414}
                    sizes="(max-width: 1200px) 92vw, 1140px"
                    className="h-auto w-full"
                  />
                </a>
                <figcaption className="mt-3 text-center text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink/50">
                  Tap to view full size
                </figcaption>
              </figure>
            ))}
            <p className="text-center text-[0.9rem] text-ink/60">
              The 2026 program, shown as a guide — the 2027 schedule will be
              announced closer to the event.
            </p>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="glow bg-ink text-center">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.75rem,7vw,5rem)]">
            <h2 className="display text-[clamp(1.9rem,6vw,3.2rem)]">
              Be There In <span className="accent">2027</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] leading-relaxed text-white/75">
              Two full days, 50+ sessions, the Fashion Show and the Cocktail
              Party — all included on every ticket.
            </p>
            <div className="mt-8 flex justify-center">
              {ticketsOnSale ? (
                <Link href="/tickets" className={TICKET_CTA_CLASS}>
                  Get Your Tickets
                </Link>
              ) : (
                <WaitlistButton variant="primary" />
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
