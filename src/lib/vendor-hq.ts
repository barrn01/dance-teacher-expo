// Vendor HQ — Booked-vendor readiness overview helpers.
// Pure functions (no server imports) so they're testable and usable anywhere.
// See docs/vendor-hq/integration-plan.md.
import type { Vendor } from "./types";
import { vendorLogos, isProfileComplete } from "./vendor-logos";
import { TIER_PRICE_EX_GST, type Tier } from "./vendors";

export type StatusState = "done" | "waiting" | "chase" | "na";

export const STATUS_SYMBOL: Record<StatusState, string> = {
  done: "✓",
  waiting: "·",
  chase: "!",
  na: "—",
};

/** A rendered readiness/money cell. */
export type StatusCell = {
  status: StatusState;
  /** Free-text display date, e.g. "11 Sep" (optional). */
  date?: string | null;
  /** Drive URL — makes the cell clickable. */
  link?: string | null;
  note?: string | null;
  /** True when computed from real vendor data (not editable as a status). */
  derived?: boolean;
};

/** A row from the `vendor_statuses` table (manual statuses). */
export type VendorStatusRow = {
  vendor_id: string;
  field_key: string;
  status: StatusState;
  display_date: string | null;
  link: string | null;
  note: string | null;
};

// Grid column definitions — [key, label]. Order here is the render order.
export const MONEY_STATUS_FIELDS = [
  ["deposit", "Deposit paid"],
  ["invoice", "Invoice recv'd"],
  ["funds", "Funds recv'd"],
] as const;

export const ITEM_STATUS_FIELDS = [
  ["logo", "Logo"], // derived
  ["video", "Video"], // derived
  ["ig_sched", "IG sched."], // manual
  ["app", "App entry"], // derived
  ["booth", "Booth alloc."], // derived
  ["session", "Session"], // manual (na unless Platinum/Gold service)
  ["fashion", "Fashion show"], // manual (na unless Platinum/Gold fashion)
] as const;

export type StatusFieldKey =
  | (typeof MONEY_STATUS_FIELDS)[number][0]
  | (typeof ITEM_STATUS_FIELDS)[number][0];

/** Keys whose cell is DERIVED from real vendor data (never manually edited). */
export const DERIVED_KEYS: StatusFieldKey[] = ["logo", "video", "app", "booth"];
/** Keys stored in `vendor_statuses` (admin-maintained). */
export const MANUAL_KEYS: StatusFieldKey[] = [
  "deposit",
  "invoice",
  "funds",
  "ig_sched",
  "session",
  "fashion",
];

const isTopTier = (v: Vendor) =>
  v.package_tier === "platinum" || v.package_tier === "gold";

/** Session applies only to Platinum/Gold *service* vendors; else N/A. */
export const sessionApplies = (v: Vendor) =>
  isTopTier(v) && v.package_family === "service";
/** Fashion-show slot applies only to Platinum/Gold *fashion* vendors; else N/A. */
export const fashionApplies = (v: Vendor) =>
  isTopTier(v) && v.package_family === "fashion";

/** Derive the four data-backed readiness cells from the vendor row itself. */
function derivedCell(key: StatusFieldKey, v: Vendor): StatusCell {
  const done = (b: boolean): StatusCell => ({
    status: b ? "done" : "waiting",
    derived: true,
  });
  switch (key) {
    case "logo":
      return done(!!vendorLogos(v).square);
    case "video":
      return done(!!v.video_url);
    case "app": // exhibitor listing complete (square logo + description + website)
      return done(isProfileComplete(v));
    case "booth":
      return done(!!v.booth_number);
    default:
      return { status: "waiting" };
  }
}

/**
 * Resolve every status cell for a vendor: derived fields from the row, manual
 * fields from vendor_statuses, with the session/fashion N/A rule applied.
 */
export function vendorCells(
  v: Vendor,
  statusRows: VendorStatusRow[],
): Record<StatusFieldKey, StatusCell> {
  const byKey = new Map(statusRows.map((r) => [r.field_key, r]));
  const cells = {} as Record<StatusFieldKey, StatusCell>;

  for (const key of DERIVED_KEYS) cells[key] = derivedCell(key, v);

  for (const key of MANUAL_KEYS) {
    // N/A overrides for the two conditional event slots.
    if (key === "session" && !sessionApplies(v)) {
      cells[key] = { status: "na" };
      continue;
    }
    if (key === "fashion" && !fashionApplies(v)) {
      cells[key] = { status: "na" };
      continue;
    }
    const row = byKey.get(key);
    cells[key] = row
      ? {
          status: row.status,
          date: row.display_date,
          link: row.link,
          note: row.note,
        }
      : { status: "waiting" };
  }
  return cells;
}

/** Contracted value ex GST (cents): explicit amount, else the tier package price. */
export function vendorAmountCents(v: Vendor): number {
  if (typeof v.amount_cents === "number") return v.amount_cents;
  if (v.package_tier) return TIER_PRICE_EX_GST[v.package_tier as Tier] * 100;
  return 0;
}

/** Outstanding ex GST (cents): explicit, else assume the full amount is owed. */
export function vendorOutstandingCents(v: Vendor): number {
  if (typeof v.outstanding_cents === "number") return v.outstanding_cents;
  return vendorAmountCents(v);
}

export type SponsorshipSummary = {
  pledgedCents: number;
  outstandingCents: number;
  receivedCents: number;
  targetCents: number;
  pct: number; // 0–100
  gapCents: number; // still to sell toward target
  vendorsBooked: number;
};

/** Target-header math — mirrors the artefact (received = pledged − outstanding). */
export function summariseSponsorship(
  activeVendors: Vendor[],
  targetCents: number,
): SponsorshipSummary {
  const pledgedCents = activeVendors.reduce(
    (t, v) => t + vendorAmountCents(v),
    0,
  );
  const outstandingCents = activeVendors.reduce(
    (t, v) => t + vendorOutstandingCents(v),
    0,
  );
  const receivedCents = pledgedCents - outstandingCents;
  const pct =
    targetCents > 0
      ? Math.min(100, Math.round((100 * pledgedCents) / targetCents))
      : 0;
  return {
    pledgedCents,
    outstandingCents,
    receivedCents,
    targetCents,
    pct,
    gapCents: Math.max(0, targetCents - pledgedCents),
    vendorsBooked: activeVendors.length,
  };
}

export type ChaseEntry = { vendorId: string; company: string; items: string[] };

const FIELD_LABEL: Record<string, string> = Object.fromEntries([
  ...MONEY_STATUS_FIELDS,
  ...ITEM_STATUS_FIELDS,
]);

/**
 * Everything currently flagged `chase`, grouped by vendor. Phase 1: chase is a
 * manual status only (auto-chase from dates is a later phase).
 */
export function chaseList(
  vendors: { id: string; company_name: string }[],
  statusByVendor: Map<string, VendorStatusRow[]>,
): ChaseEntry[] {
  const out: ChaseEntry[] = [];
  for (const v of vendors) {
    const rows = statusByVendor.get(v.id) ?? [];
    const items = rows
      .filter((r) => r.status === "chase")
      .map((r) => {
        const label = FIELD_LABEL[r.field_key] ?? r.field_key;
        return r.note ? `${label} (${r.note})` : label;
      });
    if (items.length) out.push({ vendorId: v.id, company: v.company_name, items });
  }
  return out;
}

/** Count of cells flagged `chase` across all vendors (for the tile). */
export function chaseCount(statusByVendor: Map<string, VendorStatusRow[]>): number {
  let n = 0;
  for (const rows of statusByVendor.values())
    n += rows.filter((r) => r.status === "chase").length;
  return n;
}

/** Whole days between now and the event (for the "days to go" tile). */
export function daysToGo(eventDateISO: string, nowMs: number): number {
  const diff = new Date(eventDateISO).getTime() - nowMs;
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
