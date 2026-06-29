const contactStatus = document.getElementById("contact-status");
const contactClient = window.websSupabase;
const contactPageLoadedAt = Date.now();
const CONTACT_MIN_COMPLETION_TIME_MS = 5000;

function mostrarEstadoContacto(message, isError) {
    contactStatus.textContent = message;
    contactStatus.classList.toggle("error", Boolean(isError));
}

function validarContacto(payload) {
    if (payload.nombre.length < 2) return "El nombre debe tener al menos 2 caracteres.";
    if (payload.asunto.length < 4) return "El asunto debe tener al menos 4 caracteres.";
    if (payload.mensaje.length < 20) return "El mensaje debe tener al menos 20 caracteres.";
    if (!/\s/.test(payload.mensaje)) return "El mensaje debe contener varias palabras.";

    const secuenciaAleatoria = /\p{L}{19,}/u;
    if ([payload.nombre, payload.asunto, payload.mensaje].some((valor) => secuenciaAleatoria.test(valor))) {
        return "Revisa el texto: contiene una secuencia de letras demasiado larga.";
    }

    return "";
}

async function enviarContacto(event) {
    event.preventDefault();
    mostrarEstadoContacto("", false);

    const form = event.target;
    const formData = new FormData(form);

    if (String(formData.get("website") || "").trim()) return;

    if (Date.now() - contactPageLoadedAt < CONTACT_MIN_COMPLETION_TIME_MS) {
        mostrarEstadoContacto("No se pudo enviar el mensaje. Revisa los datos e intentalo de nuevo.", true);
        return;
    }

    if (!contactClient) {
        mostrarEstadoContacto("No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.", true);
        return;
    }

    const payload = {
        nombre: String(formData.get("name")).trim(),
        email: String(formData.get("email")).trim(),
        asunto: String(formData.get("subject")).trim(),
        mensaje: String(formData.get("message")).trim(),
        page_url: window.location.href
    };

    const validationError = validarContacto(payload);
    if (validationError) {
        mostrarEstadoContacto(validationError, true);
        return;
    }

    try {
        await contactClient
            .from("webs_contact_messages")
            .insert({
                nombre: payload.nombre,
                email: payload.email,
                asunto: payload.asunto,
                mensaje: payload.mensaje,
                page_url: payload.page_url
            })
            .throwOnError();

        try {
            await contactClient.functions.invoke("notify-webs-contact", { body: payload });
        } catch (error) {
            console.warn("No se pudo enviar la notificacion de contacto.", error);
        }

        form.reset();
        mostrarEstadoContacto("Mensaje enviado correctamente", false);
    } catch (error) {
        mostrarEstadoContacto("No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.", true);
    }
}