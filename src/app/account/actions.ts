"use server";

import { revalidatePath } from "next/cache";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertContact, removeTagsByEmail } from "@/lib/ghl";

export type UpdateAttendeeResult = { ok: boolean; error?: string };

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Assign or swap the attendee on a ticket. Authorised by RLS (the buyer may
 * only touch attendees under their own orders). We sync the attendee to GHL
 * and — once every ticket on the order has an attendee email — close out the
 * "details outstanding" reminder. We deliberately do NOT email the attendee:
 * the studio owner holds the tickets, the event runs ticketless at the desk,
 * and attendees are emailed their app details in a batch closer to the event.
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

  // Sync the attendee to GHL so they can be emailed app details closer to the
  // event. No ticket email is sent to the attendee (see function doc).
  if (email) {
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
