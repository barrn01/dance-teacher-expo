/**
 * Sanitise a post-login `next` redirect target to a same-site relative path.
 *
 * The auth routes redirect to `${origin}${next}`. Without this guard a `next` of
 * `@evil.com`, `//evil.com`, or `/\evil.com` would turn that into an external
 * URL (open redirect). Anything that isn't a plain, single-slash relative path
 * falls back to a safe default.
 */
export function safeNext(next: string | null, fallback = "/account"): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
