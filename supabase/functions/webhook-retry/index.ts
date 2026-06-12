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

// Exponential backoff schedule (minutes) with jitter: 1, 5, 30, 120, 360
const BACKOFF_MINUTES = [1, 5, 30, 120, 360];
function nextRetryAt(nextAttemptCount: number): string {
  const idx = Math.min(nextAttemptCount - 1, BACKOFF_MINUTES.length - 1);
  const baseMs = BACKOFF_MINUTES[Math.max(0, idx)] * 60 * 1000;
  const jitterMs = Math.floor(Math.random() * 30 * 1000); // up to 30s jitter
  return new Date(Date.now() + baseMs + jitterMs).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional single-order manual retry: { order_id }
    let manualOrderId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        manualOrderId = body?.order_id ?? null;
      } catch (_) { /* no body = batch cron run */ }
    }

    // Find failed webhook logs that haven't exceeded max retries.
    // Manual retries bypass the attempt cap for the requested order.
    let query = supabase
      .from("webhook_logs")
      .select("*, orders(*, source_systems(*))")
      .eq("success", false)
      .order("created_at", { ascending: true })
      .limit(manualOrderId ? 50 : 20);
    if (manualOrderId) {
      query = query.eq("order_id", manualOrderId);
    } else {
      query = query.lt("attempt_count", MAX_RETRIES);
    }
    const { data: failedLogs, error: logsError } = await query;

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
      const isOmhOrder = order.external_order_id?.startsWith("OMH-");

      let targetUrl: string | null = null;
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let payload: Record<string, unknown> = {};

      const standardStatus = toStandardStatus(order.fulfillment_status);

      if (log.event_type === "omh_status_sync" && isOmhOrder) {
        // Resend the exact stored payload so event_id stays stable (idempotency on Only Hub side)
        const onlyHubUrl = sourceSystem?.webhook_url || Deno.env.get("ONLY_HUB_WEBHOOK_URL") || null;
        const onlyHubKey = sourceSystem?.webhook_secret || Deno.env.get("ONLY_HUB_WEBHOOK_KEY") || null;
        targetUrl = onlyHubUrl;
        if (onlyHubKey) headers["x-api-key"] = onlyHubKey;
        payload = (log.payload as Record<string, unknown>) ?? {};
      } else if ((log.event_type === "shop_status_sync" && isShopOrder && sourceSystem?.api_key) ||
          (log.event_type === "easy_status_sync" && isEasyOrder && sourceSystem?.api_key)) {
        targetUrl = isEasyOrder ? EASY_WEBHOOK_URL : SHOP_WEBHOOK_URL;
        headers["x-api-key"] = sourceSystem.api_key;
        headers["Authorization"] = `Bearer ${sourceSystem.api_key}`;
        payload = {
          external_order_id: order.external_order_id,
          delivery_order_id: order.id,
          tracking_code: order.internal_order_number,
          status: standardStatus,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
          district: order.district || undefined,
          address_text: order.address_text || undefined,
          note: order.delivery_note || undefined,
          updated_at: new Date().toISOString(),
        };
      } else if (sourceSystem?.webhook_url && !isOmhOrder) {
        targetUrl = sourceSystem.webhook_url;
        if (sourceSystem.webhook_secret) {
          headers["X-Webhook-Secret"] = sourceSystem.webhook_secret;
        }
        payload = {
          event: log.event_type,
          order_id: order.id,
          external_order_id: order.external_order_id,
          delivery_order_id: order.id,
          tracking_code: order.internal_order_number,
          status: standardStatus,
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
          district: order.district || undefined,
          address_text: order.address_text || undefined,
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
      const newAttemptCount = (log.attempt_count || 1) + 1;
      await supabase
        .from("webhook_logs")
        .update({
          attempt_count: newAttemptCount,
          success,
          response_status: responseStatus,
          response_body: responseBody,
          next_retry_at: success || newAttemptCount >= MAX_RETRIES ? null : nextRetryAt(newAttemptCount),
        })
        .eq("id", log.id);

      // Update sync tracking on order
      await supabase
        .from("orders")
        .update({
          last_sync_at: new Date().toISOString(),
          sync_error: success ? null : responseBody,
          last_api_error: success ? null : responseBody,
          ...(success
            ? { sync_attempts: 0, retry_count: 0 }
            : { retry_count: newAttemptCount }),
          ...(manualOrderId ? { manual_retry_at: new Date().toISOString() } : {}),
        })
        .eq("id", order.id);

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
