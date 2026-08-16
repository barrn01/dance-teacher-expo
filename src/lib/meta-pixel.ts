"use client";

/**
 * Thin client-side wrapper over the Meta Pixel (`window.fbq`). Safe to call
 * before the Pixel finishes loading — the bootstrap stub queues calls. No-op
 * when the Pixel was never initialised (no id configured / SSR).
 *
 * Pass an `eventId` that matches the server-side Conversions API event so Meta
 * de-duplicates the pair (used for Purchase: eventId = order number).
 */
type Fbq = (
  command: string,
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export function pixelTrack(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params ?? {}, eventId ? { eventID: eventId } : undefined);
}
