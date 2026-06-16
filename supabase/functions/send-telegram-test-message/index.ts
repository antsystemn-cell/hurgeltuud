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

    // Only staff (admin / operator) may send test messages.
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
    const driverId = body?.driverId;
    if (!driverId || typeof driverId !== "string") {
      return jsonResponse({ error: "driverId is required" }, 400);
    }

    const { data: driver, error: driverErr } = await admin
      .from("profiles")
      .select("full_name, telegram_chat_id, telegram_enabled")
      .eq("user_id", driverId)
      .maybeSingle();
    if (driverErr) return jsonResponse({ error: driverErr.message }, 400);
    if (!driver) return jsonResponse({ error: "Driver not found" }, 404);

    if (!driver.telegram_chat_id) {
      return jsonResponse({ success: false, error: "Telegram chat ID is missing" }, 400);
    }
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return jsonResponse({ success: false, error: "TELEGRAM_BOT_TOKEN is not configured" }, 400);
    }

    const messageText =
      `✅ Telegram notification амжилттай холбогдлоо.\n` +
      `Жолоочийн групп чат бэлэн байна.`;

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
      if (!tgOk) tgError = tgData?.description || `Telegram error (HTTP ${tgRes.status})`;
    } catch (e) {
      tgError = (e as Error).message || "Telegram request failed";
    }

    if (tgOk) {
      console.log(`Telegram test message sent to driver ${driverId}`);
      return jsonResponse({ success: true });
    }

    console.error(`Telegram test message failed for driver ${driverId}: ${tgError}`);
    return jsonResponse({ success: false, error: tgError }, 400);
  } catch (err) {
    console.error("send-telegram-test-message fatal:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
