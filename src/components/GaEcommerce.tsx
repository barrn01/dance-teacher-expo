"use client";

import { useEffect, useRef } from "react";
import { dataLayerEcommerce, type EcommerceItem } from "@/lib/dataLayer";

/**
 * GA4 ecommerce trackers for Google Analytics / Google Ads (managed by Soup
 * Agency in GTM). These push GA4-standard ecommerce events to the dataLayer;
 * GTM forwards them to GA4. Meta is deliberately handled elsewhere (hardcoded
 * Pixel + CAPI) — do not add Meta events here, or Purchases will double-count.
 */

/**
 * GA4 `begin_checkout` — fires once when the checkout page mounts (the buyer
 * has reached checkout). Not deduplicated; reaching checkout again fires again,
 * which is the expected GA4 behaviour.
 */
export function GaBeginCheckout({
  valueCents,
  currency,
  items,
}: {
  valueCents: number;
  currency: string;
  items: EcommerceItem[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    dataLayerEcommerce("begin_checkout", {
      value: valueCents / 100,
      currency,
      items,
    });
  }, [valueCents, currency, items]);
  return null;
}

/**
 * GA4 `purchase` — fires once on the order-confirmation page. `transaction_id`
 * is the order number, so GA4 automatically de-duplicates if the buyer reloads
 * the confirmation page.
 */
export function GaPurchase({
  transactionId,
  valueCents,
  currency,
  items,
}: {
  transactionId: string;
  valueCents: number;
  currency: string;
  items: EcommerceItem[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !transactionId) return;
    fired.current = true;
    dataLayerEcommerce("purchase", {
      transaction_id: transactionId,
      value: valueCents / 100,
      currency,
      items,
    });
  }, [transactionId, valueCents, currency, items]);
  return null;
}
