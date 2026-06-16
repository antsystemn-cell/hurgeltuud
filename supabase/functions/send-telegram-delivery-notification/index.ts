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

// Mongolian labels for the current fulfillment status.
const STATUS_LABELS: Record<string, string> = {
  confirmed: "🔵 Баталгаажсан",
  phone_confirmed: "🟡 Утсаар баталгаажсан",
  out_for_delivery: "🟠 Хүргэлтэд гарсан",
  delivered: "🟢 Хүргэгдсэн",
  cancelled: "🔴 Цуцлагдсан",
};

function statusLabel(status: unknown): string {
  const key = String(status ?? "");
  return STATUS_LABELS[key] || show(status);
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

    // Verify caller is a signed-in user (staff or the assigned driver).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    const force = body?.force === true;
    if (!orderId || typeof orderId !== "string") {
      return jsonResponse({ error: "orderId is required" }, 400);
    }

    // Fetch the order + line items.
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("*, order_items(product_name_snapshot, quantity), source_systems(name)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) return jsonResponse({ error: orderErr.message }, 400);
    if (!order) return jsonResponse({ error: "Order not found" }, 404);

    // Authorisation: staff (admin/operator) OR the assigned driver of this order.
    const [{ data: isAdmin }, { data: isOperator }] = await Promise.all([
      admin.rpc("has_role", { _user_id: caller.id, _role: "main_admin" }),
      admin.rpc("has_role", { _user_id: caller.id, _role: "operator" }),
    ]);
    const isAssignedDriver = order.assigned_driver_user_id === caller.id;
    if (!isAdmin && !isOperator && !isAssignedDriver) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

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

    if (!botToken) {
      const msg = "TELEGRAM_BOT_TOKEN is not configured";
      console.error(msg);
      await admin.from("orders").update({ telegram_notify_error: msg }).eq("id", orderId);
      return jsonResponse({ success: true, sent: false, error: msg });
    }

    // Build message text (reflects the order's CURRENT status).
    const items = (order.order_items ?? []) as Array<{ product_name_snapshot: string; quantity: number }>;
    const productName = items.length
      ? items.map((i) => `${show(i.product_name_snapshot)}${i.quantity ? ` x${i.quantity}` : ""}`).join(", ")
      : "-";
    const address = [order.district, order.address_text].filter(Boolean).join(", ") || "-";
    const fee = formatFee(order.total_amount ?? order.delivery_fee);
    // Resolve the actual shop in 2 ways:
    //  1) merchant_name → the specific shop inside Only Merchants Hub (e.g. "Only Shop")
    //  2) source_systems.name → a directly-connected shop (e.g. "EasyShop")
    const sourceName =
      ((order.source_systems as { name?: string } | null)?.name || "").trim() ||
      String(order.source_channel ?? "").trim();
    const merchant = String(order.merchant_name ?? "").trim();
    const shopLine =
      merchant && merchant.toLowerCase() !== sourceName.toLowerCase()
        ? sourceName
          ? `${merchant} (${sourceName})`
          : merchant
        : sourceName || merchant || "-";

    const messageText =
      `🚚 <b>Шинэ хүргэлтийн захиалга орлоо!</b>\n\n` +
      `🏪 Дэлгүүр: ${escapeHtml(show(shopLine))}\n` +
      `👤 Хүлээн авагч: ${escapeHtml(show(order.phone))}\n` +
      `📦 Бараа: ${escapeHtml(productName)}\n` +
      `📍 Хаяг: ${escapeHtml(address)}\n` +
      `💰 Төлбөр: ${escapeHtml(fee)}₮\n` +
      `🧾 Захиалгын дугаар: ${escapeHtml(show(order.internal_order_number))}\n` +
      `📊 Төлөв: ${escapeHtml(statusLabel(order.fulfillment_status))}\n\n` +
      `Жолооч та хүргэлтээ систем дээрээс шалгана уу.`;

    const existingChatId = (order.telegram_chat_id as string | null) || null;
    const existingMessageId = (order.telegram_message_id as string | null) || null;

    // ---- EDIT PATH: a message already exists for this group → edit it in place. ----
    const canEdit =
      !!existingMessageId &&
      !!existingChatId &&
      existingChatId === String(driver.telegram_chat_id);

    if (canEdit) {
      let editOk = false;
      let editError = "";
      let messageMissing = false;
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: existingChatId,
            message_id: Number(existingMessageId),
            text: messageText,
            parse_mode: "HTML",
          }),
        });
        const data = await res.json().catch(() => ({}));
        editOk = res.ok && data?.ok === true;
        if (!editOk) {
          editError = data?.description || `Telegram error (HTTP ${res.status})`;
          const lower = editError.toLowerCase();
          // Telegram returns these when the original message no longer exists.
          messageMissing =
            lower.includes("message to edit not found") ||
            lower.includes("message_id_invalid") ||
            lower.includes("message can't be edited");
        }
      } catch (e) {
        editError = (e as Error).message || "Telegram edit request failed";
      }

      // "message is not modified" means the content is already up to date — treat as success.
      const notModified = editError.toLowerCase().includes("message is not modified");

      if (editOk || notModified) {
        await admin
          .from("orders")
          .update({
            telegram_message_last_edited_at: new Date().toISOString(),
            telegram_notify_error: null,
          })
          .eq("id", orderId);
        console.log(`Telegram message edited for order ${orderId} (status ${order.fulfillment_status})`);
        return jsonResponse({ success: true, edited: true, driver: driver.full_name });
      }

      // If the original message is gone, fall through to send a fresh one.
      if (!messageMissing) {
        console.error(`Telegram edit failed for order ${orderId}: ${editError}`);
        await admin.from("orders").update({ telegram_notify_error: editError }).eq("id", orderId);
        return jsonResponse({ success: true, edited: false, error: editError });
      }
      console.warn(`Telegram message missing for order ${orderId}, sending a new one: ${editError}`);
    } else if (!force && order.telegram_notified === true && order.telegram_last_sent_driver_id === driverId) {
      // ---- SEND PATH duplicate guard (only when there is no editable message). ----
      return jsonResponse({
        success: true,
        sent: false,
        skipped: "Telegram notification already sent to this driver",
      });
    }

    // ---- SEND PATH: no editable message → send a new one and store its id. ----
    let tgOk = false;
    let tgError = "";
    let newMessageId: number | null = null;
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
      if (tgOk) {
        newMessageId = tgData?.result?.message_id ?? null;
      } else {
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
          telegram_message_id: newMessageId !== null ? String(newMessageId) : null,
          telegram_chat_id: String(driver.telegram_chat_id),
          telegram_message_last_edited_at: new Date().toISOString(),
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
