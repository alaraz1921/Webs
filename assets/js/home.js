const menuBtn = document.getElementById('mobile-menu-btn');
const menuList = document.getElementById('nav-menu-list');
const navbar = document.getElementById('main-navbar');
const contactStatus = document.getElementById('contact-status');
const contactClient = window.eventSupabase;

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

async function enviarContacto(event) {
    event.preventDefault();
    mostrarEstadoContacto('', false);

    if (!contactClient) {
        mostrarEstadoContacto('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    const payload = {
        nombre: String(formData.get('name')).trim(),
        email: String(formData.get('email')).trim(),
        asunto: String(formData.get('subject')).trim(),
        mensaje: String(formData.get('message')).trim(),
        page_url: window.location.href
    };

    try {
        await contactClient
            .from('eventin_contact_requests')
            .insert({
                nombre: payload.nombre,
                email: payload.email,
                asunto: payload.asunto,
                mensaje: payload.mensaje
            })
            .throwOnError();

        try {
            await contactClient.functions.invoke('notify-contact', { body: payload });
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
