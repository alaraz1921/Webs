(function () {
    const client = window.eventSupabase;
    const loginPanel = document.getElementById('login-panel');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('admin-login-form');
    const loginStatus = document.getElementById('admin-login-status');
    const eventSelect = document.getElementById('event-select');
    const responsesTable = document.getElementById('responses-table');
    const messagesList = document.getElementById('messages-list');
    const logoutButton = document.getElementById('logout-button');
    const superadminPanel = document.getElementById('superadmin-panel');
    const superadminStatus = document.getElementById('superadmin-status');
    const createEventForm = document.getElementById('create-event-form');
    const createEventType = document.getElementById('create-event-type');
    const deleteEventButton = document.getElementById('delete-event-button');
    const settingsForm = document.getElementById('event-settings-form');
    const settingsStatus = document.getElementById('event-settings-status');
    const publicLink = document.getElementById('public-link');
    let currentProfile = null;
    let currentEvents = [];

    function setStatus(element, message, isError) {
        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    function setLoginStatus(message, isError) {
        setStatus(loginStatus, message, isError);
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString('es-ES') : '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function isSuperadmin() {
        return currentProfile?.role === 'superadmin';
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

    function getPublicEventUrl(slug) {
        return new URL(`index.html?evento=${encodeURIComponent(slug)}`, window.location.href).href;
    }

    async function showAdmin() {
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await loadProfile();
        await loadEventTypes();
        await loadEvents();
    }

    function showLogin() {
        loginPanel.hidden = false;
        adminPanel.hidden = true;
        superadminPanel.hidden = true;
    }

    async function loadProfile() {
        const { data: userData } = await client.auth.getUser();

        if (!userData.user) {
            currentProfile = null;
            return;
        }

        const { data } = await client
            .from('eventin_profiles')
            .select('id,email,display_name,role')
            .eq('id', userData.user.id)
            .maybeSingle();

        currentProfile = data || { id: userData.user.id, role: 'admin' };
        superadminPanel.hidden = !isSuperadmin();
    }

    async function loadEventTypes() {
        const { data, error } = await client
            .from('eventin_event_types')
            .select('key,name')
            .order('name', { ascending: true });

        if (error || !data?.length) {
            createEventType.innerHTML = '<option value="communion">Comunion</option>';
            return;
        }

        createEventType.innerHTML = data.map((item) => (
            `<option value="${escapeHtml(item.key)}">${escapeHtml(item.name)}</option>`
        )).join('');
    }

    async function loadEvents() {
        const { data, error } = isSuperadmin()
            ? await client
                .from('eventin_events')
                .select('id,title,event_date,public_slug,event_code,event_type,location_name,maps_url')
                .order('created_at', { ascending: true })
            : await client
                .from('eventin_event_admins')
                .select('event:eventin_events(id,title,event_date,public_slug,event_code,event_type,location_name,maps_url)')
                .order('created_at', { ascending: true });

        if (error) {
            eventSelect.innerHTML = '<option>No se pudieron cargar eventos</option>';
            return;
        }

        currentEvents = isSuperadmin()
            ? data
            : data.map((item) => item.event).filter(Boolean);

        eventSelect.innerHTML = currentEvents.map((item) => (
            `<option value="${item.id}">${escapeHtml(item.title)}</option>`
        )).join('');

        if (currentEvents.length > 0) {
            await loadEventData(currentEvents[0].id);
        } else {
            responsesTable.innerHTML = '<tr><td colspan="6">No tienes eventos asignados.</td></tr>';
            messagesList.innerHTML = '<p>No tienes eventos asignados.</p>';
            settingsForm.reset();
            publicLink.textContent = '';
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

        if (eventData?.public_slug) {
            const publicUrl = getPublicEventUrl(eventData.public_slug);
            const eventCode = eventData.event_code ? ` · Codigo: ${escapeHtml(eventData.event_code)}` : '';
            publicLink.innerHTML = `Enlace publico: <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">${escapeHtml(publicUrl)}</a>${eventCode}`;
        } else {
            publicLink.textContent = 'Este evento todavia no tiene enlace publico.';
        }
        setStatus(settingsStatus, '', false);
    }

    async function loadResponses(eventId) {
        const { data, error } = await client
            .from('eventin_guest_responses')
            .select('nombre,telefono,asistencia,mensaje,created_at,updated_at')
            .eq('event_id', eventId)
            .order('updated_at', { ascending: false });

        if (error || !data.length) {
            responsesTable.innerHTML = '<tr><td colspan="6">Sin respuestas recibidas.</td></tr>';
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
            </tr>
        `).join('');
    }

    async function loadMessages(eventId) {
        const { data, error } = await client
            .from('eventin_public_messages')
            .select('author_name,message,created_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error || !data.length) {
            messagesList.innerHTML = '<p>Sin mensajes publicos.</p>';
            return;
        }

        messagesList.innerHTML = data.map((row) => `
            <article class="message-item">
                <strong>${escapeHtml(row.author_name)}</strong>
                <p>${escapeHtml(row.message)}</p>
                <time>${formatDate(row.created_at)}</time>
            </article>
        `).join('');
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoginStatus('', false);

        if (!client) {
            setLoginStatus('No se pudo conectar con Supabase.', true);
            return;
        }

        const formData = new FormData(loginForm);
        const { error } = await client.auth.signInWithPassword({
            email: String(formData.get('email')),
            password: String(formData.get('password'))
        });

        if (error) {
            setLoginStatus('Acceso no valido', true);
            return;
        }

        await showAdmin();
    });

    eventSelect.addEventListener('change', () => {
        loadEventData(eventSelect.value);
    });

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(settingsStatus, '', false);

        const eventId = eventSelect.value;
        const formData = new FormData(settingsForm);

        try {
            await client
                .from('eventin_events')
                .update({
                    event_date: new Date(String(formData.get('event_date'))).toISOString(),
                    location_name: String(formData.get('location_name') || '').trim(),
                    maps_url: String(formData.get('maps_url') || '').trim()
                })
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
        setStatus(superadminStatus, '', false);

        if (!isSuperadmin()) {
            setStatus(superadminStatus, 'Solo el superadministrador puede crear eventos.', true);
            return;
        }

        const formData = new FormData(createEventForm);
        const title = String(formData.get('title')).trim();
        const adminEmail = String(formData.get('admin_email')).trim().toLowerCase();
        const eventDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const { data: profile } = await client
                .from('eventin_profiles')
                .select('id')
                .eq('email', adminEmail)
                .maybeSingle()
                .throwOnError();

            if (!profile) {
                setStatus(superadminStatus, 'No existe un perfil con ese email.', true);
                return;
            }

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

            await client
                .from('eventin_event_admins')
                .insert({
                    event_id: newEvent.id,
                    user_id: profile.id
                })
                .throwOnError();

            createEventForm.reset();
            setStatus(superadminStatus, 'Evento creado correctamente', false);
            await loadEvents();
            eventSelect.value = newEvent.id;
            await loadEventData(newEvent.id);
        } catch (error) {
            setStatus(superadminStatus, 'No se pudo crear el evento.', true);
        }
    });

    deleteEventButton.addEventListener('click', async () => {
        const eventId = eventSelect.value;
        const eventData = currentEvents.find((item) => item.id === eventId);

        if (!isSuperadmin() || !eventId) {
            setStatus(superadminStatus, 'Solo el superadministrador puede borrar eventos.', true);
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

            setStatus(superadminStatus, 'Evento borrado', false);
            await loadEvents();
        } catch (error) {
            setStatus(superadminStatus, 'No se pudo borrar el evento.', true);
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

        const { data } = await client.auth.getSession();
        if (data.session) {
            await showAdmin();
        }
    }

    init();
})();
