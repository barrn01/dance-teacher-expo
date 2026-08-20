import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminGate } from "@/lib/admin";
import { getSession, listRooms, listSpeakers } from "@/lib/cms";
import { SessionEditForm } from "@/components/admin/ScheduleForms";

export const dynamic = "force-dynamic";

export default async function AdminSessionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const { id } = await params;
  const [session, rooms, speakers] = await Promise.all([
    getSession(id),
    listRooms(),
    listSpeakers(),
  ]);
  if (!session) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/admin/schedule"
          className="text-[0.8rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
        >
          ← Schedule
        </Link>
        <h1 className="display mt-2 text-[clamp(1.6rem,5vw,2.2rem)]">
          {session.title}
        </h1>
      </div>
      <SessionEditForm
        session={session}
        rooms={rooms}
        speakers={speakers.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
