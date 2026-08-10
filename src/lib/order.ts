import type { TicketType } from "./types";
import { priceBreakdown, type PriceBreakdown } from "./pricing";

// A selection maps ticket_type.key -> quantity.
export type Selection = Record<string, number>;

/** Parse "key:qty,key:qty" (from the ?items= param) into a selection. */
export function parseItemsParam(raw?: string | null): Selection {
  const out: Selection = {};
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [key, qty] = part.split(":");
    const n = Number(qty);
    if (key && Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

export type OrderLine = {
  ticketType: TicketType;
  quantity: number;
  breakdown: PriceBreakdown;
};

export type ComputedOrder = {
  lines: OrderLine[];
  totalQuantity: number;
  subtotalCents: number;
  totalCents: number;
  savingsCents: number;
  currency: string;
};

/**
 * Authoritative order total computed server-side from ticket config. Quantities
 * are clamped to each ticket's min/max. Never trust a client-supplied amount.
 */
export function computeOrder(
  ticketTypes: TicketType[],
  selection: Selection,
): ComputedOrder {
  const byKey = new Map(ticketTypes.map((tt) => [tt.key, tt]));
  const lines: OrderLine[] = [];
  let totalQuantity = 0;
  let totalCents = 0;
  let savingsCents = 0;
  let currency = "AUD";

  for (const [key, rawQty] of Object.entries(selection)) {
    const tt = byKey.get(key);
    if (!tt || !tt.is_active) continue;
    let qty = Math.max(0, Math.floor(rawQty));
    if (tt.max_quantity != null) qty = Math.min(qty, tt.max_quantity);
    if (qty <= 0) continue;

    const breakdown = priceBreakdown(tt, qty);
    lines.push({ ticketType: tt, quantity: qty, breakdown });
    totalQuantity += breakdown.quantity;
    totalCents += breakdown.subtotalCents;
    savingsCents += breakdown.savingsCents;
    currency = tt.currency || currency;
  }

  return {
    lines,
    totalQuantity,
    subtotalCents: totalCents,
    totalCents,
    savingsCents,
    currency,
  };
}
