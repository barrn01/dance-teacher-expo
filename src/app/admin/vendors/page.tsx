import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_SLUG } from "@/lib/tickets";
import {
  TIER_LABEL,
  FAMILY_LABEL,
  summariseVendors,
  type Tier,
  type Family,
} from "@/lib/vendors";
import {
  MONEY_STATUS_FIELDS,
  ITEM_STATUS_FIELDS,
  STATUS_SYMBOL,
  vendorCells,
  vendorAmountCents,
  vendorOutstandingCents,
  summariseSponsorship,
  chaseList,
  chaseCount,
  daysToGo,
  type StatusCell,
  type StatusFieldKey,
  type VendorStatusRow,
} from "@/lib/vendor-hq";
import { formatAud } from "@/lib/pricing";
import type { Vendor } from "@/lib/types";
import {
  VendorCreateForm,
  VendorResendButton,
} from "@/components/admin/VendorManager";

export const dynamic = "force-dynamic";

const TIER_PILL: Record<Tier, string> = {
  platinum: "border-[#C9D3E0] bg-[#EEF2F7]",
  gold: "border-[#E6CE7A] bg-[#FBF0CE]",
  silver: "border-[#CFCFD3] bg-[#F2F2F3]",
  bronze: "border-[#D6A879] bg-[#F6E4D2]",
};

const CELL_CLASS: Record<StatusCell["status"], string> = {
  done: "bg-green-100 text-green-800",
  waiting: "bg-black/[0.06] text-ink/35",
  chase: "bg-amber-100 text-amber-800",
  na: "text-ink/25",
};
const STATE_WORD: Record<StatusCell["status"], string> = {
  done: "done",
  waiting: "not yet",
  chase: "chase now",
  na: "n/a",
};

/** Server-rendered readiness/money cell (the artefact's dotCell). */
function Cell({ cell, label }: { cell: StatusCell; label: string }) {
  const title = `${label} — ${STATE_WORD[cell.status]}${
    cell.date ? " " + cell.date : ""
  }${cell.note ? " · " + cell.note : ""}`;
  const flag = cell.note && cell.status !== "done";
  const chip = (
    <span
      title={title}
      className={`relative inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-[0.8rem] font-bold ${CELL_CLASS[cell.status]}`}
    >
      {STATUS_SYMBOL[cell.status]}
      {flag && (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-pink" />
      )}
    </span>
  );
  return cell.link ? (
    <a href={cell.link} target="_blank" rel="noopener noreferrer">
      {chip}
    </a>
  ) : (
    chip
  );
}

export default async function AdminVendorsPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id, name, venue_name, start_at, sponsorship_target_cents")
    .eq("slug", EVENT_SLUG)
    .maybeSingle<{
      id: string;
      name: string;
      venue_name: string | null;
      start_at: string | null;
      sponsorship_target_cents: number | null;
    }>();

  const { data: rows } = event
    ? await sb
        .from("vendors")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const vendors = (rows ?? []) as Vendor[];
  const active = vendors.filter((v) => v.status === "active");

  // Manual statuses, grouped by vendor.
  const { data: statusRows } = event
    ? await sb
        .from("vendor_statuses")
        .select("vendor_id, field_key, status, display_date, link, note")
    : { data: [] };
  const statusByVendor = new Map<string, VendorStatusRow[]>();
  for (const r of (statusRows ?? []) as VendorStatusRow[]) {
    const list = statusByVendor.get(r.vendor_id) ?? [];
    list.push(r);
    statusByVendor.set(r.vendor_id, list);
  }

  // Attending staff per vendor.
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

  const targetCents = event?.sponsorship_target_cents ?? 0;
  const sponsor = summariseSponsorship(active, targetCents);
  const tierSummary = summariseVendors(vendors);
  const chase = chaseList(active, statusByVendor);
  const toChase = chaseCount(statusByVendor);
  const days = event?.start_at ? daysToGo(event.start_at, Date.now()) : null;

  const tiles = [
    { value: sponsor.vendorsBooked.toString(), label: "Vendors booked" },
    { value: formatAud(sponsor.receivedCents), label: "Cash received" },
    { value: toChase.toString(), label: "Items to chase" },
    { value: days != null ? days.toString() : "—", label: "Days to event" },
  ];

  return (
    <div className="grid gap-6">
      {/* Wordmark + event line + countdown */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[clamp(1.8rem,6vw,2.6rem)] text-pink">
            Vendor HQ
          </h1>
          <p className="mt-1 text-[0.85rem] text-ink/55">
            {event?.name ?? "Dance Teacher Expo 2027"}
            {event?.venue_name ? ` · ${event.venue_name}` : ""}
          </p>
        </div>
        {days != null && (
          <div className="text-right">
            <div className="display text-[clamp(1.6rem,5vw,2.2rem)] leading-none">
              {days}
            </div>
            <div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink/45">
              days to go
            </div>
          </div>
        )}
      </div>

      {/* Tabs (Pipeline lands in Phase 2) */}
      <div className="flex gap-2 border-b-2 border-pink">
        <span className="rounded-t-lg bg-pink px-4 py-2 text-[0.85rem] font-bold text-white">
          Booked vendors
        </span>
        <span
          className="cursor-not-allowed rounded-t-lg border border-b-0 border-black/10 bg-black/[0.03] px-4 py-2 text-[0.85rem] font-bold text-ink/35"
          title="Coming in Phase 2"
        >
          Pipeline · Soon
        </span>
      </div>

      {/* Target header */}
      <div className="rounded-[12px] bg-char-2/[0.04] p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="display text-[clamp(1.5rem,4vw,2.1rem)] leading-none">
            {formatAud(sponsor.pledgedCents)}
          </span>
          <span className="text-[0.85rem] text-ink/55">
            pledged of the {formatAud(sponsor.targetCents)} sponsorship target
          </span>
          <span className="ml-auto text-[clamp(1.2rem,3vw,1.6rem)] font-extrabold text-pink">
            {sponsor.pct}%
          </span>
        </div>
        <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className="h-full rounded-full bg-pink"
            style={{ width: `${Math.max(1, sponsor.pct)}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[0.82rem] text-ink/60">
          <span>Received: {formatAud(sponsor.receivedCents)}</span>
          <span>Outstanding: {formatAud(sponsor.outstandingCents)}</span>
          <span>Still to sell: {formatAud(sponsor.gapCents)}</span>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[12px] border border-black/10 bg-white p-4"
          >
            <div className="display text-[clamp(1.3rem,4vw,1.9rem)] leading-none">
              {t.value}
            </div>
            <div className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink/45">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {/* Per-tier breakdown */}
      <div className="flex flex-wrap gap-2">
        {tierSummary.tiers.map((t) => (
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
      </div>

      {/* Top of the chase list */}
      {chase.length > 0 && (
        <div>
          <h2 className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/50">
            Top of the chase list
          </h2>
          <div className="grid gap-2">
            {chase.map((c) => (
              <div
                key={c.vendorId}
                className="rounded-[8px] bg-amber-50 px-4 py-2.5 text-[0.85rem]"
              >
                <Link
                  href={`/admin/vendors/${c.vendorId}`}
                  className="font-bold text-ink hover:underline"
                >
                  {c.company}
                </Link>
                <span className="text-ink/60"> — {c.items.join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <VendorCreateForm />

      {/* The full grid */}
      <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
        <table className="w-full min-w-[1180px] border-collapse text-[0.82rem]">
          <thead>
            <tr className="text-left text-[0.62rem] font-bold uppercase tracking-[0.06em] text-ink/40">
              <th className="sticky left-0 z-10 bg-white px-4 py-2"></th>
              <th className="border-l-2 border-black/10 px-2 py-2" colSpan={5}>
                The money
              </th>
              <th className="border-l-2 border-black/10 px-2 py-2" colSpan={4}>
                Contact
              </th>
              <th className="border-l-2 border-black/10 px-2 py-2" colSpan={4}>
                Assets &amp; promo
              </th>
              <th className="border-l-2 border-black/10 px-2 py-2" colSpan={3}>
                Event
              </th>
              <th className="px-2 py-2"></th>
            </tr>
            <tr className="border-b border-black/10 text-center text-[0.6rem] font-bold uppercase tracking-[0.05em] text-ink/45">
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left">
                Vendor
              </th>
              <th className="border-l-2 border-black/10 px-2 py-2 text-right">
                Amount
              </th>
              <th className="px-2 py-2 text-right">Outstanding</th>
              {MONEY_STATUS_FIELDS.map(([k, l]) => (
                <th key={k} className="px-2 py-2">
                  {l}
                </th>
              ))}
              <th className="border-l-2 border-black/10 px-2 py-2 text-left">
                Person
              </th>
              <th className="px-2 py-2 text-left">Phone</th>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Insta</th>
              {ITEM_STATUS_FIELDS.slice(0, 4).map(([k, l]) => (
                <th
                  key={k}
                  className={k === "logo" ? "border-l-2 border-black/10 px-2 py-2" : "px-2 py-2"}
                >
                  {l}
                </th>
              ))}
              {ITEM_STATUS_FIELDS.slice(4).map(([k, l]) => (
                <th
                  key={k}
                  className={k === "booth" ? "border-l-2 border-black/10 px-2 py-2" : "px-2 py-2"}
                >
                  {l}
                </th>
              ))}
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-4 py-10 text-center text-ink/50">
                  No vendors yet.
                </td>
              </tr>
            ) : (
              vendors.map((v) => {
                const cells = vendorCells(v, statusByVendor.get(v.id) ?? []);
                const tier = v.package_tier
                  ? TIER_LABEL[v.package_tier as Tier]
                  : null;
                const family = v.package_family
                  ? FAMILY_LABEL[v.package_family as Family]
                  : null;
                const cell = (k: StatusFieldKey, label: string) => (
                  <td className="px-2 py-2 text-center">
                    <Cell cell={cells[k]} label={label} />
                  </td>
                );
                return (
                  <tr key={v.id} className="border-b border-black/5 last:border-0">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2">
                      <Link
                        href={`/admin/vendors/${v.id}`}
                        className="font-semibold text-pink hover:underline"
                      >
                        {v.company_name}
                      </Link>
                      <div className="text-[0.68rem] text-ink/45">
                        {[tier, family].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="border-l-2 border-black/10 px-2 py-2 text-right tabular-nums">
                      {formatAud(vendorAmountCents(v))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink/70">
                      {formatAud(vendorOutstandingCents(v))}
                    </td>
                    {MONEY_STATUS_FIELDS.map(([k, l]) => (
                      <td key={k} className="px-2 py-2 text-center">
                        <Cell cell={cells[k as StatusFieldKey]} label={l} />
                      </td>
                    ))}
                    <td className="border-l-2 border-black/10 px-2 py-2 text-ink/75">
                      {v.contact_name || "—"}
                    </td>
                    <td className="px-2 py-2 text-ink/70">
                      {v.contact_phone || "—"}
                    </td>
                    <td className="px-2 py-2">
                      {v.contact_email ? (
                        <a
                          href={`mailto:${v.contact_email}`}
                          className="text-pink hover:underline"
                        >
                          {v.contact_email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-ink/70">
                      {v.instagram || "—"}
                    </td>
                    {ITEM_STATUS_FIELDS.slice(0, 4).map(([k, l], i) => (
                      <td
                        key={k}
                        className={`px-2 py-2 text-center ${i === 0 ? "border-l-2 border-black/10" : ""}`}
                      >
                        <Cell cell={cells[k as StatusFieldKey]} label={l} />
                      </td>
                    ))}
                    {ITEM_STATUS_FIELDS.slice(4).map(([k, l], i) => (
                      <td
                        key={k}
                        className={`px-2 py-2 text-center ${i === 0 ? "border-l-2 border-black/10" : ""}`}
                      >
                        <Cell cell={cells[k as StatusFieldKey]} label={l} />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      <VendorResendButton id={v.id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] text-ink/55">
        {(
          [
            ["done", "Done"],
            ["waiting", "Not yet"],
            ["chase", "Chase now"],
            ["na", "N/A"],
          ] as const
        ).map(([s, l]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] text-[0.72rem] font-bold ${CELL_CLASS[s]}`}
            >
              {STATUS_SYMBOL[s]}
            </span>
            {l}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-black/[0.06]">
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-pink" />
          </span>
          Has a note
        </span>
      </div>

      <p className="text-[0.8rem] text-ink/45">
        Vendors sign in at{" "}
        <Link href="/vendor" className="font-semibold text-pink hover:underline">
          /vendor
        </Link>{" "}
        to complete their exhibitor listing. Logo, App entry and Booth update
        automatically as they do.
      </p>
    </div>
  );
}
