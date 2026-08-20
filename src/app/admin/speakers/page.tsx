import Link from "next/link";
import { getAdminGate } from "@/lib/admin";
import { listSpeakers } from "@/lib/cms";
import {
  SpeakerCreateForm,
  SpeakerReorder,
} from "@/components/admin/SpeakerForms";
import { BulkCsvUpload } from "@/components/admin/BulkCsvUpload";
import { createSpeakersBulk } from "@/app/admin/speakers/actions";

const SPEAKER_TEMPLATE = `name,title,company,tagline,pronouns,bio,instagram,website
Jamie Lee,Studio Owner,Studio X,Award-winning choreographer,she/her,Full bio here,jamielee,studiox.com.au
`;

export const dynamic = "force-dynamic";

export default async function AdminSpeakersPage() {
  const gate = await getAdminGate();
  if (gate.status !== "admin") return null;

  const speakers = await listSpeakers();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.6rem,5vw,2.2rem)]">
          Speakers &amp; Teachers
        </h1>
        <div className="text-[0.82rem] text-ink/55">
          {speakers.length} total ·{" "}
          {speakers.filter((s) => s.is_active).length} active
        </div>
      </div>

      <SpeakerCreateForm />

      <BulkCsvUpload
        title="Bulk import (CSV)"
        action={createSpeakersBulk}
        template={SPEAKER_TEMPLATE}
        templateName="speakers-template.csv"
        help={
          <>
            Columns: <code className="font-mono">name, title, company, tagline, pronouns, bio, instagram, website</code>.
            Only <strong>name</strong> is required. Header row optional.
          </>
        }
      />

      {speakers.length === 0 ? (
        <p className="rounded-[12px] border border-black/10 bg-white px-4 py-10 text-center text-ink/50">
          No speakers yet.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {speakers.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-[12px] border border-black/10 bg-white p-3"
            >
              <SpeakerReorder id={s.id} />
              <Link
                href={`/admin/speakers/${s.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-paper">
                  {s.headshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.headshot_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[0.6rem] font-bold uppercase text-ink/30">
                      —
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">
                      {s.name}
                    </span>
                    {s.is_featured && (
                      <span className="rounded-full bg-pink/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.05em] text-pink">
                        Featured
                      </span>
                    )}
                    {!s.is_active && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.05em] text-gray-500">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[0.82rem] text-ink/55">
                    {[s.title, s.company].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
