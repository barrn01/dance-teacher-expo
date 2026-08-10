import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Order confirmed — Dance Teacher Expo 2027",
};

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; order?: string }>;
}) {
  const { payment_intent, order } = await searchParams;

  let orderNumber = order ?? null;
  let status: string | null = null;
  let email: string | null = null;
  let ticketCount = 0;

  if (payment_intent) {
    const sb = createServiceClient();
    const { data } = await sb
      .from("orders")
      .select("id, order_number, status, buyer_email")
      .eq("stripe_payment_intent_id", payment_intent)
      .maybeSingle();
    if (data) {
      orderNumber = data.order_number;
      status = data.status;
      email = data.buyer_email;
      const { count } = await sb
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("order_id", data.id);
      ticketCount = count ?? 0;
    }
  }

  const paid = status === "paid";

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[560px] py-[clamp(3rem,8vw,5rem)] text-center">
          <p className="script text-[clamp(1.6rem,4vw,2.2rem)] text-pink">
            You&apos;re in!
          </p>
          <h1 className="display mt-1 text-[clamp(2.2rem,7vw,3.4rem)] text-ink">
            See You At Rosehill
          </h1>

          <div className="relative mt-6 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6 text-left">
            <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
            {orderNumber && (
              <p className="text-[0.82rem] font-bold uppercase tracking-[0.12em] text-ink/55">
                Order {orderNumber}
              </p>
            )}
            <p className="mt-3 leading-relaxed text-ink/75">
              {paid ? (
                <>
                  Payment received — {ticketCount > 0 ? `${ticketCount} ` : ""}
                  ticket{ticketCount === 1 ? "" : "s"} confirmed. Your QR
                  ticket{ticketCount === 1 ? "" : "s"}{" "}
                  {ticketCount === 1 ? "is" : "are"} on the way to{" "}
                  <span className="font-bold text-ink">{email}</span>.
                </>
              ) : (
                <>
                  Thanks — your payment is being confirmed. Your QR tickets will
                  arrive by email at{" "}
                  <span className="font-bold text-ink">
                    {email ?? "your inbox"}
                  </span>{" "}
                  within a few minutes.
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-[0.85rem] text-ink/55">
            Sat 17 &amp; Sun 18 April 2027 · Grand Pavilion, Rosehill Gardens,
            Sydney
          </p>

          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-ink px-7 py-3.5 text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-char-2"
            >
              Done
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
