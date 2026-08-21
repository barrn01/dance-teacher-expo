import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex w-[min(1140px,92vw)] items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="Dance Teacher Expo 2027 home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dte27-logo.svg"
            alt="Dance Teacher Expo 2027"
            className="h-9 w-auto"
          />
        </Link>
        <span className="hidden text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-ballet sm:block">
          17–18 April 2027 · Rosehill Gardens
        </span>
      </div>
    </header>
  );
}
