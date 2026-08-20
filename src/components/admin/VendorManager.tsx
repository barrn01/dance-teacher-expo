"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createVendor,
  resendVendorLink,
  setVendorDocumentStatus,
  updateVendorRecord,
} from "@/app/admin/actions";
import type { Vendor } from "@/lib/types";

const inputClass =
  "w-full rounded-[10px] border border-black/15 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/50";

export function VendorCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
    packageFamily: "",
    packageTier: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createVendor({
      companyName: form.companyName,
      contactEmail: form.contactEmail,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      packageFamily: form.packageFamily || null,
      packageTier: form.packageTier || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not create the vendor.");
      return;
    }
    setForm({
      companyName: "",
      contactEmail: "",
      contactName: "",
      contactPhone: "",
      packageFamily: form.packageFamily,
      packageTier: form.packageTier,
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
        Add vendor
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Company name</label>
          <input
            className={inputClass}
            placeholder="Studio Brands Co."
            value={form.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact email (their login)</label>
          <input
            className={inputClass}
            type="email"
            placeholder="owner@studiobrands.com.au"
            value={form.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact name</label>
          <input
            className={inputClass}
            placeholder="Optional"
            value={form.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact phone</label>
          <input
            className={inputClass}
            placeholder="Optional"
            value={form.contactPhone}
            onChange={(e) => set({ contactPhone: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Package family</label>
          <select
            className={inputClass}
            value={form.packageFamily}
            onChange={(e) => set({ packageFamily: e.target.value })}
          >
            <option value="">—</option>
            <option value="service">Service</option>
            <option value="fashion">Fashion</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Package tier</label>
          <select
            className={inputClass}
            value={form.packageTier}
            onChange={(e) => set({ packageTier: e.target.value })}
          >
            <option value="">—</option>
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
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
        {busy ? "Adding…" : "Add vendor"}
      </button>
      <p className="text-[0.78rem] text-ink/45">
        Adds the <code className="font-mono">dte27 vendor</code> tag (plus the
        tier tag) in GHL. Use “Send link” to email them their sign-in.
      </p>
    </form>
  );
}

export function VendorRecordForm({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: vendor.company_name,
    contactEmail: vendor.contact_email,
    contactName: vendor.contact_name ?? "",
    contactPhone: vendor.contact_phone ?? "",
    packageFamily: vendor.package_family ?? "",
    packageTier: vendor.package_tier ?? "",
    boothNumber: vendor.booth_number ?? "",
    status: vendor.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateVendorRecord({
      id: vendor.id,
      companyName: form.companyName,
      contactEmail: form.contactEmail,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      packageFamily: form.packageFamily || null,
      packageTier: form.packageTier || null,
      boothNumber: form.boothNumber,
      status: form.status as "active" | "inactive",
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
      className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6"
    >
      <span className="absolute inset-x-0 top-0 h-[5px] bg-ink/70" />
      <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
        Vendor record
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className={labelClass}>Company name</label>
          <input
            className={inputClass}
            value={form.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact email (login)</label>
          <input
            className={inputClass}
            type="email"
            value={form.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact name</label>
          <input
            className={inputClass}
            value={form.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Contact phone</label>
          <input
            className={inputClass}
            value={form.contactPhone}
            onChange={(e) => set({ contactPhone: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Package family</label>
          <select
            className={inputClass}
            value={form.packageFamily}
            onChange={(e) => set({ packageFamily: e.target.value })}
          >
            <option value="">—</option>
            <option value="service">Service</option>
            <option value="fashion">Fashion</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Package tier</label>
          <select
            className={inputClass}
            value={form.packageTier}
            onChange={(e) => set({ packageTier: e.target.value })}
          >
            <option value="">—</option>
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Booth number</label>
          <input
            className={inputClass}
            placeholder="Unassigned"
            value={form.boothNumber}
            onChange={(e) => set({ boothNumber: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => set({ status: e.target.value as "active" | "inactive" })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
          className="rounded-full bg-ink px-7 py-3 text-[0.85rem] font-extrabold uppercase tracking-[0.08em] text-white transition-colors hover:bg-char-2 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save record"}
        </button>
        {saved && (
          <span className="text-[0.85rem] font-semibold text-green-700">
            Saved ✓
          </span>
        )}
      </div>
      <p className="text-[0.76rem] text-ink/45">
        Changing the tier updates the vendor&apos;s GHL tier tag automatically.
      </p>
    </form>
  );
}

export function DocStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (s: "approved" | "rejected" | "submitted") => {
    setBusy(true);
    await setVendorDocumentStatus(id, s);
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="flex items-center gap-1.5">
      {status !== "approved" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("approved")}
          className="rounded-full border border-green-300 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("rejected")}
          className="rounded-full border border-black/15 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-ink/60 hover:border-pink hover:text-pink disabled:opacity-50"
        >
          Reject
        </button>
      )}
      {status !== "submitted" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act("submitted")}
          className="text-[0.68rem] font-bold uppercase tracking-[0.04em] text-ink/40 hover:text-ink disabled:opacity-50"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export function VendorResendButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  return (
    <button
      type="button"
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        const res = await resendVendorLink(id);
        setState(res.ok ? "sent" : "error");
      }}
      className="rounded-full border border-black/15 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.04em] text-ink/60 hover:border-ink disabled:opacity-50"
    >
      {state === "sending"
        ? "…"
        : state === "sent"
          ? "Sent ✓"
          : state === "error"
            ? "Retry"
            : "Send link"}
    </button>
  );
}
