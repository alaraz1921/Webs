(function () {
    const client = window.eventSupabase;
    const config = window.eventPlatformConfig;
    const loginPanel = document.getElementById('login-panel');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('admin-login-form');
    const loginStatus = document.getElementById('admin-login-status');
    const logoutButton = document.getElementById('logout-button');
    const adminRoleLabel = document.getElementById('admin-role-label');
    const adminMenu = document.getElementById('admin-menu');
    const showEventsViewButton = document.getElementById('show-events-view');
    const showUsersViewButton = document.getElementById('show-users-view');
    const eventsView = document.getElementById('events-view');
    const usersView = document.getElementById('users-view');
    const eventSelect = document.getElementById('event-select');
    const adminEventLink = document.getElementById('admin-event-link');
    const adminEventsPanel = document.getElementById('admin-events-panel');
    const eventAdminStatus = document.getElementById('event-admin-status');
    const createEventForm = document.getElementById('create-event-form');
    const createEventType = document.getElementById('create-event-type');
    const deleteEventButton = document.getElementById('delete-event-button');
    const settingsForm = document.getElementById('event-settings-form');
    const settingsEventType = document.getElementById('settings-event-type');
    const settingsStatus = document.getElementById('event-settings-status');
    const publicLink = document.getElementById('public-link');
    const responsesTable = document.getElementById('responses-table');
    const messagesList = document.getElementById('messages-list');
    const userForm = document.getElementById('user-form');
    const clearUserFormButton = document.getElementById('clear-user-form');
    const userStatus = document.getElementById('user-status');
    const usersTable = document.getElementById('users-table');
    const loginEventLink = document.getElementById('login-event-link');
    const showEventCodePanelButton = document.getElementById('show-event-code-panel');
    const eventCodePanel = document.getElementById('event-code-panel');
    const eventCodeStatus = document.getElementById('event-code-status');

    let currentProfile = null;
    let currentEvents = [];
    let currentEventTypes = [];
    let currentUsers = [];

    function setStatus(element, message, isError) {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    function setLoginStatus(message, isError) {
        setStatus(loginStatus, message, isError);
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

    function isEventUser() {
        return currentProfile?.role === 'user';
    }

    function normalizeCode(value) {
        return String(value || '').replace(/\D/g, '').slice(0, 6);
    }

    function validateCode(value) {
        return /^\d{6}$/.test(String(value || ''));
    }

    function toInputDateTime(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 16);
    }

    function createSlug(title) {
        const cleanTitle = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const randomPart = Math.random().toString(36).slice(2, 7);

        return `${cleanTitle || 'evento'}-${randomPart}`;
    }

    function createEventCode() {
        return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    }

    function getPublicEventUrl(eventData) {
        const eventKey = eventData?.public_slug || eventData?.event_code || config.defaultEventSlug;
        return new URL(`evento.html?evento=${encodeURIComponent(eventKey)}`, window.location.href).href;
    }

    function getCurrentEvent() {
        return currentEvents.find((item) => item.id === eventSelect.value) || null;
    }

    function createSignupClient() {
        return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: `eventin-user-create-${Date.now()}`
            }
        });
    }

    function fillTypeSelect(selectElement, selectedValue) {
        if (!selectElement) {
            return;
        }

        selectElement.innerHTML = currentEventTypes.map((item) => (
            `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)}</option>`
        )).join('');
        selectElement.value = selectedValue || currentEventTypes[0]?.key || 'communion';
    }

    function showView(viewName) {
        const usersAllowed = isAdmin();
        eventsView.hidden = viewName !== 'events';
        usersView.hidden = viewName !== 'users' || !usersAllowed;
        showEventsViewButton.classList.toggle('active', viewName === 'events');
        showUsersViewButton.classList.toggle('active', viewName === 'users');

        if (viewName === 'users' && usersAllowed) {
            loadUsers();
        }
    }

    function showLogin() {
        loginPanel.hidden = false;
        adminPanel.hidden = true;
        adminEventsPanel.hidden = true;
        adminMenu.hidden = true;
    }

    async function showAdmin() {
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await loadProfile();
        await loadEventTypes();
        await loadEvents();
        adminMenu.hidden = !isAdmin();
        adminEventsPanel.hidden = !isAdmin();
        adminRoleLabel.textContent = isAdmin() ? 'Administrador' : 'Usuario de evento';
        showView('events');
    }

    async function loadProfile() {
        const { data: userData } = await client.auth.getUser();

        if (!userData.user) {
            currentProfile = null;
            return;
        }

        const { data, error } = await client
            .from('eventin_profiles')
            .select('id,email,display_name,role,event_code')
            .eq('id', userData.user.id)
            .maybeSingle();

        if (error || !data) {
            currentProfile = null;
            throw new Error('Perfil no configurado');
        }

        currentProfile = data;
    }

    async function loadEventTypes() {
        const { data, error } = await client
            .from('eventin_event_types')
            .select('key,name')
            .order('name', { ascending: true });

        currentEventTypes = error || !data?.length
            ? [{ key: 'communion', name: 'Comunion' }]
            : data;

        fillTypeSelect(createEventType);
        fillTypeSelect(settingsEventType);
    }

    async function loadEvents() {
        const query = client
            .from('eventin_events')
            .select('id,title,event_date,public_slug,event_code,event_type,location_name,maps_url')
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

        settingsForm.hidden = currentEvents.length === 0;
        adminEventLink.hidden = currentEvents.length === 0;

        if (currentEvents.length > 0) {
            await loadEventData(currentEvents[0].id);
        } else {
            responsesTable.innerHTML = '<tr><td colspan="7">No hay eventos disponibles.</td></tr>';
            messagesList.innerHTML = '<p>No hay eventos disponibles.</p>';
            settingsForm.reset();
            publicLink.textContent = isEventUser()
                ? 'No hay ningun evento con el codigo asignado a tu usuario.'
                : 'Todavia no hay eventos creados.';
        }
    }

    async function loadEventData(eventId) {
        await Promise.all([
            loadEventSettings(eventId),
            loadResponses(eventId),
            loadMessages(eventId)
        ]);
    }

    async function loadEventSettings(eventId) {
        const eventData = currentEvents.find((item) => item.id === eventId);
        const { data: settings } = await client
            .from('eventin_event_settings')
            .select('subtitle,display_date,display_time,presentation_title,presentation_text,hero_image_url,detail_image_url,palette_key')
            .eq('event_id', eventId)
            .maybeSingle();

        settingsForm.elements.title.value = eventData?.title || '';
        settingsForm.elements.event_code.value = eventData?.event_code || '';
        settingsForm.elements.event_code.readOnly = true;
        settingsForm.elements.event_date.value = toInputDateTime(eventData?.event_date);
        settingsForm.elements.location_name.value = eventData?.location_name || '';
        settingsForm.elements.maps_url.value = eventData?.maps_url || '';
        settingsForm.elements.subtitle.value = settings?.subtitle || '';
        settingsForm.elements.display_date.value = settings?.display_date || '';
        settingsForm.elements.display_time.value = settings?.display_time || '';
        settingsForm.elements.presentation_title.value = settings?.presentation_title || '';
        settingsForm.elements.presentation_text.value = settings?.presentation_text || '';
        settingsForm.elements.hero_image_url.value = settings?.hero_image_url || '';
        settingsForm.elements.detail_image_url.value = settings?.detail_image_url || '';
        settingsForm.elements.palette_key.value = settings?.palette_key || 'earth';
        fillTypeSelect(settingsEventType, eventData?.event_type || 'communion');

        if (eventData) {
            const publicUrl = getPublicEventUrl(eventData);
            adminEventLink.href = publicUrl;
            publicLink.innerHTML = `Enlace publico: <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">${escapeHtml(publicUrl)}</a> · Codigo: ${escapeHtml(eventData.event_code)}`;
        } else {
            publicLink.textContent = 'Este evento todavia no tiene enlace publico.';
        }
        setStatus(settingsStatus, '', false);
    }

    async function loadResponses(eventId) {
        const { data, error } = await client
            .from('eventin_guest_responses')
            .select('id,nombre,telefono,asistencia,mensaje,created_at,updated_at')
            .eq('event_id', eventId)
            .order('updated_at', { ascending: false });

        if (error || !data?.length) {
            responsesTable.innerHTML = '<tr><td colspan="7">Sin respuestas recibidas.</td></tr>';
            return;
        }

        responsesTable.innerHTML = data.map((row) => `
            <tr>
                <td>${escapeHtml(row.nombre)}</td>
                <td>${escapeHtml(row.telefono)}</td>
                <td>${row.asistencia ? 'Si' : 'No'}</td>
                <td>${escapeHtml(row.mensaje)}</td>
                <td>${formatDate(row.created_at)}</td>
                <td>${formatDate(row.updated_at)}</td>
                <td class="table-actions">
                    <button type="button" data-action="edit-response" data-id="${row.id}" class="secondary-button">Editar</button>
                    <button type="button" data-action="delete-response" data-id="${row.id}" class="danger-button">Borrar</button>
                </td>
            </tr>
        `).join('');
    }

    async function loadMessages(eventId) {
        const { data, error } = await client
            .from('eventin_public_messages')
            .select('id,author_name,message,created_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error || !data?.length) {
            messagesList.innerHTML = '<p>Sin mensajes publicos.</p>';
            return;
        }

        messagesList.innerHTML = data.map((row) => `
            <article class="message-item">
                <strong>${escapeHtml(row.author_name)}</strong>
                <p>${escapeHtml(row.message)}</p>
                <time>${formatDate(row.created_at)}</time>
                <div class="table-actions">
                    <button type="button" data-action="edit-message" data-id="${row.id}" class="secondary-button">Editar</button>
                    <button type="button" data-action="delete-message" data-id="${row.id}" class="danger-button">Borrar</button>
                </div>
            </article>
        `).join('');
    }

    async function loadUsers() {
        if (!isAdmin()) {
            return;
        }

        const [{ data: profiles, error }, { data: events }] = await Promise.all([
            client
                .from('eventin_profiles')
                .select('id,email,display_name,role,event_code,created_at')
                .eq('role', 'user')
                .order('created_at', { ascending: false }),
            client
                .from('eventin_events')
                .select('title,event_code')
        ]);

        if (error) {
            usersTable.innerHTML = '<tr><td colspan="5">No se pudieron cargar usuarios.</td></tr>';
            return;
        }

        currentUsers = profiles || [];
        const eventsByCode = new Map((events || []).map((item) => [item.event_code, item.title]));

        usersTable.innerHTML = currentUsers.length
            ? currentUsers.map((profile) => `
                <tr>
                    <td>${escapeHtml(profile.display_name)}</td>
                    <td>${escapeHtml(profile.email)}</td>
                    <td>${escapeHtml(profile.event_code)}</td>
                    <td>${escapeHtml(eventsByCode.get(profile.event_code) || 'Sin evento asociado')}</td>
                    <td class="table-actions">
                        <button type="button" data-action="edit-user" data-id="${profile.id}" class="secondary-button">Editar</button>
                        <button type="button" data-action="delete-user" data-id="${profile.id}" class="danger-button">Borrar</button>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="5">No hay usuarios de evento.</td></tr>';
    }

    function resetUserForm() {
        userForm.reset();
        userForm.elements.profile_id.value = '';
        userForm.elements.email.readOnly = false;
        userForm.elements.password.required = true;
        setStatus(userStatus, '', false);
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoginStatus('', false);

        if (!client) {
            setLoginStatus('No se pudo conectar con Supabase.', true);
            return;
        }

        try {
            const formData = new FormData(loginForm);
            const { error } = await client.auth.signInWithPassword({
                email: String(formData.get('email')).trim().toLowerCase(),
                password: String(formData.get('password'))
            });

            if (error) {
                setLoginStatus('Acceso no valido', true);
                return;
            }

            await showAdmin();
        } catch (error) {
            setLoginStatus('El usuario no tiene perfil de administracion configurado.', true);
            await client.auth.signOut();
        }
    });

    showEventCodePanelButton.addEventListener('click', () => {
        eventCodePanel.hidden = !eventCodePanel.hidden;
    });

    eventCodePanel.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(eventCodePanel);
        const eventCode = normalizeCode(formData.get('event_code'));
        if (!validateCode(eventCode)) {
            setStatus(eventCodeStatus, 'Introduce un codigo de 6 digitos.', true);
            return;
        }

        window.location.href = `evento.html?evento=${encodeURIComponent(eventCode)}`;
    });

    showEventsViewButton.addEventListener('click', () => showView('events'));
    showUsersViewButton.addEventListener('click', () => showView('users'));

    eventSelect.addEventListener('change', () => {
        loadEventData(eventSelect.value);
    });

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(settingsStatus, '', false);

        const eventId = eventSelect.value;
        const formData = new FormData(settingsForm);
        if (!eventId) {
            setStatus(settingsStatus, 'No hay evento seleccionado.', true);
            return;
        }


        try {
            const eventPayload = {
                title: String(formData.get('title') || '').trim(),
                event_type: String(formData.get('event_type') || 'communion'),
                event_date: new Date(String(formData.get('event_date'))).toISOString(),
                location_name: String(formData.get('location_name') || '').trim(),
                maps_url: String(formData.get('maps_url') || '').trim()
            };


            await client
                .from('eventin_events')
                .update(eventPayload)
                .eq('id', eventId)
                .throwOnError();

            await client
                .from('eventin_event_settings')
                .upsert({
                    event_id: eventId,
                    subtitle: String(formData.get('subtitle') || '').trim(),
                    display_date: String(formData.get('display_date') || '').trim(),
                    display_time: String(formData.get('display_time') || '').trim(),
                    presentation_title: String(formData.get('presentation_title') || '').trim(),
                    presentation_text: String(formData.get('presentation_text') || '').trim(),
                    hero_image_url: String(formData.get('hero_image_url') || '').trim(),
                    detail_image_url: String(formData.get('detail_image_url') || '').trim(),
                    palette_key: String(formData.get('palette_key') || 'earth')
                }, { onConflict: 'event_id' })
                .throwOnError();

            setStatus(settingsStatus, 'Cambios guardados', false);
            await loadEvents();
            eventSelect.value = eventId;
            await loadEventData(eventId);
        } catch (error) {
            setStatus(settingsStatus, 'No se pudieron guardar los cambios.', true);
        }
    });

    createEventForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(eventAdminStatus, '', false);

        if (!isAdmin()) {
            setStatus(eventAdminStatus, 'Solo el administrador puede crear eventos.', true);
            return;
        }

        const formData = new FormData(createEventForm);
        const title = String(formData.get('title')).trim();
        const eventDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const { data: newEvent } = await client
                .from('eventin_events')
                .insert({
                    title,
                    public_slug: createSlug(title),
                    event_code: createEventCode(),
                    event_type: String(formData.get('event_type')),
                    event_date: eventDate,
                    location_name: 'Por confirmar',
                    maps_url: 'https://www.google.com/maps'
                })
                .select('id')
                .single()
                .throwOnError();

            await client
                .from('eventin_event_settings')
                .insert({
                    event_id: newEvent.id,
                    subtitle: '',
                    display_date: '',
                    display_time: '',
                    presentation_title: '',
                    presentation_text: '',
                    palette_key: 'earth'
                })
                .throwOnError();

            createEventForm.reset();
            fillTypeSelect(createEventType);
            setStatus(eventAdminStatus, 'Evento creado correctamente', false);
            await loadEvents();
            eventSelect.value = newEvent.id;
            await loadEventData(newEvent.id);
        } catch (error) {
            setStatus(eventAdminStatus, 'No se pudo crear el evento.', true);
        }
    });

    deleteEventButton.addEventListener('click', async () => {
        const eventId = eventSelect.value;
        const eventData = getCurrentEvent();

        if (!isAdmin() || !eventId) {
            setStatus(eventAdminStatus, 'Solo el administrador puede borrar eventos.', true);
            return;
        }

        if (!window.confirm(`Borrar "${eventData?.title || 'este evento'}"?`)) {
            return;
        }

        try {
            await client
                .from('eventin_events')
                .delete()
                .eq('id', eventId)
                .throwOnError();

            setStatus(eventAdminStatus, 'Evento borrado', false);
            await loadEvents();
        } catch (error) {
            setStatus(eventAdminStatus, 'No se pudo borrar el evento.', true);
        }
    });

    responsesTable.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const id = button.dataset.id;
        const eventId = eventSelect.value;

        try {
            if (action === 'delete-response') {
                if (!window.confirm('Borrar esta respuesta?')) {
                    return;
                }

                await client.from('eventin_guest_responses').delete().eq('id', id).throwOnError();
            }

            if (action === 'edit-response') {
                const message = window.prompt('Nuevo mensaje de la respuesta');
                if (message === null) {
                    return;
                }

                const asistencia = window.confirm('Aceptar para marcar asistencia como Si. Cancelar para marcar No.');
                await client
                    .from('eventin_guest_responses')
                    .update({ mensaje: message.trim(), asistencia })
                    .eq('id', id)
                    .throwOnError();
            }

            await loadResponses(eventId);
        } catch (error) {
            setStatus(settingsStatus, 'No se pudo actualizar la respuesta.', true);
        }
    });

    messagesList.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const id = button.dataset.id;
        const eventId = eventSelect.value;

        try {
            if (action === 'delete-message') {
                if (!window.confirm('Borrar este mensaje?')) {
                    return;
                }

                await client.from('eventin_public_messages').delete().eq('id', id).throwOnError();
            }

            if (action === 'edit-message') {
                const message = window.prompt('Nuevo texto del mensaje');
                if (message === null || !message.trim()) {
                    return;
                }

                await client
                    .from('eventin_public_messages')
                    .update({ message: message.trim() })
                    .eq('id', id)
                    .throwOnError();
            }

            await loadMessages(eventId);
        } catch (error) {
            setStatus(settingsStatus, 'No se pudo actualizar el mensaje.', true);
        }
    });

    userForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(userStatus, '', false);

        if (!isAdmin()) {
            setStatus(userStatus, 'Solo el administrador puede gestionar usuarios.', true);
            return;
        }

        const formData = new FormData(userForm);
        const profileId = String(formData.get('profile_id') || '');
        const displayName = String(formData.get('display_name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const password = String(formData.get('password') || '');
        const eventCode = normalizeCode(formData.get('event_code'));
        if (!validateCode(eventCode)) {
            setStatus(userStatus, 'El codigo numerico debe tener 6 digitos.', true);
            return;
        }

        try {
            const { data: eventData } = await client
                .from('eventin_events')
                .select('id')
                .eq('event_code', eventCode)
                .maybeSingle()
                .throwOnError();

            if (!eventData) {
                setStatus(userStatus, 'No existe ningun evento con ese codigo.', true);
                return;
            }

            let userId = profileId;

            if (!userId) {
                if (!password) {
                    setStatus(userStatus, 'La contrasena es obligatoria al crear un usuario.', true);
                    return;
                }

                const signupClient = createSignupClient();
                const { data: signupData, error: signupError } = await signupClient.auth.signUp({
                    email,
                    password,
                    options: { data: { display_name: displayName } }
                });

                if (signupError || !signupData.user) {
                    setStatus(userStatus, 'No se pudo crear el usuario Auth. Revisa que las altas esten permitidas en Supabase.', true);
                    return;
                }

                userId = signupData.user.id;
            }

            await client
                .from('eventin_profiles')
                .upsert({
                    id: userId,
                    email,
                    display_name: displayName,
                    role: 'user',
                    event_code: eventCode
                }, { onConflict: 'id' })
                .throwOnError();

            resetUserForm();
            setStatus(userStatus, 'Usuario guardado', false);
            await loadUsers();
        } catch (error) {
            setStatus(userStatus, 'No se pudo guardar el usuario.', true);
        }
    });

    clearUserFormButton.addEventListener('click', resetUserForm);

    usersTable.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const id = button.dataset.id;
        const profile = currentUsers.find((item) => item.id === id);

        if (!profile) {
            return;
        }

        if (action === 'edit-user') {
            userForm.elements.profile_id.value = profile.id;
            userForm.elements.display_name.value = profile.display_name || '';
            userForm.elements.email.value = profile.email || '';
            userForm.elements.email.readOnly = true;
            userForm.elements.password.value = '';
            userForm.elements.password.required = false;
            userForm.elements.event_code.value = profile.event_code || '';
            setStatus(userStatus, 'Editando usuario. La contrasena no se modifica desde este panel.', false);
        }

        if (action === 'delete-user') {
            if (!window.confirm(`Borrar el perfil de ${profile.email}? El usuario Auth se debe borrar desde Supabase si quieres eliminar el acceso por completo.`)) {
                return;
            }

            try {
                await client
                    .from('eventin_profiles')
                    .delete()
                    .eq('id', profile.id)
                    .throwOnError();

                resetUserForm();
                setStatus(userStatus, 'Perfil borrado', false);
                await loadUsers();
            } catch (error) {
                setStatus(userStatus, 'No se pudo borrar el perfil.', true);
            }
        }
    });

    logoutButton.addEventListener('click', async () => {
        await client.auth.signOut();
        showLogin();
    });

    async function init() {
        if (!client) {
            setLoginStatus('No se pudo conectar con Supabase.', true);
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const eventKey = params.get('evento');
        if (eventKey) {
            loginEventLink.href = `evento.html?evento=${encodeURIComponent(eventKey)}`;
        }

        const { data } = await client.auth.getSession();
        if (data.session) {
            try {
                await showAdmin();
            } catch (error) {
                setLoginStatus('El usuario no tiene perfil de administracion configurado.', true);
                await client.auth.signOut();
                showLogin();
            }
        }
    }

    init();
})();
