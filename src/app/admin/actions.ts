"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail, getAdminGate } from "@/lib/admin";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getEventWithTicketTypes, EVENT_SLUG } from "@/lib/tickets";
import { sendOrderConfirmation, type TicketForEmail } from "@/lib/email";
import { upsertContact } from "@/lib/ghl";
import { slugify, vendorGhlTags, TIERS, FAMILIES } from "@/lib/vendors";
import { applyVendorProfile } from "@/lib/vendor-profile";
import { removeTagsByEmail } from "@/lib/ghl";
import {
  ATTENDEE_CATEGORIES,
  CATEGORY_TAG,
  ALL_CATEGORY_TAGS,
} from "@/lib/attendee-config";
import type { Vendor } from "@/lib/types";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export type RefundResult = {
  ok: boolean;
  error?: string;
  refundedCents?: number;
  status?: string;
};

/**
 * Refund an order (full or partial) via Stripe, then update our order state.
 * Admin-gated. Idempotency-keyed on the current refunded total so a double
 * submit can't double-refund. A full refund also marks the tickets refunded.
 */
export async function refundOrder(input: {
  orderId: string;
  amountCents?: number; // omitted/0 = refund everything remaining
}): Promise<RefundResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const sb = createServiceClient();
  const { data: order } = await sb
    .from("orders")
    .select(
      "id, status, total_cents, amount_refunded_cents, stripe_payment_intent_id",
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found." };
  if (!order.stripe_payment_intent_id)
    return { ok: false, error: "This order has no payment to refund." };
  if (order.status !== "paid" && order.status !== "partially_refunded")
    return { ok: false, error: `Can't refund a ${order.status} order.` };

  const refundable = order.total_cents - order.amount_refunded_cents;
  if (refundable <= 0) return { ok: false, error: "Nothing left to refund." };

  const amount =
    input.amountCents && input.amountCents > 0 ? input.amountCents : refundable;
  if (amount > refundable)
    return {
      ok: false,
      error: `Max refundable is $${(refundable / 100).toFixed(2)}.`,
    };

  try {
    await getStripe().refunds.create(
      { payment_intent: order.stripe_payment_intent_id, amount },
      {
        idempotencyKey: `refund_${order.id}_${order.amount_refunded_cents}_${amount}`,
      },
    );
  } catch (e) {
    console.error("[admin] Stripe refund failed", e);
    return { ok: false, error: "Stripe refused the refund — please try again." };
  }

  const newRefunded = order.amount_refunded_cents + amount;
  const fullyRefunded = newRefunded >= order.total_cents;
  const newStatus = fullyRefunded ? "refunded" : "partially_refunded";

  await sb
    .from("orders")
    .update({ status: newStatus, amount_refunded_cents: newRefunded })
    .eq("id", order.id);

  // On a full refund, void the tickets so they can't be used at the door.
  if (fullyRefunded) {
    await sb
      .from("tickets")
      .update({ status: "refunded" })
      .eq("order_id", order.id);
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin");
  return { ok: true, refundedCents: newRefunded, status: newStatus };
}

/**
 * Admin sign-in request. Unlike the buyer login (open to anyone), this checks
 * the admin allowlist BEFORE sending — a non-admin email gets a clear error and
 * no email at all. The magic link uses the token-hash flow (see /auth/confirm).
 */
export async function requestAdminLink(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim();
  if (!isEmail(e)) return { ok: false, error: "Please enter a valid email." };
  if (!isAdminEmail(e))
    return { ok: false, error: "This email doesn't have admin access." };

  const supabase = await createAuthServerClient();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dance-teacher-expo.vercel.app";
  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { emailRedirectTo: `${site}/auth/confirm?next=/admin` },
  });
  if (error) {
    console.error("[admin] signInWithOtp failed", error.message);
    return { ok: false, error: "Couldn't send the link — please try again." };
  }
  return { ok: true };
}

export type CompResult = {
  ok: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: string;
};

/**
 * Issue complimentary tickets (speakers, staff, prizes). Creates a paid $0
 * order flagged as a comp, one attendee + ticket per seat (recipient is the
 * first attendee, extras left unassigned to fill in later), optionally emails
 * the recipient their QR tickets, and syncs them to GHL as an attendee.
 */
export async function createComp(input: {
  name: string;
  email: string;
  phone?: string;
  ticketTypeKey?: string;
  quantity: number;
  reason: string;
  sendEmail: boolean;
}): Promise<CompResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Recipient name is required." };
  if (!isEmail(email))
    return { ok: false, error: "A valid recipient email is required." };
  const qty = Math.max(1, Math.min(50, Math.floor(input.quantity || 1)));

  const data = await getEventWithTicketTypes();
  if (!data) return { ok: false, error: "Event not found." };
  const tt =
    data.ticketTypes.find((t) => t.key === input.ticketTypeKey) ??
    data.ticketTypes[0];
  if (!tt) return { ok: false, error: "No ticket type configured." };

  const sb = createServiceClient();

  const { data: created, error: orderErr } = await sb
    .from("orders")
    .insert({
      event_id: data.event.id,
      status: "paid",
      buyer_name: name,
      buyer_email: email,
      buyer_phone: input.phone?.trim() || null,
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      currency: tt.currency,
      metadata: {
        comp: true,
        comp_reason: input.reason?.trim() || null,
        issued_by: gate.user.email,
      },
    })
    .select("id, order_number")
    .single();
  if (orderErr || !created)
    return { ok: false, error: "Could not create the comp order." };

  await sb.from("order_items").insert({
    order_id: created.id,
    ticket_type_id: tt.id,
    quantity: qty,
    unit_price_cents: 0,
    line_total_cents: 0,
  });

  const [first, ...rest] = name.split(/\s+/);
  const attRows = Array.from({ length: qty }, (_, i) =>
    i === 0
      ? {
          order_id: created.id,
          ticket_type_id: tt.id,
          first_name: first || null,
          last_name: rest.join(" ") || null,
          email,
          phone: input.phone?.trim() || null,
        }
      : {
          order_id: created.id,
          ticket_type_id: tt.id,
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
        },
  );
  const { data: atts } = await sb
    .from("attendees")
    .insert(attRows)
    .select("id");

  const { data: tickets } = await sb
    .from("tickets")
    .insert(
      (atts ?? []).map((a) => ({
        order_id: created.id,
        attendee_id: a.id,
        ticket_type_id: tt.id,
        event_id: data.event.id,
      })),
    )
    .select("qr_token, attendee:attendees(first_name, last_name)");

  if (input.sendEmail) {
    const forEmail: TicketForEmail[] = (tickets ?? []).map((t, i) => {
      const a = one(
        t.attendee as
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null,
      );
      const nm = [a?.first_name, a?.last_name].filter(Boolean).join(" ");
      return {
        attendeeName: nm || `Attendee ${i + 1}`,
        ticketTypeName: tt.name,
        qrToken: t.qr_token,
      };
    });
    await sendOrderConfirmation({
      to: email,
      buyerName: name,
      orderNumber: created.order_number,
      eventName: data.event.name,
      totalCents: 0,
      tickets: forEmail,
    });
  }

  await upsertContact({
    email,
    name,
    phone: input.phone?.trim() || null,
    tags: ["DTE2027-attendee", "DTE2027-comp"],
  });

  revalidatePath("/admin");
  return { ok: true, orderId: created.id, orderNumber: created.order_number };
}

export type PromoActionResult = { ok: boolean; error?: string };

type PromoInput = {
  code: string;
  discountType: "percent" | "fixed_amount";
  discountValue: number;
  maxRedemptions?: number | null;
  endsAt?: string | null;
};

type PromoInsertRow = {
  code: string;
  discount_type: "percent" | "fixed_amount";
  discount_value: number;
  max_redemptions: number | null;
  ends_at: string | null;
};

/**
 * Validate + normalise one promo code (shared by the single-create form and the
 * CSV bulk upload). Value is % for percent, dollars for fixed (stored as cents).
 */
function normalizePromo(
  input: PromoInput,
): { ok: true; row: PromoInsertRow } | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{2,40}$/.test(code))
    return { ok: false, error: "Code must be 2–40 letters, numbers or - _ ." };

  if (input.discountType === "percent") {
    if (!(input.discountValue >= 1 && input.discountValue <= 100))
      return { ok: false, error: "Percent must be 1–100." };
  } else if (!(input.discountValue > 0)) {
    return { ok: false, error: "Amount must be more than $0." };
  }
  const discount_value =
    input.discountType === "percent"
      ? Math.round(input.discountValue)
      : Math.round(input.discountValue * 100); // dollars → cents

  const max =
    input.maxRedemptions != null && input.maxRedemptions > 0
      ? Math.floor(input.maxRedemptions)
      : null;

  return {
    ok: true,
    row: {
      code,
      discount_type: input.discountType,
      discount_value,
      max_redemptions: max,
      ends_at: input.endsAt || null,
    },
  };
}

/** Create a promo code (admin). Value is % (percent) or dollars (fixed). */
export async function createPromo(
  input: PromoInput,
): Promise<PromoActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const norm = normalizePromo(input);
  if (!norm.ok) return { ok: false, error: norm.error };

  const data = await getEventWithTicketTypes();
  const sb = createServiceClient();
  const { error } = await sb.from("promo_codes").insert({
    event_id: data?.event.id ?? null,
    ...norm.row,
    is_active: true,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "That code already exists." };
    console.error("[admin] createPromo failed", error);
    return { ok: false, error: "Could not create the code." };
  }
  revalidatePath("/admin/promo");
  return { ok: true };
}

export type BulkPromoRowResult = {
  line: number; // 1-based line number in the uploaded file
  code: string;
  ok: boolean;
  error?: string;
};

export type BulkPromoResult = {
  ok: boolean;
  error?: string;
  created: number;
  failed: number;
  results: BulkPromoRowResult[];
};

/** Map a CSV type cell (or the value cell) to a discount type. */
function csvDiscountType(
  typeCell: string,
  valueCell: string,
): "percent" | "fixed_amount" {
  const t = typeCell.trim().toLowerCase();
  if (t) {
    if (t.startsWith("p") || t.includes("percent") || t.includes("%"))
      return "percent";
    if (
      t.startsWith("f") ||
      t.startsWith("$") ||
      t.includes("fixed") ||
      t.includes("amount") ||
      t.includes("dollar")
    )
      return "fixed_amount";
  }
  // No usable type column — infer from the value cell's symbol.
  if (valueCell.includes("$")) return "fixed_amount";
  return "percent";
}

/** Parse an expiry cell. Blank → null; a bare date → end of that day. */
function csvExpiry(
  raw: string,
): { ok: true; iso: string | null } | { ok: false } {
  const s = raw.trim();
  if (!s) return { ok: true, iso: null };
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(isDateOnly ? `${s}T23:59:59+10:00` : s);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, iso: d.toISOString() };
}

/**
 * Bulk-create promo codes from raw CSV text (admin). Columns (header row
 * optional, matched by name; otherwise positional): code, type, value,
 * max_uses, expires. Each row is validated independently — a bad row is
 * reported and skipped, the rest still import. Codes are created active.
 */
export async function createPromosBulk(
  csv: string,
): Promise<BulkPromoResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin")
    return { ok: false, error: "Not authorised.", created: 0, failed: 0, results: [] };

  const { parseCsv } = await import("@/lib/csv");
  const rows = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0)
    return { ok: false, error: "The file is empty.", created: 0, failed: 0, results: [] };

  // Header detection: if the first row names a "code" column, map columns by
  // name; otherwise treat every row as data in positional order.
  let cols = { code: 0, type: 1, value: 2, max: 3, expires: 4 };
  let dataStart = 0;
  const first = rows[0].map((c) => c.trim().toLowerCase());
  if (first.some((h) => h === "code")) {
    const find = (names: string[]) =>
      first.findIndex((h) => names.includes(h));
    cols = {
      code: find(["code"]),
      type: find(["type", "discount_type", "discount type", "kind"]),
      value: find([
        "value",
        "amount",
        "discount",
        "discount_value",
        "off",
      ]),
      max: find([
        "max_uses",
        "max uses",
        "max_redemptions",
        "max redemptions",
        "limit",
        "uses",
      ]),
      expires: find([
        "expires",
        "expiry",
        "ends_at",
        "ends",
        "end",
        "expires_at",
      ]),
    };
    dataStart = 1;
  }

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "") : "");

  const data = await getEventWithTicketTypes();
  const eventId = data?.event.id ?? null;
  const sb = createServiceClient();

  const results: BulkPromoRowResult[] = [];
  const seen = new Set<string>();

  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const rawCode = cell(r, cols.code).trim();

    const valueCell = cell(r, cols.value);
    const discountType = csvDiscountType(cell(r, cols.type), valueCell);
    const discountValue = parseFloat(valueCell.replace(/[$,%\s]/g, ""));
    const maxDigits = cell(r, cols.max).replace(/[^\d]/g, "");
    const maxRedemptions = maxDigits ? parseInt(maxDigits, 10) : null;

    if (Number.isNaN(discountValue)) {
      results.push({ line, code: rawCode, ok: false, error: "Missing or invalid discount value." });
      continue;
    }

    const norm = normalizePromo({
      code: rawCode,
      discountType,
      discountValue,
      maxRedemptions,
    });
    if (!norm.ok) {
      results.push({ line, code: rawCode, ok: false, error: norm.error });
      continue;
    }

    const exp = csvExpiry(cell(r, cols.expires));
    if (!exp.ok) {
      results.push({ line, code: norm.row.code, ok: false, error: "Invalid expiry date." });
      continue;
    }

    if (seen.has(norm.row.code)) {
      results.push({ line, code: norm.row.code, ok: false, error: "Duplicate code in file." });
      continue;
    }
    seen.add(norm.row.code);

    const { error } = await sb.from("promo_codes").insert({
      event_id: eventId,
      ...norm.row,
      ends_at: exp.iso,
      is_active: true,
    });
    if (error) {
      results.push({
        line,
        code: norm.row.code,
        ok: false,
        error:
          error.code === "23505"
            ? "Code already exists."
            : "Database error.",
      });
      continue;
    }
    results.push({ line, code: norm.row.code, ok: true });
  }

  const created = results.filter((x) => x.ok).length;
  const failed = results.length - created;
  if (created > 0) revalidatePath("/admin/promo");
  return { ok: true, created, failed, results };
}

export type VendorActionResult = {
  ok: boolean;
  error?: string;
  vendorId?: string;
};

/** Set (or clear) a ticket holder's lead-gen category. Admin. */
export async function setAttendeeCategory(
  attendeeId: string,
  category: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const value =
    category && ATTENDEE_CATEGORIES.some((c) => c.key === category)
      ? category
      : null;
  const sb = createServiceClient();
  const { data: att } = await sb
    .from("attendees")
    .select("email, first_name, last_name, phone")
    .eq("id", attendeeId)
    .maybeSingle<{
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
    }>();

  const { error } = await sb
    .from("attendees")
    .update({ category: value })
    .eq("id", attendeeId);
  if (error) return { ok: false, error: "Could not update." };

  // Sync the role tag to GHL (best-effort) so vendor lead workflows can use it.
  if (att?.email) {
    const roleTag = value ? CATEGORY_TAG[value] : null;
    if (roleTag) {
      const name =
        [att.first_name, att.last_name].filter(Boolean).join(" ") || null;
      await upsertContact({
        email: att.email,
        name,
        phone: att.phone,
        tags: ["DTE2027-attendee", roleTag],
      });
    }
    const stale = ALL_CATEGORY_TAGS.filter((t) => t !== roleTag);
    if (stale.length) await removeTagsByEmail(att.email, stale);
  }

  revalidatePath("/admin/attendees");
  return { ok: true };
}

/**
 * Create a vendor (admin). Seeds the exhibitor record + GHL contact with the
 * `dte27 vendor` and per-tier tags. The vendor then signs in via magic link to
 * complete their listing. Contact email is the login identity (unique per event
 * in practice; a duplicate email just means they'd see the first match).
 */
export async function createVendor(input: {
  companyName: string;
  contactEmail: string;
  contactName?: string;
  contactPhone?: string;
  packageFamily?: string | null;
  packageTier?: string | null;
}): Promise<VendorActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const companyName = input.companyName.trim();
  const contactEmail = input.contactEmail.trim();
  if (!companyName) return { ok: false, error: "Company name is required." };
  if (!isEmail(contactEmail))
    return { ok: false, error: "A valid contact email is required." };

  const family =
    input.packageFamily && FAMILIES.includes(input.packageFamily as never)
      ? input.packageFamily
      : null;
  const tier =
    input.packageTier && TIERS.includes(input.packageTier as never)
      ? input.packageTier
      : null;

  const data = await getEventWithTicketTypes(EVENT_SLUG);
  if (!data) return { ok: false, error: "Event not found." };

  const sb = createServiceClient();

  // Insert with a unique slug (retry once with a random suffix on collision).
  const base = slugify(companyName) || "vendor";
  let vendorId: string | null = null;
  for (const slug of [base, `${base}-${crypto.randomUUID().slice(0, 4)}`]) {
    const { data: created, error } = await sb
      .from("vendors")
      .insert({
        event_id: data.event.id,
        company_name: companyName,
        slug,
        package_family: family,
        package_tier: tier,
        contact_email: contactEmail,
        contact_name: input.contactName?.trim() || null,
        contact_phone: input.contactPhone?.trim() || null,
      })
      .select("id")
      .single();
    if (!error && created) {
      vendorId = created.id;
      break;
    }
    if (error && error.code !== "23505") {
      console.error("[admin] createVendor failed", error);
      return { ok: false, error: "Could not create the vendor." };
    }
    // 23505 on (event_id, slug) → loop retries with a suffixed slug.
  }
  if (!vendorId)
    return { ok: false, error: "Could not create a unique vendor slug." };

  // Tag in GHL (best-effort — never block creation).
  await upsertContact({
    email: contactEmail,
    name: input.contactName?.trim() || companyName,
    phone: input.contactPhone?.trim() || null,
    tags: vendorGhlTags(tier),
  });

  revalidatePath("/admin/vendors");
  return { ok: true, vendorId };
}

/**
 * Edit a vendor's exhibitor profile ON THEIR BEHALF (admin support). Same core
 * write as the vendor self-service save, but admin-gated and targeting any
 * vendor by id.
 */
export async function adminSaveVendorProfile(
  vendorId: string,
  formData: FormData,
): Promise<VendorActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const sb = createServiceClient();
  const { data: vendor } = await sb
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle<Vendor>();
  if (!vendor) return { ok: false, error: "Vendor not found." };

  const res = await applyVendorProfile(vendor, formData);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  return { ok: true };
}

/** Review a vendor document: mark approved / rejected / submitted (admin). */
export async function setVendorDocumentStatus(
  docId: string,
  status: "submitted" | "approved" | "rejected",
): Promise<VendorActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  if (!["submitted", "approved", "rejected"].includes(status))
    return { ok: false, error: "Invalid status." };

  const sb = createServiceClient();
  const { data: doc } = await sb
    .from("vendor_documents")
    .select("vendor_id")
    .eq("id", docId)
    .maybeSingle<{ vendor_id: string }>();
  if (!doc) return { ok: false, error: "Document not found." };

  const { error } = await sb
    .from("vendor_documents")
    .update({ status })
    .eq("id", docId);
  if (error) return { ok: false, error: "Could not update the document." };

  revalidatePath(`/admin/vendors/${doc.vendor_id}`);
  return { ok: true };
}

/**
 * Edit a vendor's record fields (company, package family/tier, contact, booth,
 * status) — admin. Keeps GHL tier tags in sync when the tier changes.
 */
export async function updateVendorRecord(input: {
  id: string;
  companyName: string;
  contactEmail: string;
  contactName?: string;
  contactPhone?: string;
  packageFamily?: string | null;
  packageTier?: string | null;
  boothNumber?: string;
  status?: "active" | "inactive";
}): Promise<VendorActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const companyName = input.companyName.trim();
  const contactEmail = input.contactEmail.trim();
  if (!companyName) return { ok: false, error: "Company name is required." };
  if (!isEmail(contactEmail))
    return { ok: false, error: "A valid contact email is required." };

  const family =
    input.packageFamily && FAMILIES.includes(input.packageFamily as never)
      ? input.packageFamily
      : null;
  const tier =
    input.packageTier && TIERS.includes(input.packageTier as never)
      ? input.packageTier
      : null;
  const status = input.status === "inactive" ? "inactive" : "active";

  const sb = createServiceClient();
  const { data: before } = await sb
    .from("vendors")
    .select("package_tier, contact_email")
    .eq("id", input.id)
    .maybeSingle<{ package_tier: string | null; contact_email: string }>();
  if (!before) return { ok: false, error: "Vendor not found." };

  const { error } = await sb
    .from("vendors")
    .update({
      company_name: companyName,
      contact_email: contactEmail,
      contact_name: input.contactName?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      package_family: family,
      package_tier: tier,
      booth_number: input.boothNumber?.trim() || null,
      status,
    })
    .eq("id", input.id);
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Another vendor already uses that slug." };
    console.error("[admin] updateVendorRecord failed", error);
    return { ok: false, error: "Could not save the vendor." };
  }

  // Keep GHL tier tags in sync (best-effort — never block the save).
  const tierChanged = (before.package_tier ?? null) !== tier;
  if (tierChanged || before.contact_email !== contactEmail) {
    await upsertContact({
      email: contactEmail,
      name: input.contactName?.trim() || companyName,
      phone: input.contactPhone?.trim() || null,
      tags: vendorGhlTags(tier),
    });
    // Strip the stale tier tag from the same contact if only the tier changed.
    if (
      tierChanged &&
      before.package_tier &&
      before.contact_email === contactEmail
    ) {
      await removeTagsByEmail(contactEmail, [
        `dte27 ${before.package_tier} vendor`,
      ]);
    }
  }

  revalidatePath(`/admin/vendors/${input.id}`);
  revalidatePath("/admin/vendors");
  return { ok: true };
}

/** Email a vendor their magic sign-in link (admin-triggered). */
export async function resendVendorLink(
  vendorId: string,
): Promise<VendorActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const sb = createServiceClient();
  const { data: vendor } = await sb
    .from("vendors")
    .select("contact_email")
    .eq("id", vendorId)
    .maybeSingle<{ contact_email: string }>();
  if (!vendor) return { ok: false, error: "Vendor not found." };

  const supabase = await createAuthServerClient();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || "https://dance-teacher-expo.vercel.app";
  const { error } = await supabase.auth.signInWithOtp({
    email: vendor.contact_email,
    options: { emailRedirectTo: `${site}/auth/confirm?next=/vendor` },
  });
  if (error) {
    console.error("[admin] resendVendorLink failed", error.message);
    return { ok: false, error: "Couldn't send the link — please try again." };
  }
  return { ok: true };
}

export type TicketBandInput = {
  from: number;
  to: number | null;
  priceDollars: number;
};

export type UpdateTicketInput = {
  id: string;
  name: string;
  description: string;
  basePriceDollars: number;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
  isFeatured: boolean;
  inclusions: string[];
  priceBands: TicketBandInput[];
};

/**
 * Edit a ticket type's config — name, copy, base price, per-order limits,
 * inclusions and the position-based price bands. Admin-gated. Amounts arrive in
 * dollars and are stored as integer cents. Unknown `pricing_rules` keys are
 * preserved; an empty band list clears `price_bands` (flat base price applies).
 */
export async function updateTicketType(
  input: UpdateTicketInput,
): Promise<PromoActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const toCents = (d: number) => Math.round(d * 100);
  if (!(input.basePriceDollars >= 0))
    return { ok: false, error: "Base price can't be negative." };

  const minQ = Math.max(1, Math.floor(input.minQuantity || 1));
  const maxQ =
    input.maxQuantity != null && input.maxQuantity > 0
      ? Math.floor(input.maxQuantity)
      : null;
  if (maxQ != null && maxQ < minQ)
    return { ok: false, error: "Max per order can't be below the minimum." };

  // Validate + normalise the price bands (ordered by position).
  const bands = [...input.priceBands]
    .map((b) => ({
      from: Math.floor(b.from),
      to: b.to != null ? Math.floor(b.to) : null,
      price_cents: toCents(b.priceDollars),
    }))
    .sort((a, b) => a.from - b.from);
  for (const b of bands) {
    if (!(b.from >= 1))
      return { ok: false, error: "Each band's 'from' position must be 1 or more." };
    if (b.to != null && b.to < b.from)
      return { ok: false, error: "A band's 'to' can't be below its 'from'." };
    if (!(b.price_cents >= 0))
      return { ok: false, error: "Band prices can't be negative." };
  }

  const inclusions = input.inclusions
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("ticket_types")
    .select("pricing_rules")
    .eq("id", input.id)
    .maybeSingle<{ pricing_rules: Record<string, unknown> | null }>();

  const pricing_rules: Record<string, unknown> = { ...(existing?.pricing_rules ?? {}) };
  if (bands.length > 0) {
    pricing_rules.price_bands = bands.map((b) =>
      b.to != null
        ? { from: b.from, to: b.to, price_cents: b.price_cents }
        : { from: b.from, price_cents: b.price_cents },
    );
  } else {
    delete pricing_rules.price_bands;
  }

  const { error } = await sb
    .from("ticket_types")
    .update({
      name,
      description: input.description.trim() || null,
      price_cents: toCents(input.basePriceDollars),
      min_quantity: minQ,
      max_quantity: maxQ,
      is_active: input.isActive,
      is_featured: input.isFeatured,
      inclusions,
      pricing_rules,
    })
    .eq("id", input.id);

  if (error) {
    console.error("[admin] updateTicketType failed", error);
    return { ok: false, error: "Could not save the ticket type." };
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/tickets");
  revalidatePath("/");
  return { ok: true };
}

/** Activate/deactivate a promo code (admin). */
export async function setPromoActive(
  id: string,
  isActive: boolean,
): Promise<PromoActionResult> {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return { ok: false, error: "Not authorised." };
  const sb = createServiceClient();
  const { error } = await sb
    .from("promo_codes")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not update the code." };
  revalidatePath("/admin/promo");
  return { ok: true };
}
