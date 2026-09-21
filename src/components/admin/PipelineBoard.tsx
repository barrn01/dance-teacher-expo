"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  STAGES,
  STAGE_LABEL,
  byStage,
  type BoardProspect,
  type ProspectStage,
  type PulseSummary,
  type TouchChannel,
} from "@/lib/pipeline";
import {
  moveProspectStage,
  addProspectTouch,
  addProspectNote,
  updateProspectFields,
  addProspect,
} from "@/app/admin/actions";

const aud = (cents: number) =>
  "$" + Math.round(cents / 100).toLocaleString("en-AU");

const TOUCH_BUTTONS: [TouchChannel, string][] = [
  ["call", "📞 Call"],
  ["email", "✉️ Email"],
  ["sms", "💬 SMS"],
  ["dm", "📱 DM"],
];

const inputClass =
  "w-full rounded-[8px] border border-black/15 bg-white px-2.5 py-1.5 text-[0.85rem] outline-none focus:border-pink";

export function PipelineBoard({
  prospects,
  pulse,
}: {
  prospects: BoardProspect[];
  pulse: PulseSummary;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const cols = byStage(prospects);
  const lost = cols.lost;

  const tiles = [
    { v: pulse.inPlay, l: "In play" },
    { v: pulse.inConversation, l: "In conversation" },
    { v: aud(pulse.potentialCents), l: "Potential if all close" },
    { v: pulse.goneQuiet, l: "Gone quiet (14d+)" },
    { v: pulse.won, l: "Won so far" },
  ];

  return (
    <div className={`grid gap-5 ${pending ? "opacity-70" : ""}`}>
      {/* Pulse */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div
            key={t.l}
            className="rounded-[12px] border border-black/10 bg-white p-3.5"
          >
            <div className="display text-[clamp(1.2rem,3.5vw,1.7rem)] leading-none">
              {t.v}
            </div>
            <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink/45">
              {t.l}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/50">
          Pipeline
        </h2>
        <AddProspect
          open={adding}
          setOpen={setAdding}
          onAdd={(name, tier, potential) =>
            run(() =>
              addProspect({
                name,
                tier: tier || null,
                potentialCents: potential,
              }),
            )
          }
        />
      </div>

      {/* Board */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[900px] gap-3">
          {STAGES.map(([stage, label]) => (
            <div key={stage} className="flex-1">
              <div className="mb-2 border-b-2 border-pink pb-1 text-center text-[0.8rem] font-bold">
                {label}
                <span className="ml-1 text-[0.7rem] font-normal text-ink/45">
                  {cols[stage].length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {cols[stage].map((p) => (
                  <Card key={p.id} p={p} run={run} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lost bucket */}
      {lost.length > 0 && (
        <details className="rounded-[10px] border border-black/10 bg-black/[0.02] p-3">
          <summary className="cursor-pointer text-[0.85rem] font-bold text-ink/60">
            ❌ Not this year ({lost.length})
          </summary>
          <div className="mt-2 grid gap-1.5">
            {lost.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-[8px] bg-white px-3 py-1.5 text-[0.85rem]"
              >
                <span>
                  {p.name}
                  <span className="ml-2 text-ink/40">{aud(p.estCents)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => run(() => moveProspectStage(p.id, "new"))}
                  className="text-[0.78rem] font-bold text-pink hover:underline"
                >
                  ↩ Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Card({
  p,
  run,
}: {
  p: BoardProspect;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const meter =
    p.daysSinceTouch === null
      ? "📞 not contacted yet"
      : `last touch ${p.daysSinceTouch}d ago`;

  return (
    <details className="rounded-[8px] border border-black/10 bg-[#FFFDF5] p-2.5 text-[0.82rem] shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="font-bold">{p.name}</div>
        <div className="text-[0.72rem] text-ink/50">
          {[p.tier, aud(p.estCents)].filter(Boolean).join(" · ")}
        </div>
        <div
          className={`mt-1 inline-block text-[0.72rem] ${
            p.quiet
              ? "rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800"
              : "text-ink/45"
          }`}
        >
          {p.quiet ? `⚠ gone quiet · ${meter}` : meter}
        </div>
        {p.source && (
          <div className="mt-1 text-[0.7rem] italic text-ink/40">{p.source}</div>
        )}
      </summary>

      <div className="mt-2 grid gap-2 border-t border-black/10 pt-2">
        {/* Move stage */}
        <div className="flex flex-wrap gap-1">
          {STAGES.filter(([s]) => s !== p.stage).map(([s, l]) => (
            <button
              key={s}
              type="button"
              onClick={() => run(() => moveProspectStage(p.id, s))}
              className="rounded-full border border-black/15 px-2 py-0.5 text-[0.7rem] font-semibold hover:border-pink hover:text-pink"
            >
              → {l}
            </button>
          ))}
          {p.stage !== "lost" && (
            <button
              type="button"
              onClick={() => run(() => moveProspectStage(p.id, "lost"))}
              className="rounded-full border border-black/15 px-2 py-0.5 text-[0.7rem] font-semibold text-ink/60 hover:border-red-400 hover:text-red-600"
            >
              ❌ Not this year
            </button>
          )}
        </div>

        {/* Log a touch */}
        <div className="flex flex-wrap gap-1">
          {TOUCH_BUTTONS.map(([ch, l]) => (
            <button
              key={ch}
              type="button"
              onClick={() => run(() => addProspectTouch(p.id, ch))}
              className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.7rem] font-semibold hover:bg-pink/10"
            >
              {l}
            </button>
          ))}
        </div>

        <NoteAdder prospectId={p.id} run={run} />
        <EditDetails p={p} run={run} />

        {/* History */}
        {(p.touches.length > 0 || p.notes.length > 0) && (
          <div className="mt-1 grid gap-1 border-t border-black/10 pt-2 text-[0.72rem] text-ink/60">
            {p.notes.map((n) => (
              <div key={n.id}>
                <span className="text-ink/40">
                  {n.created_at.slice(0, 10)} · {shortBy(n.by)}:
                </span>{" "}
                {n.text}
              </div>
            ))}
            {p.touches.map((t) => (
              <div key={t.id} className="text-ink/45">
                {t.occurred_at.slice(0, 10)} · {t.channel}
                {t.body ? ` — ${t.body}` : ""} ({shortBy(t.by)})
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

const shortBy = (by: string | null) => (by ? by.split("@")[0] : "—");

function NoteAdder({
  prospectId,
  run,
}: {
  prospectId: string;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-1">
      <input
        className={inputClass}
        placeholder="Add a note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => {
          run(() => addProspectNote(prospectId, text));
          setText("");
        }}
        className="shrink-0 rounded-[8px] bg-pink px-3 text-[0.75rem] font-bold text-white disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function EditDetails({
  p,
  run,
}: {
  p: BoardProspect;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState(p.contact_person ?? "");
  const [phone, setPhone] = useState(p.contact_phone ?? "");
  const [email, setEmail] = useState(p.contact_email ?? "");
  const [tier, setTier] = useState(p.tier ?? "");
  const [potential, setPotential] = useState(
    p.potential_cents != null ? String(p.potential_cents / 100) : "",
  );

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="justify-self-start text-[0.72rem] font-semibold text-ink/50 hover:text-pink"
      >
        ✎ Edit details
      </button>
    );

  return (
    <div className="grid gap-1.5 rounded-[8px] bg-black/[0.03] p-2">
      <input className={inputClass} placeholder="Contact person" value={person} onChange={(e) => setPerson(e.target.value)} />
      <div className="flex gap-1.5">
        <input className={inputClass} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputClass} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex gap-1.5">
        <input className={inputClass} placeholder="Tier (e.g. Gold)" value={tier} onChange={(e) => setTier(e.target.value)} />
        <input className={inputClass} placeholder="Potential $" inputMode="decimal" value={potential} onChange={(e) => setPotential(e.target.value)} />
      </div>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-black/15 px-3 py-1 text-[0.72rem] font-bold text-ink/60">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            const pc = parseFloat(potential);
            run(() =>
              updateProspectFields(p.id, {
                contactPerson: person,
                contactPhone: phone,
                contactEmail: email,
                tier,
                potentialCents: Number.isFinite(pc) ? Math.round(pc * 100) : null,
              }),
            );
            setOpen(false);
          }}
          className="rounded-full bg-pink px-4 py-1 text-[0.72rem] font-bold text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function AddProspect({
  open,
  setOpen,
  onAdd,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  onAdd: (name: string, tier: string, potentialCents: number | null) => void;
}) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("");
  const [potential, setPotential] = useState("");

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-pink px-4 py-1.5 text-[0.8rem] font-bold text-white"
      >
        + Add prospect
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input className={inputClass + " max-w-[180px]"} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputClass + " max-w-[110px]"} placeholder="Tier" value={tier} onChange={(e) => setTier(e.target.value)} />
      <input className={inputClass + " max-w-[110px]"} placeholder="Potential $" inputMode="decimal" value={potential} onChange={(e) => setPotential(e.target.value)} />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => {
          const pc = parseFloat(potential);
          onAdd(name.trim(), tier.trim(), Number.isFinite(pc) ? Math.round(pc * 100) : null);
          setName("");
          setTier("");
          setPotential("");
          setOpen(false);
        }}
        className="rounded-full bg-pink px-4 py-1.5 text-[0.8rem] font-bold text-white disabled:opacity-50"
      >
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[0.8rem] text-ink/50">
        Cancel
      </button>
    </div>
  );
}
