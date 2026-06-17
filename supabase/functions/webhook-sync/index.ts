import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CANONICAL status vocabulary shared by every integration:
//   new, confirmed, assigned, picked_up, in_transit, delivered, cancelled, failed
// Single source of truth — used for both the standardized field and the
// Only Hub fulfillment_status so the same internal status never maps two ways.
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

// Only Hub status vocabulary. Only Hub keys SMS / QPay off these exact values:
//   confirmed, assigned, out_for_delivery, delivered, cancelled
// IMPORTANT: out_for_delivery must NOT be sent as "in_transit" — Only Hub does
// not recognize that value, so the "хүргэлтэнд гарсан" SMS would never fire.
function toOmhStatus(internal: string | null | undefined): string {
  switch (internal) {
    case "confirmed": return "confirmed";
    case "phone_confirmed": return "assigned";
    case "out_for_delivery": return "out_for_delivery";
    case "delivered": return "delivered";
    case "cancelled": return "cancelled";
    default: return "new";
  }
}

// Deterministic event id => identical status changes dedupe to the same id,
// so duplicate syncs and retries are idempotent on both sides.
function buildEventId(order: { id: string; fulfillment_status: string | null; payment_status: string | null }): string {
  return `${order.id}:${order.fulfillment_status ?? "?"}:${order.payment_status ?? "?"}`;
}

async function markOrderSynced(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  success: boolean,
  errorMsg: string | null,
) {
  if (success) {
    await supabase.from("orders").update({
      last_sync_at: new Date().toISOString(),
      sync_error: null,
      last_api_error: null,
      sync_attempts: 0,
      retry_count: 0,
    }).eq("id", orderId);
    return;
  }
  // Failure: bump counters atomically-ish (re-read then write)
  const { data } = await supabase
    .from("orders")
    .select("sync_attempts, retry_count")
    .eq("id", orderId)
    .single();
  await supabase.from("orders").update({
    last_sync_at: new Date().toISOString(),
    sync_error: errorMsg,
    last_api_error: errorMsg,
    sync_attempts: ((data?.sync_attempts as number) ?? 0) + 1,
    retry_count: ((data?.retry_count as number) ?? 0) + 1,
  }).eq("id", orderId);
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
    const isOmhOrder = order.external_order_id?.startsWith("OMH-");
    const SHOP_WEBHOOK_URL = "https://oaqegsepcakxtspufyje.supabase.co/functions/v1/delivery-status-webhook";
    const EASY_WEBHOOK_URL = "https://jiqjebbxcwetakdhfuel.supabase.co/functions/v1/delivery-status-webhook";

    const standardStatus = toStandardStatus(order.fulfillment_status);
    let anyAttempt = false;
    let anySuccess = false;
    let lastError: string | null = null;

    // === Only Hub (only_merchants_hub) outbound webhook ===
    // Only OMH- prefixed orders are sent to Only Hub.
    // Both the production (only.mn) and the stable Lovable endpoint are tried,
    // so a status update succeeds as long as either host is reachable.
    const ONLY_HUB_URLS = [
      "https://only.mn/api/public/delivery/webhook",
      "https://only-hub.lovable.app/api/public/delivery/webhook",
    ];
    // Build the target list: a DB-configured webhook_url (if any) takes priority,
    // then the two known defaults (deduped). An env override is honored too.
    const onlyHubUrls = Array.from(
      new Set(
        [
          sourceSystem?.webhook_url || null,
          Deno.env.get("ONLY_HUB_WEBHOOK_URL") || null,
          ...ONLY_HUB_URLS,
        ].filter((u): u is string => !!u),
      ),
    );
    // Platform-wide API key (preferred) sent as x-api-key. Falls back to the
    // per-merchant secret stored on the source system if the key isn't set.
    const onlyHubKey =
      Deno.env.get("SWIFT_DELIVERY_API_KEY") || sourceSystem?.webhook_secret || null;

    if (isOmhOrder && onlyHubUrls.length > 0) {
      anyAttempt = true;

      // Resolve driver info (minimal PII: id, name, phone)
      let driver: { id: string; name: string | null; phone: string | null } | null = null;
      if (order.assigned_driver_user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .eq("user_id", order.assigned_driver_user_id)
          .maybeSingle();
        driver = {
          id: order.assigned_driver_user_id as string,
          name: (prof?.full_name as string) ?? null,
          phone: (prof?.phone as string) ?? null,
        };
      }

      const omhStatus = toOmhStatus(order.fulfillment_status);
      const eventId = buildEventId(order);

      // Idempotency: if this exact status change was already delivered to
      // Only Hub, don't send it again (prevents duplicate processing & loops).
      const { data: priorLog } = await supabase
        .from("webhook_logs")
        .select("id, success")
        .eq("event_id", eventId)
        .eq("success", true)
        .maybeSingle();

      if (priorLog) {
        anySuccess = true; // already synced — treat as success
      } else {
        const nowIso = new Date().toISOString();
        const payload: Record<string, unknown> = {
          // Only Hub keys off fulfillment_status (delivered/completed) to run
          // SMS / QPay / payment collection. Delivery Hub stays logistics-only.
          event: "order.status_changed",
          event_id: eventId,
          // OMH-<orderId> is Only Hub's primary lookup key.
          external_order_id: order.external_order_id,
          delivery_order_id: order.id,
          tracking_code: order.internal_order_number,
          internal_order_number: order.internal_order_number,
          fulfillment_status: omhStatus,
          status: omhStatus,
          payment_status: order.payment_status,
          // Flat driver fields (Only Hub merchant admin display) + nested for back-compat.
          driver_id: driver?.id ?? null,
          driver_name: driver?.name ?? null,
          driver_phone: driver?.phone ?? null,
          driver,
          updated_at: nowIso,
          timestamp: nowIso,
          note: order.delivery_note || null,
        };
        // payment_collected_in_cash is a logistics flag reported on delivered;
        // Only Hub remains the payment authority.
        if (omhStatus === "delivered") {
          payload.payment_collected_in_cash = order.payment_collected_in_cash === true;
        }

        // Try each Only Hub endpoint (only.mn, then Lovable) until one accepts.
        let omhSuccess = false;
        let omhStatusCode = 0;
        let omhBody = "";
        const attempts: string[] = [];
        for (const url of onlyHubUrls) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Platform-wide key + legacy per-merchant header; Only Hub validates either.
                ...(onlyHubKey
                  ? { "x-api-key": onlyHubKey, "x-webhook-secret": onlyHubKey, "X-OnlyHub-Webhook-Secret": onlyHubKey }
                  : {}),
              },
              body: JSON.stringify(payload),
            });
            omhStatusCode = res.status;
            omhBody = await res.text();
            omhSuccess = res.ok;
          } catch (err) {
            omhStatusCode = 0;
            omhBody = err instanceof Error ? err.message : "Fetch failed";
            omhSuccess = false;
          }
          attempts.push(`${url} -> ${omhStatusCode}`);
          if (omhSuccess) break; // first success wins
        }

        if (omhSuccess) anySuccess = true;
        else lastError = `omh: ${omhStatusCode} ${omhBody} [${attempts.join(" | ")}]`;

        // Upsert on event_id so a duplicate concurrent sync can't double-log.
        await supabase.from("webhook_logs").upsert({
          source_system_id: sourceSystem?.id ?? null,
          order_id: order.id,
          event_type: "omh_status_sync",
          event_id: eventId,
          payload,
          response_status: omhStatusCode,
          response_body: `${omhBody} [tried: ${attempts.join(" | ")}]`,
          success: omhSuccess,
          attempt_count: 1,
          next_retry_at: omhSuccess ? null : new Date(Date.now() + 60 * 1000).toISOString(),
        }, { onConflict: "event_id", ignoreDuplicates: false });
      }
    }


    // If it's a SHOP- order, send to the shop webhook endpoint.
    // Prefer webhook_secret/webhook_url for outbound sync; api_key is primarily inbound.
    const shopOutboundKey = sourceSystem?.webhook_secret || sourceSystem?.api_key || null;
    const easyOutboundKey = sourceSystem?.webhook_secret || sourceSystem?.api_key || null;
    const shopWebhookUrl = sourceSystem?.webhook_url || SHOP_WEBHOOK_URL;
    const easyWebhookUrl = sourceSystem?.webhook_url || EASY_WEBHOOK_URL;

    if (isShopOrder && shopOutboundKey) {
      anyAttempt = true;
      let shopSuccess = false;
      let shopStatus = 0;
      let shopBody = "";

      const payload = {
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

      try {
        const res = await fetch(shopWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": shopOutboundKey,
            "Authorization": `Bearer ${shopOutboundKey}`,
          },
          body: JSON.stringify(payload),
        });
        shopStatus = res.status;
        shopBody = await res.text();
        shopSuccess = res.ok;
      } catch (err) {
        shopBody = err instanceof Error ? err.message : "Fetch failed";
      }

      if (shopSuccess) anySuccess = true;
      else lastError = `shop: ${shopStatus} ${shopBody}`;

      await supabase.from("webhook_logs").insert({
        source_system_id: sourceSystem.id,
        order_id: order.id,
        event_type: "shop_status_sync",
        payload,
        response_status: shopStatus,
        response_body: shopBody,
        success: shopSuccess,
        attempt_count: 1,
      });
    }

    // If it's an EASY- order, send to the Easyshop webhook endpoint
    if (isEasyOrder && easyOutboundKey) {
      anyAttempt = true;
      let easySuccess = false;
      let easyStatus = 0;
      let easyBody = "";

      const payload = {
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

      try {
        const res = await fetch(easyWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": easyOutboundKey,
            "Authorization": `Bearer ${easyOutboundKey}`,
          },
          body: JSON.stringify(payload),
        });
        easyStatus = res.status;
        easyBody = await res.text();
        easySuccess = res.ok;
      } catch (err) {
        easyBody = err instanceof Error ? err.message : "Fetch failed";
      }

      if (easySuccess) anySuccess = true;
      else lastError = `easy: ${easyStatus} ${easyBody}`;

      await supabase.from("webhook_logs").insert({
        source_system_id: sourceSystem.id,
        order_id: order.id,
        event_type: "easy_status_sync",
        payload,
        response_status: easyStatus,
        response_body: easyBody,
        success: easySuccess,
        attempt_count: 1,
      });
    }

    // Also send to source system's own webhook_url if configured.
    // OMH orders are already handled by the dedicated Only Hub branch above.
    if (sourceSystem?.webhook_url && !isOmhOrder && !isShopOrder && !isEasyOrder) {
      anyAttempt = true;
      const payload = {
        event: event_type,
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

      if (success) anySuccess = true;
      else lastError = `webhook: ${responseStatus} ${responseBody}`;

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

    if (anyAttempt) {
      await markOrderSynced(supabase, order.id, anySuccess, lastError);
    }


    if (!anyAttempt) {
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
