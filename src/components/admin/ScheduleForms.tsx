"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRoom,
  deleteRoom,
  createSession,
  updateSession,
  deleteSession,
  duplicateSession,
} from "@/app/admin/schedule/actions";
import { SESSION_TYPES, STREAMS, EVENT_DAYS } from "@/lib/cms-config";
import type { Room, SessionRow } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

export function RoomManager({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", level: "", capacity: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createRoom(form);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not add room.");
      return;
    }
    setForm({ name: "", level: "", capacity: "" });
    router.refresh();
  };

  return (
    <div className="grid gap-3 rounded-[14px] border border-black/10 bg-white p-6">
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        Rooms
      </h2>
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-[0.82rem] text-ink/75"
            >
              {r.name}
              {r.level ? ` · ${r.level}` : ""}
              <button
                type="button"
                onClick={async () => {
                  await deleteRoom(r.id);
                  router.refresh();
                }}
                className="text-ink/40 hover:text-pink"
                aria-label="Delete room"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className={labelClass}>Room name</label>
          <input
            className={inputClass}
            placeholder="Main Stage"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Level</label>
          <input
            className={inputClass}
            placeholder="Level 1"
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Capacity</label>
          <input
            className={inputClass}
            type="number"
            placeholder="—"
            value={form.capacity}
            onChange={(e) =>
              setForm((f) => ({ ...f, capacity: e.target.value }))
            }
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full border border-black/20 px-5 py-2.5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink/70 hover:border-ink disabled:opacity-50"
        >
          {busy ? "…" : "Add room"}
        </button>
      </form>
      {error && (
        <p className="text-[0.85rem] font-semibold text-pink">{error}</p>
      )}
    </div>
  );
}

export function SessionCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createSession(title);
    setBusy(false);
    if (!res.ok || !res.id) {
      setError(res.error ?? "Could not create.");
      return;
    }
    router.push(`/admin/schedule/${res.id}`);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-[14px] border border-black/10 bg-white p-5"
    >
      <div className="grid flex-1 gap-1" style={{ minWidth: 240 }}>
        <label className={labelClass}>New session title</label>
        <input
          className={inputClass}
          placeholder="e.g. Building a Competition Team"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-pink px-6 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.07em] text-white hover:bg-pink-hot disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add & edit"}
      </button>
      {error && (
        <p className="w-full text-[0.85rem] font-semibold text-pink">{error}</p>
      )}
    </form>
  );
}

export function SessionEditForm({
  session,
  rooms,
  speakers,
}: {
  session: SessionRow & { speaker_ids: string[] };
  rooms: Room[];
  speakers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await updateSession(new FormData(formRef.current));
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  };

  const del = async () => {
    setBusy(true);
    const res = await deleteSession(session.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete.");
      return;
    }
    router.push("/admin/schedule");
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="relative grid gap-5 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <input type="hidden" name="id" value={session.id} />

      <div className="grid gap-1">
        <label className={labelClass}>Title</label>
        <input name="title" className={inputClass} defaultValue={session.title} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Type</label>
          <select
            name="session_type"
            className={inputClass}
            defaultValue={session.session_type}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Stream</label>
          <select
            name="stream"
            className={inputClass}
            defaultValue={session.stream ?? ""}
          >
            <option value="">— No stream —</option>
            {STREAMS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Room</label>
          <select
            name="room_id"
            className={inputClass}
            defaultValue={session.room_id ?? ""}
          >
            <option value="">— No room —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.level ? ` (${r.level})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Day</label>
          <select
            name="session_date"
            className={inputClass}
            defaultValue={session.session_date ?? ""}
          >
            <option value="">— Unscheduled —</option>
            {EVENT_DAYS.map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className={labelClass}>Start</label>
            <input
              name="start_time"
              type="time"
              className={inputClass}
              defaultValue={session.start_time?.slice(0, 5) ?? ""}
            />
          </div>
          <div className="grid gap-1">
            <label className={labelClass}>End</label>
            <input
              name="end_time"
              type="time"
              className={inputClass}
              defaultValue={session.end_time?.slice(0, 5) ?? ""}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-1">
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          className={`${inputClass} min-h-[100px] resize-y`}
          defaultValue={session.description ?? ""}
        />
      </div>

      {/* Speakers */}
      <div className="grid gap-2">
        <label className={labelClass}>Speakers</label>
        {speakers.length === 0 ? (
          <p className="text-[0.85rem] text-ink/50">
            No speakers yet — add them under Speakers first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {speakers.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-full border border-black/15 px-3 py-1.5 text-[0.85rem] text-ink/75 has-[:checked]:border-pink has-[:checked]:bg-pink/5"
              >
                <input
                  type="checkbox"
                  name="speaker_ids"
                  value={s.id}
                  defaultChecked={session.speaker_ids.includes(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <div className="grid gap-1">
          <label className={labelClass}>Sort order</label>
          <input
            name="sort_order"
            type="number"
            className={`${inputClass} w-28`}
            defaultValue={session.sort_order}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={session.is_published}
          />
          Published
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            name="is_featured"
            defaultChecked={session.is_featured}
          />
          Featured
        </label>
      </div>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-pink px-7 py-3 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-pink-hot disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save session"}
        </button>
        {saved && (
          <span className="text-[0.85rem] font-semibold text-green-700">
            Saved ✓
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await duplicateSession(session.id);
            setBusy(false);
            if (res.ok && res.id) router.push(`/admin/schedule/${res.id}`);
            else setError(res.error ?? "Could not duplicate.");
          }}
          className="rounded-full border border-black/15 px-4 py-2 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink/60 hover:border-ink disabled:opacity-50"
        >
          Duplicate
        </button>
        {confirmDelete ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[0.82rem] text-ink/60">Delete?</span>
            <button
              type="button"
              disabled={busy}
              onClick={del}
              className="rounded-full bg-pink px-4 py-2 text-[0.75rem] font-bold uppercase tracking-[0.05em] text-white hover:bg-pink-hot disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[0.75rem] font-bold uppercase tracking-[0.05em] text-ink/45 hover:text-ink"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="ml-auto text-[0.78rem] font-bold uppercase tracking-[0.05em] text-pink hover:underline"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
