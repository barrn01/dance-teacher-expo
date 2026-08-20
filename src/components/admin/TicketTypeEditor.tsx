"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTicketType } from "@/app/admin/actions";
import type { TicketType } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

type BandForm = { from: string; to: string; price: string };

const centsToInput = (c: number) =>
  c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);

const fmt = (cents: number) => {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
};

/** Mirror of the server's band pricing, for a live preview only. */
function previewTotal(
  bands: { from: number; to: number | null; cents: number }[],
  basePriceCents: number,
  qty: number,
): number {
  let total = 0;
  for (let pos = 1; pos <= qty; pos++) {
    const band = bands.find(
      (b) => pos >= b.from && pos <= (b.to ?? Infinity),
    );
    total += band ? band.cents : basePriceCents;
  }
  return total;
}

export function TicketTypeEditor({ tt }: { tt: TicketType }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: tt.name,
    description: tt.description ?? "",
    basePrice: centsToInput(tt.price_cents),
    minQuantity: String(tt.min_quantity ?? 1),
    maxQuantity: tt.max_quantity != null ? String(tt.max_quantity) : "",
    isActive: tt.is_active,
    isFeatured: tt.is_featured,
    inclusions: (tt.inclusions ?? []).join("\n"),
  });
  const [bands, setBands] = useState<BandForm[]>(
    (tt.pricing_rules?.price_bands ?? []).map((b) => ({
      from: String(b.from),
      to: b.to != null ? String(b.to) : "",
      price: centsToInput(b.price_cents),
    })),
  );

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };
  const setBand = (i: number, patch: Partial<BandForm>) => {
    setBands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    setSaved(false);
  };
  const addBand = () => {
    setBands((bs) => [...bs, { from: "", to: "", price: "" }]);
    setSaved(false);
  };
  const removeBand = (i: number) => {
    setBands((bs) => bs.filter((_, j) => j !== i));
    setSaved(false);
  };

  // Live preview at a few quantities.
  const preview = useMemo(() => {
    const parsed = bands
      .map((b) => ({
        from: parseInt(b.from, 10),
        to: b.to.trim() ? parseInt(b.to, 10) : null,
        cents: Math.round((parseFloat(b.price) || 0) * 100),
      }))
      .filter((b) => Number.isFinite(b.from))
      .sort((a, b) => a.from - b.from);
    const base = Math.round((parseFloat(form.basePrice) || 0) * 100);
    return [1, 4, 5, 6, 10].map((q) => ({
      q,
      total: previewTotal(parsed, base, q),
    }));
  }, [bands, form.basePrice]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateTicketType({
      id: tt.id,
      name: form.name,
      description: form.description,
      basePriceDollars: parseFloat(form.basePrice) || 0,
      minQuantity: parseInt(form.minQuantity, 10) || 1,
      maxQuantity: form.maxQuantity.trim()
        ? parseInt(form.maxQuantity, 10)
        : null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      inclusions: form.inclusions.split("\n"),
      priceBands: bands
        .filter((b) => b.from.trim() !== "")
        .map((b) => ({
          from: parseInt(b.from, 10),
          to: b.to.trim() ? parseInt(b.to, 10) : null,
          priceDollars: parseFloat(b.price) || 0,
        })),
    });
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
      onSubmit={submit}
      className="relative grid gap-5 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          {tt.name}
        </h2>
        <code className="rounded-full bg-ink/5 px-2.5 py-1 font-mono text-[0.72rem] text-ink/50">
          {tt.key}
        </code>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Name</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Base / single price ($)</label>
          <input
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            value={form.basePrice}
            onChange={(e) => set({ basePrice: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-1">
        <label className={labelClass}>Description</label>
        <textarea
          className={`${inputClass} min-h-[72px] resize-y`}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <div className="grid gap-1">
        <label className={labelClass}>Inclusions (one per line)</label>
        <textarea
          className={`${inputClass} min-h-[110px] resize-y`}
          value={form.inclusions}
          onChange={(e) => set({ inclusions: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="grid gap-1">
          <label className={labelClass}>Min / order</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            value={form.minQuantity}
            onChange={(e) => set({ minQuantity: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Max / order (∞)</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            placeholder="—"
            value={form.maxQuantity}
            onChange={(e) => set({ maxQuantity: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set({ isActive: e.target.checked })}
          />
          Active
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5 text-[0.85rem] font-semibold text-ink/70">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => set({ isFeatured: e.target.checked })}
          />
          Featured
        </label>
      </div>

      {/* Price bands */}
      <div className="grid gap-3 rounded-[12px] border border-black/10 bg-paper/60 p-4">
        <div>
          <h3 className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-ink/55">
            Price bands (by ticket position)
          </h3>
          <p className="mt-1 text-[0.82rem] leading-relaxed text-ink/55">
            Each ticket in an order is priced by its position. e.g.{" "}
            <em>1–4 at $329, the 5th at $0, 6th onward at $249</em>. Leave{" "}
            <strong>To</strong> blank for “onward”. Positions not covered by any
            band use the base price. No bands = flat base price for every ticket.
          </p>
        </div>

        {bands.length > 0 && (
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ink/40">
              <span>From pos</span>
              <span>To pos</span>
              <span>Price ($)</span>
              <span></span>
            </div>
            {bands.map((b, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2"
              >
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  placeholder="1"
                  value={b.from}
                  onChange={(e) => setBand(i, { from: e.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  placeholder="∞"
                  value={b.to}
                  onChange={(e) => setBand(i, { to: e.target.value })}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={b.price}
                  onChange={(e) => setBand(i, { price: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeBand(i)}
                  className="rounded-full border border-black/15 px-3 py-2 text-[0.7rem] font-bold text-ink/50 hover:border-pink hover:text-pink"
                  aria-label="Remove band"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addBand}
          className="justify-self-start rounded-full border border-black/20 px-4 py-2 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-ink/70 hover:border-ink hover:text-ink"
        >
          + Add band
        </button>
      </div>

      {/* Live preview */}
      <div className="grid gap-2 rounded-[12px] border border-pink/25 bg-pink/[0.04] p-4">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-pink/70">
          Live preview — order total
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] text-ink">
          {preview.map((p) => (
            <span key={p.q} className="tabular-nums">
              <strong>{p.q}</strong> ticket{p.q > 1 ? "s" : ""}:{" "}
              <strong>{fmt(p.total)}</strong>
            </span>
          ))}
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
          {busy ? "Saving…" : "Save changes"}
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
