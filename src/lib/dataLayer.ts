"use client";

/**
 * Push a custom event to the Google Tag Manager dataLayer.
 *
 * GA4 is now loaded and managed by GTM (container GTM-TDWVHG4), not by a
 * hardcoded gtag.js — so client-side events are surfaced to GTM here and the
 * agency forwards them to GA4 with a Custom Event trigger + GA4 Event tag.
 * Safe to call before GTM finishes loading: the dataLayer array is created on
 * demand and GTM drains anything already queued when it initialises. No-op
 * during SSR.
 */
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function dataLayerEvent(
  event: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...(params ?? {}) });
}

export type EcommerceItem = {
  item_id?: string;
  item_name: string;
  quantity?: number;
  price?: number;
};

export type EcommercePayload = {
  transaction_id?: string;
  value?: number;
  currency?: string;
  items: EcommerceItem[];
};

/**
 * Push a GA4 ecommerce event (e.g. `purchase`, `begin_checkout`) to the GTM
 * dataLayer in GA4's recommended shape. The previous `ecommerce` object is
 * cleared first (`{ ecommerce: null }`) so item data from an earlier event
 * can't leak into this one. The agency's GA4 Event tag in GTM reads the
 * `ecommerce` object and forwards it to GA4. Meta is NOT driven from here —
 * the hardcoded Pixel + CAPI handle Meta (MetaPixel.tsx + src/lib/meta.ts).
 */
export function dataLayerEcommerce(
  event: string,
  ecommerce: EcommercePayload,
): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce });
}
