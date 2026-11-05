import "server-only";
import { createServiceClient } from "./supabase/server";
import { EVENT_SLUG } from "./tickets";

/**
 * Reconcile a signed vendor back to its pipeline prospect.
 *
 * When a vendor pays their deposit (the GHL deposit webhook) they often sign
 * with a different email than the one on their pipeline card, so an exact-email
 * link silently misses and the prospect is left stuck in New/Contacted even
 * though they've actually booked. This module matches a vendor to an open
 * prospect by email → company name → phone (highest-confidence first) and, on a
 * single confident match, moves that prospect to WON and links the vendor.
 *
 * Matching is deliberately conservative: a tier only links when it yields
 * exactly ONE candidate. More than one → ambiguous (surfaced for a manual
 * link, never auto-linked to avoid mislinking the wrong business).
 */

type VendorLike = {
  id: string;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type ProspectLike = {
  id: string;
  name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: string;
};

type MatchBy = "email" | "company" | "phone";

const normEmail = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

/**
 * Collapse a company name to a comparison key: lowercased, "&"→"and", common
 * business suffixes dropped, all non-alphanumerics removed. So "Luxe
 * Performance Tours" and "Luxe Performance Tours Pty Ltd" match.
 */
const companyKey = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pty|ltd|limited|inc|incorporated|co|llc|group|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");

/**
 * Normalise a phone to comparable digits: strip non-digits, drop an AU country
 * code (61) or a leading trunk 0. Returns "" when too short to trust.
 */
const normPhone = (s: string | null | undefined): string => {
  let d = (s ?? "").replace(/\D/g, "");
  if (d.length >= 11 && d.startsWith("61")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.replace(/^0+/, "");
  return d.length >= 8 ? d : "";
};

type FindResult =
  | { kind: "match"; prospectId: string; matchedBy: MatchBy }
  | { kind: "ambiguous"; matchedBy: MatchBy; count: number }
  | { kind: "none" };

/**
 * Find the pipeline prospect a vendor corresponds to, email → company → phone.
 * `prospects` should already be scoped to the event and to unlinked rows.
 * Email can reclaim a `lost` prospect (high confidence); the fuzzier company /
 * phone tiers skip `lost` so a deliberately-dropped lead isn't resurrected.
 */
export function findProspectForVendor(
  vendor: VendorLike,
  prospects: ProspectLike[],
): FindResult {
  const resolve = (ms: ProspectLike[], by: MatchBy): FindResult =>
    ms.length === 1
      ? { kind: "match", prospectId: ms[0].id, matchedBy: by }
      : { kind: "ambiguous", matchedBy: by, count: ms.length };

  const vEmail = normEmail(vendor.contact_email);
  if (vEmail) {
    const m = prospects.filter(
      (p) => p.stage !== "won" && normEmail(p.contact_email) === vEmail,
    );
    if (m.length) return resolve(m, "email");
  }

  const vCompany = companyKey(vendor.company_name);
  if (vCompany.length >= 3) {
    const m = prospects.filter(
      (p) =>
        p.stage !== "won" &&
        p.stage !== "lost" &&
        companyKey(p.name) === vCompany,
    );
    if (m.length) return resolve(m, "company");
  }

  const vPhone = normPhone(vendor.contact_phone);
  if (vPhone) {
    const m = prospects.filter(
      (p) =>
        p.stage !== "won" &&
        p.stage !== "lost" &&
        normPhone(p.contact_phone) === vPhone,
    );
    if (m.length) return resolve(m, "phone");
  }

  return { kind: "none" };
}

export type ReconcileResult =
  | { linked: true; already?: boolean; prospectId: string; matchedBy?: MatchBy }
  | { linked: false; reason: "no_match" | "ambiguous" | "vendor_not_found"; matchedBy?: MatchBy };

/** Mark a prospect won and link it to the vendor. Won the moment it's booked. */
async function linkProspect(
  sb: ReturnType<typeof createServiceClient>,
  prospectId: string,
  vendorId: string,
): Promise<void> {
  const now = new Date();
  await sb
    .from("prospects")
    .update({
      stage: "won",
      won_vendor_id: vendorId,
      won_date: now.toISOString().slice(0, 10),
      updated_at: now.toISOString(),
    })
    .eq("id", prospectId);
}

/**
 * Reconcile a single vendor (by id) to its prospect. Idempotent: a no-op if a
 * prospect already links to this vendor. Best-effort — callers (the deposit
 * webhook) should not fail on a thrown error here.
 */
export async function reconcileVendorToProspect(
  vendorId: string,
): Promise<ReconcileResult> {
  const sb = createServiceClient();

  const { data: vendor } = await sb
    .from("vendors")
    .select("id, event_id, company_name, contact_email, contact_phone")
    .eq("id", vendorId)
    .maybeSingle<VendorLike & { event_id: string }>();
  if (!vendor) return { linked: false, reason: "vendor_not_found" };

  const { data: alreadyLinked } = await sb
    .from("prospects")
    .select("id")
    .eq("won_vendor_id", vendorId)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (alreadyLinked)
    return { linked: true, already: true, prospectId: alreadyLinked.id };

  const { data: pool } = await sb
    .from("prospects")
    .select("id, name, contact_email, contact_phone, stage")
    .eq("event_id", vendor.event_id)
    .is("won_vendor_id", null);

  const res = findProspectForVendor(vendor, (pool ?? []) as ProspectLike[]);
  if (res.kind === "match") {
    await linkProspect(sb, res.prospectId, vendorId);
    return { linked: true, prospectId: res.prospectId, matchedBy: res.matchedBy };
  }
  if (res.kind === "ambiguous")
    return { linked: false, reason: "ambiguous", matchedBy: res.matchedBy };
  return { linked: false, reason: "no_match" };
}

export type BackfillSummary = {
  linked: { vendorId: string; company: string; prospectId: string; matchedBy: MatchBy }[];
  ambiguous: { vendorId: string; company: string; matchedBy: MatchBy; count: number }[];
  unmatched: { vendorId: string; company: string }[];
};

/**
 * Sweep every signed (active) vendor not yet linked to a prospect and link the
 * confident single matches, moving those prospects to WON. Clears the backlog of
 * already-booked vendors whose cards are stuck in the pipeline. Works off one
 * shared prospect pool and removes each matched prospect so two vendors can't
 * claim the same card in one pass. Returns what it linked and what needs a hand.
 */
export async function reconcileAllSignedVendors(): Promise<BackfillSummary> {
  const sb = createServiceClient();
  const summary: BackfillSummary = { linked: [], ambiguous: [], unmatched: [] };

  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle<{ id: string }>();
  if (!event) return summary;

  const [{ data: vendorRows }, { data: prospectRows }] = await Promise.all([
    sb
      .from("vendors")
      .select("id, company_name, contact_email, contact_phone")
      .eq("event_id", event.id)
      .eq("status", "active"),
    sb
      .from("prospects")
      .select("id, name, contact_email, contact_phone, stage, won_vendor_id")
      .eq("event_id", event.id),
  ]);

  const allProspects = (prospectRows ?? []) as (ProspectLike & {
    won_vendor_id: string | null;
  })[];
  const linkedVendorIds = new Set(
    allProspects.map((p) => p.won_vendor_id).filter(Boolean) as string[],
  );
  // Working pool of unlinked prospects; matched rows are spliced out.
  const pool: ProspectLike[] = allProspects.filter((p) => !p.won_vendor_id);

  const todo = ((vendorRows ?? []) as VendorLike[]).filter(
    (v) => !linkedVendorIds.has(v.id),
  );

  for (const v of todo) {
    const res = findProspectForVendor(v, pool);
    const company = v.company_name ?? "(no name)";
    if (res.kind === "match") {
      await linkProspect(sb, res.prospectId, v.id);
      const i = pool.findIndex((p) => p.id === res.prospectId);
      if (i >= 0) pool.splice(i, 1);
      summary.linked.push({
        vendorId: v.id,
        company,
        prospectId: res.prospectId,
        matchedBy: res.matchedBy,
      });
    } else if (res.kind === "ambiguous") {
      summary.ambiguous.push({
        vendorId: v.id,
        company,
        matchedBy: res.matchedBy,
        count: res.count,
      });
    } else {
      summary.unmatched.push({ vendorId: v.id, company });
    }
  }

  return summary;
}
