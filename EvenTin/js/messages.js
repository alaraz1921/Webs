(function () {
    const form = document.getElementById('public-message-form');
    const status = document.getElementById('public-message-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const antiSpam = window.eventAntiSpam.createGuard(form);

    if (!eventContext?.hasRequestedEvent()) {
        return;
    }

    function showStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('error', Boolean(isError));
    }

    async function notifyEventUser(recordId) {
        if (!recordId) {
            return;
        }

        try {
            const { error } = await client.functions.invoke('notify-event-activity', {
                body: {
                    activity_type: 'public_message',
                    record_id: recordId
                }
            });
            if (error) {
                console.warn('No se pudo enviar la notificacion del mensaje.', error);
            }
        } catch (error) {
            console.warn('No se pudo enviar la notificacion del mensaje.', error);
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus('', false);

        const formData = new FormData(form);
        const authorName = String(formData.get('author_name')).trim();
        const message = String(formData.get('message')).trim();
        const validation = antiSpam.validate({ name: authorName, message });

        if (validation.blocked) {
            if (!validation.silent) showStatus(validation.message, true);
            return;
        }

        if (!client || !eventContext) {
            showStatus('No se pudo conectar con el servicio. Intentalo de nuevo mas tarde.', true);
            return;
        }

        try {
            const { event: eventData } = await eventContext.getEvent();
            const { data: messageId, error: rpcError } = await client.rpc('eventin_submit_public_message', {
                p_event_id: eventData.id,
                p_author_name: authorName,
                p_message: message
            });

            if (rpcError?.code === 'PGRST202') {
                await client.from('eventin_public_messages').insert({
                    event_id: eventData.id,
                    author_name: authorName,
                    message
                }).throwOnError();
            } else if (rpcError) {
                throw rpcError;
            }

            await notifyEventUser(messageId);
            form.reset();
            showStatus('Mensaje enviado correctamente', false);
        } catch (error) {
            showStatus('No se pudo enviar el mensaje. Intentalo de nuevo mas tarde.', true);
        }
    });
})();
