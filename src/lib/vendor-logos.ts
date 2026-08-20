// Client-safe vendor logo config + pure helpers (NO server-only imports, so
// this can be used from client components like the profile form). The
// server-only lib/vendors re-exports these for server code.
import type { Vendor } from "./types";

/** Max attending staff a vendor can add (per vendor, for now). */
export const MAX_VENDOR_STAFF = 5;

/** Document categories a vendor can upload (insurance, contracts, etc.). */
export const DOC_TYPES = [
  { key: "insurance", label: "Public Liability Insurance" },
  { key: "contract", label: "Signed Contract" },
  { key: "safety", label: "Safety / Compliance" },
  { key: "other", label: "Other" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["key"];

export const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.key, d.label]),
);

/**
 * Purpose-tagged logo slots. `square` is the key one — it powers the exhibitor
 * directory, event app tiles and social content, so the CMS can rely on it.
 */
export const LOGO_SLOTS = [
  {
    key: "square",
    label: "Square logo",
    hint: "1:1 square — used in the event app, exhibitor directory and social tiles. This is the key one for our content system.",
    recommended: true,
  },
  {
    key: "primary",
    label: "Primary logo",
    hint: "Your main logo in full colour, any shape — for light backgrounds.",
    recommended: false,
  },
  {
    key: "horizontal",
    label: "Horizontal logo",
    hint: "Wide / landscape lockup — for banners and headers.",
    recommended: false,
  },
  {
    key: "mono",
    label: "Reversed logo (white)",
    hint: "A white / mono version for dark backgrounds. Optional.",
    recommended: false,
  },
] as const;
export type LogoSlot = (typeof LOGO_SLOTS)[number]["key"];

/** A vendor's logo map (slot -> url), tolerant of a null column. */
export function vendorLogos(v: Vendor): Record<string, string> {
  return (v.logos ?? {}) as Record<string, string>;
}

/** Best single logo for thumbnails/fallbacks: square first, then others. */
export function primaryLogo(v: Vendor): string | null {
  const l = vendorLogos(v);
  return l.square || l.primary || v.logo_url || l.horizontal || l.mono || null;
}

/** Whether the exhibitor profile has the essentials filled in. */
export function isProfileComplete(v: Vendor): boolean {
  // The square logo is required — it's what the directory/app/CMS rely on.
  return !!(vendorLogos(v).square && v.description && v.website_url);
}
