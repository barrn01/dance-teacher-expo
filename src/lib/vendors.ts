import "server-only";
import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/server";
import { createAuthServerClient } from "./supabase/auth-server";
import { EVENT_SLUG } from "./tickets";
import type { Vendor, VendorDocument } from "./types";

export const DOCS_BUCKET = "vendor-documents";

// Client-safe logo config + pure helpers live in a separate module (no
// server-only imports); re-export so server code can keep importing from here.
export {
  LOGO_SLOTS,
  MAX_VENDOR_STAFF,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  vendorLogos,
  primaryLogo,
  isProfileComplete,
  type LogoSlot,
  type DocType,
} from "./vendor-logos";

export const TIERS = ["platinum", "gold", "silver", "bronze"] as const;
export const FAMILIES = ["service", "fashion"] as const;
export type Tier = (typeof TIERS)[number];
export type Family = (typeof FAMILIES)[number];

export const TIER_LABEL: Record<Tier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};
export const FAMILY_LABEL: Record<Family, string> = {
  service: "Service",
  fashion: "Fashion",
};

// Indicative package investment (ex GST), from the 2027 vendor prospectus.
export const TIER_PRICE_EX_GST: Record<Tier, number> = {
  platinum: 10500,
  gold: 6000,
  silver: 4500,
  bronze: 3500,
};

// $500 deposit locks a tier (vendor prospectus). GST is added on top of the
// ex-GST package prices above (vendor pricing is quoted +GST).
export const VENDOR_DEPOSIT_EX_GST = 500;
export const GST_RATE = 0.1;

export type VendorTierStat = {
  tier: Tier;
  /** Active (signed) vendors on this tier. */
  count: number;
  /** Committed package value ex GST for this tier, in integer cents. */
  valueCents: number;
};

export type VendorSummary = {
  /** Every vendor row, any status. */
  total: number;
  /** Signed = active vendors (deposit paid / admin-created, not withdrawn). */
  signed: number;
  /** Withdrawn / inactive vendors. */
  inactive: number;
  /** Signed vendors with no tier yet (excluded from the committed $ value). */
  untiered: number;
  /** Total committed package value across signed vendors, ex GST, in cents. */
  committedExGstCents: number;
  /** Same total with GST added, in cents. */
  committedIncGstCents: number;
  /** Deposits locked: $500 per signed vendor, ex GST, in cents. */
  depositsExGstCents: number;
  /** Per-tier counts + value, ordered platinum → bronze. */
  tiers: VendorTierStat[];
};

/**
 * Roll up signed-vendor counts and committed revenue for the admin dashboard.
 * "Signed" = an active vendor row; committed value sums the tier package price
 * (ex GST) for each signed vendor that has a tier. Untiered signed vendors are
 * counted but contribute $0 until a tier is set. Pure — no DB access.
 */
export function summariseVendors(
  vendors: Pick<Vendor, "status" | "package_tier">[],
): VendorSummary {
  const active = vendors.filter((v) => v.status === "active");
  const tiers: VendorTierStat[] = TIERS.map((tier) => {
    const count = active.filter((v) => v.package_tier === tier).length;
    return { tier, count, valueCents: count * TIER_PRICE_EX_GST[tier] * 100 };
  });
  const committedExGstCents = tiers.reduce((n, t) => n + t.valueCents, 0);
  return {
    total: vendors.length,
    signed: active.length,
    inactive: vendors.length - active.length,
    untiered: active.filter((v) => !v.package_tier).length,
    committedExGstCents,
    committedIncGstCents: Math.round(committedExGstCents * (1 + GST_RATE)),
    depositsExGstCents: active.length * VENDOR_DEPOSIT_EX_GST * 100,
    tiers,
  };
}

/**
 * GHL tags for a vendor: the overarching `dte27 vendor` plus a per-tier tag
 * (`dte27 gold vendor`, etc.) matching Nathan's existing GHL tag scheme.
 */
export function vendorGhlTags(tier: string | null): string[] {
  const tags = ["dte27 vendor"];
  if (tier) tags.push(`dte27 ${tier} vendor`);
  return tags;
}

/** URL-safe slug from a company name. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Pull a tier key out of a GHL tag list, e.g. "dte27 gold vendor" → "gold". */
export function tierFromTags(tags: string[] | string | null | undefined): string | null {
  const list = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags.split(",")
      : [];
  for (const raw of list) {
    const t = raw.trim().toLowerCase();
    for (const tier of TIERS) {
      if (t === `dte27 ${tier} vendor` || t === tier) return tier;
    }
  }
  return null;
}

export type VendorIntakeResult = {
  ok: boolean;
  created?: boolean;
  vendorId?: string;
  error?: string;
};

/**
 * Create or update a vendor from a GHL deposit (no admin gate; called by the
 * inbound webhook after secret verification). Matches an existing vendor by
 * contact email and only fills tier/family when supplied — it never clobbers a
 * vendor's own profile edits.
 */
export async function upsertVendorFromDeposit(input: {
  companyName: string;
  contactEmail: string;
  contactName?: string | null;
  contactPhone?: string | null;
  tier?: string | null;
  family?: string | null;
}): Promise<VendorIntakeResult> {
  const companyName = input.companyName?.trim();
  const contactEmail = input.contactEmail?.trim();
  if (!companyName) return { ok: false, error: "Missing company name." };
  if (!isEmail(contactEmail)) return { ok: false, error: "Invalid contact email." };

  const tier = input.tier && TIERS.includes(input.tier as never) ? input.tier : null;
  const family =
    input.family && FAMILIES.includes(input.family as never) ? input.family : null;

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle<{ id: string }>();
  if (!event) return { ok: false, error: "Event not found." };

  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("event_id", event.id)
    .eq("contact_email", contactEmail)
    .maybeSingle<{ id: string }>();

  if (existing) {
    const update: Record<string, unknown> = { company_name: companyName };
    if (input.contactName?.trim()) update.contact_name = input.contactName.trim();
    if (input.contactPhone?.trim()) update.contact_phone = input.contactPhone.trim();
    if (tier) update.package_tier = tier;
    if (family) update.package_family = family;
    const { error } = await sb.from("vendors").update(update).eq("id", existing.id);
    if (error) {
      console.error("[intake] vendor update failed", error);
      return { ok: false, error: "Update failed." };
    }
    return { ok: true, created: false, vendorId: existing.id };
  }

  const base = slugify(companyName) || "vendor";
  for (const slug of [base, `${base}-${crypto.randomUUID().slice(0, 4)}`]) {
    const { data: created, error } = await sb
      .from("vendors")
      .insert({
        event_id: event.id,
        company_name: companyName,
        slug,
        package_tier: tier,
        package_family: family,
        contact_email: contactEmail,
        contact_name: input.contactName?.trim() || null,
        contact_phone: input.contactPhone?.trim() || null,
      })
      .select("id")
      .single();
    if (!error && created) return { ok: true, created: true, vendorId: created.id };
    if (error && error.code !== "23505") {
      console.error("[intake] vendor insert failed", error);
      return { ok: false, error: "Insert failed." };
    }
  }
  return { ok: false, error: "Could not create a unique slug." };
}

/** Look up a vendor by their login email (service client — bypasses RLS). */
export async function getVendorByEmail(email: string): Promise<Vendor | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("vendors")
    .select("*")
    .eq("contact_email", email)
    .maybeSingle<Vendor>();
  return data ?? null;
}

export type VendorGate =
  | { status: "anon" }
  | { status: "not_vendor"; email: string | null }
  | { status: "vendor"; user: User; vendor: Vendor };

/** Resolve the current vendor session for gating /vendor pages. */
export async function getVendorGate(): Promise<VendorGate> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { status: "anon" };
  const vendor = await getVendorByEmail(user.email);
  if (!vendor) return { status: "not_vendor", email: user.email };
  return { status: "vendor", user, vendor };
}

export type VendorStaff = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  ticket_status: string | null;
};

// PostgREST may type an embedded to-one relation as an array — normalise.
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/** A vendor's attending staff (attendees on their $0 exhibitor order). */
export async function getVendorStaff(vendorId: string): Promise<VendorStaff[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("attendees")
    .select(
      "id, first_name, last_name, email, phone, created_at, tickets(status), orders!inner(vendor_id)",
    )
    .eq("orders.vendor_id", vendorId)
    .order("created_at", { ascending: true });
  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    tickets: { status: string } | { status: string }[] | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    ticket_status: one(r.tickets)?.status ?? null,
  }));
}

export type VendorDocumentWithUrl = VendorDocument & {
  signedUrl: string | null;
};

/**
 * A vendor's documents with short-lived signed download URLs (private bucket —
 * files are never public). Call only after gating (vendor owns them, or admin).
 */
export async function getVendorDocuments(
  vendorId: string,
): Promise<VendorDocumentWithUrl[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("vendor_documents")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as VendorDocument[];

  return Promise.all(
    docs.map(async (d) => {
      const { data: signed } = await sb.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(d.storage_path, 3600); // 1 hour
      return { ...d, signedUrl: signed?.signedUrl ?? null };
    }),
  );
}
