import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// CANONICAL cross-system status vocabulary accepted from partners:
//   new, confirmed, assigned, picked_up, in_transit, delivered, cancelled, failed
// Mapped to the internal fulfillment_status enum. Internal values are also
// accepted for backwards compatibility.
const CANONICAL_TO_INTERNAL: Record<string, string> = {
  new: "confirmed",
  confirmed: "confirmed",
  assigned: "phone_confirmed",
  picked_up: "out_for_delivery",
  in_transit: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
  failed: "cancelled",
  // internal pass-through
  phone_confirmed: "phone_confirmed",
  out_for_delivery: "out_for_delivery",
};

const VALID_PAYMENT = ["unpaid", "cash_on_delivery", "paid", "refunded"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate via x-api-key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const body = await req.json();
    const { external_order_id, payment_status, note } = body;
    const event_id: string | undefined = body.event_id;
    const rawFulfillment: string | undefined = body.fulfillment_status ?? body.status;

    if (!external_order_id) {
      return new Response(JSON.stringify({ error: "Missing external_order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only Hub orders must use the OMH- prefix
    if (sourceSystem.code === "only_merchants_hub" && !external_order_id.startsWith("OMH-")) {
      return new Response(JSON.stringify({ error: "external_order_id must start with OMH- for only_merchants_hub" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if this event_id was already processed, return early.
    if (event_id) {
      const { data: prior } = await supabase
        .from("webhook_logs")
        .select("id")
        .eq("event_id", event_id)
        .maybeSingle();
      if (prior) {
        return new Response(JSON.stringify({ success: true, deduped: true, event_id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Normalize fulfillment_status through the canonical map
    let fulfillment_status: string | undefined;
    if (rawFulfillment) {
      fulfillment_status = CANONICAL_TO_INTERNAL[rawFulfillment];
      if (!fulfillment_status) {
        return new Response(JSON.stringify({
          error: `Invalid status "${rawFulfillment}". Valid: ${Object.keys(CANONICAL_TO_INTERNAL).join(", ")}`,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (payment_status && !VALID_PAYMENT.includes(payment_status)) {
      return new Response(JSON.stringify({ error: `Invalid payment_status. Valid: ${VALID_PAYMENT.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment_status && !fulfillment_status) {
      return new Response(JSON.stringify({ error: "Must provide payment_status or fulfillment_status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, fulfillment_status, payment_status, external_order_id, assigned_driver_user_id, internal_order_number")
      .eq("external_order_id", external_order_id)
      .eq("source_system_id", sourceSystem.id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found", external_order_id }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: never reopen a terminal order via inbound sync (idempotent + loop safe)
    const isTerminal = order.fulfillment_status === "delivered" || order.fulfillment_status === "cancelled";

    // Build update payload - only update fields that changed
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { old: string; new: string }> = {};

    if (fulfillment_status && fulfillment_status !== order.fulfillment_status && !isTerminal) {
      updates.fulfillment_status = fulfillment_status;
      changes.fulfillment_status = { old: order.fulfillment_status, new: fulfillment_status };

      if (fulfillment_status === "phone_confirmed") updates.phone_confirmed_at = new Date().toISOString();
      if (fulfillment_status === "out_for_delivery") updates.out_for_delivery_at = new Date().toISOString();
      if (fulfillment_status === "delivered") updates.delivered_at = new Date().toISOString();
      if (fulfillment_status === "cancelled") updates.cancelled_at = new Date().toISOString();
    }

    if (payment_status && payment_status !== order.payment_status) {
      updates.payment_status = payment_status;
      changes.payment_status = { old: order.payment_status, new: payment_status };
    }

    if (note) {
      updates.delivery_note = note;
    }

    // Record the inbound event for idempotency + audit (even no-ops)
    const logEventId = event_id ?? `inbound:${order.id}:${fulfillment_status ?? "_"}:${payment_status ?? "_"}:${Date.now()}`;
    await supabase.from("webhook_logs").upsert({
      source_system_id: sourceSystem.id,
      order_id: order.id,
      event_type: "inbound_status_update",
      event_id: logEventId,
      payload: body,
      success: true,
      attempt_count: 1,
    }, { onConflict: "event_id", ignoreDuplicates: true });

    if (Object.keys(changes).length === 0 && !note) {
      return new Response(JSON.stringify({
        success: true,
        message: isTerminal ? "Order is terminal, ignored" : "No changes needed",
        order_id: order.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply update
    const { error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", order.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update order", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the inbound sync
    await supabase.from("audit_logs").insert({
      action: "inbound_status_sync",
      entity_type: "order",
      entity_id: order.id,
      details: { source_system: sourceSystem.code, external_order_id, changes },
    });

    // Notify the assigned driver when the order is cancelled from the merchant side
    if (changes.fulfillment_status?.new === "cancelled" && order.assigned_driver_user_id) {
      await supabase.from("audit_logs").insert({
        user_id: order.assigned_driver_user_id,
        action: "driver_notified_cancel",
        entity_type: "order",
        entity_id: order.id,
        details: {
          source_system: sourceSystem.code,
          internal_order_number: order.internal_order_number,
          message: "Захиалга мерчантаас цуцлагдсан",
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      updated: changes,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Inbound status update error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
