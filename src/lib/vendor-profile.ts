import "server-only";
import { createServiceClient } from "./supabase/server";
import { LOGO_SLOTS, vendorLogos } from "./vendor-logos";
import type { Vendor } from "./types";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Add https:// to a bare domain; leave blank as blank. */
function normalizeUrl(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3 MB

export type ProfileSaveResult = { ok: boolean; error?: string };

/**
 * Apply an exhibitor-profile update (text fields + per-slot logo upload/remove)
 * to a given vendor. Shared by the vendor self-service action and the admin
 * edit-on-behalf action — the CALLER is responsible for authorising first.
 */
export async function applyVendorProfile(
  vendor: Vendor,
  formData: FormData,
): Promise<ProfileSaveResult> {
  const sb = createServiceClient();

  const str = (k: string) => {
    const val = formData.get(k);
    return typeof val === "string" ? val.trim() : "";
  };

  const description = str("description");
  const website_url = normalizeUrl(str("website_url"));
  const instagram = str("instagram").replace(/^@/, "") || null;
  const facebook = normalizeUrl(str("facebook"));
  const publicEmail = str("public_contact_email");

  // Logos: one optional file per named slot, plus an optional per-slot remove.
  const logos: Record<string, string> = { ...vendorLogos(vendor) };
  for (const slot of LOGO_SLOTS) {
    if (formData.get(`remove_${slot.key}`) === "on") {
      delete logos[slot.key];
      continue;
    }
    const file = formData.get(`logo_${slot.key}`);
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = LOGO_TYPES[file.type];
    if (!ext)
      return {
        ok: false,
        error: `${slot.label} must be a PNG, JPG, WEBP or SVG.`,
      };
    if (file.size > MAX_LOGO_BYTES)
      return { ok: false, error: `${slot.label} must be under 3 MB.` };
    const path = `${vendor.id}/${slot.key}-${crypto.randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from("vendor-logos")
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (upErr) {
      console.error("[vendor] logo upload failed", upErr);
      return { ok: false, error: `${slot.label} upload failed — try again.` };
    }
    logos[slot.key] = sb.storage
      .from("vendor-logos")
      .getPublicUrl(path).data.publicUrl;
  }

  const logo_url = logos.square || logos.primary || null;
  const complete = !!(logos.square && description && website_url);

  const { error } = await sb
    .from("vendors")
    .update({
      description: description || null,
      website_url,
      instagram,
      facebook,
      public_contact_email: isEmail(publicEmail) ? publicEmail : null,
      logos,
      logo_url,
      profile_completed_at: complete
        ? (vendor.profile_completed_at ?? new Date().toISOString())
        : null,
    })
    .eq("id", vendor.id);

  if (error) {
    console.error("[vendor] profile save failed", error);
    return { ok: false, error: "Could not save the profile." };
  }
  return { ok: true };
}
