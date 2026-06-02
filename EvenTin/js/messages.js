(function () {
    const form = document.getElementById('public-message-form');
    const status = document.getElementById('public-message-status');
    const client = window.eventSupabase;
    const eventId = window.eventPlatformConfig.defaultEventId;

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
            event_id: eventId,
            author_name: String(formData.get('author_name')).trim(),
            message: String(formData.get('message')).trim()
        };

        try {
            await client.from('public_messages').insert(payload).throwOnError();
            form.reset();
            showStatus('Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
