// Vendor HQ — Pipeline (prospects) types + pure selectors.
// Client-safe: NO server-only imports, so the interactive board can use it.
// See docs/vendor-hq/integration-plan.md.

export type ProspectStage =
  | "new"
  | "contacted"
  | "convo"
  | "verbal"
  | "won"
  | "lost";

export type TouchChannel = "call" | "sms" | "email" | "dm" | "note";
export type TouchDirection = "out" | "in";

export type ProspectTouch = {
  id: string;
  prospect_id: string;
  occurred_at: string;
  channel: TouchChannel;
  direction: TouchDirection;
  body: string | null;
  by: string | null;
};

export type ProspectNote = {
  id: string;
  prospect_id: string;
  created_at: string;
  by: string | null;
  text: string;
};

export type Prospect = {
  id: string;
  event_id: string;
  name: string;
  ghl_contact_id: string | null;
  tier: string | null;
  type: string | null;
  potential_cents: number | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_insta: string | null;
  source: string | null;
  stage: ProspectStage;
  won_date: string | null;
  won_vendor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectWithHistory = Prospect & {
  touches: ProspectTouch[];
  notes: ProspectNote[];
};

/** A prospect enriched with display-derived values, computed server-side. */
export type BoardProspect = ProspectWithHistory & {
  estCents: number;
  quiet: boolean;
  daysSinceTouch: number | null;
};

/** Board columns, in order. `lost` is intentionally NOT a column (own bucket). */
export const STAGES: [ProspectStage, string][] = [
  ["new", "New lead"],
  ["contacted", "Contacted"],
  ["convo", "In convo"],
  ["verbal", "Verbal yes"],
  ["won", "🎉 Won"],
];

export const STAGE_LABEL: Record<ProspectStage, string> = {
  new: "New lead",
  contacted: "Contacted",
  convo: "In convo",
  verbal: "Verbal yes",
  won: "Won",
  lost: "Not this year",
};

/** Fallback package value ex GST (cents) when a prospect has no explicit potential. */
const TIER_PRICE_CENTS: Record<string, number> = {
  platinum: 10_500_00,
  gold: 6_000_00,
  silver: 4_500_00,
  bronze: 3_500_00,
};

export const QUIET_DAYS = 14;

/** Estimated value: explicit potential wins; else first word of tier → price. */
export function estValueCents(p: Prospect): number {
  if (typeof p.potential_cents === "number") return p.potential_cents;
  const key = (p.tier ?? "").trim().split(/\s+/)[0]?.toLowerCase();
  return TIER_PRICE_CENTS[key] ?? 0;
}

/** ISO of the most recent touch, or null if none. */
export function lastTouchAt(touches: ProspectTouch[]): string | null {
  if (!touches.length) return null;
  return touches
    .map((t) => t.occurred_at)
    .sort()
    .at(-1)!;
}

export function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  return Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000);
}

/**
 * "Gone quiet": in play (not won/lost), past the `new` stage, and no touch in
 * over QUIET_DAYS. A prospect with zero touches is never quiet (still "not
 * contacted yet").
 */
export function isGoneQuiet(p: ProspectWithHistory, nowMs: number): boolean {
  if (p.stage === "won" || p.stage === "lost" || p.stage === "new") return false;
  const ago = daysSince(lastTouchAt(p.touches), nowMs);
  return ago !== null && ago > QUIET_DAYS;
}

export type PulseSummary = {
  inPlay: number; // not won/lost
  inConversation: number; // convo or verbal
  potentialCents: number; // Σ estValue over in-play
  goneQuiet: number;
  won: number;
};

export function pulseSummary(
  prospects: ProspectWithHistory[],
  nowMs: number,
): PulseSummary {
  const inPlay = prospects.filter(
    (p) => p.stage !== "won" && p.stage !== "lost",
  );
  return {
    inPlay: inPlay.length,
    inConversation: inPlay.filter(
      (p) => p.stage === "convo" || p.stage === "verbal",
    ).length,
    potentialCents: inPlay.reduce((t, p) => t + estValueCents(p), 0),
    goneQuiet: inPlay.filter((p) => isGoneQuiet(p, nowMs)).length,
    won: prospects.filter((p) => p.stage === "won").length,
  };
}

/** Group prospects by stage (preserves the element type). */
export function byStage<T extends { stage: ProspectStage }>(
  prospects: T[],
): Record<ProspectStage, T[]> {
  const out = {
    new: [],
    contacted: [],
    convo: [],
    verbal: [],
    won: [],
    lost: [],
  } as Record<ProspectStage, T[]>;
  for (const p of prospects) out[p.stage].push(p);
  return out;
}
