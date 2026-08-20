// Client-safe attendee config (no server-only imports).

/** Lead-gen classification for ticket holders. */
export const ATTENDEE_CATEGORIES = [
  { key: "studio_owner", label: "Studio Owner" },
  { key: "teacher", label: "Teacher" },
  { key: "admin", label: "Admin Superstar" },
] as const;
export type AttendeeCategory = (typeof ATTENDEE_CATEGORIES)[number]["key"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ATTENDEE_CATEGORIES.map((c) => [c.key, c.label]),
);

/** GHL tag per category, for vendor lead workflows. */
export const CATEGORY_TAG: Record<string, string> = {
  studio_owner: "dte27-attendee-studio-owner",
  teacher: "dte27-attendee-teacher",
  admin: "dte27-attendee-admin",
};
export const ALL_CATEGORY_TAGS = Object.values(CATEGORY_TAG);

/** Registration type of a person at the expo. */
export type AttendeeType = "ticket_holder" | "vendor_staff" | "speaker";

export const ATTENDEE_TYPE_LABEL: Record<AttendeeType, string> = {
  ticket_holder: "Ticket holder",
  vendor_staff: "Vendor staff",
  speaker: "Speaker",
};
