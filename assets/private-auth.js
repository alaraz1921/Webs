const supabaseClient = window.websSupabase;

const loginForm = document.getElementById('private-login-form');
const emailInput = document.getElementById('private-email');
const passwordInput = document.getElementById('private-password');
const messageBox = document.getElementById('private-message');
const authPanel = document.getElementById('private-auth-panel');
const contentPanel = document.getElementById('private-content-panel');
const userEmail = document.getElementById('private-user-email');
const logoutButton = document.getElementById('private-logout');
const dailyAccessFormula = document.getElementById('daily-access-formula');

function showMessage(text, type = 'info') {
    messageBox.textContent = text;
    messageBox.dataset.type = type;
    messageBox.hidden = false;
}

function setLoading(isLoading) {
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Entrando...' : 'Entrar';
}

function showPrivateContent(user) {
    authPanel.hidden = true;
    contentPanel.hidden = false;
    userEmail.textContent = user.email;
    loadDailyAccessFormula();
}

function showLogin() {
    authPanel.hidden = false;
    contentPanel.hidden = true;
    userEmail.textContent = '';
    dailyAccessFormula.textContent = 'Cargando recordatorio...';
}

async function loadDailyAccessFormula() {
    const { data, error } = await supabaseClient.rpc('get_daily_access_formula_note');

    if (error) {
        dailyAccessFormula.textContent = 'No se pudo cargar el recordatorio de claves.';
        return;
    }

    dailyAccessFormula.textContent = data;
}

async function loadSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        showMessage('No se pudo comprobar la sesion.', 'error');
        showLogin();
        return;
    }

    if (data.session?.user) {
        showPrivateContent(data.session.user);
    } else {
        showLogin();
    }
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoading(true);
    messageBox.hidden = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
    });

    setLoading(false);

    if (error) {
        showMessage('No se pudo iniciar sesion. Revisa el email y la clave.', 'error');
        return;
    }

    passwordInput.value = '';
    showPrivateContent(data.user);
});

logoutButton.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
        showPrivateContent(session.user);
    } else {
        showLogin();
    }
});

loadSession();
