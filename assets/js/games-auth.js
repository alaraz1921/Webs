const gamesClient = window.websSupabase;
const GAMES_AUTH_TIME_KEY = 'games_auth_time';
const GAMES_AUTH_DURATION_MS = 24 * 60 * 60 * 1000;

const guestOptions = Array.from(document.querySelectorAll('.games-nav-guest'));
const sessionOptions = Array.from(document.querySelectorAll('.games-nav-session'));
const loginScreen = document.getElementById('games-login-screen');
const registerScreen = document.getElementById('games-register-screen');
const recoveryScreen = document.getElementById('games-recovery-screen');
const newPasswordScreen = document.getElementById('games-new-password-screen');
const loginForm = document.getElementById('games-login-form');
const registerForm = document.getElementById('games-register-form');
const recoveryForm = document.getElementById('games-recovery-form');
const newPasswordForm = document.getElementById('games-new-password-form');

function accesoGamesVigente() {
    const inicio = Number(localStorage.getItem(GAMES_AUTH_TIME_KEY));
    return Number.isFinite(inicio) && inicio > 0 && Date.now() - inicio < GAMES_AUTH_DURATION_MS;
}

function guardarAccesoGames() {
    localStorage.setItem(GAMES_AUTH_TIME_KEY, String(Date.now()));
}

function limpiarAccesoGames() {
    localStorage.removeItem(GAMES_AUTH_TIME_KEY);
    localStorage.removeItem('bingo_monitor_auth_time');
    localStorage.removeItem('infiltrado_auth_time');
}
async function validarAccesoGames(user, messageId = 'games-login-message') {
    const { data: profile, error } = await gamesClient
        .from('profiles')
        .select('approval_status, trial_expires_at')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        await gamesClient.auth.signOut();
        limpiarAccesoGames();
        mostrarMensaje(messageId, 'No se pudo validar el estado de la cuenta.', 'error');
        return false;
    }

    if (profile.approval_status === 'bloqueado') {
        await gamesClient.auth.signOut();
        limpiarAccesoGames();
        mostrarMensaje(messageId, 'La cuenta ha sido bloqueada por un administrador.', 'error');
        return false;
    }

    if (profile.approval_status === 'temporal' && Date.now() >= Date.parse(profile.trial_expires_at)) {
        await gamesClient.auth.signOut();
        limpiarAccesoGames();
        mostrarMensaje(messageId, 'Tu acceso temporal ha caducado. Tu cuenta está pendiente de validación por un administrador.', 'error');
        return false;
    }

    return true;
}

function mostrarMensaje(id, texto, tipo = 'info') {
    const mensaje = document.getElementById(id);
    mensaje.textContent = texto;
    mensaje.dataset.type = tipo;
    mensaje.hidden = false;
}

function ocultarMensajes() {
    document.querySelectorAll('.games-auth-message').forEach((mensaje) => {
        mensaje.hidden = true;
    });
}

function cerrarMenuUsuario() {
    if (typeof cerrarMenuMovil === 'function') cerrarMenuMovil();
}

function mostrarPantallaAutenticacion(pantalla) {
    cerrarMenuUsuario();
    ocultarMensajes();
    loginScreen.hidden = pantalla !== 'login';
    registerScreen.hidden = pantalla !== 'register';
    recoveryScreen.hidden = pantalla !== 'recovery';
    newPasswordScreen.hidden = pantalla !== 'new-password';

    const camposIniciales = {
        login: 'games-login-identifier',
        register: 'games-register-user',
        recovery: 'games-recovery-email',
        'new-password': 'games-new-password'
    };
    document.getElementById(camposIniciales[pantalla]).focus();
}

function cerrarPantallasAutenticacion() {
    loginScreen.hidden = true;
    registerScreen.hidden = true;
    recoveryScreen.hidden = true;
    newPasswordScreen.hidden = true;
}

function mostrarSesion() {
    guestOptions.forEach((opcion) => { opcion.hidden = true; });
    sessionOptions.forEach((opcion) => { opcion.hidden = false; });
}

function mostrarInvitado() {
    guestOptions.forEach((opcion) => { opcion.hidden = false; });
    sessionOptions.forEach((opcion) => { opcion.hidden = true; });
}

async function cargarSesion() {
    const { data } = await gamesClient.auth.getSession();

    if (data.session?.user && new URLSearchParams(window.location.search).get('recovery') === '1') {
        mostrarPantallaAutenticacion('new-password');
        return;
    }

    if (data.session?.user && accesoGamesVigente()) {
        if (await validarAccesoGames(data.session.user)) {
            mostrarSesion(data.session.user);
            return;
        }
        mostrarInvitado();
        return;
    }

    limpiarAccesoGames();
    mostrarInvitado();
}

async function resolverEmailAcceso(identificador) {
    if (identificador.includes('@')) return identificador;

    const { data, error } = await gamesClient.rpc('resolve_games_login_email', {
        p_identifier: identificador
    });

    return error ? null : data;
}

document.getElementById('games-open-login').addEventListener('click', () => mostrarPantallaAutenticacion('login'));
document.getElementById('games-open-register').addEventListener('click', () => mostrarPantallaAutenticacion('register'));
document.getElementById('games-open-recovery').addEventListener('click', (event) => {
    event.preventDefault();
    mostrarPantallaAutenticacion('recovery');
});
document.getElementById('games-login-open-register').addEventListener('click', () => mostrarPantallaAutenticacion('register'));
document.querySelectorAll('[data-close-auth]').forEach((boton) => boton.addEventListener('click', cerrarPantallasAutenticacion));

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const boton = loginForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'ENTRANDO...';

    const identificador = document.getElementById('games-login-identifier').value.trim();
    const email = await resolverEmailAcceso(identificador);
    const resultado = email
        ? await gamesClient.auth.signInWithPassword({
            email,
            password: document.getElementById('games-login-password').value
        })
        : { data: null, error: true };

    boton.disabled = false;
    boton.textContent = 'ENTRAR';

    if (resultado.error) {
        mostrarMensaje('games-login-message', 'No se pudo iniciar sesion. Revisa el usuario o correo y la contrasena.', 'error');
        return;
    }

    if (!await validarAccesoGames(resultado.data.user)) {
        return;
    }

    guardarAccesoGames();
    document.getElementById('games-login-password').value = '';
    mostrarSesion(resultado.data.user);
    cerrarPantallasAutenticacion();
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const boton = registerForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'ENVIANDO...';
    const username = document.getElementById('games-register-user').value.trim().toLowerCase();

    const { data, error } = await gamesClient.auth.signUp({
        email: document.getElementById('games-register-email').value.trim(),
        password: document.getElementById('games-register-password').value,
        options: {
            emailRedirectTo: new URL('games.html', window.location.href).href,
            data: {
                display_name: username,
                username,
                registration_source: 'games'
            }
        }
    });

    boton.disabled = false;
    boton.textContent = 'SOLICITAR REGISTRO';

    if (error) {
        mostrarMensaje('games-register-message', 'No se pudo solicitar el registro. El usuario puede estar ocupado o los datos no son validos.', 'error');
        return;
    }

    if (data.session) await gamesClient.auth.signOut();
    limpiarAccesoGames();
    registerForm.reset();
    mostrarMensaje('games-register-message', 'Solicitud enviada. Revisa tu correo y confirma la cuenta antes de iniciar sesion.', 'success');
});

recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const boton = recoveryForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'ENVIANDO...';

    const { error } = await gamesClient.auth.resetPasswordForEmail(
        document.getElementById('games-recovery-email').value.trim(),
        { redirectTo: new URL('games.html?recovery=1', window.location.href).href }
    );

    boton.disabled = false;
    boton.textContent = 'ENVIAR ENLACE';

    if (error) {
        mostrarMensaje('games-recovery-message', 'No se pudo enviar el enlace de recuperacion.', 'error');
        return;
    }

    recoveryForm.reset();
    mostrarMensaje('games-recovery-message', 'Si el correo pertenece a una cuenta, recibiras un enlace para restaurar la contrasena.', 'success');
});

newPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const password = document.getElementById('games-new-password').value;
    const confirmacion = document.getElementById('games-new-password-confirm').value;

    if (password !== confirmacion) {
        mostrarMensaje('games-new-password-message', 'Las contrasenas no coinciden.', 'error');
        return;
    }

    const boton = newPasswordForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'GUARDANDO...';
    const { error } = await gamesClient.auth.updateUser({ password });
    boton.disabled = false;
    boton.textContent = 'GUARDAR CONTRASEÑA';

    if (error) {
        mostrarMensaje('games-new-password-message', 'No se pudo actualizar la contrasena. Solicita un nuevo enlace.', 'error');
        return;
    }

    newPasswordForm.reset();
    await gamesClient.auth.signOut();
    limpiarAccesoGames();
    mostrarInvitado();
    mostrarPantallaAutenticacion('login');
    mostrarMensaje('games-login-message', 'Contrasena actualizada. Ya puedes iniciar sesion.', 'success');
});

document.getElementById('games-logout').addEventListener('click', async () => {
    await gamesClient.auth.signOut();
    limpiarAccesoGames();
    mostrarInvitado();
    cerrarMenuUsuario();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    cerrarMenuUsuario();
    cerrarPantallasAutenticacion();
});

gamesClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') mostrarPantallaAutenticacion('new-password');
});

const pantallaSolicitada = new URLSearchParams(window.location.search).get('auth');
if (['login', 'register', 'recovery'].includes(pantallaSolicitada)) {
    mostrarPantallaAutenticacion(pantallaSolicitada);
}

cargarSesion();
