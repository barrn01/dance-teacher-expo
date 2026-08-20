"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addVendorStaff,
  updateVendorStaff,
  removeVendorStaff,
} from "@/app/vendor/actions";
import { MAX_VENDOR_STAFF } from "@/lib/vendor-logos";
import type { VendorStaff } from "@/lib/vendors";

const inputClass =
  "w-full rounded-[9px] border border-black/15 bg-white px-3 py-2 text-[0.9rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";
const labelClass =
  "text-[0.62rem] font-bold uppercase tracking-[0.09em] text-ink/45";

export function VendorStaffManager({ staff }: { staff: VendorStaff[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCap = staff.length >= MAX_VENDOR_STAFF;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adding.firstName.trim()) {
      setError("Enter at least a first name.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await addVendorStaff(adding);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not add staff member.");
      return;
    }
    setAdding({ firstName: "", lastName: "", email: "", phone: "" });
    router.refresh();
  };

  return (
    <section className="relative grid gap-4 overflow-hidden rounded-[14px] border border-black/10 bg-white p-6">
      <span className="absolute inset-x-0 top-0 h-[5px] bg-pink" />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-ink/55">
            Attending staff
          </h2>
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-ink/45">
            {staff.length} of {MAX_VENDOR_STAFF} passes used
          </span>
        </div>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-ink/55">
          Add the team members working your booth (up to {MAX_VENDOR_STAFF}).
          Each gets an event pass for check-in — we&apos;ll email their app
          details closer to the event.
        </p>
      </div>

      {staff.length > 0 && (
        <ul className="grid gap-2">
          {staff.map((s) => (
            <StaffRow key={s.id} staff={s} />
          ))}
        </ul>
      )}

      {/* Add row (hidden at cap) */}
      {atCap ? (
        <p className="rounded-[12px] border border-dashed border-black/15 bg-paper/50 px-4 py-3 text-[0.85rem] text-ink/60">
          You&apos;ve added the maximum of {MAX_VENDOR_STAFF} staff passes.
          Remove one to add another, or contact{" "}
          <a
            href="mailto:hello@danceteacherexpo.com.au"
            className="font-semibold text-pink hover:underline"
          >
            hello@danceteacherexpo.com.au
          </a>{" "}
          if you need more.
        </p>
      ) : (
      <form
        onSubmit={add}
        className="grid gap-3 rounded-[12px] border border-dashed border-black/15 bg-paper/50 p-4"
      >
        <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-ink/50">
          Add a staff member
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className={labelClass}>First name *</label>
            <input
              className={inputClass}
              value={adding.firstName}
              onChange={(e) =>
                setAdding((a) => ({ ...a, firstName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1">
            <label className={labelClass}>Last name</label>
            <input
              className={inputClass}
              value={adding.lastName}
              onChange={(e) =>
                setAdding((a) => ({ ...a, lastName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1">
            <label className={labelClass}>Email</label>
            <input
              className={inputClass}
              type="email"
              value={adding.email}
              onChange={(e) =>
                setAdding((a) => ({ ...a, email: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1">
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              value={adding.phone}
              onChange={(e) =>
                setAdding((a) => ({ ...a, phone: e.target.value }))
              }
            />
          </div>
        </div>
        {error && (
          <p className="rounded-[9px] bg-pink/10 px-3 py-2 text-[0.85rem] font-semibold text-pink">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="justify-self-start rounded-full bg-pink px-6 py-2.5 text-[0.8rem] font-extrabold uppercase tracking-[0.07em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add staff member"}
        </button>
      </form>
      )}
    </section>
  );
}

function StaffRow({ staff }: { staff: VendorStaff }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: staff.first_name ?? "",
    lastName: staff.last_name ?? "",
    email: staff.email ?? "",
    phone: staff.phone ?? "",
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateVendorStaff({ attendeeId: staff.id, ...form });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save.");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const res = await removeVendorStaff(staff.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not remove.");
      return;
    }
    router.refresh();
  };

  const name =
    [staff.first_name, staff.last_name].filter(Boolean).join(" ") ||
    "Unnamed staff";

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-black/10 px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{name}</div>
          <div className="truncate text-[0.8rem] text-ink/55">
            {staff.email || "No email"}
            {staff.phone ? ` · ${staff.phone}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.05em] text-green-800">
            Pass ready
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-black/15 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-ink/60 hover:border-ink"
          >
            Edit
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="grid gap-3 rounded-[10px] border border-pink/30 bg-pink/[0.03] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="First name"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
        <input
          className={inputClass}
          placeholder="Last name"
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <input
          className={inputClass}
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </div>
      {error && (
        <p className="text-[0.82rem] font-semibold text-pink">{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-full bg-pink px-5 py-2 text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-white hover:bg-pink-hot disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(false)}
          className="rounded-full border border-black/15 px-5 py-2 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink/60 hover:border-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="ml-auto rounded-full px-4 py-2 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-pink hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
