import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NewUserPayload = {
    id?: string;
    email?: string;
    created_at?: string;
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function cleanText(value: unknown) {
    return String(value || "").trim();
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

serve(async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const fromEmail = Deno.env.get("FROM_EMAIL");
    const webhookSecret = Deno.env.get("NEW_USER_WEBHOOK_SECRET");

    if (!resendApiKey || !adminEmail || !fromEmail || !webhookSecret) {
        console.error("notify-new-user is missing required secrets");
        return jsonResponse({ error: "Function is not configured" }, 500);
    }

    if (request.headers.get("x-webhook-secret") !== webhookSecret) {
        console.warn("notify-new-user rejected a request with an invalid webhook secret");
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let payload: NewUserPayload;
    try {
        payload = await request.json();
    } catch (error) {
        console.error("notify-new-user received invalid JSON", error);
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const userId = cleanText(payload.id);
    const email = cleanText(payload.email).toLowerCase() || "No disponible";
    const createdAt = cleanText(payload.created_at);
    const createdAtDate = createdAt ? new Date(createdAt) : new Date();
    const formattedDate = Number.isNaN(createdAtDate.getTime())
        ? createdAt || "No disponible"
        : new Intl.DateTimeFormat("es-ES", {
            dateStyle: "full",
            timeStyle: "long",
            timeZone: "Europe/Madrid"
        }).format(createdAtDate);

    const subject = "Nuevo usuario registrado en EvenTin";
    const text = [
        "Nuevo usuario registrado en EvenTin",
        "",
        `Email: ${email}`,
        `Fecha y hora del registro: ${formattedDate}`,
        "Proyecto: Games",
        `ID del usuario: ${userId || "No disponible"}`
    ].join("\n");
    const html = `
        <h2>Nuevo usuario registrado en EvenTin</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Fecha y hora del registro:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>Proyecto:</strong> Games</p>
        <p><strong>ID del usuario:</strong> ${escapeHtml(userId || "No disponible")}</p>
    `;

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: fromEmail,
                to: [adminEmail],
                subject,
                text,
                html
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("notify-new-user Resend error", response.status, errorBody);
            return jsonResponse({ error: "Email provider failed" }, 502);
        }
    } catch (error) {
        console.error("notify-new-user request failed", error);
        return jsonResponse({ error: "Email request failed" }, 502);
    }

    return jsonResponse({ ok: true });
});
