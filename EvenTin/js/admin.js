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

    function setLoginStatus(message, isError) {
        loginStatus.textContent = message;
        loginStatus.classList.toggle('error', Boolean(isError));
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

    async function showAdmin() {
        loginPanel.hidden = true;
        adminPanel.hidden = false;
        await loadEvents();
    }

    function showLogin() {
        loginPanel.hidden = false;
        adminPanel.hidden = true;
    }

    async function loadEvents() {
        const { data, error } = await client
            .from('event_admins')
            .select('events(id,title,event_date)')
            .order('created_at', { ascending: true });

        if (error) {
            eventSelect.innerHTML = '<option>No se pudieron cargar eventos</option>';
            return;
        }

        const events = data.map((item) => item.events).filter(Boolean);

        eventSelect.innerHTML = events.map((item) => (
            `<option value="${item.id}">${escapeHtml(item.title)}</option>`
        )).join('');

        if (events.length > 0) {
            await loadEventData(events[0].id);
        } else {
            responsesTable.innerHTML = '<tr><td colspan="6">No tienes eventos asignados.</td></tr>';
            messagesList.innerHTML = '<p>No tienes eventos asignados.</p>';
        }
    }

    async function loadEventData(eventId) {
        await Promise.all([
            loadResponses(eventId),
            loadMessages(eventId)
        ]);
    }

    async function loadResponses(eventId) {
        const { data, error } = await client
            .from('guest_responses')
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
            .from('public_messages')
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
