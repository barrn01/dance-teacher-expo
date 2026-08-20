const MAIN_SITE = "https://danceteacherexpo.com.au";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto flex w-[min(1140px,92vw)] flex-wrap items-center justify-between gap-4 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dte27-logo.svg"
          alt="Dance Teacher Expo 2027"
          className="h-9 w-auto"
        />
        <a
          href={MAIN_SITE}
          className="inline-flex items-center rounded-full border-2 border-white/35 px-6 py-3 text-[0.8rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:border-white"
        >
          danceteacherexpo.com.au
        </a>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[0.74rem] text-white/50">
          <span>
            Dance Teacher Expo 2027 · Grand Pavilion, Rosehill Gardens, Sydney ·
            All prices AUD, incl. GST
          </span>
          <nav className="flex items-center gap-4 font-semibold uppercase tracking-[0.06em]">
            <a href="/terms" className="hover:text-white">
              Terms
            </a>
            <a href="/privacy" className="hover:text-white">
              Privacy
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
