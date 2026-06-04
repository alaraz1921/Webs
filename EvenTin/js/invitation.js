(function () {
    const form = document.getElementById('invitation-form');
    const status = document.getElementById('invitation-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const eventLink = document.getElementById('event-link');
    const modal = document.getElementById('invitation-success-modal');
    const modalEventLink = document.getElementById('modal-event-link');


    function valueOrFallback(value, fallback) {
        return value === null || value === undefined ? fallback : value;
    }


    function formatEventDateTime(value) {
        if (!value) {
            return { date: '', time: '' };
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return { date: '', time: '' };
        }

        return {
            date: date.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }),
            time: date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }

    function setText(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    }

    async function loadInvitationHeader() {
        if (!eventContext) {
            return;
        }

        const { event: eventData, settings } = await eventContext.getEvent();
        const fallback = window.eventPlatformConfig?.fallbackEvent || {};
        const title = valueOrFallback(eventData?.title, fallback.title || '');
        const eventDateTime = formatEventDateTime(valueOrFallback(eventData?.event_date, fallback.eventDate || ''));
        const displayDate = eventDateTime.date;
        const displayTime = eventDateTime.time;

        setText('[data-invitation-title]', title);
        setText('[data-invitation-date]', displayDate);
        setText('[data-invitation-time]', displayTime ? ` · ${displayTime}` : '');
    }

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

    loadInvitationHeader().catch(() => {
        setText('[data-invitation-title]', 'Evento no encontrado');
    });

    if (eventLink && eventContext) {
        const eventUrl = eventContext.buildEventUrl('evento.html');
        eventLink.href = eventUrl;
        if (modalEventLink) {
            modalEventLink.href = eventUrl;
        }
    }
})();
