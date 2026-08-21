import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistButton } from "@/components/WaitlistModal";

const WHAT_TO_EXPECT: { title: string; body: string }[] = [
  {
    title: "50+ Sessions",
    body: "Two full days of professional development across multiple rooms, led by the industry's most respected educators.",
  },
  {
    title: "Grand Opening Lunch",
    body: "The whole industry together to kick things off — plus a proper sit-down lunch included on both days.",
  },
  {
    title: "The Fashion Show",
    body: "Saturday night's showcase — the latest in dancewear and costume, under the lights.",
  },
  {
    title: "Cocktail Party",
    body: "Unwind and connect with your peers over drinks once the sessions wrap.",
  },
  {
    title: "70+ Exhibiting Brands",
    body: "Meet the brands behind your studio — costumes, footwear, technology and more.",
  },
  {
    title: "The Event App",
    body: "Your personal schedule, session details and connections, all in one place.",
  },
];

const FLOOR_PHOTOS: {
  src: string;
  alt: string;
  caption: string;
  rot: string;
}[] = [
  {
    src: "/media/images/movement-session.jpg",
    alt: "Dancers in a packed movement class with arms raised",
    caption: "Movement classes",
    rot: "-rotate-2",
  },
  {
    src: "/media/images/vendor-arena-floor.jpg",
    alt: "Teachers connecting across the busy vendor arena",
    caption: "The vendor arena",
    rot: "rotate-1",
  },
  {
    src: "/media/images/business-session.jpg",
    alt: "Attendees seated in a business-track session",
    caption: "Business track",
    rot: "rotate-1",
  },
  {
    src: "/media/images/vendor-arena-teachers.jpg",
    alt: "Two teachers with DTE tote bags at an exhibitor booth",
    caption: "70+ exhibiting brands",
    rot: "-rotate-2",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="glow">
          <div className="mx-auto w-[min(1140px,92vw)] px-0 py-[clamp(3rem,8vw,5.5rem)] text-center">
            <p className="display text-[clamp(1.5rem,4.6vw,2.5rem)] text-white/95">
              Dance Teacher Expo <span className="accent">2027</span>
            </p>
            <p className="script mb-2 mt-4 inline-block -rotate-2 text-[clamp(1.6rem,4vw,2.4rem)] text-ballet">
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
              Cocktail Party. Join the waitlist to be first to know when tickets
              open.
            </p>

            <div className="mt-9 flex justify-center">
              <WaitlistButton variant="primary" />
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
                70+
              </div>
              <div className="mt-1.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/85">
                Exhibiting brands
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Attendee stories (video) ---------- */}
        <section className="bg-paper text-ink">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.75rem,7vw,5rem)]">
            <div className="text-center">
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
                Straight from the floor
              </span>
              <h2 className="display mx-auto mt-2 max-w-[20ch] text-[clamp(2rem,5vw,3.1rem)] text-ink">
                Why Teachers Keep Coming Back
              </h2>
              <p className="mx-auto mt-4 max-w-[58ch] leading-relaxed text-ink/70">
                Hear from the educators and studio owners who&apos;ve made DTE
                their must-attend event, year after year.
              </p>
            </div>

            <div className="mx-auto mt-9 max-w-[860px]">
              <video
                className="aspect-video w-full rounded-2xl bg-ink shadow-[0_24px_60px_rgba(23,17,20,0.25)]"
                controls
                preload="none"
                playsInline
                poster="/media/video/dte-attendee-stories-poster.jpg"
              >
                <source
                  src="/media/video/dte-attendee-stories.mp4"
                  type="video/mp4"
                />
              </video>
            </div>
          </div>
        </section>

        {/* ---------- What to expect ---------- */}
        <section className="bg-ink">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.75rem,7vw,5rem)]">
            <div className="text-center">
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-ballet">
                Two days, one industry
              </span>
              <h2 className="display mx-auto mt-2 max-w-[20ch] text-[clamp(2rem,5vw,3.1rem)]">
                What&apos;s In Store
              </h2>
              <p className="mx-auto mt-4 max-w-[60ch] leading-relaxed text-white/70">
                Every ticket is a Two-Day All Access pass — the full program,
                both lunches and the headline socials included.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WHAT_TO_EXPECT.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-char-2 p-6 text-left"
                >
                  <h3 className="text-[0.8rem] font-extrabold uppercase tracking-[0.1em] text-ballet">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-[0.95rem] leading-relaxed text-white/70">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Photo band (the floor) ---------- */}
        <section className="bg-paper-2 text-ink">
          <div className="mx-auto w-[min(1140px,92vw)] py-[clamp(2.75rem,7vw,5rem)]">
            <div className="text-center">
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
                Inside the room
              </span>
              <h2 className="display mx-auto mt-2 max-w-[20ch] text-[clamp(2rem,5vw,3.1rem)] text-ink">
                The DTE Floor
              </h2>
              <p className="mx-auto mt-4 max-w-[58ch] leading-relaxed text-ink/70">
                From packed movement classes to the buzzing vendor arena — two
                days of the whole industry under one roof.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {FLOOR_PHOTOS.map((p) => (
                <figure
                  key={p.src}
                  className={`${p.rot} transition-transform duration-300 hover:rotate-0`}
                >
                  <div className="overflow-hidden rounded-2xl shadow-[0_18px_45px_rgba(23,17,20,0.22)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.src}
                      alt={p.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                  <figcaption className="mt-3 text-center text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
                    {p.caption}
                  </figcaption>
                </figure>
              ))}
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
            <div className="mt-9 flex justify-center">
              <WaitlistButton variant="primary" label="Join the ticket waitlist" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
