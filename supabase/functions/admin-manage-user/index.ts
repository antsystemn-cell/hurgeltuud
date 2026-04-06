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

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: "Invalid session" }, 401);

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "main_admin",
    });
    if (!isAdmin) return jsonResponse({ error: "Forbidden: admin only" }, 403);

    const body = await req.json();
    const { action } = body;

    // ── DELETE USER ──
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: "user_id required" }, 400);
      if (user_id === caller.id) return jsonResponse({ error: "Cannot delete yourself" }, 400);

      // Delete role, profile, then auth user
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    // ── UPDATE PROFILE ──
    if (action === "update_profile") {
      const { user_id, full_name, phone } = body;
      if (!user_id) return jsonResponse({ error: "user_id required" }, 400);

      const updates: Record<string, string> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone !== undefined) updates.phone = phone;

      if (Object.keys(updates).length === 0) return jsonResponse({ error: "Nothing to update" }, 400);

      const { error } = await adminClient.from("profiles").update(updates).eq("user_id", user_id);
      if (error) return jsonResponse({ error: error.message }, 400);

      // Also update auth user metadata if name changed
      if (full_name !== undefined) {
        await adminClient.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
      }

      return jsonResponse({ success: true });
    }

    // ── UPDATE ROLE ──
    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) return jsonResponse({ error: "user_id and role required" }, 400);
      if (user_id === caller.id) return jsonResponse({ error: "Cannot change your own role" }, 400);

      const validRoles = ["main_admin", "operator", "driver"];
      if (!validRoles.includes(role)) return jsonResponse({ error: "Invalid role" }, 400);

      // Upsert: delete existing then insert new
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await adminClient.from("user_roles").insert({ user_id, role });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) return jsonResponse({ error: "user_id and new_password required" }, 400);

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
