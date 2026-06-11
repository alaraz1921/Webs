const bingoClient = window.websSupabase;
const DEMO_BINGO_EMAIL = 'demobingo@alaraz1921.com';
const BINGO_AUTH_TIME_KEY = 'bingo_monitor_auth_time';
const AUTH_DURATION_MS = 24 * 60 * 60 * 1000;

let numerosDisponibles = Array.from({ length: 90 }, (_, indice) => indice + 1);
let numerosCantados = [];
let intervalo = null;
let enMarcha = false;
let partidaActual = null;

function normalizarUsuario(usuario) {
    const valor = usuario.trim().toLowerCase();
    return valor.includes('@') ? valor : valor === 'demobingo' ? DEMO_BINGO_EMAIL : valor;
}

function sesionBingoVigente() {
    const inicioSesion = Number(localStorage.getItem(BINGO_AUTH_TIME_KEY));
    return Number.isFinite(inicioSesion)
        && inicioSesion > 0
        && Date.now() - inicioSesion < AUTH_DURATION_MS;
}

function estaInstaladaPwa() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function usuarioPuedeGestionarBingo() {
    const { data, error } = await bingoClient
        .from('app_projects')
        .select('id')
        .eq('slug', 'bingo')
        .maybeSingle();

    return !error && Boolean(data);
}

async function iniciarSesion(event) {
    event.preventDefault();
    const errorBox = document.getElementById('msgError');
    const submitButton = event.target.querySelector('button[type="submit"]');
    errorBox.style.display = 'none';
    submitButton.disabled = true;
    submitButton.textContent = 'ENTRANDO...';

    const { error } = await bingoClient.auth.signInWithPassword({
        email: normalizarUsuario(document.getElementById('bingoUsuario').value),
        password: document.getElementById('bingoClave').value
    });

    if (error || !(await usuarioPuedeGestionarBingo())) {
        await bingoClient.auth.signOut();
        errorBox.textContent = 'USUARIO O CLAVE INCORRECTOS';
        errorBox.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'ENTRAR';
        return;
    }

    document.getElementById('bingoClave').value = '';
    localStorage.setItem(BINGO_AUTH_TIME_KEY, String(Date.now()));
    await mostrarMonitor();
}

async function comprobarSesion() {
    const { data } = await bingoClient.auth.getSession();
    if (data.session?.user && sesionBingoVigente() && await usuarioPuedeGestionarBingo()) {
        await mostrarMonitor();
        return;
    }

    localStorage.removeItem(BINGO_AUTH_TIME_KEY);
    document.getElementById('pantallaLogin').style.display = 'flex';
    document.getElementById('bingoUsuario').focus();
}

async function mostrarMonitor() {
    document.getElementById('pantallaLogin').style.display = 'none';
    inicializarPanel();
    await cargarPartidaActual();
}

async function cargarPartidaActual() {
    const { data, error } = await bingoClient
        .from('bingo_partidas')
        .select('id, iniciada')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        mostrarAlertaMonitor('No se pudo cargar la partida actual.');
        return;
    }

    if (data) {
        establecerPartida(data);
    } else {
        await crearNuevaPartida();
    }
}

function establecerPartida(partida) {
    partidaActual = partida;
    document.getElementById('partidaId').textContent = partida.id;
    cargarEstadoMonitor();
    actualizarBotonControl();
}

async function crearNuevaPartida() {
    const { data, error } = await bingoClient
        .from('bingo_partidas')
        .insert({ iniciada: false })
        .select('id, iniciada')
        .single();

    if (error) {
        mostrarAlertaMonitor('No se pudo crear una nueva partida.');
        return;
    }

    establecerPartida(data);
}

function claveEstadoMonitor() {
    return partidaActual ? `bingo_monitor_partida_${partidaActual.id}` : '';
}

function guardarEstadoMonitor() {
    if (!partidaActual) return;
    localStorage.setItem(claveEstadoMonitor(), JSON.stringify(numerosCantados));
}

function cargarEstadoMonitor() {
    detenerCanto();
    numerosCantados = JSON.parse(localStorage.getItem(claveEstadoMonitor()) || '[]');
    numerosDisponibles = Array.from({ length: 90 }, (_, indice) => indice + 1)
        .filter((numero) => !numerosCantados.includes(numero));
    inicializarPanel();

    numerosCantados.forEach((numero) => {
        document.getElementById(`bola-${numero}`)?.classList.add('cantado');
    });

    const ultima = numerosCantados.at(-1);
    const anterior = numerosCantados.at(-2);
    document.getElementById('bolaActual').textContent = ultima || '--';
    document.getElementById('bolaAnterior').textContent = anterior || '--';
}

function limpiarEstadoMonitor() {
    detenerCanto();
    if (partidaActual) localStorage.removeItem(claveEstadoMonitor());
    numerosDisponibles = Array.from({ length: 90 }, (_, indice) => indice + 1);
    numerosCantados = [];
    document.getElementById('bolaActual').textContent = '--';
    document.getElementById('bolaAnterior').textContent = '--';
    inicializarPanel();
}

function inicializarPanel() {
    const tabla = document.getElementById('tabla-panel');
    tabla.innerHTML = '';

    for (let numero = 1; numero <= 90; numero++) {
        if ((numero - 1) % 10 === 0) tabla.appendChild(document.createElement('tr'));
        const celda = document.createElement('td');
        celda.textContent = numero;
        celda.id = `bola-${numero}`;
        tabla.lastElementChild.appendChild(celda);
    }
}

async function solicitarInicioPartida() {
    if (!partidaActual) return;

    if (enMarcha) {
        detenerCanto();
        actualizarBotonControl();
        return;
    }

    if (partidaActual.iniciada) {
        comenzarCanto();
        return;
    }

    mostrarConfirmacionMonitor('La partida se marcara como iniciada y ya no se podran cambiar los cartones. ¿Quieres continuar?', async () => {
        const { data, error } = await bingoClient
            .from('bingo_partidas')
            .update({ iniciada: true, updated_at: new Date().toISOString() })
            .eq('id', partidaActual.id)
            .select('id, iniciada')
            .single();

        if (error) {
            mostrarAlertaMonitor('No se pudo iniciar la partida.');
            return;
        }

        partidaActual = data;
        comenzarCanto();
    });
}

function comenzarCanto() {
    if (numerosDisponibles.length === 0) {
        mostrarAlertaMonitor('Se han cantado los 90 numeros. Fin de la partida.');
        return;
    }

    enMarcha = true;
    sacarBola();
    intervalo = setInterval(sacarBola, 4000);
    actualizarBotonControl();
}

function detenerCanto() {
    clearInterval(intervalo);
    intervalo = null;
    enMarcha = false;
}

function actualizarBotonControl() {
    const boton = document.getElementById('btnControl');
    if (!partidaActual?.iniciada) {
        boton.textContent = 'INICIAR PARTIDA';
        boton.className = 'btn-comenzar';
    } else if (enMarcha) {
        boton.textContent = 'PAUSAR CANTO';
        boton.className = 'btn-pausar';
    } else {
        boton.textContent = 'REANUDAR CANTO';
        boton.className = 'btn-comenzar';
    }
}

function sacarBola() {
    if (numerosDisponibles.length === 0) {
        detenerCanto();
        actualizarBotonControl();
        mostrarAlertaMonitor('Se han cantado los 90 numeros. Fin de la partida.');
        return;
    }

    const indice = Math.floor(Math.random() * numerosDisponibles.length);
    const bola = numerosDisponibles.splice(indice, 1)[0];
    numerosCantados.push(bola);
    document.getElementById('bolaAnterior').textContent = document.getElementById('bolaActual').textContent;
    document.getElementById('bolaActual').textContent = bola;
    document.getElementById(`bola-${bola}`)?.classList.add('cantado');
    guardarEstadoMonitor();
}

function solicitarReinicioPartida() {
    mostrarConfirmacionMonitor('Se limpiara la tabla del monitor, la partida se marcara como no iniciada y se podran cambiar los cartones. ¿Quieres continuar?', async () => {
        const { data, error } = await bingoClient
            .from('bingo_partidas')
            .update({ iniciada: false, updated_at: new Date().toISOString() })
            .eq('id', partidaActual.id)
            .select('id, iniciada')
            .single();

        if (error) {
            mostrarAlertaMonitor('No se pudo reiniciar la partida.');
            return;
        }

        limpiarEstadoMonitor();
        establecerPartida(data);
    });
}

function solicitarNuevaPartida() {
    mostrarConfirmacionMonitor('Se limpiara la tabla del monitor y se generara un nuevo id de partida. ¿Quieres continuar?', async () => {
        limpiarEstadoMonitor();
        await crearNuevaPartida();
    });
}

function solicitarVolverGames() {
    mostrarConfirmacionMonitor('¿Quieres volver a Games?', () => {
        window.location.href = '../games.html';
    });
}

function mostrarConfirmacionMonitor(texto, callback) {
    document.getElementById('textoMonitorModalConfirm').textContent = texto;
    const modal = document.getElementById('monitorModalConfirm');
    modal.style.display = 'flex';
    document.getElementById('btnMonitorConfirmSi').onclick = () => {
        modal.style.display = 'none';
        callback();
    };
    document.getElementById('btnMonitorConfirmNo').onclick = () => {
        modal.style.display = 'none';
    };
}

function mostrarAlertaMonitor(texto) {
    document.getElementById('textoMonitorModalAlert').textContent = texto;
    document.getElementById('monitorModalAlert').style.display = 'flex';
}

function cerrarAlertaMonitor() {
    document.getElementById('monitorModalAlert').style.display = 'none';
}

function mostrarAyudaMonitor() {
    mostrarAlertaMonitor('Inicia la partida para bloquear los cambios de carton. Reiniciar conserva el id actual y permite nuevos cartones. Nueva partida genera un id distinto.');
}

window.addEventListener('load', () => {
    document.body.classList.toggle('pwa-standalone', estaInstaladaPwa());
    document.getElementById('bingoLoginForm').addEventListener('submit', iniciarSesion);
    comprobarSesion();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});
