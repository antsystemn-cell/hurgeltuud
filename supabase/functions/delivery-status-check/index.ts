import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// CANONICAL status vocabulary shared with every integration:
//   new, confirmed, assigned, picked_up, in_transit, delivered, cancelled, failed
function toStandardStatus(internal: string | null | undefined): string {
  switch (internal) {
    case "confirmed": return "confirmed";
    case "phone_confirmed": return "assigned";
    case "out_for_delivery": return "in_transit";
    case "delivered": return "delivered";
    case "cancelled": return "cancelled";
    default: return "new";
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate via x-api-key against an active source system.
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-OnlyHub-Webhook-Secret");
    if (!apiKey) {
      return json({ success: false, error: "Missing x-api-key header" }, 401);
    }

    const { data: sourceSystem, error: ssError } = await supabase
      .from("source_systems")
      .select("id, code, active")
      .or(`api_key.eq.${apiKey},webhook_secret.eq.${apiKey}`)
      .eq("active", true)
      .maybeSingle();

    if (ssError || !sourceSystem) {
      return json({ success: false, error: "Invalid or inactive API key" }, 401);
    }

    // Accept lookup params from query string (GET) or JSON body (POST).
    let external_order_id: string | null = null;
    let delivery_order_id: string | null = null;
    let tracking_code: string | null = null;

    const url = new URL(req.url);
    external_order_id = url.searchParams.get("external_order_id");
    delivery_order_id = url.searchParams.get("delivery_order_id");
    tracking_code = url.searchParams.get("tracking_code");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        external_order_id = external_order_id ?? body.external_order_id ?? null;
        delivery_order_id = delivery_order_id ?? body.delivery_order_id ?? null;
        tracking_code = tracking_code ?? body.tracking_code ?? null;
      } catch (_) { /* no body */ }
    }

    if (!external_order_id && !delivery_order_id && !tracking_code) {
      return json({
        success: false,
        error: "Provide one of external_order_id, delivery_order_id, or tracking_code",
      }, 400);
    }

    let query = supabase
      .from("orders")
      .select("id, external_order_id, internal_order_number, fulfillment_status, payment_status, assigned_driver_user_id, source_system_id, updated_at, delivered_at, cancelled_at")
      .eq("source_system_id", sourceSystem.id);

    if (delivery_order_id) query = query.eq("id", delivery_order_id);
    else if (external_order_id) query = query.eq("external_order_id", external_order_id);
    else if (tracking_code) query = query.eq("internal_order_number", tracking_code);

    const { data: order, error: orderError } = await query.maybeSingle();

    if (orderError) {
      return json({ success: false, error: orderError.message }, 500);
    }
    if (!order) {
      return json({ success: false, error: "Order not found" }, 404);
    }

    // Resolve assigned driver info (minimal PII: name + phone).
    let driver_name: string | null = null;
    let driver_phone: string | null = null;
    if (order.assigned_driver_user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", order.assigned_driver_user_id)
        .maybeSingle();
      driver_name = (prof?.full_name as string) ?? null;
      driver_phone = (prof?.phone as string) ?? null;
    }

    return json({
      success: true,
      delivery_order_id: order.id,
      external_order_id: order.external_order_id,
      tracking_code: order.internal_order_number,
      status: toStandardStatus(order.fulfillment_status),
      fulfillment_status: order.fulfillment_status,
      payment_status: order.payment_status,
      driver_id: order.assigned_driver_user_id,
      driver_name,
      driver_phone,
      updated_at: order.updated_at,
    });
  } catch (error) {
    console.error("Delivery status check error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
