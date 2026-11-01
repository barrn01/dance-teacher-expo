import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare that is false on any length difference. */
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Constant-time verification of a request's shared webhook secret.
 *
 * Preferred transport is the `x-webhook-secret` header or an
 * `Authorization: Bearer <secret>` header. A `?token=` query-string fallback is
 * still accepted for backward compatibility with existing GHL workflows, but it
 * is DEPRECATED — query strings leak into access logs, proxies and `Referer`.
 * When the query fallback is used we log a one-off warning so the operator can
 * confirm the transport and migrate GHL to a header; once no warnings appear,
 * drop `allowQueryToken` (and eventually this branch) to fully close the leak.
 *
 * All comparisons are constant-time (crypto.timingSafeEqual), replacing the
 * previous `!==` which was vulnerable to a timing side-channel.
 */
export function verifyWebhookSecret(
  request: Request,
  expected: string,
  opts: { allowQueryToken?: boolean } = {},
): boolean {
  if (!expected) return false;

  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (header && safeEqual(header, expected)) return true;

  if (opts.allowQueryToken) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (token && safeEqual(token, expected)) {
      console.warn(
        "[webhook-auth] secret accepted via DEPRECATED ?token= query param — " +
          "reconfigure the sender to use the x-webhook-secret header",
      );
      return true;
    }
  }

  return false;
}
