(function () {
    const client = window.eventSupabase;
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');
    const antiSpam = window.eventAntiSpam.createGuard(contactForm);

    function showStatus(message, isError) {
        contactStatus.textContent = message;
        contactStatus.classList.toggle('error', Boolean(isError));
    }

    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus('', false);

        const formData = new FormData(contactForm);
        const payload = {
            nombre: String(formData.get('nombre')).trim(),
            email: String(formData.get('email')).trim(),
            asunto: String(formData.get('asunto')).trim(),
            mensaje: String(formData.get('mensaje')).trim(),
            page_url: window.location.href
        };
        const validation = antiSpam.validate({
            name: payload.nombre,
            subject: payload.asunto,
            message: payload.mensaje
        });

        if (validation.blocked) {
            if (!validation.silent) showStatus(validation.message, true);
            return;
        }

        if (!client) {
            showStatus('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
            return;
        }

        try {
            await client.from('eventin_contact_requests').insert({
                nombre: payload.nombre,
                email: payload.email,
                asunto: payload.asunto,
                mensaje: payload.mensaje
            }).throwOnError();

            try {
                await client.functions.invoke('notify-contact', { body: payload });
            } catch (error) {
                console.warn('No se pudo enviar la notificacion de contacto.', error);
            }

            contactForm.reset();
            showStatus('Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
