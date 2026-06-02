(function () {
    const form = document.getElementById('public-message-form');
    const status = document.getElementById('public-message-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;

    if (!eventContext?.hasRequestedEvent()) {
        return;
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
                author_name: String(formData.get('author_name')).trim(),
                message: String(formData.get('message')).trim()
            };

            await client.from('eventin_public_messages').insert(payload).throwOnError();
            form.reset();
            showStatus('Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
