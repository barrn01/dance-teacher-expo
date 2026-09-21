import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_SLUG } from "@/lib/tickets";
import { PipelineBoard } from "@/components/admin/PipelineBoard";
import {
  pulseSummary,
  estValueCents,
  isGoneQuiet,
  lastTouchAt,
  daysSince,
  type Prospect,
  type ProspectTouch,
  type ProspectNote,
  type ProspectWithHistory,
  type BoardProspect,
} from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .maybeSingle<{ id: string }>();
  if (!event) return <div className="p-6 text-ink/60">Event not found.</div>;

  const { data: prospectRows } = await sb
    .from("prospects")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });
  const prospects = (prospectRows ?? []) as Prospect[];
  const ids = prospects.map((p) => p.id);

  const [{ data: touchRows }, { data: noteRows }] = await Promise.all([
    ids.length
      ? sb.from("prospect_touches").select("*").in("prospect_id", ids)
      : Promise.resolve({ data: [] as ProspectTouch[] }),
    ids.length
      ? sb.from("prospect_notes").select("*").in("prospect_id", ids)
      : Promise.resolve({ data: [] as ProspectNote[] }),
  ]);

  const touchesByP = new Map<string, ProspectTouch[]>();
  for (const t of (touchRows ?? []) as ProspectTouch[]) {
    const l = touchesByP.get(t.prospect_id) ?? [];
    l.push(t);
    touchesByP.set(t.prospect_id, l);
  }
  const notesByP = new Map<string, ProspectNote[]>();
  for (const n of (noteRows ?? []) as ProspectNote[]) {
    const l = notesByP.get(n.prospect_id) ?? [];
    l.push(n);
    notesByP.set(n.prospect_id, l);
  }

  const withHistory: ProspectWithHistory[] = prospects.map((p) => ({
    ...p,
    touches: (touchesByP.get(p.id) ?? []).sort((a, b) =>
      a.occurred_at < b.occurred_at ? 1 : -1,
    ),
    notes: (notesByP.get(p.id) ?? []).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    ),
  }));

  const nowMs = Date.now();
  const pulse = pulseSummary(withHistory, nowMs);
  const board: BoardProspect[] = withHistory.map((p) => ({
    ...p,
    estCents: estValueCents(p),
    quiet: isGoneQuiet(p, nowMs),
    daysSinceTouch: daysSince(lastTouchAt(p.touches), nowMs),
  }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-[clamp(1.8rem,6vw,2.6rem)] text-pink">
          Vendor HQ
        </h1>
        <p className="mt-1 text-[0.85rem] text-ink/55">Prospect pipeline</p>
      </div>
      <div className="flex gap-2 border-b-2 border-pink">
        <Link
          href="/admin/vendors"
          className="rounded-t-lg border border-b-0 border-black/10 bg-black/[0.03] px-4 py-2 text-[0.85rem] font-bold text-ink/55 hover:text-pink"
        >
          Booked vendors
        </Link>
        <span className="rounded-t-lg bg-pink px-4 py-2 text-[0.85rem] font-bold text-white">
          Pipeline
        </span>
      </div>
      <PipelineBoard prospects={board} pulse={pulse} />
    </div>
  );
}
