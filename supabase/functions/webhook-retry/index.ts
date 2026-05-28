import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 5;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find failed webhook logs that haven't exceeded max retries
    const { data: failedLogs, error: logsError } = await supabase
      .from("webhook_logs")
      .select("*, orders(*, source_systems(*))")
      .eq("success", false)
      .lt("attempt_count", MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(20);

    if (logsError) throw logsError;

    if (!failedLogs?.length) {
      return new Response(JSON.stringify({ message: "No failed webhooks to retry", retried: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SHOP_WEBHOOK_URL = "https://oaqegsepcakxtspufyje.supabase.co/functions/v1/delivery-status-webhook";
    const EASY_WEBHOOK_URL = "https://jiqjebbxcwetakdhfuel.supabase.co/functions/v1/delivery-status-webhook";
    let retriedCount = 0;
    let successCount = 0;

    for (const log of failedLogs) {
      const order = log.orders as any;
      if (!order) continue;

      const sourceSystem = order.source_systems as any;
      const isShopOrder = order.external_order_id?.startsWith("SHOP-");
      const isEasyOrder = order.external_order_id?.startsWith("EASY-");

      let targetUrl: string | null = null;
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let payload: Record<string, unknown> = {};

      if ((log.event_type === "shop_status_sync" && isShopOrder && sourceSystem?.api_key) ||
          (log.event_type === "easy_status_sync" && isEasyOrder && sourceSystem?.api_key)) {
        targetUrl = isEasyOrder ? EASY_WEBHOOK_URL : SHOP_WEBHOOK_URL;
        headers["x-api-key"] = sourceSystem.api_key;
        payload = {
          external_order_id: order.external_order_id,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
          note: order.delivery_note || undefined,
        };
      } else if (sourceSystem?.webhook_url) {
        targetUrl = sourceSystem.webhook_url;
        if (sourceSystem.webhook_secret) {
          headers["X-Webhook-Secret"] = sourceSystem.webhook_secret;
        }
        payload = {
          event: log.event_type,
          order_id: order.id,
          external_order_id: order.external_order_id,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
          timestamp: new Date().toISOString(),
        };
      }

      if (!targetUrl) continue;

      let success = false;
      let responseStatus = 0;
      let responseBody = "";

      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        responseStatus = res.status;
        responseBody = await res.text();
        success = res.ok;
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Fetch failed";
      }

      // Update the log entry
      await supabase
        .from("webhook_logs")
        .update({
          attempt_count: (log.attempt_count || 1) + 1,
          success,
          response_status: responseStatus,
          response_body: responseBody,
          next_retry_at: success ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", log.id);

      retriedCount++;
      if (success) successCount++;
    }

    return new Response(JSON.stringify({
      success: true,
      retried: retriedCount,
      succeeded: successCount,
      failed: retriedCount - successCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook retry error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
