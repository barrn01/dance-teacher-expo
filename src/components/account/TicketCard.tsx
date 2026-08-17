"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAttendee } from "@/app/account/actions";

const inputClass =
  "w-full rounded-[9px] border border-black/15 bg-white px-3 py-2 text-[0.9rem] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-pink";

export type TicketCardData = {
  index: number;
  ticketTypeName: string;
  qrDataUrl: string;
  attendeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export function TicketCard({ ticket }: { ticket: TicketCardData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: ticket.firstName,
    lastName: ticket.lastName,
    email: ticket.email,
    phone: ticket.phone,
  });

  const assigned = !!ticket.email;
  const displayName =
    [ticket.firstName, ticket.lastName].filter(Boolean).join(" ") ||
    ticket.email;

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await updateAttendee({ attendeeId: ticket.attendeeId, ...form });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save.");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  return (
    <li className="rounded-[12px] border border-black/10 bg-paper-2 p-3">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ticket.qrDataUrl}
          width={72}
          height={72}
          alt=""
          className="h-[72px] w-[72px] shrink-0 rounded-[8px] bg-white p-1"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/45">
            Ticket {ticket.index} · {ticket.ticketTypeName}
          </div>
          {assigned ? (
            <>
              <div className="mt-0.5 truncate font-bold text-ink">
                {displayName}
              </div>
              <div className="truncate text-[0.82rem] text-ink/55">
                {ticket.email}
              </div>
            </>
          ) : (
            <div className="mt-0.5 font-bold text-pink">Not assigned yet</div>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setForm({
                firstName: ticket.firstName,
                lastName: ticket.lastName,
                email: ticket.email,
                phone: ticket.phone,
              });
              setEditing(true);
            }}
            className="shrink-0 rounded-full border-2 border-ink/15 px-4 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink"
          >
            {assigned ? "Edit" : "Assign"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 border-t border-black/10 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
          <input
            className={inputClass}
            placeholder="Email — their ticket goes here"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Phone (optional)"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {error && (
            <p className="rounded-[9px] bg-pink/10 px-3 py-2 text-[0.85rem] font-semibold text-pink">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center rounded-full bg-pink px-5 py-2.5 text-[0.78rem] font-extrabold uppercase tracking-[0.06em] text-white transition-colors hover:bg-pink-hot disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-ink/55 hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <p className="text-[0.75rem] text-ink/45">
            Changing the email re-sends this ticket to the new attendee. The QR
            stays the same.
          </p>
        </div>
      )}
    </li>
  );
}
