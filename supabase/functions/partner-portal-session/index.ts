import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Server-to-server endpoint.
// The partner's backend calls this with its x-api-key while a trusted admin is
// logged in to the partner's own admin panel. It returns a short-lived token +
// portal URL. The partner then embeds the portal URL (iframe / new tab) so the
// admin can manage ONLY that partner's deliveries without logging in here.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sourceSystem, error: ssError } = await supabase
      .from("source_systems")
      .select("id, name, code, active")
      .eq("api_key", apiKey)
      .eq("active", true)
      .single();

    if (ssError || !sourceSystem) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional merchant scope: when the partner's admin panel opens the portal
    // for ONE specific shop/merchant, it passes merchant_code (and optionally
    // merchant_name). The resulting session can then ONLY see/manage that
    // merchant's deliveries. When omitted, the session covers the whole source
    // system (platform-wide admin view).
    const reqBody = await req.json().catch(() => ({}));
    const merchantCode = (reqBody?.merchant_code ?? null) as string | null;
    const merchantName = (reqBody?.merchant_name ?? null) as string | null;

    // Generate a cryptographically random session token (valid 12h).
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("partner_sessions").insert({
      token,
      source_system_id: sourceSystem.id,
      merchant_code: merchantCode,
      merchant_name: merchantName,
      expires_at: expiresAt,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to create session", details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const portalBase = Deno.env.get("PARTNER_PORTAL_BASE_URL") || "https://hurgelt.only.mn";

    return new Response(JSON.stringify({
      ok: true,
      token,
      expires_at: expiresAt,
      portal_url: `${portalBase}/portal?token=${token}`,
      source_system: { name: sourceSystem.name, code: sourceSystem.code },
      merchant: merchantCode ? { code: merchantCode, name: merchantName } : null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("partner-portal-session error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
