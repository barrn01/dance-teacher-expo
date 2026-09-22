"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
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
  sendProspectMessage,
  getProspectConversation,
  convertProspectToVendor,
} from "@/app/admin/actions";
import type { ConvMessage } from "@/lib/ghl";

/** Turn a GHL email/SMS HTML body into readable plain text (decode entities,
 *  keep paragraph breaks, drop tags). */
const stripHtml = (s: string) =>
  s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Drop the quoted original + signature from an email reply, keeping just the
 *  new text. Falls back to the full body if that would leave nothing. */
const cleanReply = (t: string): string => {
  let cut = t;
  const quote = cut.match(/(?:^|\n)\s*On\b[\s\S]{0,300}?\bwrote:/); // Gmail/Apple
  if (quote?.index != null) cut = cut.slice(0, quote.index);
  const outlook = cut.match(/\n-{2,}\s*Original Message\s*-{2,}/i);
  if (outlook?.index != null) cut = cut.slice(0, outlook.index);
  const sig = cut.match(/\n--\s*(?:\n|$)/); // standard signature delimiter
  if (sig?.index != null) cut = cut.slice(0, sig.index);
  cut = cut.trim();
  return cut || t.trim();
};

/** Readable body for a conversation bubble (email replies get de-quoted). */
const displayBody = (channel: string, body: string): string => {
  const text = stripHtml(body);
  return channel === "email" ? cleanReply(text) : text;
};

const aud = (cents: number) =>
  "$" + Math.round(cents / 100).toLocaleString("en-AU");

// SMS + Email actually send via GHL (see Messenger); call + DM are manual logs.
const TOUCH_BUTTONS: [TouchChannel, string][] = [
  ["call", "📞 Log call"],
  ["dm", "📱 Log DM"],
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
  const [query, setQuery] = useState("");
  const [hideUntouched, setHideUntouched] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openProspect = openId
    ? (prospects.find((x) => x.id === openId) ?? null)
    : null;

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const isUntouched = (p: BoardProspect) =>
    p.stage === "new" && p.touches.length === 0 && p.notes.length === 0;
  const untouchedCount = prospects.filter(isUntouched).length;

  const q = query.trim().toLowerCase();
  let filtered = q
    ? prospects.filter((p) =>
        [p.name, p.contact_person, p.contact_email, p.source, p.tier].some(
          (f) => f?.toLowerCase().includes(q),
        ),
      )
    : prospects;
  if (hideUntouched) filtered = filtered.filter((p) => !isUntouched(p));

  const cols = byStage(filtered);
  const lost = cols.lost;

  const tiles = [
    { v: pulse.inPlay, l: "Prospects in play" },
    { v: pulse.inConversation, l: "In conversation" },
    { v: aud(pulse.potentialCents), l: "Potential if all closed" },
    { v: pulse.goneQuiet, l: "Gone quiet (14d+)" },
    { v: pulse.won, l: "Won so far" },
  ];

  return (
    <div className={`grid gap-5 ${pending ? "opacity-70" : ""}`}>
      {/* Whiteboard + sticky-note styling (from the artefact handoff §5.4). A
          whiteboard is a physical white object — it stays white regardless. */}
      <style>{`
        .wb-board{ background:#fff;
          background-image:radial-gradient(#D8D8DE 1px, transparent 1px);
          background-size:22px 22px; border:6px solid #C8CBD2; border-radius:12px;
          box-shadow:inset 0 2px 10px rgba(0,0,0,.06); }
        .wb-head{ font-family:"Chalkboard SE","Comic Sans MS","Segoe Print",cursive;
          transform:rotate(-1deg); }
        .wb-card{ background:#FFF6C8; color:#1F1F1F; border-radius:2px;
          box-shadow:1px 3px 6px rgba(0,0,0,.18); position:relative; }
        .wb-card::before{ content:""; position:absolute; top:-6px; left:50%;
          width:12px; height:12px; margin-left:-6px; border-radius:50%;
          background:#E23480; box-shadow:0 1px 2px rgba(0,0,0,.3); }
        .wb-cards .wb-card:nth-child(odd){ transform:rotate(-1.1deg); }
        .wb-cards .wb-card:nth-child(even){ transform:rotate(0.9deg); }
        .wb-cards .wb-card:nth-child(3n){ transform:rotate(1.6deg); }
        .wb-card[open]{ transform:none !important; z-index:3; }
        .wb-name{ font-family:"Chalkboard SE","Comic Sans MS","Segoe Print",cursive;
          font-size:1rem; font-weight:700; line-height:1.2; }
        .wb-won{ background:#DFF3E4; }
        .wb-won::before{ background:#237A3C; }
      `}</style>
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

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/50">
          Pipeline
        </h2>
        <div className="flex flex-1 items-center gap-2">
          <input
            className={inputClass + " max-w-[280px]"}
            placeholder="Search name, contact, source, tier…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {q && (
            <span className="text-[0.72rem] text-ink/50">
              {filtered.length} of {prospects.length}
              <button
                type="button"
                onClick={() => setQuery("")}
                className="ml-2 font-bold text-pink hover:underline"
              >
                clear
              </button>
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[0.72rem] text-ink/60">
            <input
              type="checkbox"
              checked={hideUntouched}
              onChange={(e) => setHideUntouched(e.target.checked)}
              className="accent-pink"
            />
            Hide untouched new leads
            {untouchedCount > 0 && (
              <span className="text-ink/40">({untouchedCount})</span>
            )}
          </label>
        </div>
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

      {/* Board — capped height with its own scroll; sticky column headers */}
      <div className="wb-board max-h-[72vh] overflow-auto p-4">
        <div className="flex min-w-[960px] items-start gap-4">
          {STAGES.map(([stage, label]) => (
            <div key={stage} className="flex-1">
              <div className="sticky top-0 z-10 mb-3 bg-white/95 pb-1 backdrop-blur-sm">
                <div className="wb-head mx-auto max-w-[160px] border-b-[3px] border-pink pb-1 text-center text-[1.05rem] font-bold text-[#1F1F1F]">
                  {label}
                  <span className="block text-[0.68rem] font-normal tracking-[0.08em] text-[#8E8489]">
                    {cols[stage].length} card
                    {cols[stage].length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="wb-cards flex flex-col gap-3">
                {cols[stage].map((p) => (
                  <Card key={p.id} p={p} onOpen={setOpenId} />
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

      {openProspect && (
        <ProspectModal
          p={openProspect}
          onClose={() => setOpenId(null)}
          run={run}
        />
      )}
    </div>
  );
}

/** Collapsed sticky-note in a column; click to open the full modal. */
function Card({
  p,
  onOpen,
}: {
  p: BoardProspect;
  onOpen: (id: string) => void;
}) {
  const meter =
    p.daysSinceTouch === null
      ? "📞 not contacted yet"
      : `last touch ${p.daysSinceTouch}d ago`;

  return (
    <button
      type="button"
      onClick={() => onOpen(p.id)}
      className={`wb-card w-full p-3 text-left text-[0.82rem] ${p.stage === "won" ? "wb-won" : ""}`}
    >
      <div className="wb-name">
        {p.stage === "won" ? "👑 " : ""}
        {p.name}
      </div>
      <div className="text-[0.72rem] text-[#6b6257]">
        {[p.tier, aud(p.estCents)].filter(Boolean).join(" · ")}
      </div>
      <div
        className={`mt-1 inline-block text-[0.72rem] ${
          p.quiet
            ? "rounded bg-[#FBEED8] px-1.5 py-0.5 font-bold text-[#9A5B00]"
            : "text-[#4a443c]"
        }`}
      >
        {p.quiet ? `⚠ gone quiet · ${meter}` : meter}
      </div>
      {p.source && (
        <div className="mt-1 text-[0.7rem] italic text-[#8a8172]">
          {p.source}
        </div>
      )}
    </button>
  );
}

/** Blown-out card: conversation thread + all actions. */
function ProspectModal({
  p,
  onClose,
  run,
}: {
  p: BoardProspect;
  onClose: () => void;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [msgs, setMsgs] = useState<ConvMessage[] | null>(null);
  const [convErr, setConvErr] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    setConvErr(null);
    const res = await getProspectConversation(p.id);
    if (res.ok) setMsgs(res.messages);
    else setConvErr(res.error ?? "Couldn't load messages.");
  }, [p.id]);
  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const meter =
    p.daysSinceTouch === null
      ? "not contacted yet"
      : `last touch ${p.daysSinceTouch}d ago`;
  const localLogs = p.touches.filter(
    (t) => t.channel === "call" || t.channel === "dm",
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.name}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[min(680px,96vw)] flex-col overflow-hidden rounded-[14px] bg-white text-ink shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
          <div>
            <h3 className="text-[1.15rem] font-extrabold">
              {p.stage === "won" ? "👑 " : ""}
              {p.name}
            </h3>
            <div className="text-[0.8rem] text-ink/55">
              {[p.tier, aud(p.estCents), STAGE_LABEL[p.stage]]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div
              className={`mt-1 inline-block text-[0.75rem] ${
                p.quiet
                  ? "rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800"
                  : "text-ink/45"
              }`}
            >
              {p.quiet ? `⚠ gone quiet · ${meter}` : meter}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-ink/50 hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="grid flex-1 gap-4 overflow-y-auto overflow-x-hidden p-4">
          {/* Conversation */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink/50">
                Conversation
              </span>
              <button
                type="button"
                onClick={loadThread}
                className="text-[0.72rem] font-semibold text-pink hover:underline"
              >
                refresh
              </button>
            </div>
            {msgs === null && !convErr && (
              <p className="text-[0.8rem] text-ink/40">Loading…</p>
            )}
            {convErr && (
              <p className="text-[0.8rem] text-red-600">{convErr}</p>
            )}
            {msgs && msgs.length === 0 && (
              <p className="text-[0.8rem] text-ink/40">
                No SMS or email yet — send one below.
              </p>
            )}
            {msgs && msgs.length > 0 && (
              <div className="grid gap-2">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`min-w-0 max-w-[85%] break-words rounded-[10px] px-3 py-2 text-[0.85rem] [overflow-wrap:anywhere] ${
                      m.direction === "out"
                        ? "justify-self-end bg-pink/10"
                        : "justify-self-start bg-black/[0.06]"
                    }`}
                  >
                    <div className="mb-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ink/40">
                      {m.direction === "out" ? "Sent" : "Reply"} · {m.channel}
                      {m.dateAdded ? ` · ${m.dateAdded.slice(0, 10)}` : ""}
                    </div>
                    {m.subject && (
                      <div className="font-semibold">{m.subject}</div>
                    )}
                    <div className="whitespace-pre-wrap">
                      {displayBody(m.channel, m.body)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send via GHL */}
          <Messenger prospectId={p.id} onSent={loadThread} />

          {/* Move stage */}
          <div>
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink/50">
              Move to
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {STAGES.filter(([s]) => s !== p.stage).map(([s, l]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => run(() => moveProspectStage(p.id, s))}
                  className="rounded-full border border-black/15 px-2.5 py-1 text-[0.75rem] font-semibold hover:border-pink hover:text-pink"
                >
                  → {l}
                </button>
              ))}
              {p.stage !== "lost" && (
                <button
                  type="button"
                  onClick={() => run(() => moveProspectStage(p.id, "lost"))}
                  className="rounded-full border border-black/15 px-2.5 py-1 text-[0.75rem] font-semibold text-ink/60 hover:border-red-400 hover:text-red-600"
                >
                  ❌ Not this year
                </button>
              )}
            </div>
          </div>

          {/* Won → booked vendor */}
          {p.stage === "won" && <ConvertVendor p={p} />}

          {/* Manual logs (call / DM) */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[0.68rem] text-ink/50">Log:</span>
            {TOUCH_BUTTONS.map(([ch, l]) => (
              <button
                key={ch}
                type="button"
                onClick={() => run(() => addProspectTouch(p.id, ch))}
                className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[0.75rem] font-semibold hover:bg-pink/10"
              >
                {l}
              </button>
            ))}
          </div>

          <NoteAdder prospectId={p.id} run={run} />
          <EditDetails p={p} run={run} />

          {/* Notes & call/DM logs (SMS/email live in Conversation above) */}
          {(p.notes.length > 0 || localLogs.length > 0) && (
            <div className="grid gap-1 border-t border-black/10 pt-3 text-[0.75rem] text-ink/60">
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink/45">
                Notes &amp; logs
              </span>
              {p.notes.map((n) => (
                <div key={n.id}>
                  <span className="text-ink/40">
                    {n.created_at.slice(0, 10)} · {shortBy(n.by)}:
                  </span>{" "}
                  {n.text}
                </div>
              ))}
              {localLogs.map((t) => (
                <div key={t.id} className="text-ink/45">
                  {t.occurred_at.slice(0, 10)} · {t.channel} ({shortBy(t.by)})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const shortBy = (by: string | null) => (by ? by.split("@")[0] : "—");

function ConvertVendor({ p }: { p: BoardProspect }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (p.won_vendor_id)
    return (
      <div className="rounded-[8px] bg-green-50 px-3 py-2 text-[0.8rem] font-semibold text-green-700">
        ✓ Linked to a booked vendor —{" "}
        <a href="/admin/vendors" className="text-pink hover:underline">
          view in Booked
        </a>
      </div>
    );

  const convert = async () => {
    setBusy(true);
    setError(null);
    const res = await convertProspectToVendor(p.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't convert.");
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={convert}
        className="rounded-full bg-pink px-4 py-1.5 text-[0.8rem] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "➕ Create booked vendor from this prospect"}
      </button>
      {error && <p className="mt-1 text-[0.72rem] text-red-600">{error}</p>}
    </div>
  );
}

function Messenger({
  prospectId,
  onSent,
}: {
  prospectId: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"sms" | "email" | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mode)
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[0.68rem] text-[#8a8172]">Send:</span>
        <button
          type="button"
          onClick={() => setMode("sms")}
          className="rounded-full bg-pink/10 px-2 py-0.5 text-[0.7rem] font-semibold text-pink hover:bg-pink/20"
        >
          💬 SMS
        </button>
        <button
          type="button"
          onClick={() => setMode("email")}
          className="rounded-full bg-pink/10 px-2 py-0.5 text-[0.7rem] font-semibold text-pink hover:bg-pink/20"
        >
          ✉️ Email
        </button>
      </div>
    );

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await sendProspectMessage(prospectId, mode, { subject, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Send failed.");
      return;
    }
    setBody("");
    setSubject("");
    setMode(null);
    router.refresh();
    onSent?.();
  };

  return (
    <div className="grid gap-1.5 rounded-[8px] bg-white/70 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.72rem] font-bold">
          {mode === "sms" ? "Send SMS" : "Send email"} via GHL
        </span>
        <button
          type="button"
          onClick={() => {
            setMode(null);
            setError(null);
          }}
          className="text-[0.72rem] text-ink/50 hover:text-ink"
        >
          cancel
        </button>
      </div>
      {mode === "email" && (
        <input
          className={inputClass}
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      )}
      <textarea
        className={inputClass + " min-h-[56px]"}
        placeholder={mode === "sms" ? "Text message…" : "Email body…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="text-[0.72rem] text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={send}
        className="justify-self-end rounded-full bg-pink px-4 py-1 text-[0.72rem] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );
}

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
