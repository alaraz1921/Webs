import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CreateUserPayload = {
    email?: string;
    password?: string;
    display_name?: string;
    event_code?: string;
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function cleanText(value: unknown) {
    return String(value || "").trim();
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return jsonResponse({ error: "Function is not configured" }, 500);
    }

    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
        return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
        return jsonResponse({ error: "Invalid session" }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
        .from("eventin_profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

    if (profileError || profile?.role !== "admin") {
        return jsonResponse({ error: "Only admins can create users" }, 403);
    }

    let payload: CreateUserPayload;
    try {
        payload = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const email = cleanText(payload.email).toLowerCase();
    const password = String(payload.password || "");
    const displayName = cleanText(payload.display_name);
    const eventCode = cleanText(payload.event_code);

    if (!email || !password || !displayName || !/^\d{6}$/.test(eventCode)) {
        return jsonResponse({ error: "Missing or invalid user fields" }, 400);
    }

    const { data: eventData, error: eventError } = await adminClient
        .from("eventin_events")
        .select("id")
        .eq("event_code", eventCode)
        .maybeSingle();

    if (eventError || !eventData) {
        return jsonResponse({ error: "Event code not found" }, 404);
    }

    const { data: existingProfile } = await adminClient
        .from("eventin_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (existingProfile) {
        return jsonResponse({ error: "A profile already exists for this email" }, 409);
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName }
    });

    if (createError || !createdUser.user) {
        console.error("Auth admin createUser failed", createError);
        return jsonResponse({ error: "Could not create Auth user" }, 502);
    }

    const { error: profileInsertError } = await adminClient
        .from("eventin_profiles")
        .upsert({
            id: createdUser.user.id,
            email,
            display_name: displayName,
            role: "user",
            event_code: eventCode
        }, { onConflict: "id" });

    if (profileInsertError) {
        console.error("Profile insert failed", profileInsertError);
        await adminClient.auth.admin.deleteUser(createdUser.user.id);
        return jsonResponse({ error: "Could not create user profile" }, 502);
    }

    return jsonResponse({
        ok: true,
        user_id: createdUser.user.id
    });
});
