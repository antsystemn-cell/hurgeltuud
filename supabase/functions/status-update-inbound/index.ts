import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

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
    const { external_order_id, payment_status, fulfillment_status, note } = body;

    if (!external_order_id) {
      return new Response(JSON.stringify({ error: "Missing external_order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate statuses
    const validFulfillment = ["confirmed", "phone_confirmed", "out_for_delivery", "delivered", "cancelled"];
    const validPayment = ["unpaid", "cash_on_delivery", "paid", "refunded"];

    if (fulfillment_status && !validFulfillment.includes(fulfillment_status)) {
      return new Response(JSON.stringify({ error: `Invalid fulfillment_status. Valid: ${validFulfillment.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment_status && !validPayment.includes(payment_status)) {
      return new Response(JSON.stringify({ error: `Invalid payment_status. Valid: ${validPayment.join(", ")}` }), {
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
      .select("id, fulfillment_status, payment_status, external_order_id")
      .eq("external_order_id", external_order_id)
      .eq("source_system_id", sourceSystem.id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found", external_order_id }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update payload - only update fields that changed
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { old: string; new: string }> = {};

    if (fulfillment_status && fulfillment_status !== order.fulfillment_status) {
      updates.fulfillment_status = fulfillment_status;
      changes.fulfillment_status = { old: order.fulfillment_status, new: fulfillment_status };

      // Set timestamps
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

    if (Object.keys(changes).length === 0 && !note) {
      return new Response(JSON.stringify({
        success: true,
        message: "No changes needed, statuses already match",
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
      details: {
        source_system: sourceSystem.code,
        external_order_id,
        changes,
      },
    });

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
