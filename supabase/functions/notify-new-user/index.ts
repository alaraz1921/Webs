import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NewUserPayload = {
    id?: string;
    email?: string;
    created_at?: string;
    project?: string;
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

function jsonResponse(body: object, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    });
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
        console.error("notify-new-user is missing required environment variables");
        return jsonResponse({ error: "Function is not configured" }, 500);
    }

    if (request.headers.get("x-webhook-secret") !== webhookSecret) {
        console.warn("notify-new-user rejected an unauthorized request");
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
    const email = cleanText(payload.email).toLowerCase();
    const createdAt = cleanText(payload.created_at) || new Date().toISOString();
    const project = cleanText(payload.project) || "Games";

    if (!userId || !email) {
        console.error("notify-new-user received incomplete user data", payload);
        return jsonResponse({ error: "Missing user data" }, 400);
    }

    const subject = "Nuevo usuario registrado en ALARAZ1921 Games";
    const text = [
        "Nuevo usuario registrado en ALARAZ1921 Games",
        "",
        `Email: ${email}`,
        `Fecha y hora: ${createdAt}`,
        `Proyecto: ${project}`,
        `ID de usuario: ${userId}`
    ].join("\n");
    const html = `
        <h2>Nuevo usuario registrado en ALARAZ1921 Games</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Fecha y hora:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Proyecto:</strong> ${escapeHtml(project)}</p>
        <p><strong>ID de usuario:</strong> ${escapeHtml(userId)}</p>
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
        console.error("notify-new-user request to Resend failed", error);
        return jsonResponse({ error: "Email request failed" }, 502);
    }

    return jsonResponse({ ok: true });
});
