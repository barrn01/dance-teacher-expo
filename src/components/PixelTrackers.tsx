"use client";

import { useEffect, useRef } from "react";
import { pixelTrack } from "@/lib/meta-pixel";

/** Fire ViewContent once when the tickets page mounts. */
export function ViewContentTracker({
  valueCents,
  currency,
  contentIds,
}: {
  valueCents: number;
  currency: string;
  contentIds: string[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    pixelTrack("ViewContent", {
      content_type: "product",
      content_ids: contentIds,
      currency,
      value: valueCents / 100,
    });
  }, [valueCents, currency, contentIds]);
  return null;
}

/**
 * Fire Purchase once on the success page. eventID = order number so Meta
 * de-duplicates against the server-side Conversions API Purchase.
 */
export function PurchaseTracker({
  orderNumber,
  valueCents,
  currency,
  numItems,
  contentIds,
}: {
  orderNumber: string;
  valueCents: number;
  currency: string;
  numItems: number;
  contentIds: string[];
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !orderNumber) return;
    fired.current = true;
    pixelTrack(
      "Purchase",
      {
        content_type: "product",
        content_ids: contentIds,
        currency,
        value: valueCents / 100,
        num_items: numItems,
      },
      orderNumber,
    );
  }, [orderNumber, valueCents, currency, numItems, contentIds]);
  return null;
}
