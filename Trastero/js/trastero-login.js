const supabaseClient = window.websSupabase;
const loginForm = document.getElementById('trastero-login-form');
const emailInput = document.getElementById('trastero-email');
const passwordInput = document.getElementById('trastero-password');
const messageBox = document.getElementById('trastero-login-message');

function showLoginMessage(text, type = 'info') {
    messageBox.textContent = text;
    messageBox.dataset.type = type;
    messageBox.hidden = false;
}

function setLoginLoading(isLoading) {
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Entrando...' : 'Entrar en Traster';
}

async function canAccessTraster(user) {
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    if (profileError) return false;
    if (profile?.role === 'admin') return true;
    if (profile?.role !== 'viewer') return false;

    const { data: membership, error: membershipError } = await supabaseClient
        .from('project_members')
        .select('role, app_projects!inner(slug,is_active)')
        .eq('user_id', user.id)
        .eq('role', 'editor')
        .eq('app_projects.slug', 'trastero')
        .eq('app_projects.is_active', true)
        .maybeSingle();
    return !membershipError && Boolean(membership);
}

async function enterTraster(user) {
    if (!await canAccessTraster(user)) {
        await supabaseClient.auth.signOut();
        showLoginMessage('Acceso reservado a usuarios autorizados de Traster.', 'error');
        return;
    }
    window.location.replace('app.html');
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginLoading(true);
    messageBox.hidden = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
    });

    setLoginLoading(false);

    if (error || !data?.user) {
        showLoginMessage('No se pudo iniciar sesion. Revisa el email y la clave.', 'error');
        return;
    }

    passwordInput.value = '';
    await enterTraster(data.user);
});

async function initLogin() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.user) await enterTraster(data.session.user);
}

initLogin();
