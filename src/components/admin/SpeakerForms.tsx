"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSpeaker,
  updateSpeaker,
  deleteSpeaker,
  moveSpeaker,
} from "@/app/admin/speakers/actions";
import type { Speaker } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

export function SpeakerCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createSpeaker(name);
    setBusy(false);
    if (!res.ok || !res.id) {
      setError(res.error ?? "Could not create.");
      return;
    }
    router.push(`/admin/speakers/${res.id}`);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-[14px] border border-black/10 bg-white p-5"
    >
      <div className="grid flex-1 gap-1" style={{ minWidth: 240 }}>
        <label className={labelClass}>New speaker name</label>
        <input
          className={inputClass}
          placeholder="e.g. Jamie Lee"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

export function SpeakerReorder({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const move = async (dir: "up" | "down") => {
    setBusy(true);
    await moveSpeaker(id, dir);
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="flex shrink-0 flex-col text-ink/40">
      <button
        type="button"
        disabled={busy}
        onClick={() => move("up")}
        className="px-1 leading-none hover:text-ink disabled:opacity-40"
        aria-label="Move up"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => move("down")}
        className="px-1 leading-none hover:text-ink disabled:opacity-40"
        aria-label="Move down"
      >
        ▼
      </button>
    </div>
  );
}

export function SpeakerEditForm({
  speaker,
  vendors,
  registered,
}: {
  speaker: Speaker;
  vendors: { id: string; company_name: string }[];
  registered: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState<string | null>(speaker.headshot_url);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await updateSpeaker(new FormData(formRef.current));
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
    const res = await deleteSpeaker(speaker.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not delete.");
      return;
    }
    router.push("/admin/speakers");
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="relative grid gap-5 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <input type="hidden" name="id" value={speaker.id} />

      {/* Headshot */}
      <div className="grid gap-2">
        <label className={labelClass}>Headshot</label>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-paper">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] text-ink/35">
                No photo
              </span>
            )}
          </div>
          <div className="grid gap-2 text-[0.82rem] text-ink/60">
            <input
              type="file"
              name="headshot"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(URL.createObjectURL(f));
              }}
              className="file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[0.72rem] file:font-extrabold file:uppercase file:tracking-[0.06em] file:text-white hover:file:bg-char-2"
            />
            {speaker.headshot_url && (
              <label className="flex items-center gap-2 text-[0.78rem] font-semibold text-ink/55">
                <input
                  type="checkbox"
                  name="remove_headshot"
                  onChange={(e) => {
                    if (e.target.checked) setPhoto(null);
                    else setPhoto(speaker.headshot_url);
                  }}
                />
                Remove current photo
              </label>
            )}
            <p className="text-[0.72rem] text-ink/45">
              PNG, JPG or WEBP · up to 5 MB. Square works best.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Name</label>
          <input
            name="name"
            className={inputClass}
            defaultValue={speaker.name}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Title / role</label>
          <input
            name="title"
            className={inputClass}
            placeholder="Studio Owner & Choreographer"
            defaultValue={speaker.title ?? ""}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Studio / company</label>
          <input
            name="company"
            className={inputClass}
            defaultValue={speaker.company ?? ""}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Pronouns</label>
          <input
            name="pronouns"
            className={inputClass}
            placeholder="she/her"
            defaultValue={speaker.pronouns ?? ""}
          />
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <label className={labelClass}>Tagline (one line)</label>
          <input
            name="tagline"
            className={inputClass}
            placeholder="A short one-liner shown under their name"
            defaultValue={speaker.tagline ?? ""}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Website</label>
          <input
            name="website_url"
            className={inputClass}
            placeholder="yourstudio.com.au"
            defaultValue={speaker.website_url ?? ""}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Instagram</label>
          <input
            name="instagram"
            className={inputClass}
            placeholder="@handle"
            defaultValue={speaker.instagram ?? ""}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Sort order</label>
          <input
            name="sort_order"
            type="number"
            className={inputClass}
            defaultValue={speaker.sort_order}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Linked vendor (optional)</label>
          <select
            name="vendor_id"
            className={inputClass}
            defaultValue={speaker.vendor_id ?? ""}
          >
            <option value="">— Not linked —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1">
        <label className={labelClass}>Bio</label>
        <textarea
          name="bio"
          className={`${inputClass} min-h-[120px] resize-y`}
          defaultValue={speaker.bio ?? ""}
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={speaker.is_active}
          />
          Active (visible)
        </label>
        <label className="flex items-center gap-2 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            name="is_featured"
            defaultChecked={speaker.is_featured}
          />
          Featured in listing
        </label>
        <label className="flex items-center gap-2 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            name="is_homepage_featured"
            defaultChecked={speaker.is_homepage_featured}
          />
          Featured on homepage
        </label>
      </div>

      <label className="flex items-center gap-2 rounded-[10px] border border-black/10 bg-paper/50 px-4 py-3 text-[0.88rem] font-semibold text-ink/75">
        <input
          type="checkbox"
          name="register_pass"
          defaultChecked={registered}
        />
        Register for the event — issues a check-in pass and adds them to the
        attendee list.
      </label>

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
          {busy ? "Saving…" : "Save speaker"}
        </button>
        {saved && (
          <span className="text-[0.85rem] font-semibold text-green-700">
            Saved ✓
          </span>
        )}
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
