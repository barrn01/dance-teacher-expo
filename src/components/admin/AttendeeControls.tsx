"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAttendeeCategory } from "@/app/admin/actions";
import { ATTENDEE_CATEGORIES } from "@/lib/attendee-config";

/** Inline category picker for a ticket holder (auto-saves on change). */
export function AttendeeCategorySelect({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <select
      disabled={busy}
      value={value ?? ""}
      onChange={async (e) => {
        setBusy(true);
        await setAttendeeCategory(id, e.target.value || null);
        setBusy(false);
        router.refresh();
      }}
      className="rounded-full border border-black/15 bg-white px-2.5 py-1 text-[0.78rem] text-ink outline-none focus:border-pink disabled:opacity-50"
    >
      <option value="">— Set —</option>
      {ATTENDEE_CATEGORIES.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
