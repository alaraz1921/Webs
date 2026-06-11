(function () {
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const phoneForm = document.getElementById('invitation-phone-form');
    const phoneStatus = document.getElementById('invitation-phone-status');
    const responseForm = document.getElementById('invitation-form');
    const responseStatus = document.getElementById('invitation-status');
    const changePhoneButton = document.getElementById('change-invitation-phone');
    const notFoundPanel = document.getElementById('invitation-not-found');
    const guestGreeting = document.getElementById('guest-greeting');
    const detailImage = document.getElementById('invitation-detail-image');
    const eventLink = document.getElementById('event-link');
    const modal = document.getElementById('invitation-success-modal');
    const modalEventLink = document.getElementById('modal-event-link');
    const params = new URLSearchParams(window.location.search);
    const eventKey = String(params.get('evento') || '').trim();
    let matchedPhone = '';

    function valueOrFallback(value, fallback) {
        return value === null || value === undefined ? fallback : value;
    }

    function normalizePhone(value) {
        let digits = String(value || '').replace(/\D/g, '');
        if (digits.startsWith('0034')) {
            digits = digits.slice(4);
        } else if (digits.length > 9 && digits.startsWith('34')) {
            digits = digits.slice(2);
        }
        return digits;
    }

    function setStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    function setText(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
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
            time: date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
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
        const key = eventData?.public_slug || eventData?.event_code || eventKey;
        const url = key ? `evento.html?evento=${encodeURIComponent(key)}` : 'index.html';
        eventLink.href = url;
        modalEventLink.href = url;
    }

    function showPhoneLookup() {
        matchedPhone = '';
        phoneForm.hidden = false;
        responseForm.hidden = true;
        notFoundPanel.hidden = true;
        guestGreeting.hidden = true;
        setStatus(phoneStatus, '', false);
        phoneForm.elements.phone.focus();
    }

    function showGuest(guest) {
        phoneForm.hidden = true;
        notFoundPanel.hidden = true;
        responseForm.hidden = false;
        guestGreeting.textContent = `Hola ${guest.name}`;
        guestGreeting.hidden = false;
        responseForm.elements.name.value = guest.name || '';
        responseForm.elements.adults_count.value = guest.adults_count ?? 1;
        responseForm.elements.children_count.value = guest.children_count ?? 0;
        responseForm.elements.message.value = guest.message || '';
        responseForm.querySelectorAll('[name="will_attend"]').forEach((radio) => {
            radio.checked = guest.will_attend !== null && String(guest.will_attend) === radio.value;
        });
    }

    async function notifyEventUser(recordId) {
        if (!recordId) {
            return;
        }
        try {
            const { error } = await client.functions.invoke('notify-event-activity', {
                body: { activity_type: 'guest_response', record_id: recordId }
            });
            if (error) {
                console.warn('No se pudo enviar la notificación de respuesta.', error);
            }
        } catch (error) {
            console.warn('No se pudo enviar la notificación de respuesta.', error);
        }
    }

    phoneForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(phoneStatus, '', false);
        notFoundPanel.hidden = true;
        matchedPhone = normalizePhone(new FormData(phoneForm).get('phone'));

        if (!client || !eventKey || !matchedPhone) {
            setStatus(phoneStatus, 'Introduce un teléfono válido.', true);
            return;
        }

        try {
            const { data, error } = await client.rpc('eventin_find_guest_by_phone', {
                p_event_key: eventKey,
                p_phone: matchedPhone
            });
            if (error) {
                throw error;
            }
            if (!data?.guest) {
                notFoundPanel.hidden = false;
                return;
            }
            applyInvitationHeader(data.event);
            applyDetailImage(data.settings);
            setEventLinks(data.event);
            showGuest(data.guest);
        } catch (error) {
            setStatus(phoneStatus, 'No se pudo comprobar la invitación. Inténtalo de nuevo más tarde.', true);
        }
    });

    responseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(responseStatus, '', false);
        const formData = new FormData(responseForm);
        const attendanceValue = formData.get('will_attend');

        if (!matchedPhone || attendanceValue === null) {
            setStatus(responseStatus, 'Indica si asistirás al evento.', true);
            return;
        }

        try {
            const { data, error } = await client.rpc('eventin_submit_guest_phone_response', {
                p_event_key: eventKey,
                p_phone: matchedPhone,
                p_will_attend: attendanceValue === 'true',
                p_adults_count: Number(formData.get('adults_count') || 0),
                p_children_count: Number(formData.get('children_count') || 0),
                p_message: String(formData.get('message') || '').trim()
            });
            if (error) {
                throw error;
            }
            await notifyEventUser(data);
            modal.hidden = false;
        } catch (error) {
            setStatus(responseStatus, 'No se pudo guardar la respuesta. Inténtalo de nuevo más tarde.', true);
        }
    });

    changePhoneButton.addEventListener('click', showPhoneLookup);

    (async function init() {
        if (!eventKey || !eventContext) {
            phoneForm.hidden = true;
            notFoundPanel.hidden = false;
            notFoundPanel.querySelector('p').textContent = 'No hemos podido identificar el evento de esta invitación.';
            return;
        }
        try {
            const { event: eventData, settings } = await eventContext.getEvent();
            applyInvitationHeader(eventData);
            applyDetailImage(settings);
            setEventLinks(eventData);
        } catch (error) {
            setText('[data-invitation-title]', 'Evento no encontrado');
        }
    })();
})();
