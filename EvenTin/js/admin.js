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
    const showContactsViewButton = document.getElementById('show-contacts-view');
    const eventsView = document.getElementById('events-view');
    const usersView = document.getElementById('users-view');
    const contactsView = document.getElementById('contacts-view');
    const eventSelect = document.getElementById('event-select');
    const eventSelector = document.querySelector('.event-selector');
    const eventUserTitle = document.getElementById('event-user-title');
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
    const eventLinks = document.getElementById('event-links');
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
    const heroImageStatus = document.getElementById('hero-image-status');
    const detailImageStatus = document.getElementById('detail-image-status');
    const refreshContactRequestsButton = document.getElementById('refresh-contact-requests');
    const contactRequestsList = document.getElementById('contact-requests-list');
    const contactRequestsStatus = document.getElementById('contact-requests-status');
    const loginResetLink = document.getElementById('login-reset-link');
    const userResetLink = document.getElementById('user-reset-link');

    const IMAGE_BUCKET = 'eventin-images';
    const ORIGINAL_IMAGE_LIMIT_BYTES = 12 * 1024 * 1024;
    const OPTIMIZED_IMAGE_LIMIT_BYTES = 2.5 * 1024 * 1024;
    const IMAGE_UPLOADS = {
        hero: {
            fileField: 'hero_image_file',
            urlField: 'hero_image_url',
            statusElement: heroImageStatus,
            maxWidth: 1600,
            fileName: 'hero.webp',
            label: 'principal'
        },
        detail: {
            fileField: 'detail_image_file',
            urlField: 'detail_image_url',
            statusElement: detailImageStatus,
            maxWidth: 1200,
            fileName: 'detail.webp',
            label: 'detalle'
        }
    };

    let currentProfile = null;
    let currentEvents = [];
    let currentEventTypes = [];
    let currentUsers = [];
    let currentContactRequests = [];

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

    function getEventUrl(pageName, eventData, bustCache) {
        const eventKey = eventData?.public_slug || eventData?.event_code || config.defaultEventSlug;
        const url = new URL(pageName, window.location.href);
        url.searchParams.set('evento', eventKey);
        if (bustCache) {
            url.searchParams.set('v', Date.now());
        }
        return url.href;
    }

    function getPublicEventUrl(eventData, bustCache) {
        return getEventUrl('evento.html', eventData, bustCache);
    }

    function getInvitationEventUrl(eventData) {
        return getEventUrl('invitacion.html', eventData, false);
    }

    function getCurrentEvent() {
        return currentEvents.find((item) => item.id === eventSelect.value) || null;
    }

    function getResetPasswordUrl(email) {
        const params = new URLSearchParams(window.location.search);
        const eventKey = params.get('evento');
        const url = new URL('reset-password.html', window.location.href);

        if (eventKey) {
            url.searchParams.set('evento', eventKey);
        }

        if (email) {
            url.searchParams.set('email', email);
        }

        return url.href;
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

    function updateImageStatus(kind, hasImage) {
        const configItem = IMAGE_UPLOADS[kind];
        if (!configItem?.statusElement) {
            return;
        }

        configItem.statusElement.textContent = hasImage
            ? 'Imagen guardada. Puedes elegir otra para sustituirla.'
            : 'Se optimiza automaticamente al guardar.';
    }

    function loadImageFromFile(file) {
        const imageUrl = URL.createObjectURL(file);

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(imageUrl);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                reject(new Error('No se pudo leer la imagen.'));
            };
            image.src = imageUrl;
        });
    }

    function canvasToWebpBlob(canvas, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('No se pudo optimizar la imagen.'));
                    return;
                }
                resolve(blob);
            }, 'image/webp', quality);
        });
    }

    async function optimizeImageFile(file, maxWidth) {
        if (!file?.size) {
            return null;
        }

        if (file.size > ORIGINAL_IMAGE_LIMIT_BYTES) {
            throw new Error('La imagen original supera 12 MB.');
        }

        const source = window.createImageBitmap
            ? await createImageBitmap(file)
            : await loadImageFromFile(file);
        const scale = Math.min(1, maxWidth / source.width);
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.drawImage(source, 0, 0, width, height);

        if (source.close) {
            source.close();
        }

        for (const quality of [0.78, 0.68, 0.58]) {
            const blob = await canvasToWebpBlob(canvas, quality);
            if (blob.size <= OPTIMIZED_IMAGE_LIMIT_BYTES) {
                return blob;
            }
        }

        throw new Error('La imagen optimizada sigue siendo demasiado grande.');
    }

    async function uploadEventImage(eventData, kind, file) {
        const configItem = IMAGE_UPLOADS[kind];
        if (!file?.size || !configItem || !eventData?.event_code) {
            return String(settingsForm.elements[configItem?.urlField]?.value || '').trim();
        }

        setStatus(settingsStatus, `Optimizando imagen ${configItem.label}...`, false);
        const optimizedImage = await optimizeImageFile(file, configItem.maxWidth);
        const imagePath = `events/${eventData.event_code}/${configItem.fileName}`;

        setStatus(settingsStatus, `Subiendo imagen ${configItem.label}...`, false);
        const { error } = await client.storage
            .from(IMAGE_BUCKET)
            .upload(imagePath, optimizedImage, {
                contentType: 'image/webp',
                upsert: true
            });

        if (error) {
            throw error;
        }

        const { data } = client.storage
            .from(IMAGE_BUCKET)
            .getPublicUrl(imagePath);

        return `${data.publicUrl}?v=${Date.now()}`;
    }

    async function uploadPendingImages(eventData, formData) {
        const heroFile = formData.get(IMAGE_UPLOADS.hero.fileField);
        const detailFile = formData.get(IMAGE_UPLOADS.detail.fileField);

        return {
            hero_image_url: await uploadEventImage(eventData, 'hero', heroFile),
            detail_image_url: await uploadEventImage(eventData, 'detail', detailFile)
        };
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
        contactsView.hidden = viewName !== 'contacts' || !usersAllowed;
        showEventsViewButton.classList.toggle('active', viewName === 'events');
        showUsersViewButton.classList.toggle('active', viewName === 'users');
        showContactsViewButton.classList.toggle('active', viewName === 'contacts');

        if (viewName === 'users' && usersAllowed) {
            loadUsers();
        }

        if (viewName === 'contacts' && usersAllowed) {
            loadContactRequests();
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
        updateAdminHeader();
        showView('events');
    }


    function updateAdminHeader(eventData = null) {
        const email = currentProfile?.email || '';
        adminRoleLabel.textContent = email ? `Usuario: ${email}` : 'Usuario:';

        if (eventSelector) {
            eventSelector.hidden = isEventUser();
        }

        if (!eventUserTitle) {
            return;
        }

        eventUserTitle.hidden = !isEventUser();
        eventUserTitle.textContent = isEventUser()
            ? eventData?.title || currentEvents[0]?.title || 'Evento asignado'
            : '';
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
        updateAdminHeader(eventData);
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
        settingsForm.elements.hero_image_file.value = '';
        settingsForm.elements.detail_image_file.value = '';
        settingsForm.elements.palette_key.value = settings?.palette_key || 'earth';
        updateImageStatus('hero', Boolean(settings?.hero_image_url));
        updateImageStatus('detail', Boolean(settings?.detail_image_url));
        fillTypeSelect(settingsEventType, eventData?.event_type || 'communion');

        if (eventData) {
            const publicUrl = getPublicEventUrl(eventData, true);
            adminEventLink.href = publicUrl;
            eventLinks.hidden = false;
            eventLinks.dataset.publicUrl = publicUrl;
            eventLinks.dataset.invitationUrl = getInvitationEventUrl(eventData);
            publicLink.textContent = `Codigo: ${eventData.event_code}`;
        } else {
            eventLinks.hidden = true;
            delete eventLinks.dataset.publicUrl;
            delete eventLinks.dataset.invitationUrl;
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

    async function loadContactRequests() {
        if (!isAdmin()) {
            return;
        }

        setStatus(contactRequestsStatus, '', false);

        const { data, error } = await client
            .from('eventin_contact_requests')
            .select('id,nombre,email,asunto,mensaje,created_at')
            .order('created_at', { ascending: false });

        if (error) {
            contactRequestsList.innerHTML = '<p>No se pudieron cargar los mensajes de contacto.</p>';
            return;
        }

        currentContactRequests = data || [];
        contactRequestsList.innerHTML = currentContactRequests.length
            ? currentContactRequests.map((row) => `
                <article class="message-item contact-request-item">
                    <div class="contact-request-header">
                        <div>
                            <strong>${escapeHtml(row.nombre)}</strong>
                            <a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a>
                        </div>
                        <time>${formatDate(row.created_at)}</time>
                    </div>
                    <h3>${escapeHtml(row.asunto)}</h3>
                    <p>${escapeHtml(row.mensaje)}</p>
                    <div class="table-actions">
                        <a class="secondary-button" href="mailto:${escapeHtml(row.email)}?subject=${encodeURIComponent(`Re: ${row.asunto || 'Contacto EvenTin'}`)}">Responder</a>
                        <button type="button" data-action="delete-contact-request" data-id="${row.id}" class="danger-button">Borrar</button>
                    </div>
                </article>
            `).join('')
            : '<p>No hay mensajes de contacto.</p>';
    }

    function resetUserForm() {
        userForm.reset();
        userForm.elements.profile_id.value = '';
        userForm.elements.email.readOnly = false;
        userForm.elements.password.required = true;
        userResetLink.href = getResetPasswordUrl();
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
    showContactsViewButton.addEventListener('click', () => showView('contacts'));
    refreshContactRequestsButton.addEventListener('click', loadContactRequests);

    eventSelect.addEventListener('change', () => {
        loadEventData(eventSelect.value);
    });

    eventLinks.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-copy-link]');
        if (!button) {
            return;
        }

        const url = button.dataset.copyLink === 'invitation'
            ? eventLinks.dataset.invitationUrl
            : eventLinks.dataset.publicUrl;

        if (!url) {
            setStatus(settingsStatus, 'No hay enlace disponible para copiar.', true);
            return;
        }

        try {
            await copyText(url);
            setStatus(settingsStatus, 'Enlace copiado al portapapeles', false);
        } catch (error) {
            setStatus(settingsStatus, 'No se pudo copiar el enlace.', true);
        }
    });

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(settingsStatus, '', false);

        const eventId = eventSelect.value;
        const eventData = getCurrentEvent();
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

            const imageUrls = await uploadPendingImages(eventData, formData);

            await client
                .from('eventin_event_settings')
                .upsert({
                    event_id: eventId,
                    subtitle: String(formData.get('subtitle') || '').trim(),
                    display_date: String(formData.get('display_date') || '').trim(),
                    display_time: String(formData.get('display_time') || '').trim(),
                    presentation_title: String(formData.get('presentation_title') || '').trim(),
                    presentation_text: String(formData.get('presentation_text') || '').trim(),
                    hero_image_url: imageUrls.hero_image_url,
                    detail_image_url: imageUrls.detail_image_url,
                    palette_key: String(formData.get('palette_key') || 'earth')
                }, { onConflict: 'event_id' })
                .throwOnError();

            setStatus(settingsStatus, 'Cambios guardados', false);
            await loadEvents();
            eventSelect.value = eventId;
            await loadEventData(eventId);
        } catch (error) {
            const errorMessage = error?.message
                ? `No se pudieron guardar los cambios: ${error.message}`
                : 'No se pudieron guardar los cambios.';
            setStatus(settingsStatus, errorMessage, true);
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
                    subtitle: 'Un día para compartir',
                    display_date: '',
                    display_time: '',
                    presentation_title: 'Un recuerdo para siempre',
                    presentation_text: 'Hay momentos que quedan grabados en el corazón para toda la vida. Nos gustaría celebrarlo contigo y guardar juntos este hermoso recuerdo.',
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

    contactRequestsList.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action="delete-contact-request"]');
        if (!button) {
            return;
        }

        const contactRequest = currentContactRequests.find((item) => item.id === button.dataset.id);
        if (!contactRequest) {
            return;
        }

        if (!window.confirm(`Borrar el mensaje de ${contactRequest.email}?`)) {
            return;
        }

        try {
            await client
                .from('eventin_contact_requests')
                .delete()
                .eq('id', contactRequest.id)
                .throwOnError();

            setStatus(contactRequestsStatus, 'Mensaje borrado', false);
            await loadContactRequests();
        } catch (error) {
            setStatus(contactRequestsStatus, 'No se pudo borrar el mensaje.', true);
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

            if (!profileId) {
                if (!password) {
                    setStatus(userStatus, 'La clave es obligatoria al crear un usuario.', true);
                    return;
                }

                const { data: functionData, error: functionError } = await client.functions.invoke('create-event-user', {
                    body: {
                        email,
                        password,
                        display_name: displayName,
                        event_code: eventCode
                    }
                });

                if (functionError || !functionData?.user_id) {
                    setStatus(userStatus, 'No se pudo crear el usuario Auth desde la funcion segura.', true);
                    return;
                }

                resetUserForm();
                setStatus(userStatus, 'Usuario creado', false);
                await loadUsers();
                return;
            }

            await client
                .from('eventin_profiles')
                .upsert({
                    id: profileId,
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
            userResetLink.href = getResetPasswordUrl(profile.email || '');
            setStatus(userStatus, 'Editando usuario. La clave no se modifica desde este panel.', false);
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
        loginResetLink.href = getResetPasswordUrl();
        userResetLink.href = getResetPasswordUrl();
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
