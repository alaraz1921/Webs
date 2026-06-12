const gamesClient = window.websSupabase;
const GAMES_AUTH_TIME_KEY = 'games_auth_time';
const GAMES_AUTH_DURATION_MS = 24 * 60 * 60 * 1000;

const userTrigger = document.getElementById('games-user-trigger');
const userMenu = document.getElementById('games-user-menu');
const guestOptions = document.getElementById('games-user-guest');
const sessionOptions = document.getElementById('games-user-session');
const userName = document.getElementById('games-user-name');
const loginScreen = document.getElementById('games-login-screen');
const registerScreen = document.getElementById('games-register-screen');
const loginForm = document.getElementById('games-login-form');
const registerForm = document.getElementById('games-register-form');

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
    userMenu.hidden = true;
    userTrigger.setAttribute('aria-expanded', 'false');
}

function mostrarPantallaAutenticacion(pantalla) {
    cerrarMenuUsuario();
    ocultarMensajes();
    loginScreen.hidden = pantalla !== 'login';
    registerScreen.hidden = pantalla !== 'register';
    const campo = pantalla === 'login' ? document.getElementById('games-login-email') : document.getElementById('games-register-user');
    campo.focus();
}

function cerrarPantallasAutenticacion() {
    loginScreen.hidden = true;
    registerScreen.hidden = true;
}

function mostrarSesion(user) {
    guestOptions.hidden = true;
    sessionOptions.hidden = false;
    userName.textContent = user.user_metadata?.display_name || user.email;
}

function mostrarInvitado() {
    guestOptions.hidden = false;
    sessionOptions.hidden = true;
    userName.textContent = '';
}

async function cargarSesion() {
    const { data } = await gamesClient.auth.getSession();

    if (data.session?.user && accesoGamesVigente()) {
        mostrarSesion(data.session.user);
        return;
    }

    limpiarAccesoGames();
    mostrarInvitado();
}

userTrigger.addEventListener('click', () => {
    const seAbrira = userMenu.hidden;
    userMenu.hidden = !seAbrira;
    userTrigger.setAttribute('aria-expanded', String(seAbrira));
});

document.getElementById('games-open-login').addEventListener('click', () => mostrarPantallaAutenticacion('login'));
document.getElementById('games-open-register').addEventListener('click', () => mostrarPantallaAutenticacion('register'));
document.querySelectorAll('[data-close-auth]').forEach((boton) => boton.addEventListener('click', cerrarPantallasAutenticacion));

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const boton = loginForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'ENTRANDO...';

    const { data, error } = await gamesClient.auth.signInWithPassword({
        email: document.getElementById('games-login-email').value.trim(),
        password: document.getElementById('games-login-password').value
    });

    boton.disabled = false;
    boton.textContent = 'ENTRAR';

    if (error) {
        mostrarMensaje('games-login-message', 'No se pudo iniciar sesión. Revisa el correo y la contraseña.', 'error');
        return;
    }

    guardarAccesoGames();
    document.getElementById('games-login-password').value = '';
    mostrarSesion(data.user);
    cerrarPantallasAutenticacion();
});

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarMensajes();
    const boton = registerForm.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'ENVIANDO...';

    const { data, error } = await gamesClient.auth.signUp({
        email: document.getElementById('games-register-email').value.trim(),
        password: document.getElementById('games-register-password').value,
        options: {
            emailRedirectTo: new URL('games.html', window.location.href).href,
            data: {
                display_name: document.getElementById('games-register-user').value.trim(),
                registration_source: 'games'
            }
        }
    });

    boton.disabled = false;
    boton.textContent = 'SOLICITAR REGISTRO';

    if (error) {
        mostrarMensaje('games-register-message', 'No se pudo solicitar el registro. Revisa los datos introducidos.', 'error');
        return;
    }

    if (data.session) await gamesClient.auth.signOut();
    limpiarAccesoGames();
    registerForm.reset();
    mostrarMensaje('games-register-message', 'Solicitud enviada. Revisa tu correo y confirma la cuenta antes de iniciar sesión.', 'success');
});

document.getElementById('games-logout').addEventListener('click', async () => {
    await gamesClient.auth.signOut();
    limpiarAccesoGames();
    mostrarInvitado();
    cerrarMenuUsuario();
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.games-user-area')) cerrarMenuUsuario();
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    cerrarMenuUsuario();
    cerrarPantallasAutenticacion();
});

cargarSesion();
