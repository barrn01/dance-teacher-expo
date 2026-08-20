"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPromo,
  createPromosBulk,
  setPromoActive,
  type BulkPromoResult,
} from "@/app/admin/actions";

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

const SAMPLE_CSV = `code,type,value,max_uses,expires
EARLYBIRD,percent,20,100,2027-03-01
STUDIO50,fixed,50,,
PARTNER,percent,15,,2027-04-01
VIPFREE,percent,100,25,
`;

export function PromoBulkUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkPromoResult | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const res = await createPromosBulk(text);
      if (!res.ok) {
        setError(res.error ?? "Could not read that file.");
      } else {
        setResult(res);
        if (res.created > 0) router.refresh();
      }
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "promo-codes-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const failures = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-ink/70" />
      <div>
        <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
          Bulk upload (CSV)
        </h2>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-ink/60">
          Columns: <code className="font-mono">code, type, value, max_uses, expires</code>.
          {" "}
          <span className="text-ink/50">
            Type is <em>percent</em> or <em>fixed</em>; value is a percentage or
            dollar amount. <code className="font-mono">max_uses</code> and{" "}
            <code className="font-mono">expires</code> (a date) are optional.
            Codes are created active.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          className="text-[0.85rem] text-ink/70 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-5 file:py-2.5 file:text-[0.8rem] file:font-extrabold file:uppercase file:tracking-[0.06em] file:text-white hover:file:bg-char-2 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={downloadSample}
          className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-pink underline-offset-2 hover:underline"
        >
          Download template
        </button>
        {busy && <span className="text-[0.85rem] text-ink/50">Importing…</span>}
      </div>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-3">
          <p className="text-[0.9rem] font-semibold text-ink">
            {fileName ? `${fileName}: ` : ""}
            <span className="text-green-700">{result.created} created</span>
            {result.failed > 0 && (
              <span className="text-pink">, {result.failed} skipped</span>
            )}
            .
          </p>
          {failures.length > 0 && (
            <div className="overflow-x-auto rounded-[10px] border border-pink/25 bg-pink/[0.04]">
              <table className="w-full min-w-[420px] border-collapse text-[0.82rem]">
                <thead>
                  <tr className="border-b border-pink/20 text-left text-[0.68rem] font-bold uppercase tracking-[0.08em] text-pink/70">
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f) => (
                    <tr
                      key={f.line}
                      className="border-b border-pink/10 last:border-0"
                    >
                      <td className="px-3 py-2 tabular-nums text-ink/60">
                        {f.line}
                      </td>
                      <td className="px-3 py-2 font-mono text-ink">
                        {f.code || "—"}
                      </td>
                      <td className="px-3 py-2 text-ink/70">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
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
