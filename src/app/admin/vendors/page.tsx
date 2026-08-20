import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_SLUG } from "@/lib/tickets";
import {
  TIER_LABEL,
  FAMILY_LABEL,
  isProfileComplete,
  primaryLogo,
  summariseVendors,
  type Tier,
  type Family,
} from "@/lib/vendors";
import { formatAud } from "@/lib/pricing";
import type { Vendor } from "@/lib/types";
import {
  VendorCreateForm,
  VendorResendButton,
} from "@/components/admin/VendorManager";

export const dynamic = "force-dynamic";

// Light package-colour backgrounds for the per-tier pills.
const TIER_PILL: Record<Tier, string> = {
  platinum: "border-[#C9D3E0] bg-[#EEF2F7]",
  gold: "border-[#E6CE7A] bg-[#FBF0CE]",
  silver: "border-[#CFCFD3] bg-[#F2F2F3]",
  bronze: "border-[#D6A879] bg-[#F6E4D2]",
};

export default async function AdminVendorsPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle();

  const { data: rows } = event
    ? await sb
        .from("vendors")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const vendors = (rows ?? []) as Vendor[];
  const complete = vendors.filter(isProfileComplete).length;
  const summary = summariseVendors(vendors);

  // Tally attending staff per vendor (attendees on vendor-linked orders).
  const { data: staffRows } = await sb
    .from("attendees")
    .select("id, orders!inner(vendor_id)")
    .not("orders.vendor_id", "is", null);
  const staffCount = new Map<string, number>();
  for (const r of (staffRows ?? []) as {
    orders: { vendor_id: string } | { vendor_id: string }[];
  }[]) {
    const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    if (o?.vendor_id)
      staffCount.set(o.vendor_id, (staffCount.get(o.vendor_id) ?? 0) + 1);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">Vendors</h1>
        <div className="text-[0.82rem] text-ink/55">
          {vendors.length} total · {complete} listing
          {complete === 1 ? "" : "s"} complete
        </div>
      </div>

      {/* Signed vendors + committed revenue */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Signed vendors",
            value: summary.signed.toString(),
            sub:
              summary.inactive > 0
                ? `${summary.inactive} inactive`
                : summary.untiered > 0
                  ? `${summary.untiered} tier TBC`
                  : "all tiers set",
          },
          {
            label: "Committed (ex GST)",
            value: formatAud(summary.committedExGstCents),
            sub: `${formatAud(summary.committedIncGstCents)} inc GST`,
          },
          {
            label: "Deposits locked",
            value: formatAud(summary.depositsExGstCents),
            sub: "$500 ea, ex GST",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border border-black/10 bg-white p-4"
          >
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink/45">
              {s.label}
            </div>
            <div className="display mt-1 text-[clamp(1.3rem,4vw,1.9rem)] text-ink">
              {s.value}
            </div>
            <div className="mt-0.5 text-[0.72rem] text-ink/45">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-tier breakdown */}
      <div className="flex flex-wrap gap-2">
        {summary.tiers.map((t) => (
          <div
            key={t.tier}
            className={`flex items-baseline gap-2 rounded-full border px-3.5 py-1.5 text-[0.8rem] ${TIER_PILL[t.tier]}`}
          >
            <span className="font-bold text-ink">{TIER_LABEL[t.tier]}</span>
            <span className="tabular-nums text-ink/55">× {t.count}</span>
            <span className="tabular-nums font-semibold text-pink">
              {formatAud(t.valueCents)}
            </span>
          </div>
        ))}
        {summary.untiered > 0 && (
          <div className="flex items-baseline gap-2 rounded-full border border-dashed border-black/15 bg-white px-3.5 py-1.5 text-[0.8rem]">
            <span className="font-bold text-ink/70">No tier</span>
            <span className="tabular-nums text-ink/55">× {summary.untiered}</span>
            <span className="text-ink/40">TBC</span>
          </div>
        )}
      </div>

      <VendorCreateForm />

      <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-black/10 text-left text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/45">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-center">Staff</th>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No vendors yet.
                </td>
              </tr>
            ) : (
              vendors.map((v) => {
                const tier = v.package_tier
                  ? TIER_LABEL[v.package_tier as Tier]
                  : null;
                const family = v.package_family
                  ? FAMILY_LABEL[v.package_family as Family]
                  : null;
                const done = isProfileComplete(v);
                const thumb = primaryLogo(v);
                return (
                  <tr
                    key={v.id}
                    className="border-b border-black/5 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/vendors/${v.id}`}
                        className="flex items-center gap-2 font-semibold text-pink hover:underline"
                      >
                        {thumb && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-7 w-7 rounded-[6px] object-contain"
                          />
                        )}
                        {v.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {[family, tier].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink/80">{v.contact_name || "—"}</div>
                      <div className="text-[0.8rem] text-ink/50">
                        {v.contact_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-ink/70">
                      {staffCount.get(v.id) ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.04em] ${
                          done
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {done ? "Complete" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <VendorResendButton id={v.id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[0.8rem] text-ink/45">
        Vendors sign in at{" "}
        <Link href="/vendor" className="font-semibold text-pink hover:underline">
          /vendor
        </Link>{" "}
        with their contact email to complete their exhibitor listing.
      </p>
    </div>
  );
}
