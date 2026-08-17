import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginForm } from "@/components/account/LoginForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { TicketCard } from "@/components/account/TicketCard";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { qrDataUrl } from "@/lib/qr";
import { formatAud } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Your tickets — Dance Teacher Expo 2027",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AttendeeEmbed = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type TicketRow = {
  id: string;
  order_id: string;
  ticket_type_id: string;
  qr_token: string;
  status: string;
  attendee: AttendeeEmbed | AttendeeEmbed[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function AccountPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-[min(1140px,92vw)] max-w-[720px] py-[clamp(2.5rem,7vw,4.5rem)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-pink">
                Your account
              </span>
              <h1 className="display mt-2 text-[clamp(2rem,7vw,3rem)] text-ink">
                Your tickets
              </h1>
            </div>
            {user && (
              <div className="pt-2 text-right">
                <div className="text-[0.8rem] text-ink/50">
                  {user.email}
                </div>
                <SignOutButton />
              </div>
            )}
          </div>

          {!user ? <LoginForm /> : <Dashboard supabase={supabase} />}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

async function Dashboard({
  supabase,
}: {
  supabase: Awaited<ReturnType<typeof createAuthServerClient>>;
}) {
  const [{ data: orders }, { data: tickets }, ev] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, total_cents, currency, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("tickets")
      .select(
        "id, order_id, ticket_type_id, qr_token, status, attendee:attendees(id, first_name, last_name, email, phone)",
      ),
    getEventWithTicketTypes(),
  ]);

  const typeName = new Map(
    (ev?.ticketTypes ?? []).map((t) => [t.id, t.name]),
  );

  const ticketRows = (tickets ?? []) as TicketRow[];
  // Pre-render QR data URLs (our own page, so data: URIs are fine here).
  const qrByToken = new Map(
    await Promise.all(
      ticketRows.map(
        async (t) => [t.qr_token, await qrDataUrl(t.qr_token)] as const,
      ),
    ),
  );

  const byOrder = new Map<string, TicketRow[]>();
  for (const t of ticketRows) {
    const list = byOrder.get(t.order_id) ?? [];
    list.push(t);
    byOrder.set(t.order_id, list);
  }

  const paidOrders = (orders ?? []).filter((o) => o.status === "paid");

  if (paidOrders.length === 0) {
    return (
      <div className="rounded-[14px] border border-black/10 bg-white p-6 text-center">
        <p className="text-ink/70">
          No tickets on this account yet.{" "}
          <Link href="/tickets" className="font-bold text-pink underline">
            Get tickets
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {paidOrders.map((order) => {
        const list = byOrder.get(order.id) ?? [];
        return (
          <section
            key={order.id}
            className="relative overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
          >
            <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
                  Order {order.order_number}
                </div>
                <div className="text-[0.82rem] text-ink/50">
                  {list.length} ticket{list.length === 1 ? "" : "s"} ·{" "}
                  {formatAud(order.total_cents)} {order.currency}
                </div>
              </div>
            </div>

            <ul className="grid gap-3">
              {list.map((t, i) => {
                const a = one(t.attendee);
                return (
                  <TicketCard
                    key={t.id}
                    ticket={{
                      index: i + 1,
                      ticketTypeName:
                        typeName.get(t.ticket_type_id) ?? "Ticket",
                      qrDataUrl: qrByToken.get(t.qr_token) ?? "",
                      attendeeId: a?.id ?? "",
                      firstName: a?.first_name ?? "",
                      lastName: a?.last_name ?? "",
                      email: a?.email ?? "",
                      phone: a?.phone ?? "",
                    }}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
