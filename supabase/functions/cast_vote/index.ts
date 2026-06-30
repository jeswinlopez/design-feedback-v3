// cast_vote — public, token-gated. Thin wrapper over the SECURITY DEFINER app_cast_vote
// RPC, which does all validation atomically and derives the shown order from the token
// itself (the client-reported order is never trusted). Returns success or a typed error.
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

type Body = {
  token?: string;
  variant_id?: string | null;
  no_preference?: boolean;
  rationale?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ status: "error", code: "method_not_allowed" }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ status: "error", code: "invalid_token" }, 400);
  }

  const { token, variant_id = null, no_preference = false, rationale = null } = body;
  if (!token || typeof token !== "string") {
    return json({ status: "error", code: "invalid_token" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin.rpc("app_cast_vote", {
    p_token: token,
    p_variant_id: variant_id,
    p_no_preference: !!no_preference,
    p_rationale: rationale,
  });

  if (error) {
    console.error("app_cast_vote error", error);
    return json({ status: "error", code: "server_error" }, 500);
  }

  const result = data as { status: string; code?: string };
  return json(result, result.status === "ok" ? 200 : 409);
});
