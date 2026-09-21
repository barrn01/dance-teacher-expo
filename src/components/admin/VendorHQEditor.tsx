"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveVendorHQ } from "@/app/admin/actions";

type ManualField = {
  key: string;
  label: string;
  conditional?: "session" | "fashion";
};
const MANUAL_FIELDS: ManualField[] = [
  { key: "deposit", label: "Deposit paid" },
  { key: "invoice", label: "Invoice received" },
  { key: "funds", label: "Funds received" },
  { key: "ig_sched", label: "IG scheduled" },
  { key: "session", label: "Session", conditional: "session" },
  { key: "fashion", label: "Fashion show", conditional: "fashion" },
];

const STATES = ["waiting", "chase", "done", "na"] as const;

const inputClass =
  "w-full rounded-[8px] border border-black/15 bg-white px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-pink";
const labelClass =
  "text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/50";

type StatusValue = { status: string; note: string };

export function VendorHQEditor({
  vendorId,
  companyName,
  amountDollars,
  outstandingDollars,
  boothNumber,
  videoUrl,
  instagram,
  sessionApplicable,
  fashionApplicable,
  statuses,
}: {
  vendorId: string;
  companyName: string;
  amountDollars: number;
  outstandingDollars: number;
  boothNumber: string;
  videoUrl: string;
  instagram: string;
  sessionApplicable: boolean;
  fashionApplicable: boolean;
  statuses: Record<string, StatusValue>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(String(amountDollars));
  const [outstanding, setOutstanding] = useState(String(outstandingDollars));
  const [booth, setBooth] = useState(boothNumber);
  const [video, setVideo] = useState(videoUrl);
  const [insta, setInsta] = useState(instagram);
  const [fields, setFields] = useState<Record<string, StatusValue>>(() =>
    Object.fromEntries(
      MANUAL_FIELDS.map((f) => [
        f.key,
        // Deposit defaults to done for booked vendors (see vendor-hq.ts).
        statuses[f.key] ?? {
          status: f.key === "deposit" ? "done" : "waiting",
          note: "",
        },
      ]),
    ),
  );

  const applicable = (f: ManualField) =>
    f.conditional === "session"
      ? sessionApplicable
      : f.conditional === "fashion"
        ? fashionApplicable
        : true;

  const setField = (key: string, patch: Partial<StatusValue>) =>
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  async function save() {
    setSaving(true);
    setError(null);
    const toCents = (s: string) => {
      const n = parseFloat(s);
      return Number.isFinite(n) ? Math.round(n * 100) : null;
    };
    const res = await saveVendorHQ(vendorId, {
      amountCents: toCents(amount),
      outstandingCents: toCents(outstanding),
      boothNumber: booth,
      videoUrl: video,
      instagram: insta,
      statuses: MANUAL_FIELDS.filter((f) => applicable(f)).map((f) => ({
        fieldKey: f.key,
        status: fields[f.key].status,
        note: fields[f.key].note,
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Save failed.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-black/15 px-3 py-1 text-[0.72rem] font-bold text-ink/70 hover:border-pink hover:text-pink"
      >
        Edit
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${companyName}`}
          onClick={() => !saving && setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-[min(560px,96vw)] overflow-y-auto rounded-[14px] bg-white p-5 text-ink shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[1.05rem] font-extrabold">{companyName}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl text-ink/50 hover:text-ink"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Money + promo */}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className={labelClass}>Amount (ex GST $)</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Outstanding ($)</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={outstanding}
                  onChange={(e) => setOutstanding(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Booth #</span>
                <input
                  className={inputClass}
                  value={booth}
                  onChange={(e) => setBooth(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Instagram</span>
                <input
                  className={inputClass}
                  value={insta}
                  onChange={(e) => setInsta(e.target.value)}
                />
              </label>
              <label className="col-span-2 grid gap-1">
                <span className={labelClass}>Video URL</span>
                <input
                  className={inputClass}
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                />
              </label>
            </div>

            {/* Manual statuses */}
            <div className="mt-4 grid gap-2">
              <span className={labelClass}>Statuses</span>
              {MANUAL_FIELDS.map((f) => {
                const applic = applicable(f);
                return (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-[0.85rem]">
                      {f.label}
                    </span>
                    {applic ? (
                      <>
                        <select
                          className={`${inputClass} max-w-[130px]`}
                          value={fields[f.key].status}
                          onChange={(e) =>
                            setField(f.key, { status: e.target.value })
                          }
                        >
                          {STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <input
                          className={inputClass}
                          placeholder="note (optional)"
                          value={fields[f.key].note}
                          onChange={(e) =>
                            setField(f.key, { note: e.target.value })
                          }
                        />
                      </>
                    ) : (
                      <span className="text-[0.8rem] italic text-ink/40">
                        N/A for this tier / type
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="mt-3 text-[0.85rem] text-red-600">{error}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-full border border-black/15 px-4 py-2 text-[0.85rem] font-bold text-ink/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-full bg-pink px-5 py-2 text-[0.85rem] font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
