import "server-only";
import Stripe from "stripe";

// Lazy singleton so a missing key doesn't throw at import/build time — only
// when a payment path actually runs.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  // Pin to the SDK's bundled API version (omit apiVersion) for type safety.
  client = new Stripe(key, { typescript: true });
  return client;
}
