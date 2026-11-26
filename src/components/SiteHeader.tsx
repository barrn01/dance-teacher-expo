import Link from "next/link";
import { BLACK_FRIDAY_SALE } from "@/lib/sale";

export function SiteHeader() {
  const ticketsOnSale = process.env.TICKETS_ON_SALE === "true";
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/85 backdrop-blur-md">
      {/* Black Friday bar — sits inside the sticky header so it sticks site-wide.
          Flag-gated; disappears (with the sale) when the flag is off. */}
      {BLACK_FRIDAY_SALE && (
        <div className="bg-gradient-to-r from-pink to-pink-hot text-white">
          <div className="mx-auto flex w-[min(1140px,92vw)] flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-2.5 text-center">
            <span className="display text-[clamp(1rem,3.4vw,1.5rem)] leading-none">
              🎉 Black Friday Sale
            </span>
            <span className="text-[clamp(0.85rem,2.6vw,1.1rem)] font-extrabold uppercase tracking-[0.04em]">
              <span className="text-white/55 line-through">$329</span>{" "}
              <span className="text-white">$229</span> per ticket
            </span>
            {ticketsOnSale && (
              <Link
                href="/tickets"
                className="inline-flex items-center rounded-full bg-ink px-5 py-2 text-[0.75rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5"
              >
                Get Tickets
              </Link>
            )}
          </div>
        </div>
      )}
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
