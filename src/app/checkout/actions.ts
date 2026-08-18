"use server";

import { getEventWithTicketTypes } from "@/lib/tickets";
import { computeOrder, parseItemsParam } from "@/lib/order";
import { validatePromo, promoLabel } from "@/lib/promo";

export type CheckPromoResult =
  | { ok: true; discountCents: number; code: string; label: string }
  | { ok: false; error: string };

/** Validate a promo code against the current cart (for the checkout UI). */
export async function checkPromo(
  code: string,
  itemsParam: string,
): Promise<CheckPromoResult> {
  const data = await getEventWithTicketTypes();
  if (!data) return { ok: false, error: "Event not found." };
  const order = computeOrder(data.ticketTypes, parseItemsParam(itemsParam));
  if (order.totalQuantity <= 0)
    return { ok: false, error: "Your cart is empty." };

  const res = await validatePromo(code, order, data.event.id);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    discountCents: res.discountCents,
    code: res.code,
    label: promoLabel(res.promo),
  };
}
