(function () {
    const client = window.eventSupabase;
    const loginPanel = document.getElementById('guests-login-panel');
    const guestsPanel = document.getElementById('guests-panel');
    const userLabel = document.getElementById('guests-user-label');
    const eventSelect = document.getElementById('guest-event-select');
    const eventSelector = document.getElementById('guest-event-selector');
    const eventTitle = document.getElementById('guest-event-title');
    const guestsListTitle = document.getElementById('guests-list-title');
    const newGuestButton = document.getElementById('new-guest-button');
    const guestFilter = document.getElementById('guest-filter');
    const guestSort = document.getElementById('guest-sort');
    const guestsTable = document.getElementById('guests-table');
    const guestStatus = document.getElementById('guest-status');
    const guestPrevPageButton = document.getElementById('guest-prev-page');
    const guestNextPageButton = document.getElementById('guest-next-page');
    const guestPageStatus = document.getElementById('guest-page-status');
    const formModal = document.getElementById('guest-form-modal');
    const formTitle = document.getElementById('guest-form-title');
    const guestForm = document.getElementById('guest-form');
    const cancelGuestFormButton = document.getElementById('cancel-guest-form');
    const deleteGuestModal = document.getElementById('delete-guest-modal');
    const deleteGuestMessage = document.getElementById('delete-guest-message');
    const cancelDeleteGuestButton = document.getElementById('cancel-delete-guest');
    const confirmDeleteGuestButton = document.getElementById('confirm-delete-guest');
    const backAdminLink = document.getElementById('back-admin-link');
    const backAdminLinkBottom = document.getElementById('back-admin-link-bottom');

    let currentProfile = null;
    let currentEvents = [];
    let currentGuests = [];
    let filteredGuests = [];
    let currentPage = 1;

    const PAGE_SIZE = 10;

    const icons = {
        edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
        mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
        whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20 6.2 16.6A8 8 0 1 1 9 19.3Z"/><path d="M9.5 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.3.1.5-.1.7l-.4.5c.6 1.1 1.4 1.9 2.5 2.5l.5-.4c.2-.2.5-.2.7-.1l1.4.6c.3.1.4.3.4.6v.5c0 .3-.1.5-.4.7-.5.3-1.2.5-1.8.4-3.2-.5-5.7-3-6.2-6.2-.1-.6.1-1.3.4-1.8Z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>'
    };

    function setStatus(message, isError) {
        guestStatus.textContent = message;
        guestStatus.classList.toggle('error', Boolean(isError));
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('es-ES') : '';
    }

    function isAdmin() {
        return currentProfile?.role === 'admin';
    }

    function createInvitationToken() {
        const bytes = new Uint8Array(24);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function getCurrentEvent() {
        return currentEvents.find((item) => item.id === eventSelect.value) || null;
    }

    function getGuestInvitationUrl(guest) {
        const url = new URL('invitacion.html', window.location.href);
        url.searchParams.set('token', guest.invitation_token);
        return url.href;
    }

    function getGuestInvitationMessage(guest) {
        return [
            `Hola ${guest.name}.`,
            '',
            'Nos encantaria compartir contigo un dia muy especial.',
            '',
            'Puedes ver todos los detalles y confirmar tu asistencia aqui:',
            '',
            getGuestInvitationUrl(guest),
            '',
            'Un abrazo.'
        ].join('\n');
    }

    function normalizeWhatsappPhone(value) {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) {
            return '';
        }

        return digits.startsWith('34') ? digits : `34${digits}`;
    }

    function normalizePhoneInput(value) {
        return String(value || '').replace(/[^\d+]/g, '').replace(/^00/, '+');
    }

    async function copyText(value) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
    }

    function renderGuestStatus(value) {
        const labels = {
            pending: 'Pendiente',
            opened: 'Abierta',
            confirmed: 'Confirmada',
            declined: 'Rechazada'
        };
        return labels[value] || value || 'Pendiente';
    }

    function getComparableGuestValue(guest, field) {
        if (field === 'phone') {
            return String(guest.phone || '');
        }

        if (field === 'status') {
            return renderGuestStatus(guest.invitation_status);
        }

        return String(guest.name || '');
    }

    function applyGuestListState(resetPage = false) {
        const filter = String(guestFilter.value || '').trim().toLowerCase();
        const sortKey = guestSort.value || 'name';

        filteredGuests = currentGuests
            .filter((guest) => {
                if (!filter) {
                    return true;
                }

                return String(guest.name || '').toLowerCase().includes(filter)
                    || String(guest.phone || '').toLowerCase().includes(filter);
            })
            .sort((left, right) => (
                getComparableGuestValue(left, sortKey)
                    .localeCompare(getComparableGuestValue(right, sortKey), 'es', { sensitivity: 'base', numeric: true })
            ));

        if (resetPage) {
            currentPage = 1;
        }

        const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);
    }

    function getVisibleGuests() {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredGuests.slice(start, start + PAGE_SIZE);
    }

    function renderPagination() {
        const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE));
        guestPrevPageButton.disabled = currentPage <= 1;
        guestNextPageButton.disabled = currentPage >= totalPages;
        guestPageStatus.textContent = filteredGuests.length
            ? `Pagina ${currentPage} de ${totalPages} - ${filteredGuests.length} invitados`
            : 'Sin invitados';
    }

    function resetGuestForm() {
        guestForm.reset();
        guestForm.elements.guest_id.value = '';
        guestForm.elements.adults_count.value = '1';
        guestForm.elements.children_count.value = '0';
    }

    function openGuestForm(guest = null) {
        resetGuestForm();
        formTitle.textContent = guest ? 'Editar invitado' : 'Nuevo invitado';

        if (guest) {
            guestForm.elements.guest_id.value = guest.id;
            guestForm.elements['name'].value = guest.name || '';
            guestForm.elements.phone.value = guest.phone || '';
            guestForm.elements.email.value = guest.email || '';
            guestForm.elements.adults_count.value = guest.adults_count ?? 1;
            guestForm.elements.children_count.value = guest.children_count ?? 0;
            guestForm.elements.notes.value = guest.notes || '';
        }

        formModal.hidden = false;
        guestForm.elements['name'].focus();
    }

    function closeGuestForm() {
        formModal.hidden = true;
    }

    function confirmDeleteGuest(guestName) {
        deleteGuestMessage.textContent = `Vas a borrar el invitado ${guestName || 'seleccionado'}. Esta accion no se puede deshacer.`;
        deleteGuestModal.hidden = false;

        return new Promise((resolve) => {
            function close(result) {
                deleteGuestModal.hidden = true;
                cancelDeleteGuestButton.removeEventListener('click', onCancel);
                confirmDeleteGuestButton.removeEventListener('click', onConfirm);
                deleteGuestModal.removeEventListener('click', onBackdrop);
                resolve(result);
            }

            function onCancel() {
                close(false);
            }

            function onConfirm() {
                close(true);
            }

            function onBackdrop(event) {
                if (event.target === deleteGuestModal) {
                    close(false);
                }
            }

            cancelDeleteGuestButton.addEventListener('click', onCancel);
            confirmDeleteGuestButton.addEventListener('click', onConfirm);
            deleteGuestModal.addEventListener('click', onBackdrop);
        });
    }

    function updateHeader() {
        const eventData = getCurrentEvent();
        userLabel.textContent = currentProfile?.email ? `Usuario: ${currentProfile.email}` : 'Usuario:';
        eventSelector.hidden = !isAdmin();
        eventTitle.hidden = isAdmin();
        eventTitle.textContent = eventData?.title || 'Evento asignado';
        guestsListTitle.textContent = eventData?.title ? `Invitados: ${eventData.title}` : 'Invitados';
        backAdminLink.href = eventData?.id ? `admin.html?evento=${encodeURIComponent(eventData.public_slug || eventData.event_code || '')}` : 'admin.html';
        backAdminLinkBottom.href = backAdminLink.href;
    }

    function renderGuests() {
        applyGuestListState();
        const visibleGuests = getVisibleGuests();

        if (!filteredGuests.length) {
            guestsTable.innerHTML = '<tr><td colspan="8">No hay invitados.</td></tr>';
            renderPagination();
            return;
        }

        guestsTable.innerHTML = visibleGuests.map((guest) => {
            const phone = normalizeWhatsappPhone(guest.phone);
            const whatsappUrl = phone
                ? `https://wa.me/${phone}?text=${encodeURIComponent(getGuestInvitationMessage(guest))}`
                : '';

            return `
                <tr>
                    <td data-label="Nombre">${escapeHtml(guest.name)}</td>
                    <td data-label="Telefono">${escapeHtml(guest.phone)}</td>
                    <td data-label="Email">${escapeHtml(guest.email)}</td>
                    <td data-label="Adultos">${guest.adults_count ?? 0}</td>
                    <td data-label="Ninos">${guest.children_count ?? 0}</td>
                    <td data-label="Estado">${renderGuestStatus(guest.invitation_status)}</td>
                    <td data-label="Apertura">${formatDate(guest.opened_at)}</td>
                    <td data-label="Acciones" class="table-actions icon-actions">
                        <button type="button" data-action="edit" data-id="${guest.id}" class="icon-button secondary-button" aria-label="Editar invitado" title="Editar invitado">${icons.edit}</button>
                        <button type="button" data-action="copy" data-id="${guest.id}" class="icon-button secondary-button" aria-label="Copiar invitacion" title="Copiar invitacion">${icons.mail}</button>
                        <a class="icon-button whatsapp-button${phone ? '' : ' disabled-link'}" href="${whatsappUrl || '#'}" target="_blank" rel="noopener" aria-disabled="${phone ? 'false' : 'true'}" aria-label="Enviar por WhatsApp" title="Enviar por WhatsApp">${icons.whatsapp}</a>
                        <button type="button" data-action="delete" data-id="${guest.id}" class="icon-button danger-button" aria-label="Borrar invitado" title="Borrar invitado">${icons.trash}</button>
                    </td>
                </tr>
            `;
        }).join('');
        renderPagination();
    }

    async function loadProfile() {
        const { data: userData } = await client.auth.getUser();
        if (!userData.user) {
            return null;
        }

        const { data, error } = await client
            .from('eventin_profiles')
            .select('id,email,display_name,role,event_code')
            .eq('id', userData.user.id)
            .maybeSingle();

        if (error || !data) {
            return null;
        }

        currentProfile = data;
        return data;
    }

    async function loadEvents() {
        const query = client
            .from('eventin_events')
            .select('id,title,event_date,public_slug,event_code')
            .order('created_at', { ascending: true });
        const { data, error } = isAdmin()
            ? await query
            : await query.eq('event_code', currentProfile.event_code || '');

        if (error) {
            eventSelect.innerHTML = '<option>No se pudieron cargar eventos</option>';
            return;
        }

        currentEvents = data || [];
        eventSelect.innerHTML = currentEvents.map((item) => (
            `<option value="${item.id}">${escapeHtml(item.title)} (${escapeHtml(item.event_code)})</option>`
        )).join('');

        const requestedEvent = new URLSearchParams(window.location.search).get('evento');
        const selectedEvent = currentEvents.find((item) => (
            item.id === requestedEvent
            || item.public_slug === requestedEvent
            || item.event_code === requestedEvent
        ));
        if (selectedEvent) {
            eventSelect.value = selectedEvent.id;
        }

        updateHeader();
        await loadGuests();
    }

    async function loadGuests() {
        const eventId = eventSelect.value;
        setStatus('', false);

        if (!eventId) {
            currentGuests = [];
            renderGuests();
            return;
        }

        const { data, error } = await client
            .from('eventin_guests')
            .select('id,event_id,name,phone,email,adults_count,children_count,notes,invitation_token,invitation_status,opened_at,created_at,updated_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error) {
            currentGuests = [];
            guestsTable.innerHTML = '<tr><td colspan="8">No se pudieron cargar invitados.</td></tr>';
            return;
        }

        currentGuests = data || [];
        applyGuestListState(true);
        renderGuests();
    }

    newGuestButton.addEventListener('click', () => openGuestForm());
    cancelGuestFormButton.addEventListener('click', closeGuestForm);
    formModal.addEventListener('click', (event) => {
        if (event.target === formModal) {
            closeGuestForm();
        }
    });

    eventSelect.addEventListener('change', async () => {
        updateHeader();
        await loadGuests();
    });

    guestFilter.addEventListener('input', () => {
        applyGuestListState(true);
        renderGuests();
    });

    guestSort.addEventListener('change', () => {
        applyGuestListState(true);
        renderGuests();
    });

    guestPrevPageButton.addEventListener('click', () => {
        currentPage -= 1;
        renderGuests();
    });

    guestNextPageButton.addEventListener('click', () => {
        currentPage += 1;
        renderGuests();
    });

    guestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const eventId = eventSelect.value;
        const formData = new FormData(guestForm);
        const guestId = String(formData.get('guest_id') || '');
        const payload = {
            event_id: eventId,
            name: String(formData.get('name') || '').trim(),
            phone: normalizePhoneInput(formData.get('phone')),
            email: String(formData.get('email') || '').trim().toLowerCase(),
            adults_count: Number(formData.get('adults_count') || 0),
            children_count: Number(formData.get('children_count') || 0),
            notes: String(formData.get('notes') || '').trim()
        };

        if (!eventId || !payload.name) {
            setStatus('El nombre del invitado es obligatorio.', true);
            return;
        }

        if (!guestId) {
            payload.invitation_token = createInvitationToken();
            payload.invitation_status = 'pending';
        }

        try {
            if (guestId) {
                await client
                    .from('eventin_guests')
                    .update(payload)
                    .eq('id', guestId)
                    .throwOnError();
            } else {
                await client
                    .from('eventin_guests')
                    .insert(payload)
                    .throwOnError();
            }

            closeGuestForm();
            setStatus('Invitado guardado correctamente.', false);
            await loadGuests();
        } catch (error) {
            setStatus('No se pudo guardar el invitado.', true);
        }
    });

    guestsTable.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const guest = currentGuests.find((item) => item.id === button.dataset.id);
        if (!guest) {
            return;
        }

        if (button.dataset.action === 'edit') {
            openGuestForm(guest);
            return;
        }

        if (button.dataset.action === 'copy') {
            try {
                await copyText(getGuestInvitationMessage(guest));
                setStatus('Invitacion copiada al portapapeles.', false);
            } catch (error) {
                setStatus('No se pudo copiar la invitacion.', true);
            }
            return;
        }

        if (button.dataset.action === 'delete') {
            const confirmed = await confirmDeleteGuest(guest.name);
            if (!confirmed) {
                return;
            }

            try {
                await client.from('eventin_guests').delete().eq('id', guest.id).throwOnError();
                setStatus('Invitado borrado.', false);
                await loadGuests();
            } catch (error) {
                setStatus('No se pudo borrar el invitado.', true);
            }
        }
    });

    async function init() {
        if (!client) {
            loginPanel.hidden = false;
            return;
        }

        const { data } = await client.auth.getSession();
        if (!data.session) {
            loginPanel.hidden = false;
            return;
        }

        const profile = await loadProfile();
        if (!profile) {
            loginPanel.hidden = false;
            return;
        }

        guestsPanel.hidden = false;
        await loadEvents();
    }

    init();
})();
