import { createClient } from "@supabase/supabase-js";

// Client-side Supabase: ANON / publishable key only. The service role key must NEVER
// be bundled into the frontend (§13.3). Admin data access is protected by RLS; the
// voter path goes exclusively through the get_ballot / cast_vote Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True only when both client-safe env vars are present. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Don't throw at import time — that would white-screen every route (including the
  // public voter ballot) before React can render a friendly message. main.tsx checks
  // `supabaseConfigured` and renders a config screen instead.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
  );
}

// Use harmless placeholders when unconfigured so createClient() doesn't throw; the app
// won't render App in that case anyway.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const FUNCTIONS_BASE = `${url ?? ""}/functions/v1`;
