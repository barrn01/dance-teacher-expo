"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveVendorProfile } from "@/app/vendor/actions";
import { adminSaveVendorProfile } from "@/app/admin/actions";
import { LOGO_SLOTS } from "@/lib/vendor-logos";
import type { Vendor } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

export function VendorProfileForm({
  vendor,
  adminVendorId,
}: {
  vendor: Vendor;
  /** When set, save via the admin on-behalf action instead of self-service. */
  adminVendorId?: string;
}) {
  const router = useRouter();
  const isAdmin = !!adminVendorId;
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Per-slot preview URL (existing logo, or a just-picked file's object URL).
  const [previews, setPreviews] = useState<Record<string, string | null>>(
    () => ({ ...(vendor.logos ?? {}) }),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const fd = new FormData(formRef.current);
    const res = adminVendorId
      ? await adminSaveVendorProfile(adminVendorId, fd)
      : await saveVendorProfile(fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="relative grid gap-5 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        {isAdmin ? "Edit exhibitor listing (on their behalf)" : "Your exhibitor listing"}
      </h2>

      {/* Logos — one per purpose-tagged slot */}
      <div className="grid gap-3">
        <div>
          <label className={labelClass}>Logos</label>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-ink/55">
            Upload the versions you have — different placements need different
            shapes. The <strong>square</strong> logo is required (it powers the
            directory, event app and social tiles).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {LOGO_SLOTS.map((slot) => {
            const preview = previews[slot.key];
            return (
              <div
                key={slot.key}
                className="grid gap-2 rounded-[12px] border border-black/10 bg-paper/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-ink/60">
                    {slot.label}
                    {slot.recommended && (
                      <span className="ml-1 text-pink">*</span>
                    )}
                  </span>
                  {preview && (
                    <label className="flex items-center gap-1 text-[0.7rem] font-semibold text-ink/50">
                      <input
                        type="checkbox"
                        name={`remove_${slot.key}`}
                        onChange={(e) => {
                          if (e.target.checked)
                            setPreviews((p) => ({ ...p, [slot.key]: null }));
                          else
                            setPreviews((p) => ({
                              ...p,
                              [slot.key]: vendor.logos?.[slot.key] ?? null,
                            }));
                        }}
                      />
                      Remove
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-black/10 bg-white">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={`${slot.label} preview`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] text-ink/30">
                        None
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    name={`logo_${slot.key}`}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        setPreviews((p) => ({
                          ...p,
                          [slot.key]: URL.createObjectURL(f),
                        }));
                    }}
                    className="min-w-0 text-[0.78rem] file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[0.68rem] file:font-extrabold file:uppercase file:tracking-[0.06em] file:text-white hover:file:bg-char-2"
                  />
                </div>
                <p className="text-[0.72rem] leading-snug text-ink/45">
                  {slot.hint}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div className="grid gap-1">
        <label className={labelClass}>Company blurb</label>
        <textarea
          name="description"
          defaultValue={vendor.description ?? ""}
          placeholder="A short description of your brand for the exhibitor directory and event app."
          className={`${inputClass} min-h-[110px] resize-y`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Website</label>
          <input
            name="website_url"
            defaultValue={vendor.website_url ?? ""}
            placeholder="yourbrand.com.au"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Public contact email</label>
          <input
            name="public_contact_email"
            type="email"
            defaultValue={vendor.public_contact_email ?? ""}
            placeholder="hello@yourbrand.com.au"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Instagram</label>
          <input
            name="instagram"
            defaultValue={vendor.instagram ?? ""}
            placeholder="@yourbrand"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Facebook</label>
          <input
            name="facebook"
            defaultValue={vendor.facebook ?? ""}
            placeholder="facebook.com/yourbrand"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-pink px-7 py-3 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save listing"}
        </button>
        {saved && (
          <span className="text-[0.85rem] font-semibold text-green-700">
            Saved ✓
          </span>
        )}
      </div>
    </form>
  );
}
