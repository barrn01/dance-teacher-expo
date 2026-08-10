import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service role key. Bypasses RLS —
// never import this into a Client Component or expose the key to the browser.
// Used for reading ticket config and (later) writing order/ticket state from
// the Stripe webhook.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
