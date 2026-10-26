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
