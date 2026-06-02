(function () {
    const eventContext = window.eventContext;
    const client = window.eventSupabase;
    const homePage = document.getElementById('home-page');
    const eventPage = document.getElementById('event-page');
    const eventAccessForm = document.getElementById('event-access-form');
    const eventAccessStatus = document.getElementById('event-access-status');
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');

    function showStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    function showCurrentView() {
        const hasEvent = eventContext?.hasRequestedEvent();

        homePage.hidden = Boolean(hasEvent);
        eventPage.hidden = !hasEvent;

        if (!hasEvent) {
            document.body.dataset.palette = 'home';
        }
    }

    eventAccessForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus(eventAccessStatus, '', false);

        const formData = new FormData(eventAccessForm);
        const eventCode = String(formData.get('event_code') || '').replace(/\D/g, '');

        if (!/^\d{6}$/.test(eventCode)) {
            showStatus(eventAccessStatus, 'Introduce un ID de 6 digitos.', true);
            return;
        }

        window.location.href = eventContext.buildEventUrl('index.html', eventCode);
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
            mensaje: String(formData.get('mensaje')).trim()
        };

        try {
            await client.from('eventin_contact_requests').insert(payload).throwOnError();
            contactForm.reset();
            showStatus(contactStatus, 'Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus(contactStatus, 'No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });

    showCurrentView();
})();
