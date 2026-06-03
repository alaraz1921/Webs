(function () {
    const client = window.eventSupabase;
    const eventAccessForm = document.getElementById('event-access-form');
    const eventAccessStatus = document.getElementById('event-access-status');
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');

    function showStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    document.body.dataset.palette = 'home';

    eventAccessForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus(eventAccessStatus, '', false);

        const formData = new FormData(eventAccessForm);
        const eventCode = String(formData.get('event_code') || '').replace(/\D/g, '');

        if (!/^\d{6}$/.test(eventCode)) {
            showStatus(eventAccessStatus, 'Introduce un ID de 6 digitos.', true);
            return;
        }

        window.location.href = `evento.html?evento=${encodeURIComponent(eventCode)}`;
    });

    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus(contactStatus, '', false);

        if (!client) {
            showStatus(contactStatus, 'No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
            return;
        }

        const formData = new FormData(contactForm);
        const payload = {
            nombre: String(formData.get('nombre')).trim(),
            email: String(formData.get('email')).trim(),
            asunto: String(formData.get('asunto')).trim(),
            mensaje: String(formData.get('mensaje')).trim(),
            page_url: window.location.href
        };

        try {
            await client
                .from('eventin_contact_requests')
                .insert({
                    nombre: payload.nombre,
                    email: payload.email,
                    asunto: payload.asunto,
                    mensaje: payload.mensaje
                })
                .throwOnError();

            try {
                await client.functions.invoke('notify-contact', { body: payload });
            } catch (error) {
                console.warn('No se pudo enviar la notificacion de contacto.', error);
            }

            contactForm.reset();
            showStatus(contactStatus, 'Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus(contactStatus, 'No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
