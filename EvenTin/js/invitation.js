(function () {
    const form = document.getElementById('invitation-form');
    const status = document.getElementById('invitation-status');
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const eventLink = document.getElementById('event-link');
    const modal = document.getElementById('invitation-success-modal');
    const modalEventLink = document.getElementById('modal-event-link');
    const guestGreeting = document.getElementById('guest-greeting');
    const notFoundPanel = document.getElementById('invitation-not-found');
    const detailImage = document.getElementById('invitation-detail-image');
    const legacyFields = document.querySelectorAll('[data-legacy-field]');
    const params = new URLSearchParams(window.location.search);
    const invitationToken = String(params.get('token') || '').trim();

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

    function applyInvitationHeader(eventData) {
        const fallback = window.eventPlatformConfig?.fallbackEvent || {};
        const title = valueOrFallback(eventData?.title, fallback.title || '');
        const eventDateTime = formatEventDateTime(valueOrFallback(eventData?.event_date, fallback.eventDate || ''));

        setText('[data-invitation-title]', title);
        setText('[data-invitation-date]', eventDateTime.date);
        setText('[data-invitation-time]', eventDateTime.time ? ` · ${eventDateTime.time}` : '');
    }

    function applyDetailImage(settings) {
        const imageUrl = valueOrFallback(settings?.detail_image_url, '');
        detailImage.hidden = !imageUrl;
        detailImage.style.backgroundImage = imageUrl ? `url("${imageUrl.replace(/"/g, '\\"')}")` : '';
    }

    function setEventLinks(eventData) {
        const eventKey = eventData?.public_slug || eventData?.event_code;
        const eventUrl = eventKey
            ? `evento.html?evento=${encodeURIComponent(eventKey)}`
            : eventContext?.buildEventUrl('evento.html') || 'index.html';

        if (eventLink) {
            eventLink.href = eventUrl;
        }
        if (modalEventLink) {
            modalEventLink.href = eventUrl;
        }
    }

    function setTokenMode(enabled) {
        legacyFields.forEach((field) => {
            field.hidden = enabled;
            field.querySelectorAll('input').forEach((input) => {
                input.required = !enabled;
            });
        });
    }

    async function loadTokenInvitation() {
        if (!client || !invitationToken) {
            return false;
        }

        const { data, error } = await client.rpc('eventin_get_guest_invitation', {
            p_token: invitationToken
        });

        if (error || !data?.guest || !data?.event) {
            form.hidden = true;
            notFoundPanel.hidden = false;
            return false;
        }

        setTokenMode(true);
        applyInvitationHeader(data.event);
        applyDetailImage(data.settings);
        setEventLinks(data.event);
        guestGreeting.textContent = `Hola ${data.guest.name}`;
        guestGreeting.hidden = false;
        form.elements.adults_count.value = data.guest.adults_count ?? 1;
        form.elements.children_count.value = data.guest.children_count ?? 0;
        return true;
    }

    async function loadLegacyInvitation() {
        if (!eventContext) {
            return;
        }

        const { event: eventData, settings } = await eventContext.getEvent();
        applyInvitationHeader(eventData);
        applyDetailImage(settings);
        setEventLinks(eventData);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showStatus('', false);

        if (!client) {
            showStatus('No se pudo conectar con el servicio. Intentalo de nuevo mas tarde.', true);
            return;
        }

        try {
            const formData = new FormData(form);
            const asistencia = formData.get('asistencia') === 'true';
            const adultsCount = Number(formData.get('adults_count') || 0);
            const childrenCount = Number(formData.get('children_count') || 0);
            const mensaje = String(formData.get('mensaje') || '').trim();

            if (invitationToken) {
                await client.rpc('eventin_submit_guest_token_response', {
                    p_token: invitationToken,
                    p_asistencia: asistencia,
                    p_adults_count: adultsCount,
                    p_children_count: childrenCount,
                    p_mensaje: mensaje
                }).throwOnError();
            } else {
                if (!eventContext) {
                    throw new Error('Evento no disponible');
                }

                const { event: eventData } = await eventContext.getEvent();
                await client.rpc('eventin_submit_guest_response', {
                    p_event_id: eventData.id,
                    p_nombre: String(formData.get('nombre')).trim(),
                    p_telefono: normalizePhone(String(formData.get('telefono'))),
                    p_asistencia: asistencia,
                    p_mensaje: mensaje,
                    p_adults_count: adultsCount,
                    p_children_count: childrenCount
                }).throwOnError();
            }

            showSuccessModal();
        } catch (error) {
            showStatus('No se pudo enviar la respuesta. Intentalo de nuevo mas tarde.', true);
        }
    });

    (async function init() {
        try {
            if (invitationToken) {
                await loadTokenInvitation();
            } else {
                await loadLegacyInvitation();
            }
        } catch (error) {
            setText('[data-invitation-title]', 'Evento no encontrado');
        }
    })();
})();
