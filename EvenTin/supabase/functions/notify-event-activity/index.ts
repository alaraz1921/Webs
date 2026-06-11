import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ActivityType = "public_message" | "guest_response";

type ActivityPayload = {
    activity_type?: ActivityType;
    record_id?: string;
};

type ActivityDetails = {
    eventId: string;
    heading: string;
    subjectPrefix: string;
    lines: Array<[string, string]>;
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function cleanText(value: unknown) {
    return String(value || "").trim();
}

function truncate(value: unknown, maxLength = 3000) {
    return cleanText(value).slice(0, maxLength);
}

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") || "EvenTin <onboarding@resend.dev>";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
        return jsonResponse({ error: "Function is not configured" }, 500);
    }

    let payload: ActivityPayload;
    try {
        payload = await request.json();
    } catch (_error) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const activityType = payload.activity_type;
    const recordId = cleanText(payload.record_id);
    if (!["public_message", "guest_response"].includes(activityType || "") || !/^[0-9a-f-]{36}$/i.test(recordId)) {
        return jsonResponse({ error: "Invalid activity" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    let details: ActivityDetails | null = null;

    if (activityType === "public_message") {
        const { data, error } = await adminClient
            .from("eventin_public_messages")
            .select("event_id,author_name,message")
            .eq("id", recordId)
            .maybeSingle();

        if (error || !data) {
            return jsonResponse({ error: "Message not found" }, 404);
        }

        details = {
            eventId: data.event_id,
            heading: "Nuevo mensaje publico en EvenTin",
            subjectPrefix: "Nuevo mensaje publico",
            lines: [
                ["Autor", truncate(data.author_name, 200)],
                ["Mensaje", truncate(data.message)]
            ]
        };
    } else {
        const { data, error } = await adminClient
            .from("eventin_guests")
            .select("event_id,name,will_attend,adults_count,children_count,message")
            .eq("id", recordId)
            .maybeSingle();

        if (error || !data) {
            return jsonResponse({ error: "Guest not found" }, 404);
        }

        details = {
            eventId: data.event_id,
            heading: "Nueva respuesta de invitacion en EvenTin",
            subjectPrefix: "Nueva respuesta de invitacion",
            lines: [
                ["Invitado", truncate(data.name, 200)],
                ["Asistencia", data.will_attend ? "Confirmada" : "Rechazada"],
                ["Adultos", String(data.adults_count ?? 0)],
                ["Ninos", String(data.children_count ?? 0)],
                ["Mensaje", truncate(data.message)]
            ]
        };
    }

    const { data: eventData, error: eventError } = await adminClient
        .from("eventin_events")
        .select("title,event_code,public_slug")
        .eq("id", details.eventId)
        .maybeSingle();

    if (eventError || !eventData?.event_code) {
        return jsonResponse({ error: "Event not found" }, 404);
    }

    const { data: profiles, error: profilesError } = await adminClient
        .from("eventin_profiles")
        .select("email")
        .eq("role", "user")
        .eq("event_code", eventData.event_code);

    if (profilesError) {
        console.error("Could not load event recipients", profilesError);
        return jsonResponse({ error: "Could not load recipients" }, 502);
    }

    const recipients = [...new Set(
        (profiles || [])
            .map((profile) => cleanText(profile.email).toLowerCase())
            .filter(Boolean)
    )];

    if (!recipients.length) {
        return jsonResponse({ ok: true, skipped: "No event user email" });
    }

    const eventTitle = truncate(eventData.title, 200) || "Evento";
    const eventKey = cleanText(eventData.public_slug) || cleanText(eventData.event_code);
    const adminUrl = `https://www.alaraz1921.com/EvenTin/admin.html?evento=${encodeURIComponent(eventKey)}`;
    const visibleLines = details.lines.filter(([, value]) => value);
    const subject = `${details.subjectPrefix}: ${eventTitle}`.slice(0, 180);
    const text = [
        details.heading,
        "",
        `Evento: ${eventTitle}`,
        ...visibleLines.map(([label, value]) => `${label}: ${value}`),
        "",
        `Abrir panel: ${adminUrl}`
    ].join("\n");
    const html = `
        <h2>${escapeHtml(details.heading)}</h2>
        <p><strong>Evento:</strong> ${escapeHtml(eventTitle)}</p>
        ${visibleLines.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value).replaceAll("\n", "<br>")}</p>`).join("")}
        <p><a href="${escapeHtml(adminUrl)}">Abrir panel de EvenTin</a></p>
    `;

    const results = await Promise.all(recipients.map((recipient) => fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [recipient],
            subject,
            text,
            html
        })
    })));

    if (results.some((response) => !response.ok)) {
        const errors = await Promise.all(results.filter((response) => !response.ok).map((response) => response.text()));
        console.error("Resend errors", errors);
        return jsonResponse({ error: "Email provider failed" }, 502);
    }

    return jsonResponse({ ok: true, recipients: recipients.length });
});
