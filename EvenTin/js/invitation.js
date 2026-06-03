(function () {
    const form = document.getElementById('invitation-form');
    const status = document.getElementById('invitation-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const eventLink = document.getElementById('event-link');
    const modal = document.getElementById('invitation-success-modal');
    const modalEventLink = document.getElementById('modal-event-link');

    function normalizePhone(value) {
        return value.replace(/[^\d+]/g, '').replace(/^00/, '+');
    }

    function showStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('error', Boolean(isError));
    }

    function showSuccessModal() {
        if (modal) {
            modal.hidden = false;
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus('', false);

        if (!client || !eventContext) {
            showStatus('No se pudo conectar con el servicio. Intentalo de nuevo mas tarde.', true);
            return;
        }

        try {
            const formData = new FormData(form);
            const { event: eventData } = await eventContext.getEvent();
            const payload = {
                p_event_id: eventData.id,
                p_nombre: String(formData.get('nombre')).trim(),
                p_telefono: normalizePhone(String(formData.get('telefono'))),
                p_asistencia: formData.get('asistencia') === 'true',
                p_mensaje: String(formData.get('mensaje') || '').trim()
            };

            await client
                .rpc('eventin_submit_guest_response', payload)
                .throwOnError();

            form.reset();
            showSuccessModal();
        } catch (error) {
            showStatus('No se pudo enviar la respuesta. Intentalo de nuevo mas tarde.', true);
        }
    });

    if (eventLink && eventContext) {
        const eventUrl = eventContext.buildEventUrl('evento.html');
        eventLink.href = eventUrl;
        if (modalEventLink) {
            modalEventLink.href = eventUrl;
        }
    }
})();
