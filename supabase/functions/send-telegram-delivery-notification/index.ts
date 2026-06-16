import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Show "-" instead of null/undefined/empty values inside the message.
function show(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const s = String(value).trim();
  return s.length ? s : "-";
}

function formatFee(value: unknown): string {
  const n = Number(value);
  if (!value || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}

// Escape user-controlled text for Telegram HTML parse_mode.
function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    // Verify caller is a signed-in staff member (admin or operator).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: isAdmin }, { data: isOperator }] = await Promise.all([
      admin.rpc("has_role", { _user_id: caller.id, _role: "main_admin" }),
      admin.rpc("has_role", { _user_id: caller.id, _role: "operator" }),
    ]);
    if (!isAdmin && !isOperator) return jsonResponse({ error: "Forbidden: staff only" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    const force = body?.force === true;
    if (!orderId || typeof orderId !== "string") {
      return jsonResponse({ error: "orderId is required" }, 400);
    }

    // Fetch the order + line items.
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("*, order_items(product_name_snapshot, quantity)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) return jsonResponse({ error: orderErr.message }, 400);
    if (!order) return jsonResponse({ error: "Order not found" }, 404);

    const driverId = order.assigned_driver_user_id as string | null;
    if (!driverId) {
      return jsonResponse({ success: true, sent: false, skipped: "No driver assigned" });
    }

    // Fetch the assigned driver's Telegram settings.
    const { data: driver, error: driverErr } = await admin
      .from("profiles")
      .select("full_name, telegram_chat_id, telegram_enabled")
      .eq("user_id", driverId)
      .maybeSingle();
    if (driverErr) return jsonResponse({ error: driverErr.message }, 400);
    if (!driver) return jsonResponse({ success: true, sent: false, skipped: "Driver not found" });

    if (driver.telegram_enabled === false) {
      return jsonResponse({ success: true, sent: false, skipped: "Telegram disabled for this driver" });
    }
    if (!driver.telegram_chat_id) {
      return jsonResponse({ success: true, sent: false, skipped: "Telegram chat ID is missing" });
    }

    // Duplicate guard (skipped when admin forces a manual resend).
    if (!force && order.telegram_notified === true && order.telegram_last_sent_driver_id === driverId) {
      return jsonResponse({
        success: true,
        sent: false,
        skipped: "Telegram notification already sent to this driver",
      });
    }

    if (!botToken) {
      const msg = "TELEGRAM_BOT_TOKEN is not configured";
      console.error(msg);
      await admin.from("orders").update({ telegram_notify_error: msg }).eq("id", orderId);
      return jsonResponse({ success: true, sent: false, error: msg });
    }

    // Build message text.
    const items = (order.order_items ?? []) as Array<{ product_name_snapshot: string; quantity: number }>;
    const productName = items.length
      ? items.map((i) => `${show(i.product_name_snapshot)}${i.quantity ? ` x${i.quantity}` : ""}`).join(", ")
      : "-";
    const address = [order.district, order.address_text].filter(Boolean).join(", ") || "-";
    const fee = formatFee(order.delivery_fee ?? order.total_amount);

    const messageText =
      `🚚 <b>Шинэ хүргэлтийн захиалга орлоо!</b>\n\n` +
      `👤 Хүлээн авагч: ${escapeHtml(show(order.phone))}\n` +
      `📦 Бараа: ${escapeHtml(productName)}\n` +
      `📍 Хаяг: ${escapeHtml(address)}\n` +
      `💰 Төлбөр: ${escapeHtml(fee)}₮\n` +
      `🧾 Захиалгын дугаар: ${escapeHtml(show(order.internal_order_number))}\n\n` +
      `Жолооч та хүргэлтээ систем дээрээс шалгана уу.`;

    // Send to Telegram.
    let tgOk = false;
    let tgError = "";
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: driver.telegram_chat_id,
          text: messageText,
          parse_mode: "HTML",
        }),
      });
      const tgData = await tgRes.json().catch(() => ({}));
      tgOk = tgRes.ok && tgData?.ok === true;
      if (!tgOk) {
        tgError = tgData?.description || `Telegram error (HTTP ${tgRes.status})`;
      }
    } catch (e) {
      tgError = (e as Error).message || "Telegram request failed";
    }

    if (tgOk) {
      await admin
        .from("orders")
        .update({
          telegram_notified: true,
          telegram_notified_at: new Date().toISOString(),
          telegram_last_sent_driver_id: driverId,
          telegram_notify_error: null,
        })
        .eq("id", orderId);
      console.log(`Telegram delivery notification sent for order ${orderId} -> driver ${driverId}`);
      return jsonResponse({ success: true, sent: true, driver: driver.full_name });
    }

    // Failure: keep assignment intact, record the error only.
    console.error(`Telegram delivery notification failed for order ${orderId}: ${tgError}`);
    await admin.from("orders").update({ telegram_notify_error: tgError }).eq("id", orderId);
    return jsonResponse({ success: true, sent: false, error: tgError });
  } catch (err) {
    console.error("send-telegram-delivery-notification fatal:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
