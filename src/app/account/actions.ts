"use server";

import { revalidatePath } from "next/cache";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAttendeeTicket } from "@/lib/email";
import { upsertContact, removeTagsByEmail } from "@/lib/ghl";

export type UpdateAttendeeResult = { ok: boolean; error?: string };

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/**
 * Assign or swap the attendee on a ticket. Authorised by RLS (the buyer may
 * only touch attendees under their own orders). On a real change we email the
 * new attendee their QR, sync them to GHL, and — once every ticket on the
 * order has an attendee email — close out the "details outstanding" reminder.
 */
export async function updateAttendee(input: {
  attendeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): Promise<UpdateAttendeeResult> {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const email = input.email.trim();
  if (email && !isEmail(email))
    return { ok: false, error: "Please enter a valid email." };

  // Read the current email first so we only re-send the ticket on a real
  // change. RLS scopes this to the buyer's own attendees.
  const { data: existing } = await auth
    .from("attendees")
    .select("email")
    .eq("id", input.attendeeId)
    .maybeSingle();
  const previousEmail = existing?.email ?? null;

  // Update via the authenticated client — RLS enforces ownership.
  const { data: updated, error } = await auth
    .from("attendees")
    .update({
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      email: email || null,
      phone: input.phone.trim() || null,
    })
    .eq("id", input.attendeeId)
    .select("id, order_id")
    .maybeSingle();

  if (error || !updated)
    return { ok: false, error: "Couldn't save — please try again." };

  // --- Side effects (best-effort; privileged service client) ---
  const sb = createServiceClient();
  const fullName =
    [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(" ") ||
    null;

  if (email) {
    // Ticket QR for this attendee (unique attendee_id).
    const { data: ticket } = await sb
      .from("tickets")
      .select(
        "qr_token, order:orders(order_number), ticket_type:ticket_types(name)",
      )
      .eq("attendee_id", updated.id)
      .maybeSingle();

    if (ticket) {
      const ord = one(
        ticket.order as { order_number: string } | { order_number: string }[] | null,
      );
      const tt = one(
        ticket.ticket_type as { name: string } | { name: string }[] | null,
      );
      // Only email a ticket when the attendee address actually changed.
      if (email.toLowerCase() !== (previousEmail ?? "").toLowerCase()) {
        await sendAttendeeTicket({
          to: email,
          attendeeName: fullName,
          orderNumber: ord?.order_number ?? "",
          ticketTypeName: tt?.name ?? "Two-Day All Access",
          qrToken: ticket.qr_token,
        });
      }
    }

    // Sync attendee to GHL.
    await upsertContact({
      email,
      name: fullName,
      phone: input.phone.trim() || null,
      tags: ["DTE2027-attendee"],
    });
  }

  // Completion check: are all tickets on this order now assigned an email?
  const { data: siblings } = await sb
    .from("attendees")
    .select("email")
    .eq("order_id", updated.order_id);
  const allAssigned =
    (siblings?.length ?? 0) > 0 && (siblings ?? []).every((a) => !!a.email);

  if (allAssigned) {
    const { data: order } = await sb
      .from("orders")
      .select("buyer_email")
      .eq("id", updated.order_id)
      .maybeSingle();
    if (order?.buyer_email) {
      await upsertContact({
        email: order.buyer_email,
        tags: ["dte2027-attendee-completion"],
      });
      await removeTagsByEmail(order.buyer_email, [
        "DTE2027-attendees-outstanding",
      ]);
    }
  }

  revalidatePath("/account");
  return { ok: true };
}
