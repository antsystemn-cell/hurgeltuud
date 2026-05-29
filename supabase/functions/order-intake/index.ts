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

    // Validate API key against source systems
    const { data: sourceSystem, error: ssError } = await supabase
      .from("source_systems")
      .select("*")
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

    // Validate required fields
    const required = ["external_order_id", "customer_name", "phone"];
    for (const field of required) {
      if (!body[field]) {
        return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Idempotency check
    const { data: existing } = await supabase
      .from("orders")
      .select("id, internal_order_number")
      .eq("source_system_id", sourceSystem.id)
      .eq("external_order_id", body.external_order_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        ok: true,
        message: "Order already exists",
        order_id: existing.id,
        internal_order_number: existing.internal_order_number,
        tracking_code: existing.internal_order_number,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        internal_order_number: "",
        source_system_id: sourceSystem.id,
        external_order_id: body.external_order_id,
        source_channel: body.source_channel || sourceSystem.code,
        // Sub-classification: which shop/merchant inside the source marketplace (e.g. Only Hub)
        merchant_name: body.merchant_name || body.shop_name || null,
        merchant_code: body.merchant_code || body.shop_code || body.shop_id || null,
        idempotency_key: body.idempotency_key || null,
        customer_name: body.customer_name,
        phone: body.phone,
        alternate_phone: body.alternate_phone || null,
        district: body.district || null,
        address_text: body.address_text || null,
        delivery_note: body.delivery_note || null,
        payment_method: body.payment_method || null,
        payment_status: body.payment_status || "unpaid",
        fulfillment_status: "confirmed",
        delivery_fee: body.delivery_fee || 0,
        subtotal: body.subtotal || 0,
        total_amount: body.total_amount || 0,
        customer_note: body.customer_note || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order", details: orderError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order items
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items.map((item: Record<string, unknown>) => ({
        order_id: order.id,
        product_name_snapshot: item.product_name || item.name || "Unknown",
        sku_snapshot: item.sku || null,
        variant_snapshot: item.variant || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.price || 0,
        line_total: ((item.quantity as number) || 1) * ((item.unit_price as number) || (item.price as number) || 0),
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) {
        console.error("Items creation error:", itemsError);
      }
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      action: "order_created_via_api",
      entity_type: "order",
      entity_id: order.id,
      details: {
        source_system: sourceSystem.code,
        external_order_id: body.external_order_id,
        merchant_name: order.merchant_name,
        merchant_code: order.merchant_code,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      success: true,
      order_id: order.id,
      internal_order_number: order.internal_order_number,
      tracking_code: order.internal_order_number,
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
