import { createClient } from "@supabase/supabase-js";

// Client-side Supabase: ANON / publishable key only. The service role key must NEVER
// be bundled into the frontend (§13.3). Admin data access is protected by RLS; the
// voter path goes exclusively through the get_ballot / cast_vote Edge Functions.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in dev rather than producing confusing network errors later.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const FUNCTIONS_BASE = `${url}/functions/v1`;
