(function () {
    const client = window.eventSupabase;
    const requestPanel = document.getElementById('request-reset-panel');
    const updatePanel = document.getElementById('update-password-panel');
    const requestForm = document.getElementById('request-reset-form');
    const updateForm = document.getElementById('update-password-form');
    const requestStatus = document.getElementById('request-reset-status');
    const updateStatus = document.getElementById('update-password-status');
    const backToLoginLink = document.getElementById('back-to-login-link');

    function setStatus(element, message, isError) {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    function buildAdminUrl() {
        const params = new URLSearchParams(window.location.search);
        const eventKey = params.get('evento');
        const url = new URL('admin.html', window.location.href);

        if (eventKey) {
            url.searchParams.set('evento', eventKey);
        }

        return url.href;
    }

    function buildResetUrl() {
        const params = new URLSearchParams(window.location.search);
        const eventKey = params.get('evento');
        const url = new URL('reset-password.html', window.location.href);

        if (eventKey) {
            url.searchParams.set('evento', eventKey);
        }

        return url.href;
    }

    function showUpdatePanel() {
        requestPanel.hidden = true;
        updatePanel.hidden = false;
    }

    function showRequestPanel() {
        requestPanel.hidden = false;
        updatePanel.hidden = true;
    }

    async function restoreSessionFromHash() {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
            return false;
        }

        const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (error) {
            setStatus(updateStatus, 'El enlace de recuperacion no es valido o ha caducado.', true);
            return false;
        }

        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return true;
    }

    async function restoreSessionFromCode() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
            return false;
        }

        const { error } = await client.auth.exchangeCodeForSession(code);

        if (error) {
            setStatus(updateStatus, 'El enlace de recuperacion no es valido o ha caducado.', true);
            return false;
        }

        params.delete('code');
        const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState(null, '', cleanUrl);
        return true;
    }

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(requestStatus, '', false);

        if (!client) {
            setStatus(requestStatus, 'No se pudo conectar con Supabase.', true);
            return;
        }

        const formData = new FormData(requestForm);
        const email = String(formData.get('email') || '').trim().toLowerCase();

        try {
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: buildResetUrl()
            });

            if (error) {
                throw error;
            }

            requestForm.reset();
            setStatus(requestStatus, 'Si el email existe, recibira un enlace para restaurar la clave.', false);
        } catch (error) {
            setStatus(requestStatus, 'No se pudo enviar el email de restauracion.', true);
        }
    });

    updateForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(updateStatus, '', false);

        if (!client) {
            setStatus(updateStatus, 'No se pudo conectar con Supabase.', true);
            return;
        }

        const formData = new FormData(updateForm);
        const password = String(formData.get('password') || '');
        const passwordConfirm = String(formData.get('password_confirm') || '');

        if (password.length < 8) {
            setStatus(updateStatus, 'La clave debe tener al menos 8 caracteres.', true);
            return;
        }

        if (password !== passwordConfirm) {
            setStatus(updateStatus, 'Las claves no coinciden.', true);
            return;
        }

        try {
            const { error } = await client.auth.updateUser({ password });

            if (error) {
                throw error;
            }

            await client.auth.signOut();
            updateForm.reset();
            setStatus(updateStatus, 'Clave actualizada. Ya puedes iniciar sesion.', false);
        } catch (error) {
            setStatus(updateStatus, 'No se pudo actualizar la clave.', true);
        }
    });

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const email = params.get('email');
        backToLoginLink.href = buildAdminUrl();

        if (email) {
            requestForm.elements.email.value = email;
        }

        if (!client) {
            setStatus(requestStatus, 'No se pudo conectar con Supabase.', true);
            return;
        }

        const restored = await restoreSessionFromHash() || await restoreSessionFromCode();

        if (restored) {
            showUpdatePanel();
            return;
        }

        showRequestPanel();
    }

    init();
})();
