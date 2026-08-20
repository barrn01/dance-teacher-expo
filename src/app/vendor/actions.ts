"use server";

import { revalidatePath } from "next/cache";
import { getVendorGate, MAX_VENDOR_STAFF, DOCS_BUCKET } from "@/lib/vendors";
import { DOC_TYPES } from "@/lib/vendor-logos";
import { applyVendorProfile } from "@/lib/vendor-profile";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertContact } from "@/lib/ghl";
import type { Vendor } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VendorSaveResult = { ok: boolean; error?: string };

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Save the signed-in vendor's exhibitor profile. Ownership is enforced by the
 * vendor gate; the shared `applyVendorProfile` core does the field/logo writes.
 */
export async function saveVendorProfile(
  formData: FormData,
): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };

  const res = await applyVendorProfile(gate.vendor, formData);
  if (res.ok) revalidatePath("/vendor");
  return res;
}

// ---------- Attending staff ----------
// Each staff member becomes an attendee + QR pass on a single $0 order linked
// to the vendor (created lazily), using the non-sellable exhibitor_staff type.

type Sb = SupabaseClient;

/** Find (or lazily create) the vendor's $0 exhibitor-staff order. */
async function staffOrderId(sb: Sb, vendor: Vendor): Promise<string | null> {
  const { data: existing } = await sb
    .from("orders")
    .select("id")
    .eq("vendor_id", vendor.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  const { data: created, error } = await sb
    .from("orders")
    .insert({
      event_id: vendor.event_id,
      status: "paid",
      vendor_id: vendor.id,
      buyer_name: vendor.company_name,
      buyer_email: vendor.contact_email,
      buyer_phone: vendor.contact_phone,
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      currency: "AUD",
      registration_kind: "vendor_staff",
      metadata: { exhibitor_staff: true },
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[vendor] staff order create failed", error);
    return null;
  }
  return created.id;
}

/** The event's non-sellable exhibitor-staff ticket type id. */
async function exhibitorTicketTypeId(
  sb: Sb,
  eventId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("ticket_types")
    .select("id")
    .eq("event_id", eventId)
    .eq("key", "exhibitor_staff")
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** Confirm an attendee row belongs to the signed-in vendor's staff order. */
async function ownsStaff(
  sb: Sb,
  vendor: Vendor,
  attendeeId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("attendees")
    .select("id, orders!inner(vendor_id)")
    .eq("id", attendeeId)
    .maybeSingle<{ orders: { vendor_id: string } | { vendor_id: string }[] }>();
  if (!data) return false;
  const o = Array.isArray(data.orders) ? data.orders[0] : data.orders;
  return o?.vendor_id === vendor.id;
}

export async function addVendorStaff(input: {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };
  const vendor = gate.vendor;

  const firstName = input.firstName.trim();
  if (!firstName)
    return { ok: false, error: "A staff member's first name is required." };
  const email = input.email?.trim() || "";
  if (email && !isEmail(email))
    return { ok: false, error: "That staff email doesn't look valid." };

  const sb = createServiceClient();

  // Enforce the per-vendor staff cap.
  const { count } = await sb
    .from("attendees")
    .select("id, orders!inner(vendor_id)", { count: "exact", head: true })
    .eq("orders.vendor_id", vendor.id);
  if ((count ?? 0) >= MAX_VENDOR_STAFF)
    return {
      ok: false,
      error: `You've reached the maximum of ${MAX_VENDOR_STAFF} staff passes. Remove one to add another, or contact us if you need more.`,
    };

  const orderId = await staffOrderId(sb, vendor);
  const ticketTypeId = await exhibitorTicketTypeId(sb, vendor.event_id);
  if (!orderId || !ticketTypeId)
    return { ok: false, error: "Couldn't set up staff passes — try again." };

  const { data: attendee, error: attErr } = await sb
    .from("attendees")
    .insert({
      order_id: orderId,
      ticket_type_id: ticketTypeId,
      first_name: firstName,
      last_name: input.lastName?.trim() || null,
      email: email || null,
      phone: input.phone?.trim() || null,
    })
    .select("id")
    .single();
  if (attErr || !attendee) {
    console.error("[vendor] add staff attendee failed", attErr);
    return { ok: false, error: "Could not add that staff member." };
  }

  const { error: tErr } = await sb.from("tickets").insert({
    order_id: orderId,
    attendee_id: attendee.id,
    ticket_type_id: ticketTypeId,
    event_id: vendor.event_id,
  });
  if (tErr) {
    console.error("[vendor] add staff ticket failed", tErr);
    return { ok: false, error: "Could not issue that staff pass." };
  }

  // Best-effort GHL contact for the staff member (for later app-details comms).
  if (email) {
    const name =
      [firstName, input.lastName?.trim()].filter(Boolean).join(" ") || null;
    await upsertContact({
      email,
      name,
      phone: input.phone?.trim() || null,
      tags: ["dte27 vendor staff"],
    });
  }

  revalidatePath("/vendor");
  return { ok: true };
}

export async function updateVendorStaff(input: {
  attendeeId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };

  const firstName = input.firstName.trim();
  if (!firstName) return { ok: false, error: "First name is required." };
  const email = input.email?.trim() || "";
  if (email && !isEmail(email))
    return { ok: false, error: "That staff email doesn't look valid." };

  const sb = createServiceClient();
  if (!(await ownsStaff(sb, gate.vendor, input.attendeeId)))
    return { ok: false, error: "That staff member isn't on your account." };

  const { error } = await sb
    .from("attendees")
    .update({
      first_name: firstName,
      last_name: input.lastName?.trim() || null,
      email: email || null,
      phone: input.phone?.trim() || null,
    })
    .eq("id", input.attendeeId);
  if (error) return { ok: false, error: "Could not save changes." };

  revalidatePath("/vendor");
  return { ok: true };
}

export async function removeVendorStaff(
  attendeeId: string,
): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };

  const sb = createServiceClient();
  if (!(await ownsStaff(sb, gate.vendor, attendeeId)))
    return { ok: false, error: "That staff member isn't on your account." };

  // Deleting the attendee cascades to their ticket (FK on delete cascade).
  const { error } = await sb.from("attendees").delete().eq("id", attendeeId);
  if (error) return { ok: false, error: "Could not remove that staff member." };

  revalidatePath("/vendor");
  return { ok: true };
}

// ---------- Documents (private bucket) ----------

const DOC_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadVendorDocument(
  formData: FormData,
): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };
  const v = gate.vendor;

  const docType = String(formData.get("doc_type") ?? "other");
  if (!DOC_TYPES.some((d) => d.key === docType))
    return { ok: false, error: "Pick a valid document type." };
  const label = String(formData.get("label") ?? "").trim() || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose a file to upload." };
  const ext = DOC_EXT[file.type];
  if (!ext)
    return { ok: false, error: "File must be a PDF, PNG, JPG or WEBP." };
  if (file.size > MAX_DOC_BYTES)
    return { ok: false, error: "File must be under 10 MB." };

  const sb = createServiceClient();
  const path = `${v.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage
    .from(DOCS_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("[vendor] document upload failed", upErr);
    return { ok: false, error: "Upload failed — please try again." };
  }

  const { error: rowErr } = await sb.from("vendor_documents").insert({
    vendor_id: v.id,
    doc_type: docType,
    label,
    file_name: file.name,
    storage_path: path,
    content_type: file.type,
    size_bytes: file.size,
    uploaded_by: v.contact_email,
  });
  if (rowErr) {
    // Roll back the orphaned upload so storage doesn't drift from the table.
    await sb.storage.from(DOCS_BUCKET).remove([path]);
    console.error("[vendor] document row insert failed", rowErr);
    return { ok: false, error: "Could not save the document." };
  }

  revalidatePath("/vendor");
  return { ok: true };
}

export async function deleteVendorDocument(
  docId: string,
): Promise<VendorSaveResult> {
  const gate = await getVendorGate();
  if (gate.status !== "vendor")
    return { ok: false, error: "You're not signed in as an exhibitor." };

  const sb = createServiceClient();
  const { data: doc } = await sb
    .from("vendor_documents")
    .select("id, vendor_id, storage_path")
    .eq("id", docId)
    .maybeSingle<{ id: string; vendor_id: string; storage_path: string }>();
  if (!doc || doc.vendor_id !== gate.vendor.id)
    return { ok: false, error: "That document isn't on your account." };

  await sb.storage.from(DOCS_BUCKET).remove([doc.storage_path]);
  const { error } = await sb.from("vendor_documents").delete().eq("id", docId);
  if (error) return { ok: false, error: "Could not remove the document." };

  revalidatePath("/vendor");
  return { ok: true };
}
