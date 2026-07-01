// get_ballot — public, token-gated. Returns ballot data with short-TTL signed Storage
// URLs minted server-side with the service role. Never returns the tally or any other
// voter's data. The variant order comes straight from the DB (token-deterministic).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SIGNED_URL_TTL_SECONDS = 1800; // 30 minutes — comfortable viewing window, then expires.

type Variant = { id: string; label: string; image_path: string | null; caption: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let token: string | undefined;
  try {
    ({ token } = await req.json());
  } catch {
    return json({ state: "invalid" });
  }
  if (!token || typeof token !== "string") return json({ state: "invalid" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin.rpc("app_ballot_data", { p_token: token });
  if (error) {
    console.error("app_ballot_data error", error);
    return json({ error: "server_error" }, 500);
  }
  if (!data || (data as { error?: string }).error === "invalid_token") {
    return json({ state: "invalid" });
  }

  const ballot = data as {
    test: Record<string, unknown>;
    variants: Variant[];
    already_voted: boolean;
    is_open: boolean;
  };

  // State precedence: already-voted > closed > open.
  let state: "open" | "already_voted" | "closed" = "open";
  if (ballot.already_voted) state = "already_voted";
  else if (!ballot.is_open) state = "closed";

  // Only mint signed URLs for an open ballot the voter will actually see.
  let variants: Array<Omit<Variant, "image_path"> & { url: string | null }> = ballot.variants.map(
    (v) => ({ id: v.id, label: v.label, caption: v.caption, url: null }),
  );

  if (state === "open") {
    variants = await Promise.all(
      ballot.variants.map(async (v) => {
        let url: string | null = null;
        if (v.image_path) {
          const { data: signed } = await admin.storage
            .from("designs")
            .createSignedUrl(v.image_path, SIGNED_URL_TTL_SECONDS);
          url = signed?.signedUrl ?? null;
        }
        return { id: v.id, label: v.label, caption: v.caption, url };
      }),
    );
  }

  return json({ state, test: ballot.test, variants });
});
