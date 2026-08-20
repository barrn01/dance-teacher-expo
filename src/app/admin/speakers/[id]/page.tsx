import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminGate } from "@/lib/admin";
import {
  getSpeaker,
  listVendorOptions,
  getSpeakerSessions,
  isSpeakerRegistered,
} from "@/lib/cms";
import { DAY_LABEL } from "@/lib/cms-config";
import { SpeakerEditForm } from "@/components/admin/SpeakerForms";

export const dynamic = "force-dynamic";

export default async function AdminSpeakerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { id } = await params;
  const [speaker, vendors, sessions, registered] = await Promise.all([
    getSpeaker(id),
    listVendorOptions(),
    getSpeakerSessions(id),
    isSpeakerRegistered(id),
  ]);
  if (!speaker) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/speakers"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Speakers &amp; Teachers
        </Link>
        <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.2rem)]">
          {speaker.name}
        </h1>
      </div>
      <SpeakerEditForm
        speaker={speaker}
        vendors={vendors}
        registered={registered}
      />

      <section className="grid gap-2">
        <h2 className="text-[0.8rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
          Their sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="rounded-[12px] border border-black/10 bg-white px-4 py-6 text-center text-[0.9rem] text-ink/50">
            Not assigned to any sessions yet. Add them from a session under
            Schedule.
          </p>
        ) : (
          <div className="grid gap-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/admin/schedule/${s.id}`}
                className="flex flex-wrap items-center gap-3 rounded-[10px] border border-black/10 bg-white px-4 py-2.5 hover:border-pink"
              >
                <span className="font-semibold text-ink">{s.title}</span>
                <span className="text-[0.82rem] text-ink/55">
                  {s.session_date ? DAY_LABEL[s.session_date] : "Unscheduled"}
                  {s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
