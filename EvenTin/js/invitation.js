(function () {
    const form = document.getElementById('invitation-form');
    const status = document.getElementById('invitation-status');
    const client = window.eventSupabase;
    const eventId = window.eventPlatformConfig.defaultEventId;

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

        if (!client) {
            showStatus('No se pudo conectar con el servicio. Intentalo de nuevo mas tarde.', true);
            return;
        }

        const formData = new FormData(form);
        const payload = {
            p_event_id: eventId,
            p_nombre: String(formData.get('nombre')).trim(),
            p_telefono: normalizePhone(String(formData.get('telefono'))),
            p_asistencia: formData.get('asistencia') === 'true',
            p_mensaje: String(formData.get('mensaje') || '').trim()
        };

        try {
            await client
                .rpc('eventin_submit_guest_response', payload)
                .throwOnError();

            form.reset();
            showStatus('Respuesta enviada correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar la respuesta. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
