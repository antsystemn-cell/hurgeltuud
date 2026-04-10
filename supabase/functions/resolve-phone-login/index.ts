import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, password } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Утасны дугаар шаардлагатай" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Look up profile by phone
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Энэ дугаартай хэрэглэгч олдсонгүй" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from auth
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(profile.user_id);

    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Хэрэглэгчийн мэдээлэл олдсонгүй" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email;

    // If password provided, sign in directly and return session
    if (password) {
      const signInClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(JSON.stringify({ error: "Нууц үг буруу байна" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ 
          session: signInData.session,
          email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
