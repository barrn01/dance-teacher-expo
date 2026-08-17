"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPromo, setPromoActive } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

export function PromoCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    discountType: "percent" as "percent" | "fixed_amount",
    discountValue: "",
    maxRedemptions: "",
    endsAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createPromo({
      code: form.code,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue) || 0,
      maxRedemptions: form.maxRedemptions
        ? parseInt(form.maxRedemptions)
        : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not create the code.");
      return;
    }
    setForm({
      code: "",
      discountType: form.discountType,
      discountValue: "",
      maxRedemptions: "",
      endsAt: "",
    });
    router.refresh();
  };

  return (
    <form
      onSubmit={submit}
      className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        New promo code
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Code</label>
          <input
            className={`${inputClass} uppercase`}
            placeholder="EARLYBIRD"
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Type</label>
          <select
            className={inputClass}
            value={form.discountType}
            onChange={(e) =>
              set({
                discountType: e.target.value as "percent" | "fixed_amount",
              })
            }
          >
            <option value="percent">Percent off</option>
            <option value="fixed_amount">Fixed $ off</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <label className={labelClass}>
            {form.discountType === "percent" ? "Percent (1–100)" : "Dollars off"}
          </label>
          <input
            className={inputClass}
            type="number"
            min={form.discountType === "percent" ? 1 : 0.01}
            step={form.discountType === "percent" ? 1 : 0.01}
            placeholder={form.discountType === "percent" ? "20" : "50"}
            value={form.discountValue}
            onChange={(e) => set({ discountValue: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Max uses (blank = ∞)</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            placeholder="—"
            value={form.maxRedemptions}
            onChange={(e) => set({ maxRedemptions: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Expires (blank = never)</label>
          <input
            className={inputClass}
            type="date"
            value={form.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-pink px-7 py-3 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}

export function PromoToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setPromoActive(id, !isActive);
        setBusy(false);
        router.refresh();
      }}
      className={`rounded-full px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.04em] disabled:opacity-50 ${
        isActive
          ? "border border-black/15 text-ink/60 hover:border-ink"
          : "bg-ink text-white hover:bg-char-2"
      }`}
    >
      {busy ? "…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
