import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const VALID_FULFILLMENT = ["confirmed", "phone_confirmed", "out_for_delivery", "delivered", "cancelled"];
const VALID_PAYMENT = ["unpaid", "cash_on_delivery", "paid", "refunded"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Browser-facing endpoint used by the embedded /portal page.
// Every request carries a partner session token. ALL reads & writes are scoped
// to the source_system bound to that token, so a partner can only see and manage
// the deliveries it submitted.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { token, action } = body as { token?: string; action?: string };

    if (!token) return json({ error: "Missing token" }, 401);
    if (!action) return json({ error: "Missing action" }, 400);

    // Validate session
    const { data: session } = await supabase
      .from("partner_sessions")
      .select("id, source_system_id, merchant_code, merchant_name, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
      return json({ error: "Invalid or expired session" }, 401);
    }
    const sourceId = session.source_system_id as string;
    // Optional merchant scope. When set, the session can only see/manage this
    // one merchant's deliveries inside the source system.
    const merchantCode = (session.merchant_code ?? null) as string | null;

    // Best-effort: mark session usage (non-blocking)
    supabase.from("partner_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

    // Helper to confirm an order belongs to this partner (and merchant) before mutating it.
    const orderBelongs = async (orderId: string) => {
      let q = supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("source_system_id", sourceId);
      if (merchantCode) q = q.eq("merchant_code", merchantCode);
      const { data } = await q.maybeSingle();
      return !!data;
    };

    switch (action) {
      case "session_info": {
        const { data: ss } = await supabase
          .from("source_systems")
          .select("name, code")
          .eq("id", sourceId)
          .maybeSingle();
        return json({
          ok: true,
          source_system: ss,
          merchant: merchantCode ? { code: merchantCode, name: session.merchant_name } : null,
          expires_at: session.expires_at,
        });
      }

      case "list_orders": {
        const { status, search } = body as { status?: string; search?: string };
        let q = supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("source_system_id", sourceId)
          .order("created_at", { ascending: false });

        if (merchantCode) q = q.eq("merchant_code", merchantCode);
        if (status && VALID_FULFILLMENT.includes(status)) {
          q = q.eq("fulfillment_status", status);
        }
        if (search) {
          q = q.or(
            `customer_name.ilike.%${search}%,phone.ilike.%${search}%,internal_order_number.ilike.%${search}%,merchant_name.ilike.%${search}%,district.ilike.%${search}%,address_text.ilike.%${search}%`
          );
        }
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, orders: data });
      }

      case "list_drivers": {
        const { data, error } = await supabase.rpc("get_drivers_safe");
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, drivers: data });
      }

      case "assign_driver": {
        const { order_id, driver_id } = body as { order_id?: string; driver_id?: string | null };
        if (!order_id) return json({ error: "Missing order_id" }, 400);
        if (!(await orderBelongs(order_id))) return json({ error: "Order not found" }, 404);
        const { error } = await supabase
          .from("orders")
          .update({ assigned_driver_user_id: driver_id || null })
          .eq("id", order_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "update_fulfillment": {
        const { order_id, status } = body as { order_id?: string; status?: string };
        if (!order_id || !status) return json({ error: "Missing order_id or status" }, 400);
        if (!VALID_FULFILLMENT.includes(status)) return json({ error: "Invalid status" }, 400);
        if (!(await orderBelongs(order_id))) return json({ error: "Order not found" }, 404);

        const updates: Record<string, unknown> = { fulfillment_status: status };
        if (status === "phone_confirmed") updates.phone_confirmed_at = new Date().toISOString();
        if (status === "out_for_delivery") updates.out_for_delivery_at = new Date().toISOString();
        if (status === "delivered") updates.delivered_at = new Date().toISOString();
        if (status === "cancelled") updates.cancelled_at = new Date().toISOString();

        const { error } = await supabase.from("orders").update(updates).eq("id", order_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "update_payment": {
        const { order_id, status } = body as { order_id?: string; status?: string };
        if (!order_id || !status) return json({ error: "Missing order_id or status" }, 400);
        if (!VALID_PAYMENT.includes(status)) return json({ error: "Invalid status" }, 400);
        if (!(await orderBelongs(order_id))) return json({ error: "Order not found" }, 404);
        const { error } = await supabase.from("orders").update({ payment_status: status }).eq("id", order_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "update_address": {
        const { order_id, district, address_text } = body as {
          order_id?: string; district?: string; address_text?: string;
        };
        if (!order_id) return json({ error: "Missing order_id" }, 400);
        if (!(await orderBelongs(order_id))) return json({ error: "Order not found" }, 404);
        const { error } = await supabase
          .from("orders")
          .update({ district: district ?? null, address_text: address_text ?? null })
          .eq("id", order_id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("partner-portal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
