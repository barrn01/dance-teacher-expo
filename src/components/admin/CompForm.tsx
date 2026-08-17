"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createComp } from "@/app/admin/actions";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

const REASONS = ["Speaker", "Staff", "Prize", "Sponsor", "VIP guest", "Other"];

export function CompForm({
  ticketTypeKey,
  ticketTypeName,
}: {
  ticketTypeKey: string;
  ticketTypeName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    quantity: 1,
    reason: "Speaker",
    sendEmail: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createComp({ ...form, ticketTypeKey });
    if (!res.ok) {
      setBusy(false);
      setError(res.error ?? "Couldn't issue the comp.");
      return;
    }
    router.push(`/admin/orders/${res.orderId}`);
  };

  return (
    <form
      onSubmit={submit}
      className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />

      <div className="grid gap-1">
        <label className={labelClass}>Recipient name</label>
        <input
          className={inputClass}
          placeholder="Jane Smith"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Email</label>
          <input
            className={inputClass}
            type="email"
            placeholder="jane@example.com"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Phone (optional)</label>
          <input
            className={inputClass}
            type="tel"
            placeholder="0400 000 000"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Tickets</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            max={50}
            value={form.quantity}
            onChange={(e) =>
              set({ quantity: Math.max(1, parseInt(e.target.value) || 1) })
            }
          />
          <span className="text-[0.72rem] text-ink/45">{ticketTypeName}</span>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Reason</label>
          <select
            className={inputClass}
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-paper-2 p-3.5">
        <input
          type="checkbox"
          checked={form.sendEmail}
          onChange={(e) => set({ sendEmail: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-pink"
        />
        <span className="text-[0.85rem] leading-snug text-ink/75">
          <span className="font-bold text-ink">Email the recipient</span> their
          QR ticket{form.quantity === 1 ? "" : "s"} now. Leave unticked to issue
          quietly (you can find the QRs on the order).
        </span>
      </label>

      {error && (
        <p className="rounded-[10px] bg-pink/10 px-4 py-3 text-[0.9rem] font-semibold text-pink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center rounded-full bg-pink px-8 py-3.5 text-[0.9rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-hot disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Issuing…"
          : `Issue ${form.quantity} comp ticket${form.quantity === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
