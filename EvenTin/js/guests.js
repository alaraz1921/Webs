(function () {
    const client = window.eventSupabase;
    const loginPanel = document.getElementById('guests-login-panel');
    const loginForm = document.getElementById('guests-login-form');
    const loginStatus = document.getElementById('guests-login-status');
    const guestsPanel = document.getElementById('guests-panel');
    const userLabel = document.getElementById('guests-user-label');
    const eventSelect = document.getElementById('guest-event-select');
    const eventSelector = document.getElementById('guest-event-selector');
    const eventTitle = document.getElementById('guest-event-title');
    const guestsListTitle = document.getElementById('guests-list-title');
    const newGuestButton = document.getElementById('new-guest-button');
    const copyInvitationLinkButton = document.getElementById('copy-invitation-link');
    const guestFilter = document.getElementById('guest-filter');
    const guestSort = document.getElementById('guest-sort');
    const guestsTable = document.getElementById('guests-table');
    const guestStatus = document.getElementById('guest-status');
    const guestPrevPageButton = document.getElementById('guest-prev-page');
    const guestNextPageButton = document.getElementById('guest-next-page');
    const guestPageStatus = document.getElementById('guest-page-status');
    const detailModal = document.getElementById('guest-detail-modal');
    const detailTitle = document.getElementById('guest-detail-title');
    const guestForm = document.getElementById('guest-form');
    const readActions = document.getElementById('guest-read-actions');
    const editActions = document.getElementById('guest-edit-actions');
    const editGuestButton = document.getElementById('edit-guest-button');
    const deleteGuestButton = document.getElementById('delete-guest-button');
    const closeGuestDetailButton = document.getElementById('close-guest-detail');
    const cancelGuestEditButton = document.getElementById('cancel-guest-edit');
    const deleteGuestModal = document.getElementById('delete-guest-modal');
    const deleteGuestMessage = document.getElementById('delete-guest-message');
    const cancelDeleteGuestButton = document.getElementById('cancel-delete-guest');
    const confirmDeleteGuestButton = document.getElementById('confirm-delete-guest');
    const backAdminLink = document.getElementById('back-admin-link');
    const backAdminLinkBottom = document.getElementById('back-admin-link-bottom');

    const PAGE_SIZE = 10;
    const editableNames = ['name', 'phone1', 'phone2', 'phone3', 'phone4', 'adults_count', 'children_count', 'will_attend', 'message'];
    let currentProfile = null;
    let currentEvents = [];
    let currentGuests = [];
    let filteredGuests = [];
    let selectedGuest = null;
    let currentPage = 1;
    let editMode = false;

    function setStatus(message, isError) {
        guestStatus.textContent = message;
        guestStatus.classList.toggle('error', Boolean(isError));
    }

    function setLoginStatus(message, isError) {
        loginStatus.textContent = message;
        loginStatus.classList.toggle('error', Boolean(isError));
    }

    function showLogin() {
        loginPanel.hidden = false;
        guestsPanel.hidden = true;
    }

    function showGuestsPanel() {
        loginPanel.hidden = true;
        guestsPanel.hidden = false;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
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

    function renderGuestStatus(value) {
        return {
            pending: 'Pendiente',
            viewed: 'Vista',
            confirmed: 'Confirmada',
            declined: 'Rechazada'
        }[value] || 'Pendiente';
    }

    function renderAttendance(value) {
        return value === true ? 'Sí' : value === false ? 'No' : 'Sin respuesta';
    }

    function isAdmin() {
        return currentProfile?.role === 'admin';
    }

    function getCurrentEvent() {
        return currentEvents.find((item) => item.id === eventSelect.value) || null;
    }

    function getInvitationUrl() {
        const eventData = getCurrentEvent();
        const key = eventData?.public_slug || eventData?.event_code;
        if (!key) {
            return '';
        }
        const url = new URL('invitacion.html', window.location.href);
        url.searchParams.set('evento', key);
        return url.href;
    }

    async function copyText(value) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
    }

    function updateHeader() {
        const eventData = getCurrentEvent();
        userLabel.textContent = currentProfile?.email ? `Usuario: ${currentProfile.email}` : 'Usuario:';
        eventSelector.hidden = !isAdmin();
        eventTitle.hidden = isAdmin();
        eventTitle.textContent = eventData?.title || 'Evento asignado';
        guestsListTitle.textContent = eventData?.title ? `Invitados: ${eventData.title}` : 'Invitados';
        const adminUrl = eventData ? `admin.html?evento=${encodeURIComponent(eventData.public_slug || eventData.event_code || '')}` : 'admin.html';
        backAdminLink.href = adminUrl;
        backAdminLinkBottom.href = adminUrl;
        copyInvitationLinkButton.disabled = !eventData;
    }

    function comparableValue(guest, field) {
        if (field === 'phone') {
            return guest.phone1 || '';
        }
        if (field === 'status') {
            return renderGuestStatus(guest.invitation_status);
        }
        return guest.name || '';
    }

    function applyListState(resetPage = false) {
        const filter = String(guestFilter.value || '').trim().toLowerCase();
        const sort = guestSort.value || 'name';
        filteredGuests = currentGuests
            .filter((guest) => !filter || [guest.name, guest.phone1, guest.phone2, guest.phone3, guest.phone4]
                .some((value) => String(value || '').toLowerCase().includes(filter)))
            .sort((left, right) => comparableValue(left, sort)
                .localeCompare(comparableValue(right, sort), 'es', { sensitivity: 'base', numeric: true }));
        if (resetPage) {
            currentPage = 1;
        }
        currentPage = Math.min(currentPage, Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE)));
    }

    function renderPagination() {
        const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE));
        guestPrevPageButton.disabled = currentPage <= 1;
        guestNextPageButton.disabled = currentPage >= totalPages;
        guestPageStatus.textContent = filteredGuests.length
            ? `Página ${currentPage} de ${totalPages} · ${filteredGuests.length} invitados`
            : 'Sin invitados';
    }

    function renderGuests() {
        applyListState();
        const start = (currentPage - 1) * PAGE_SIZE;
        const visibleGuests = filteredGuests.slice(start, start + PAGE_SIZE);
        if (!visibleGuests.length) {
            guestsTable.innerHTML = '<tr><td colspan="7">No hay invitados.</td></tr>';
            renderPagination();
            return;
        }
        guestsTable.innerHTML = visibleGuests.map((guest) => `
            <tr data-guest-id="${guest.id}" tabindex="0" aria-label="Ver datos de ${escapeHtml(guest.name)}">
                <td data-label="Nombre">${escapeHtml(guest.name)}</td>
                <td data-label="Teléfono principal">${escapeHtml(guest.phone1)}</td>
                <td data-label="Teléfono 2">${escapeHtml(guest.phone2)}</td>
                <td data-label="Adultos">${guest.adults_count ?? 0}</td>
                <td data-label="Niños">${guest.children_count ?? 0}</td>
                <td data-label="Asistirá">${renderAttendance(guest.will_attend)}</td>
                <td data-label="Estado"><span class="guest-status-pill status-${guest.invitation_status || 'pending'}">${renderGuestStatus(guest.invitation_status)}</span></td>
            </tr>
        `).join('');
        renderPagination();
    }

    function fillGuestForm(guest) {
        guestForm.reset();
        guestForm.elements.guest_id.value = guest?.id || '';
        guestForm.elements.name.value = guest?.name || '';
        ['phone1', 'phone2', 'phone3', 'phone4'].forEach((name) => {
            guestForm.elements[name].value = guest?.[name] || '';
        });
        guestForm.elements.adults_count.value = guest?.adults_count ?? 1;
        guestForm.elements.children_count.value = guest?.children_count ?? 0;
        guestForm.elements.will_attend.value = guest?.will_attend === true ? 'true' : guest?.will_attend === false ? 'false' : '';
        guestForm.elements.message.value = guest?.message || '';
        guestForm.elements.status_label.value = renderGuestStatus(guest?.invitation_status);
    }

    function setEditMode(enabled) {
        editMode = enabled;
        editableNames.forEach((name) => {
            guestForm.elements[name].disabled = !enabled;
        });
        readActions.hidden = enabled;
        editActions.hidden = !enabled;
    }

    function openGuestModal(guest = null, editing = false) {
        selectedGuest = guest;
        fillGuestForm(guest);
        detailTitle.textContent = guest ? guest.name : 'Nuevo invitado';
        deleteGuestButton.hidden = !guest;
        setEditMode(editing);
        detailModal.hidden = false;
        if (editing) {
            guestForm.elements.name.focus();
        }
    }

    function closeGuestModal() {
        detailModal.hidden = true;
        selectedGuest = null;
        editMode = false;
    }

    function confirmDeleteGuest(guestName) {
        deleteGuestMessage.textContent = `Vas a borrar el invitado ${guestName}. Esta acción no se puede deshacer.`;
        deleteGuestModal.hidden = false;
        return new Promise((resolve) => {
            function close(result) {
                deleteGuestModal.hidden = true;
                cancelDeleteGuestButton.removeEventListener('click', cancel);
                confirmDeleteGuestButton.removeEventListener('click', confirm);
                resolve(result);
            }
            function cancel() { close(false); }
            function confirm() { close(true); }
            cancelDeleteGuestButton.addEventListener('click', cancel);
            confirmDeleteGuestButton.addEventListener('click', confirm);
        });
    }

    async function loadProfile() {
        const { data: userData } = await client.auth.getUser();
        if (!userData.user) {
            return null;
        }
        const { data, error } = await client.from('eventin_profiles')
            .select('id,email,display_name,role,event_code')
            .eq('id', userData.user.id)
            .maybeSingle();
        currentProfile = error ? null : data;
        return currentProfile;
    }

    async function loadEvents() {
        const baseQuery = client.from('eventin_events')
            .select('id,title,event_date,public_slug,event_code')
            .order('created_at', { ascending: true });
        const { data, error } = isAdmin() ? await baseQuery : await baseQuery.eq('event_code', currentProfile.event_code || '');
        if (error) {
            setStatus('No se pudieron cargar los eventos.', true);
            return;
        }
        currentEvents = data || [];
        eventSelect.innerHTML = currentEvents.map((item) => (
            `<option value="${item.id}">${escapeHtml(item.title)} (${escapeHtml(item.event_code)})</option>`
        )).join('');
        const requested = new URLSearchParams(window.location.search).get('evento');
        const selected = currentEvents.find((item) => [item.id, item.public_slug, item.event_code].includes(requested));
        if (selected) {
            eventSelect.value = selected.id;
        }
        updateHeader();
        await loadGuests();
    }

    async function loadGuests() {
        setStatus('', false);
        if (!eventSelect.value) {
            currentGuests = [];
            renderGuests();
            return;
        }
        const { data, error } = await client.from('eventin_guests')
            .select('id,event_id,name,phone1,phone2,phone3,phone4,adults_count,children_count,will_attend,message,invitation_status,viewed_at,responded_at,created_at,updated_at')
            .eq('event_id', eventSelect.value)
            .order('created_at', { ascending: false });
        if (error) {
            setStatus('No se pudieron cargar los invitados. Comprueba que has actualizado schema.sql.', true);
            currentGuests = [];
        } else {
            currentGuests = data || [];
        }
        applyListState(true);
        renderGuests();
    }

    async function deleteSelectedGuest() {
        if (!selectedGuest || !(await confirmDeleteGuest(selectedGuest.name))) {
            return;
        }
        try {
            await client.from('eventin_guests').delete().eq('id', selectedGuest.id).throwOnError();
            closeGuestModal();
            setStatus('Invitado eliminado.', false);
            await loadGuests();
        } catch (error) {
            setStatus('No se pudo eliminar el invitado.', true);
        }
    }

    guestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!editMode || !eventSelect.value) {
            return;
        }
        const formData = new FormData(guestForm);
        const attendance = String(formData.get('will_attend') || '');
        const payload = {
            event_id: eventSelect.value,
            name: String(formData.get('name') || '').trim(),
            phone1: normalizePhone(formData.get('phone1')),
            phone2: normalizePhone(formData.get('phone2')),
            phone3: normalizePhone(formData.get('phone3')),
            phone4: normalizePhone(formData.get('phone4')),
            adults_count: Number(formData.get('adults_count') || 0),
            children_count: Number(formData.get('children_count') || 0),
            will_attend: attendance === '' ? null : attendance === 'true',
            message: String(formData.get('message') || '').trim() || null
        };
        if (!payload.name) {
            setStatus('El nombre es obligatorio.', true);
            return;
        }
        if (!payload.phone1 && !payload.phone2 && !payload.phone3 && !payload.phone4) {
            setStatus('Añade al menos un teléfono para que el invitado pueda acceder.', true);
            return;
        }
        payload.invitation_status = payload.will_attend === true
            ? 'confirmed'
            : payload.will_attend === false
                ? 'declined'
                : selectedGuest?.viewed_at
                    ? 'viewed'
                    : 'pending';
        payload.responded_at = attendance === '' ? null : new Date().toISOString();
        try {
            if (selectedGuest) {
                await client.from('eventin_guests').update(payload).eq('id', selectedGuest.id).throwOnError();
            } else {
                await client.from('eventin_guests').insert(payload).throwOnError();
            }
            closeGuestModal();
            setStatus('Invitado guardado correctamente.', false);
            await loadGuests();
        } catch (error) {
            const duplicate = String(error?.message || '').toLowerCase().includes('telefono');
            setStatus(duplicate ? 'Ese teléfono ya está asignado a otro invitado de este evento.' : 'No se pudo guardar el invitado.', true);
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoginStatus('', false);
        const formData = new FormData(loginForm);
        const { error } = await client.auth.signInWithPassword({
            email: String(formData.get('email')).trim().toLowerCase(),
            password: String(formData.get('password'))
        });
        if (error || !(await loadProfile())) {
            setLoginStatus('Acceso no válido.', true);
            return;
        }
        showGuestsPanel();
        await loadEvents();
    });

    newGuestButton.addEventListener('click', () => openGuestModal(null, true));
    copyInvitationLinkButton.addEventListener('click', async () => {
        try {
            await copyText(getInvitationUrl());
            setStatus('Enlace general de invitación copiado.', false);
        } catch (error) {
            setStatus('No se pudo copiar el enlace.', true);
        }
    });
    eventSelect.addEventListener('change', async () => {
        updateHeader();
        await loadGuests();
    });
    guestFilter.addEventListener('input', () => {
        applyListState(true);
        renderGuests();
    });
    guestSort.addEventListener('change', () => {
        applyListState(true);
        renderGuests();
    });
    guestPrevPageButton.addEventListener('click', () => { currentPage -= 1; renderGuests(); });
    guestNextPageButton.addEventListener('click', () => { currentPage += 1; renderGuests(); });
    guestsTable.addEventListener('click', (event) => {
        const row = event.target.closest('[data-guest-id]');
        const guest = currentGuests.find((item) => item.id === row?.dataset.guestId);
        if (guest) {
            openGuestModal(guest, false);
        }
    });
    guestsTable.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.target.click();
        }
    });
    editGuestButton.addEventListener('click', () => setEditMode(true));
    deleteGuestButton.addEventListener('click', deleteSelectedGuest);
    closeGuestDetailButton.addEventListener('click', closeGuestModal);
    cancelGuestEditButton.addEventListener('click', () => {
        if (!selectedGuest) {
            closeGuestModal();
            return;
        }
        fillGuestForm(selectedGuest);
        setEditMode(false);
    });
    detailModal.addEventListener('click', (event) => {
        if (event.target === detailModal) {
            closeGuestModal();
        }
    });

    (async function init() {
        if (!client) {
            showLogin();
            return;
        }
        const { data } = await client.auth.getSession();
        if (!data.session || !(await loadProfile())) {
            showLogin();
            return;
        }
        showGuestsPanel();
        await loadEvents();
    })();
})();
