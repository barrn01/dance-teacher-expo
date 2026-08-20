// Client-safe CMS config (no server-only imports — usable in admin forms).

export const SESSION_TYPES = [
  { key: "keynote", label: "Keynote" },
  { key: "workshop", label: "Workshop" },
  { key: "panel", label: "Panel" },
  { key: "social", label: "Social / Feature" },
  { key: "break", label: "Break / Meal" },
  { key: "other", label: "Other" },
] as const;
export type SessionType = (typeof SESSION_TYPES)[number]["key"];

export const SESSION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((s) => [s.key, s.label]),
);

/** Session streams (tracks). Null = no stream (e.g. socials, breaks). */
export const STREAMS = [
  { key: "business", label: "Business" },
  { key: "movement", label: "Movement" },
] as const;
export type Stream = (typeof STREAMS)[number]["key"];

export const STREAM_LABEL: Record<string, string> = Object.fromEntries(
  STREAMS.map((s) => [s.key, s.label]),
);

/** The two event days, for date pickers + schedule grouping. */
export const EVENT_DAYS = [
  { date: "2027-04-17", label: "Saturday 17 April 2027", short: "Sat 17 Apr" },
  { date: "2027-04-18", label: "Sunday 18 April 2027", short: "Sun 18 Apr" },
] as const;

export const DAY_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_DAYS.map((d) => [d.date, d.label]),
);
