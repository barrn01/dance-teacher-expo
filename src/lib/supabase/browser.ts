"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client (anon key) for the buyer dashboard's client-side
// auth calls (magic-link sign-in, sign-out). Reads/writes still go through
// RLS. Safe to expose — the anon key is public by design.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
