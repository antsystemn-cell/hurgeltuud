import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map internal fulfillment_status to standardized cross-system status
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

async function markOrderSynced(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  success: boolean,
  errorMsg: string | null,
) {
  const patch: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    sync_error: success ? null : errorMsg,
  };
  if (success) {
    patch.sync_attempts = 0;
  }
  await supabase.from("orders").update(patch).eq("id", orderId);
  if (!success) {
    // increment via RPC-less approach: re-read then bump
    const { data } = await supabase.from("orders").select("sync_attempts").eq("id", orderId).single();
    const attempts = ((data?.sync_attempts as number) ?? 0) + 1;
    await supabase.from("orders").update({ sync_attempts: attempts }).eq("id", orderId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, event_type } = await req.json();
    if (!order_id || !event_type) {
      return new Response(JSON.stringify({ error: "Missing order_id or event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order with source system
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, source_systems(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceSystem = order.source_systems as {
      id: string;
      webhook_url: string | null;
      webhook_secret: string | null;
      api_key: string | null;
    } | null;

    // Determine webhook target
    const isShopOrder = order.external_order_id?.startsWith("SHOP-");
    const isEasyOrder = order.external_order_id?.startsWith("EASY-");
    const SHOP_WEBHOOK_URL = "https://oaqegsepcakxtspufyje.supabase.co/functions/v1/delivery-status-webhook";
    const EASY_WEBHOOK_URL = "https://jiqjebbxcwetakdhfuel.supabase.co/functions/v1/delivery-status-webhook";

    // If it's a SHOP- order, send to the shop webhook endpoint
    if (isShopOrder && sourceSystem?.api_key) {
      let shopSuccess = false;
      let shopStatus = 0;
      let shopBody = "";

      try {
        const res = await fetch(SHOP_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": sourceSystem.api_key,
          },
          body: JSON.stringify({
            external_order_id: order.external_order_id,
            fulfillment_status: order.fulfillment_status,
            payment_status: order.payment_status,
            note: order.delivery_note || undefined,
          }),
        });
        shopStatus = res.status;
        shopBody = await res.text();
        shopSuccess = res.ok;
      } catch (err) {
        shopBody = err instanceof Error ? err.message : "Fetch failed";
      }

      // Log the attempt
      await supabase.from("webhook_logs").insert({
        source_system_id: sourceSystem.id,
        order_id: order.id,
        event_type: "shop_status_sync",
        payload: {
          external_order_id: order.external_order_id,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
        },
        response_status: shopStatus,
        response_body: shopBody,
        success: shopSuccess,
        attempt_count: 1,
      });
    }

    // If it's an EASY- order, send to the Easyshop webhook endpoint
    if (isEasyOrder && sourceSystem?.api_key) {
      let easySuccess = false;
      let easyStatus = 0;
      let easyBody = "";

      try {
        const res = await fetch(EASY_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": sourceSystem.api_key,
          },
          body: JSON.stringify({
            external_order_id: order.external_order_id,
            fulfillment_status: order.fulfillment_status,
            payment_status: order.payment_status,
            note: order.delivery_note || undefined,
          }),
        });
        easyStatus = res.status;
        easyBody = await res.text();
        easySuccess = res.ok;
      } catch (err) {
        easyBody = err instanceof Error ? err.message : "Fetch failed";
      }

      await supabase.from("webhook_logs").insert({
        source_system_id: sourceSystem.id,
        order_id: order.id,
        event_type: "easy_status_sync",
        payload: {
          external_order_id: order.external_order_id,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
        },
        response_status: easyStatus,
        response_body: easyBody,
        success: easySuccess,
        attempt_count: 1,
      });
    }

    // Also send to source system's own webhook_url if configured
    if (sourceSystem?.webhook_url) {
      const payload = {
        event: event_type,
        order_id: order.id,
        external_order_id: order.external_order_id,
        fulfillment_status: order.fulfillment_status,
        payment_status: order.payment_status,
        timestamp: new Date().toISOString(),
      };

      let success = false;
      let responseStatus = 0;
      let responseBody = "";

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (sourceSystem.webhook_secret) {
          headers["X-Webhook-Secret"] = sourceSystem.webhook_secret;
        }

        const response = await fetch(sourceSystem.webhook_url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        responseStatus = response.status;
        responseBody = await response.text();
        success = response.ok;
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Fetch failed";
      }

      await supabase.from("webhook_logs").insert({
        source_system_id: sourceSystem.id,
        order_id: order.id,
        event_type,
        payload,
        response_status: responseStatus,
        response_body: responseBody,
        success,
        attempt_count: 1,
      });
    }

    if (!sourceSystem?.webhook_url && !isShopOrder && !isEasyOrder) {
      return new Response(JSON.stringify({ message: "No webhook configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
