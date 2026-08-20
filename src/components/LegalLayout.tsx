import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/** Shared chrome + readable prose column for legal pages (terms, privacy). */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(760px,92vw)] py-[clamp(2.5rem,6vw,4.5rem)]">
          <Link
            href="/tickets"
            className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-pink hover:underline"
          >
            ← Tickets
          </Link>
          <h1 className="display mt-3 text-[clamp(2rem,7vw,3.2rem)] text-ink">
            {title}
          </h1>
          {updated && (
            <p className="mt-2 text-[0.82rem] font-semibold uppercase tracking-[0.06em] text-ink/45">
              {updated}
            </p>
          )}
          <div className="mt-8 grid gap-4 text-[0.96rem] leading-relaxed text-ink/75">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Section heading inside a legal document. */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 text-[1.05rem] font-extrabold text-ink">{children}</h2>
  );
}
