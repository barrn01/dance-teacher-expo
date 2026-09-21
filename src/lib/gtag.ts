"use client";

/**
 * Thin client-side wrapper over Google Analytics 4 (`window.gtag`). Safe to
 * call before gtag.js finishes loading — the dataLayer stub queues calls. No-op
 * when GA was never initialised (no measurement id configured / SSR).
 */
type Gtag = (
  command: "js" | "config" | "event" | "set",
  targetOrEvent: string | Date,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export function gtagEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params ?? {});
}
