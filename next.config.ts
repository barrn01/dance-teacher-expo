import type { NextConfig } from "next";

// Security response headers applied to every route. We deliberately keep the CSP
// to `frame-ancestors` only (clickjacking defence) rather than an enforcing
// `script-src`: the app loads inline GTM/Meta Pixel/GA and Stripe scripts, so a
// strict script CSP needs per-request nonces and careful testing — tracked as a
// follow-up. The headers below are all safe for a live tracking/payments site.
const securityHeaders = [
  // Clickjacking: modern (frame-ancestors) + legacy (X-Frame-Options) controls.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Force HTTPS for two years. No includeSubDomains/preload on purpose — other
  // subdomains (vendor., mail., …) are served by GHL/third parties.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (e.g. the success page's ?payment_intent=) cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Don't let Next.js auto-generate/overwrite CLAUDE.md — the project's
  // CLAUDE.md is the hand-authored brief and the source of truth.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
