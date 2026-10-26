"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Google Tag Manager loader (container GTM-TDWVHG4, managed by Soup Agency).
 *
 * GTM now OWNS Google Analytics 4 for this site: the GA4 "Google Tag"
 * (G-W9SGXSXVKM) lives inside the container as an All Pages tag, so there is no
 * hardcoded gtag.js anymore (the old GoogleAnalytics component was removed to
 * avoid double-counting page_view). The agency manages GA4 + Google Ads events
 * from inside GTM.
 *
 * The Meta Pixel (browser) and Meta Conversions API (server) stay HARDCODED
 * (see MetaPixel.tsx + src/lib/meta.ts) and are deliberately NOT managed here —
 * the server-side CAPI Purchase dedups against the browser Pixel on the order
 * number, which is stronger than a GTM-fired pixel. The container's old
 * `Facebook - *` tags are paused for this reason; do not re-enable them.
 *
 * Mirrors MetaPixel/GoogleAnalytics behaviour: never loads on the authenticated
 * /admin area, and renders nothing when no container id is configured.
 */
export function GoogleTagManager({
  containerId,
}: {
  containerId: string | null;
}) {
  const pathname = usePathname();
  // Keep GTM (and everything it loads) off the admin area so third-party JS
  // never runs there and admin activity stays out of analytics.
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  if (!containerId || isAdmin) return null;

  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
