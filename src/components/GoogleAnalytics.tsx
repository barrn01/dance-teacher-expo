"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Google Analytics 4 (gtag.js) loader. Mirrors MetaPixel: the bootstrap `config`
 * call fires the initial page_view for the first paint, then this fires
 * page_view again on client-side route changes (App Router SPA nav doesn't
 * reload the page). Renders nothing when no measurement id is configured.
 */
export function GoogleAnalytics({
  measurementId,
}: {
  measurementId: string | null;
}) {
  const pathname = usePathname();
  const firstLoad = useRef(true);
  // Never load or fire GA on the authenticated admin area — keeps third-party
  // JS off admin pages and admin activity out of analytics.
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (!measurementId || isAdmin) return;
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    // The bootstrap config already sent page_view for the first paint; only
    // fire on subsequent route changes.
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, measurementId, isAdmin]);

  if (!measurementId || isAdmin) return null;

  return (
    <>
      <Script
        id="ga4-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  );
}
