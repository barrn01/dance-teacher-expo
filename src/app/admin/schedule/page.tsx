import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { listSessions, listRooms } from "@/lib/cms";
import { EVENT_DAYS, SESSION_TYPE_LABEL, STREAM_LABEL } from "@/lib/cms-config";
import {
  RoomManager,
  SessionCreateForm,
} from "@/components/admin/ScheduleForms";
import { BulkCsvUpload } from "@/components/admin/BulkCsvUpload";
import { createSessionsBulk } from "@/app/admin/schedule/actions";

const SESSION_TEMPLATE = `title,type,stream,day,start,end,room,description
Building a Competition Team,workshop,business,Sat,10:00,11:00,Main Stage,Session description
Opening Keynote,keynote,,Sat,09:00,09:45,Main Stage,
`;

export const dynamic = "force-dynamic";

const typeStyle: Record<string, string> = {
  keynote: "bg-pink/15 text-pink",
  workshop: "bg-blue-100 text-blue-800",
  panel: "bg-violet-100 text-violet-800",
  social: "bg-amber-100 text-amber-800",
  break: "bg-gray-200 text-gray-600",
  other: "bg-gray-100 text-gray-600",
};

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "");

export default async function AdminSchedulePage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const [sessions, rooms] = await Promise.all([listSessions(), listRooms()]);

  // Flag same-room time overlaps (times are "HH:MM:SS", lexical compare works).
  const clashing = new Set<string>();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (!a.room_id || a.room_id !== b.room_id) continue;
      if (!a.session_date || a.session_date !== b.session_date) continue;
      if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) continue;
      if (a.start_time < b.end_time && b.start_time < a.end_time) {
        clashing.add(a.id);
        clashing.add(b.id);
      }
    }
  }

  const groups = [
    ...EVENT_DAYS.map((d) => ({
      key: d.date,
      label: d.label,
      items: sessions.filter((s) => s.session_date === d.date),
    })),
    {
      key: "unscheduled",
      label: "Unscheduled",
      items: sessions.filter((s) => !s.session_date),
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">Schedule</h1>
        <div className="text-[0.82rem] text-ink/55">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </div>
      </div>

      {clashing.size > 0 && (
        <div className="rounded-[12px] border border-pink/30 bg-pink/[0.05] px-4 py-3 text-[0.88rem] font-semibold text-pink">
          ⚠ {clashing.size} session{clashing.size === 1 ? "" : "s"} clash — two
          or more sessions share a room at the same time. Look for the “Room
          clash” tag below.
        </div>
      )}

      <RoomManager rooms={rooms} />
      <SessionCreateForm />

      <BulkCsvUpload
        title="Bulk import sessions (CSV)"
        action={createSessionsBulk}
        template={SESSION_TEMPLATE}
        templateName="sessions-template.csv"
        help={
          <>
            Columns: <code className="font-mono">title, type, stream, day, start, end, room, description</code>.
            Only <strong>title</strong> is required. Day accepts a date or
            “Sat”/“Sun”; room is matched to an existing room by name; speakers
            are linked in the editor afterwards.
          </>
        }
      />

      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.key} className="grid gap-2">
            <h2 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
              {g.label}{" "}
              <span className="text-ink/35">({g.items.length})</span>
            </h2>
            <div className="grid gap-2">
              {g.items.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/schedule/${s.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-[12px] border border-black/10 bg-white p-3 hover:border-pink"
                >
                  <span className="w-[92px] shrink-0 text-[0.85rem] font-bold tabular-nums text-ink/70">
                    {fmtTime(s.start_time)}
                    {s.end_time ? `–${fmtTime(s.end_time)}` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.05em] ${
                      typeStyle[s.session_type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {SESSION_TYPE_LABEL[s.session_type] ?? s.session_type}
                  </span>
                  {s.stream && (
                    <span className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.05em] text-ink/60">
                      {STREAM_LABEL[s.stream]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{s.title}</span>
                    <span className="block truncate text-[0.8rem] text-ink/50">
                      {s.room_name ?? "No room"}
                      {s.speaker_names.length > 0
                        ? ` · ${s.speaker_names.join(", ")}`
                        : ""}
                    </span>
                  </span>
                  {clashing.has(s.id) && (
                    <span className="rounded-full bg-pink/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.05em] text-pink">
                      ⚠ Room clash
                    </span>
                  )}
                  {!s.is_published && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.05em] text-gray-500">
                      Draft
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ),
      )}

      {sessions.length === 0 && (
        <p className="rounded-[12px] border border-black/10 bg-white px-4 py-10 text-center text-ink/50">
          No sessions yet.
        </p>
      )}
    </div>
  );
}
