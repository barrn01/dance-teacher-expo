/**
 * Google Tag Manager loader (container GTM-TDWVHG4, managed by Soup Agency).
 *
 * Rendered SERVER-SIDE as a raw inline script so the snippet is present in the
 * initial HTML — it loads as early as possible (best for ad-conversion accuracy)
 * and is detectable by Google's tag checkers / Tag Assistant. (The previous
 * next/script `afterInteractive` version injected the script only after
 * hydration, so it was absent from the server HTML and failed detection.)
 *
 * GTM now OWNS Google Analytics 4 for this site: the GA4 "Google Tag"
 * (G-W9SGXSXVKM) lives inside the container as an All Pages tag, so there is no
 * hardcoded gtag.js (the old GoogleAnalytics component was removed to avoid
 * double-counting page_view). The agency manages GA4 + Google Ads from GTM.
 *
 * The Meta Pixel (browser) + Meta Conversions API (server) stay HARDCODED
 * (see MetaPixel.tsx + src/lib/meta.ts) and are deliberately NOT managed here —
 * the server-side CAPI Purchase dedups against the browser Pixel on the order
 * number, which is stronger than a GTM-fired pixel. The container's old
 * `Facebook - *` tags are paused for this reason; do not re-enable them.
 *
 * The inline bootstrap self-excludes the authenticated /admin area at runtime
 * (a `location.pathname` guard) so third-party JS and admin activity/PII stay
 * out of analytics — matching the old GA/Pixel exclusion without a client hook.
 * Renders nothing when no container id is configured.
 */
export function GoogleTagManager({
  containerId,
}: {
  containerId: string | null;
}) {
  if (!containerId) return null;

  // Standard GTM bootstrap, wrapped in an /admin guard so it never initialises
  // on the admin area. The snippet still appears in the HTML source (so tag
  // checkers detect it); it simply no-ops when the path starts with /admin.
  const snippet = `if(!location.pathname.startsWith('/admin')){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');}`;

  return (
    <>
      <script id="gtm-init" dangerouslySetInnerHTML={{ __html: snippet }} />
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
