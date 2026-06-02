(function () {
    const form = document.getElementById('invitation-form');
    const status = document.getElementById('invitation-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const eventLink = document.getElementById('event-link');

    function normalizePhone(value) {
        return value.replace(/[^\d+]/g, '').replace(/^00/, '+');
    }

    function showStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('error', Boolean(isError));
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
                event_id: eventData.id,
                nombre: String(formData.get('nombre')).trim(),
                telefono: normalizePhone(String(formData.get('telefono'))),
                asistencia: formData.get('asistencia') === 'true',
                mensaje: String(formData.get('mensaje') || '').trim(),
                updated_at: new Date().toISOString()
            };

            await client
                .from('eventin_guest_responses')
                .upsert(payload, { onConflict: 'event_id,telefono' })
                .throwOnError();

            form.reset();
            showStatus('Respuesta enviada correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar la respuesta. Intentalo de nuevo mas tarde.', true);
        }
    });

    if (eventLink && eventContext) {
        eventLink.href = eventContext.buildEventUrl('index.html');
    }
})();
