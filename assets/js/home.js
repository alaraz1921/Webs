const menuBtn = document.getElementById('mobile-menu-btn');
const menuList = document.getElementById('nav-menu-list');
const navbar = document.getElementById('main-navbar');
const contactStatus = document.getElementById('contact-status');
const contactClient = window.websSupabase;
const contactPageLoadedAt = Date.now();
const CONTACT_MIN_COMPLETION_TIME_MS = 5000;

function cerrarMenuMovil() {
    menuBtn.classList.remove('open');
    menuList.classList.remove('mobile-open');
}

menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    menuList.classList.toggle('mobile-open');
});

menuList.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', cerrarMenuMovil);
});

function mostrarEstadoContacto(message, isError) {
    contactStatus.textContent = message;
    contactStatus.classList.toggle('error', Boolean(isError));
}

function validarContacto(payload) {
    if (payload.nombre.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
    if (payload.asunto.length < 4) return 'El asunto debe tener al menos 4 caracteres.';
    if (payload.mensaje.length < 20) return 'El mensaje debe tener al menos 20 caracteres.';
    if (!/\s/.test(payload.mensaje)) return 'El mensaje debe contener varias palabras.';

    // Validacion anti-spam: rechaza secuencias largas de letras sin separacion.
    const secuenciaAleatoria = /\p{L}{19,}/u;
    if ([payload.nombre, payload.asunto, payload.mensaje].some((valor) => secuenciaAleatoria.test(valor))) {
        return 'Revisa el texto: contiene una secuencia de letras demasiado larga.';
    }

    return '';
}

async function enviarContacto(event) {
    event.preventDefault();
    mostrarEstadoContacto('', false);

    const form = event.target;
    const formData = new FormData(form);

    // Proteccion honeypot: los bots suelen rellenar este campo invisible.
    if (String(formData.get('website') || '').trim()) return;

    // Proteccion por tiempo minimo: bloquea envios automaticos demasiado rapidos.
    if (Date.now() - contactPageLoadedAt < CONTACT_MIN_COMPLETION_TIME_MS) {
        mostrarEstadoContacto('No se pudo enviar el mensaje. Revisa los datos e intentalo de nuevo.', true);
        return;
    }

    if (!contactClient) {
        mostrarEstadoContacto('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        return;
    }

    const payload = {
        nombre: String(formData.get('name')).trim(),
        email: String(formData.get('email')).trim(),
        asunto: String(formData.get('subject')).trim(),
        mensaje: String(formData.get('message')).trim(),
        page_url: window.location.href
    };

    const validationError = validarContacto(payload);
    if (validationError) {
        mostrarEstadoContacto(validationError, true);
        return;
    }

    try {
        await contactClient
            .from('webs_contact_messages')
            .insert({
                nombre: payload.nombre,
                email: payload.email,
                asunto: payload.asunto,
                mensaje: payload.mensaje,
                page_url: payload.page_url
            })
            .throwOnError();

        try {
            await contactClient.functions.invoke('notify-webs-contact', { body: payload });
        } catch (error) {
            console.warn('No se pudo enviar la notificacion de contacto.', error);
        }

        form.reset();
        mostrarEstadoContacto('Mensaje enviado correctamente', false);
    } catch (error) {
        mostrarEstadoContacto('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
    }
}

window.addEventListener('scroll', () => {
    if (window.innerWidth > 768) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});
