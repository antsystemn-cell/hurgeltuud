import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

// Mongolian plate format: 1234 ABC (4 digits + space + 3 latin/cyrillic letters)
function isValidPlate(value: string): boolean {
  return /^\d{4}\s?[A-Za-zА-Яа-яӨөҮү]{3}$/.test(value.trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { last_name, first_name, vehicle_plate, phone, password } = await req.json();

    if (!last_name?.trim() || !first_name?.trim()) {
      return new Response(JSON.stringify({ error: "Овог болон нэрээ оруулна уу" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = normalizePhone(phone || "");
    if (cleanPhone.length < 8) {
      return new Response(JSON.stringify({ error: "Зөв утасны дугаар оруулна уу" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vehicle_plate?.trim() || !isValidPlate(vehicle_plate)) {
      return new Response(JSON.stringify({ error: "Машины улсын дугаарыг 1234 ABC форматаар оруулна уу" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Нууц үг доод тал нь 6 тэмдэгт байна" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Ensure phone not already registered
    const { data: existing } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Энэ утасны дугаар бүртгэлтэй байна" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `${cleanPhone}@phone.internal`;
    const fullName = `${last_name.trim()} ${first_name.trim()}`;
    const normalizedPlate = vehicle_plate.trim().toUpperCase().replace(/\s+/g, " ");

    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone_only: true },
    });

    if (createError || !newUserData?.user) {
      const msg = createError?.message?.includes("already registered")
        ? "Энэ утасны дугаар бүртгэлтэй байна"
        : (createError?.message || "Бүртгэл үүсгэхэд алдаа гарлаа");
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUserData.user.id;

    await adminClient
      .from("profiles")
      .update({ full_name: fullName, phone: cleanPhone, vehicle_plate: normalizedPlate, active: true })
      .eq("user_id", newUserId);

    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUserId, role: "driver" });

    if (roleError) {
      // Roll back created auth user to avoid orphans
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Immediately sign the driver in and return a session
    const signInClient = createClient(supabaseUrl, anonKey);
    const { data: signInData } = await signInClient.auth.signInWithPassword({ email, password });

    return new Response(
      JSON.stringify({ success: true, session: signInData?.session ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
