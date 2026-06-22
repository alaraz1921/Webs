import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PROFILE_ROLES = new Set(["admin", "member", "viewer", "trastero"]);
const PROJECT_ROLES = new Set(["owner", "editor", "viewer"]);

function jsonResponse(body: object, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function cleanText(value: unknown) {
    return String(value || "").trim();
}

function normalizeUsername(value: unknown) {
    return cleanText(value).toLowerCase();
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ ok: false, message: "Metodo no permitido." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("admin-create-user missing Supabase environment variables");
        return jsonResponse({ ok: false, message: "Funcion no configurada." }, 500);
    }

    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
        return jsonResponse({ ok: false, message: "Sesion no valida." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    const requester = authData?.user;

    if (authError || !requester) {
        return jsonResponse({ ok: false, message: "Sesion no valida." }, 401);
    }

    const { data: requesterProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", requester.id)
        .single();

    if (profileError || requesterProfile?.role !== "admin") {
        return jsonResponse({ ok: false, message: "Solo los administradores pueden crear usuarios." }, 403);
    }

    let payload: Record<string, unknown>;
    try {
        payload = await request.json();
    } catch (error) {
        console.error("admin-create-user invalid JSON", error);
        return jsonResponse({ ok: false, message: "Solicitud no valida." }, 400);
    }

    const email = cleanText(payload.email).toLowerCase();
    const password = cleanText(payload.password);
    const username = normalizeUsername(payload.username);
    const displayName = cleanText(payload.display_name) || username || email.split("@")[0];
    const profileRole = cleanText(payload.profile_role) || "viewer";
    const projectId = cleanText(payload.project_id);
    const projectRole = cleanText(payload.project_role);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse({ ok: false, message: "Email no valido." }, 400);
    }

    if (password.length < 6) {
        return jsonResponse({ ok: false, message: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
        return jsonResponse({ ok: false, message: "El usuario debe tener entre 3 y 30 caracteres: letras, numeros, punto, guion o guion bajo." }, 400);
    }

    if (!PROFILE_ROLES.has(profileRole)) {
        return jsonResponse({ ok: false, message: "Rol general no valido." }, 400);
    }

    if (!projectId || !PROJECT_ROLES.has(projectRole)) {
        return jsonResponse({ ok: false, message: "Selecciona proyecto y rol del proyecto." }, 400);
    }

    const { data: existingUsername, error: usernameError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (usernameError) {
        console.error("admin-create-user username lookup failed", usernameError);
        return jsonResponse({ ok: false, message: "No se pudo validar el usuario." }, 500);
    }

    if (existingUsername) {
        return jsonResponse({ ok: false, message: "El nombre de usuario ya esta en uso." }, 409);
    }

    const { data: project, error: projectError } = await adminClient
        .from("app_projects")
        .select("id, is_active")
        .eq("id", projectId)
        .single();

    if (projectError || !project?.is_active) {
        return jsonResponse({ ok: false, message: "Proyecto no valido o inactivo." }, 400);
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            display_name: displayName,
            username
        }
    });

    if (createError || !createdUser?.user) {
        console.error("admin-create-user auth creation failed", createError);
        return jsonResponse({ ok: false, message: createError?.message || "No se pudo crear el usuario." }, 400);
    }

    const userId = createdUser.user.id;

    const { error: updateProfileError } = await adminClient
        .from("profiles")
        .upsert({
            id: userId,
            email,
            display_name: displayName,
            username,
            role: profileRole
        }, { onConflict: "id" });

    if (updateProfileError) {
        console.error("admin-create-user profile update failed", updateProfileError);
        await adminClient.auth.admin.deleteUser(userId);
        return jsonResponse({ ok: false, message: "No se pudo crear el perfil del usuario." }, 500);
    }

    const { error: memberError } = await adminClient
        .from("project_members")
        .upsert({
            project_id: projectId,
            user_id: userId,
            role: projectRole
        }, { onConflict: "project_id,user_id" });

    if (memberError) {
        console.error("admin-create-user project member creation failed", memberError);
        await adminClient.auth.admin.deleteUser(userId);
        return jsonResponse({ ok: false, message: "No se pudo asignar el proyecto al usuario." }, 500);
    }

    return jsonResponse({
        ok: true,
        user: {
            id: userId,
            email,
            username,
            display_name: displayName,
            role: profileRole
        }
    });
});
