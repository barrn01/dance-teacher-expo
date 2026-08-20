import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { listAttendees, attendeeCounts } from "@/lib/attendees";
import {
  ATTENDEE_CATEGORIES,
  ATTENDEE_TYPE_LABEL,
  CATEGORY_LABEL,
  type AttendeeType,
} from "@/lib/attendee-config";
import { AttendeeCategorySelect } from "@/components/admin/AttendeeControls";

export const dynamic = "force-dynamic";

const TYPES: (AttendeeType | "all")[] = [
  "all",
  "ticket_holder",
  "vendor_staff",
  "speaker",
];

const typeStyle: Record<string, string> = {
  ticket_holder: "bg-pink/15 text-pink",
  vendor_staff: "bg-amber-100 text-amber-800",
  speaker: "bg-violet-100 text-violet-800",
};

export default async function AdminAttendeesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string; q?: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sp = await searchParams;
  const activeType = (TYPES.includes(sp.type as AttendeeType) ? sp.type : "all") as
    | AttendeeType
    | "all";
  const activeCategory = ATTENDEE_CATEGORIES.some((c) => c.key === sp.category)
    ? sp.category!
    : "";
  const q = (sp.q ?? "").trim();

  const [rows, counts] = await Promise.all([
    listAttendees({
      type: activeType,
      category: activeCategory || undefined,
      q: q || undefined,
    }),
    attendeeCounts(),
  ]);

  const qs = (patch: { type?: string; category?: string; q?: string }) => {
    const p = new URLSearchParams();
    const t = patch.type ?? activeType;
    const c = patch.category ?? activeCategory;
    const query = patch.q ?? q;
    if (t && t !== "all") p.set("type", t);
    if (c) p.set("category", c);
    if (query) p.set("q", query);
    const s = p.toString();
    return s ? `/admin/attendees?${s}` : "/admin/attendees";
  };

  const name = (r: (typeof rows)[number]) =>
    [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unnamed";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">Attendees</h1>
        <a
          href="/admin/export?type=attendees"
          className="rounded-full bg-ink px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-white hover:bg-char-2"
        >
          ↓ Attendees CSV
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Everyone", value: counts.total },
          { label: "Ticket holders", value: counts.ticket_holder },
          { label: "Vendor staff", value: counts.vendor_staff },
          { label: "Speakers", value: counts.speaker },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border border-black/10 bg-white p-4"
          >
            <div className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-ink/45">
              {s.label}
            </div>
            <div className="display mt-1 text-[clamp(1.3rem,4vw,1.9rem)] text-ink">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-3">
        <form action="/admin/attendees" className="flex flex-wrap gap-2">
          {activeType !== "all" && (
            <input type="hidden" name="type" value={activeType} />
          )}
          {activeCategory && (
            <input type="hidden" name="category" value={activeCategory} />
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="min-w-[220px] flex-1 rounded-[10px] border border-black/15 bg-white px-3.5 py-2 text-[0.9rem] outline-none focus:border-pink"
          />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES.map((t) => (
            <Link
              key={t}
              href={qs({ type: t })}
              className={`rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] ${
                activeType === t
                  ? "bg-ink text-white"
                  : "border border-black/15 text-ink/60 hover:border-ink"
              }`}
            >
              {t === "all" ? "Everyone" : ATTENDEE_TYPE_LABEL[t]}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-black/10" />
          <Link
            href={qs({ category: "" })}
            className={`rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] ${
              !activeCategory
                ? "bg-ink text-white"
                : "border border-black/15 text-ink/60 hover:border-ink"
            }`}
          >
            All roles
          </Link>
          {ATTENDEE_CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={qs({ category: c.key })}
              className={`rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] ${
                activeCategory === c.key
                  ? "bg-ink text-white"
                  : "border border-black/15 text-ink/60 hover:border-ink"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white">
        <table className="w-full min-w-[820px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-black/10 text-left text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink/45">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Studio / linked to</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No attendees match.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-black/5 last:border-0"
                >
                  <td className="px-4 py-2.5 font-semibold text-ink">
                    {name(r)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.05em] ${
                        typeStyle[r.type] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ATTENDEE_TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.type === "ticket_holder" ? (
                      <AttendeeCategorySelect id={r.id} value={r.category} />
                    ) : (
                      <span className="text-ink/35">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink/60">{r.email || "—"}</td>
                  <td className="px-4 py-2.5 text-ink/70">
                    {r.type === "vendor_staff"
                      ? (r.company ?? "—")
                      : r.type === "ticket_holder"
                        ? r.buyer_name
                          ? `Order: ${r.buyer_name}`
                          : "—"
                        : "Speaker"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.type === "speaker" && r.speaker_id ? (
                      <Link
                        href={`/admin/speakers/${r.speaker_id}`}
                        className="text-[0.78rem] font-bold text-pink hover:underline"
                      >
                        View
                      </Link>
                    ) : r.order_id ? (
                      <Link
                        href={`/admin/orders/${r.order_id}`}
                        className="text-[0.78rem] font-bold text-pink hover:underline"
                      >
                        Order
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length >= 1000 && (
        <p className="text-center text-[0.8rem] text-ink/45">
          Showing the first 1000 — narrow with search or filters.
        </p>
      )}
    </div>
  );
}
