import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ContactPayload = {
    nombre?: string;
    email?: string;
    asunto?: string;
    mensaje?: string;
    page_url?: string;
};

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

serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const toEmail = Deno.env.get("WEBS_CONTACT_TO_EMAIL") || Deno.env.get("CONTACT_TO_EMAIL");
    const fromEmail = Deno.env.get("WEBS_CONTACT_FROM_EMAIL") || Deno.env.get("CONTACT_FROM_EMAIL") || "Webs <onboarding@resend.dev>";

    if (!resendApiKey || !toEmail) {
        return new Response(JSON.stringify({ error: "Email function is not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    let payload: ContactPayload;
    try {
        payload = await request.json();
    } catch (_error) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const nombre = cleanText(payload.nombre);
    const email = cleanText(payload.email).toLowerCase();
    const asunto = cleanText(payload.asunto);
    const mensaje = cleanText(payload.mensaje);
    const pageUrl = cleanText(payload.page_url);

    if (!nombre || !email || !asunto || !mensaje) {
        return new Response(JSON.stringify({ error: "Missing contact fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const subject = `Nuevo contacto Webs: ${asunto}`.slice(0, 180);
    const text = [
        "Nuevo mensaje de contacto en Webs",
        "",
        `Nombre: ${nombre}`,
        `Email: ${email}`,
        `Asunto: ${asunto}`,
        pageUrl ? `Pagina: ${pageUrl}` : "",
        "",
        mensaje
    ].filter(Boolean).join("\n");

    const html = `
        <h2>Nuevo mensaje de contacto en Webs</h2>
        <p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Asunto:</strong> ${escapeHtml(asunto)}</p>
        ${pageUrl ? `<p><strong>Pagina:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
        <hr>
        <p>${escapeHtml(mensaje).replaceAll("\n", "<br>")}</p>
    `;

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            reply_to: email,
            subject,
            text,
            html
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Resend error", response.status, errorBody);
        return new Response(JSON.stringify({ error: "Email provider failed" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
});
