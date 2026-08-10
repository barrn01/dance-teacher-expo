import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const MAIN_SITE = "https://danceteacherexpo.com.au";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="glow">
          <div className="mx-auto w-[min(1140px,92vw)] px-0 py-[clamp(3rem,8vw,5.5rem)] text-center">
            <p className="script mb-2 inline-block -rotate-2 text-[clamp(1.6rem,4vw,2.4rem)] text-ballet">
              Rosehill is calling
            </p>
            <h1 className="display text-[clamp(2.3rem,11vw,5.6rem)]">
              Tickets Are
              <br />
              <span className="accent">Coming Soon</span>
            </h1>

            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-char">
                Sat 17 &amp; Sun 18 April 2027
              </span>
              <span className="inline-flex items-center rounded-full border-2 border-white/35 px-4 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-white">
                Grand Pavilion · Rosehill Gardens
              </span>
            </div>

            <p className="mx-auto mt-7 max-w-[56ch] text-[1.02rem] leading-relaxed text-white/80">
              Australia&apos;s biggest professional development event for dance
              teachers and studio owners is back — bigger, and at a brand-new
              home. Two full days, 50+ sessions, the Fashion Show and the
              Cocktail Party. Ticket sales open here soon.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <span className="inline-flex cursor-default items-center rounded-full bg-pink px-8 py-4 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_12px_28px_rgba(226,52,128,0.35)]">
                Tickets open soon
              </span>
              <a
                href={MAIN_SITE}
                className="inline-flex items-center rounded-full border-2 border-white/35 px-8 py-4 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:border-white"
              >
                Get updates
              </a>
            </div>

            <p className="mt-6 text-[0.82rem] uppercase tracking-[0.12em] text-white/55">
              Free onsite parking · Two full levels · New for 2027
            </p>
          </div>
        </section>

        {/* ---------- Stat strip ---------- */}
        <section className="bg-pink text-white">
          <div className="mx-auto grid w-[min(1140px,92vw)] grid-cols-1 gap-6 py-[clamp(1.8rem,4vw,2.6rem)] text-center sm:grid-cols-3 sm:gap-4">
            <div>
              <div className="display text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.9]">
                50+
              </div>
              <div className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/85">
                Sessions
              </div>
            </div>
            <div>
              <div className="display text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.9]">
                1,000+
              </div>
              <div className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/85">
                Dance educators
              </div>
            </div>
            <div>
              <div className="display text-[clamp(2.4rem,6vw,3.6rem)] leading-[0.9]">
                50+
              </div>
              <div className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/85">
                Exhibiting brands
              </div>
            </div>
          </div>
        </section>

        {/* ---------- New home (paper) ---------- */}
        <section className="bg-paper text-ink">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.75rem,7vw,5rem)] text-center">
            <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
              A new home
            </span>
            <h2 className="display mx-auto mt-2 max-w-[18ch] text-[clamp(2rem,5vw,3.1rem)] text-ink">
              We&apos;ve Moved To Rosehill Gardens
            </h2>
            <p className="mx-auto mt-4 max-w-[60ch] leading-relaxed text-ink/70">
              For 2027 the whole expo lands at the Grand Pavilion, Rosehill
              Gardens — two full levels, free onsite parking, and room to grow.
              Same weekend, same industry under one roof, a bigger stage for it.
            </p>
          </div>
        </section>

        {/* ---------- Closer ---------- */}
        <section className="glow bg-ink text-center">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(3rem,7vw,5rem)]">
            <span className="script text-[clamp(1.6rem,4vw,2.4rem)] text-ballet">
              See you at Rosehill
            </span>
            <div className="display mt-2 mb-1 text-[clamp(1.9rem,9vw,5.5rem)]">
              17 &amp; 18 <span className="accent">April</span> 2027
            </div>
            <div className="text-[clamp(0.85rem,2vw,1rem)] font-bold uppercase tracking-[0.1em] text-white/80">
              Grand Pavilion · Rosehill Gardens · Sydney
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
