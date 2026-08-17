import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { getEventWithTicketTypes } from "@/lib/tickets";
import { CompForm } from "@/components/admin/CompForm";

export const dynamic = "force-dynamic";

export default async function AdminCompPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const data = await getEventWithTicketTypes();
  const tt = data?.ticketTypes[0];

  return (
    <div className="mx-auto grid max-w-[560px] gap-5">
      <div>
        <Link
          href="/admin"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Orders
        </Link>
        <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.2rem)]">
          Comp tickets
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink/60">
          Issue complimentary tickets — speakers, staff, prizes, sponsors. No
          payment, no charge.
        </p>
      </div>

      {tt ? (
        <CompForm ticketTypeKey={tt.key} ticketTypeName={tt.name} />
      ) : (
        <div className="rounded-[14px] border border-black/10 bg-white p-6 text-ink/60">
          No ticket type configured.
        </div>
      )}
    </div>
  );
}
