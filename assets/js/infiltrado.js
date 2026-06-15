const infiltradoClient = window.websSupabase;
const GAMES_AUTH_TIME_KEY = 'games_auth_time';
const AUTH_DURATION_MS = 24 * 60 * 60 * 1000;

let jugadores = [];
let roles = {};
let infiltradosAsignados = [];
let jugadorActualIndex = 0;
let lugarSecreto = '';
let faseActual = 'CONFIGURACION';
let partidaActualId = null;
let instalacionPwaPendiente = null;
let accesoInfiltradoValidado = false;

const selectP = document.getElementById('totalPlayers');
for (let numero = 3; numero <= 20; numero++) {
    const opcion = document.createElement('option');
    opcion.value = numero;
    opcion.textContent = `${numero} Jugadores`;
    selectP.appendChild(opcion);
}

async function resolverEmailAccesoInfiltrado(usuario) {
    const identificador = usuario.trim().toLowerCase();
    if (identificador.includes('@')) return identificador;

    const { data, error } = await infiltradoClient.rpc('resolve_games_login_email', {
        p_identifier: identificador
    });

    return error ? null : data;
}

function sesionInfiltradoVigente() {
    const inicioSesion = Number(localStorage.getItem(GAMES_AUTH_TIME_KEY));
    return Number.isFinite(inicioSesion)
        && inicioSesion > 0
        && Date.now() - inicioSesion < AUTH_DURATION_MS;
}

async function usuarioPuedeUsarInfiltrado() {
    const { data, error } = await infiltradoClient
        .from('app_projects')
        .select('id')
        .eq('slug', 'infiltrado')
        .maybeSingle();

    return !error && Boolean(data);
}

async function iniciarSesion(event) {
    event.preventDefault();
    const errorBox = document.getElementById('msgErrorInfiltrado');
    const boton = event.target.querySelector('button[type="submit"]');
    errorBox.style.display = 'none';
    boton.disabled = true;
    boton.textContent = 'ENTRANDO...';

    const email = await resolverEmailAccesoInfiltrado(document.getElementById('infiltradoUsuario').value);
    const resultado = email
        ? await infiltradoClient.auth.signInWithPassword({
            email,
            password: document.getElementById('infiltradoClave').value
        })
        : { error: true };

    if (resultado.error || !(await usuarioPuedeUsarInfiltrado())) {
        await infiltradoClient.auth.signOut();
        errorBox.style.display = 'block';
        boton.disabled = false;
        boton.textContent = 'ENTRAR';
        return;
    }

    document.getElementById('infiltradoClave').value = '';
    localStorage.setItem(GAMES_AUTH_TIME_KEY, String(Date.now()));
    await iniciarAplicacion();
}

async function comprobarSesion() {
    if (typeof restaurarSesionOnline === 'function' && await restaurarSesionOnline()) return;

    const { data } = await infiltradoClient.auth.getSession();
    if (data.session?.user && sesionInfiltradoVigente() && await usuarioPuedeUsarInfiltrado()) {
        await iniciarAplicacion();
        return;
    }

    localStorage.removeItem(GAMES_AUTH_TIME_KEY);
    accesoInfiltradoValidado = false;
    actualizarBotonInstalacionPwa();
    cambiarPantallaVisual('screen-lock');
    document.getElementById('infiltradoUsuario').focus();
}

async function iniciarAplicacion() {
    accesoInfiltradoValidado = true;
    actualizarBotonInstalacionPwa();
    await cargarCategorias();
    restaurarConfiguracionBase();
    if (typeof mostrarSeleccionModoInfiltrado === 'function') {
        mostrarSeleccionModoInfiltrado();
    } else {
        await cargarPartidaTemporal();
    }
}

async function iniciarModoOffline() {
    await cargarPartidaTemporal();
}

async function cargarCategorias() {
    const { data, error } = await infiltradoClient
        .from('infiltrado_palabras')
        .select('tipo')
        .order('tipo');

    if (error) {
        abrirModal('Error', 'No se pudieron cargar los tipos de palabra.');
        return;
    }

    const selects = [document.getElementById('tipoPalabra'), document.getElementById('online-tipo-palabra')].filter(Boolean);
    [...new Set(data.map((fila) => fila.tipo))].forEach((tipo) => {
        selects.forEach((select) => {
            if ([...select.options].some((opcion) => opcion.value === tipo)) return;
            const opcion = document.createElement('option');
            opcion.value = tipo;
            opcion.textContent = tipo;
            select.appendChild(opcion);
        });
    });
}

function faltaColumnaModo(error) {
    return Boolean(error) && /modo/i.test(`${error.message || ''} ${error.details || ''}`);
}

async function cargarPartidaTemporal() {
    let resultado = await infiltradoClient
        .from('infiltrado_partidas')
        .select('id, numero_jugadores, numero_infiltrados, tipo_palabra, palabra_oculta, fase, jugador_actual')
        .eq('modo', 'offline')
        .limit(1);

    // Mantiene operativo el modo local mientras se aplica la migración online.
    if (faltaColumnaModo(resultado.error)) {
        resultado = await infiltradoClient
            .from('infiltrado_partidas')
            .select('id, numero_jugadores, numero_infiltrados, tipo_palabra, palabra_oculta, fase, jugador_actual')
            .limit(1);
    }

    if (resultado.error || !resultado.data?.length) {
        faseActual = 'CONFIGURACION';
        cambiarPantallaVisual('screen-config');
        return;
    }

    const partida = resultado.data[0];
    partidaActualId = partida.id;
    faseActual = partida.fase;
    jugadorActualIndex = partida.jugador_actual;
    lugarSecreto = partida.palabra_oculta;
    document.getElementById('totalPlayers').value = partida.numero_jugadores;
    document.getElementById('totalInfiltrados').value = partida.numero_infiltrados;
    document.getElementById('tipoPalabra').value = partida.tipo_palabra;

    const { data: filasJugadores } = await infiltradoClient
        .from('infiltrado_jugadores')
        .select('nombre, infiltrado, orden')
        .eq('partida_id', partida.id)
        .order('orden');

    jugadores = (filasJugadores || []).map((fila) => fila.nombre);
    infiltradosAsignados = (filasJugadores || []).filter((fila) => fila.infiltrado).map((fila) => fila.nombre);
    construirRoles();

    if (faseActual === 'REPARTO' && jugadores.length) {
        prepararTurnoJugador();
        cambiarPantallaVisual('screen-draw');
    } else if (faseActual === 'PARTIDA' && jugadores.length) {
        prepararPantallaResolucion();
        cambiarPantallaVisual('screen-game');
    } else {
        faseActual = 'CONFIGURACION';
        cambiarPantallaVisual('screen-config');
    }
}

function cambiarPantallaVisual(idPantalla) {
    document.querySelectorAll('.screen').forEach((pantalla) => pantalla.classList.remove('active'));
    document.getElementById(idPantalla).classList.add('active');
    if (typeof actualizarControlesContextualesInfiltrado === 'function') {
        actualizarControlesContextualesInfiltrado(idPantalla);
    }
}

function guardarConfiguracionBase() {
    localStorage.setItem('infiltrado_config_total', document.getElementById('totalPlayers').value);
    localStorage.setItem('infiltrado_config_infs', document.getElementById('totalInfiltrados').value);
    localStorage.setItem('infiltrado_config_tipo', document.getElementById('tipoPalabra').value);
}

function restaurarConfiguracionBase() {
    if (localStorage.getItem('infiltrado_config_total')) document.getElementById('totalPlayers').value = localStorage.getItem('infiltrado_config_total');
    if (localStorage.getItem('infiltrado_config_infs')) document.getElementById('totalInfiltrados').value = localStorage.getItem('infiltrado_config_infs');
    if (localStorage.getItem('infiltrado_config_tipo')) document.getElementById('tipoPalabra').value = localStorage.getItem('infiltrado_config_tipo');
}

function abrirModal(titulo, mensaje, esFinPartida = false) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-message').textContent = mensaje;
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    if (esFinPartida) {
        const repetir = document.createElement('button');
        repetir.textContent = 'Repetir (Mismos Jugadores)';
        repetir.onclick = () => {
            cerrarModal();
            reiniciarMismosJugadores();
        };
        contenedor.appendChild(repetir);

        const reiniciar = document.createElement('button');
        reiniciar.textContent = 'Reiniciar todo desde cero';
        reiniciar.className = 'btn-danger';
        reiniciar.onclick = () => {
            cerrarModal();
            reiniciarTodoSistema();
        };
        contenedor.appendChild(reiniciar);
    } else {
        const cerrar = document.createElement('button');
        cerrar.textContent = 'Entendido';
        cerrar.onclick = cerrarModal;
        contenedor.appendChild(cerrar);
    }

    document.getElementById('custom-modal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('custom-modal').style.display = 'none';
}

function solicitarVolverGamesInfiltrado(event) {
    event.preventDefault();
    document.getElementById('modal-title').textContent = 'Volver a Games';
    document.getElementById('modal-message').textContent = '¿Quieres salir de Infiltrado y volver a Games?';
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    const confirmar = document.createElement('button');
    confirmar.textContent = 'Sí, volver';
    confirmar.onclick = () => {
        window.location.href = '../games.html';
    };
    contenedor.appendChild(confirmar);

    const cancelar = document.createElement('button');
    cancelar.textContent = 'Cancelar';
    cancelar.className = 'btn-danger';
    cancelar.onclick = cerrarModal;
    contenedor.appendChild(cancelar);

    document.getElementById('custom-modal').style.display = 'flex';
}

function mostrarAyudaInfiltrado() {
    abrirModal('Ayuda de El Infiltrado', '1. Configura jugadores, infiltrados y tipo de palabra.\n2. Cada jugador mira su rol manteniendo pulsado el recuadro.\n3. Los jugadores normales ven la palabra secreta; los infiltrados no.\n4. Debatid y tratad de descubrir a los infiltrados.\n5. Al resolver, seleccionad sus nombres.');
}

function generarInputsNombres() {
    const numero = Number(document.getElementById('totalPlayers').value);
    const contenedor = document.getElementById('container-names');
    contenedor.innerHTML = '<h3>Introduce los nombres:</h3>';

    for (let indice = 1; indice <= numero; indice++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-name-input';
        input.placeholder = `Jugador ${indice}`;
        input.required = true;
        contenedor.appendChild(input);
    }

    document.getElementById('btn-continue').style.display = 'none';
    document.getElementById('btn-start').style.display = 'block';
}

async function iniciarSorteo() {
    const inputs = document.querySelectorAll('.player-name-input');
    jugadores = Array.from(inputs).map((input) => input.value.trim() || input.placeholder);

    const nombresNormalizados = jugadores.map((nombre) => nombre.toLowerCase());
    if (new Set(nombresNormalizados).size !== jugadores.length) {
        abrirModal('Nombres repetidos', 'Cada jugador debe tener un nombre diferente.');
        return;
    }

    await ejecutarMezclaYAsignacion();
}

async function obtenerPalabraSecreta(tipoSeleccionado) {
    let consulta = infiltradoClient.from('infiltrado_palabras').select('tipo, palabra');
    if (tipoSeleccionado !== 'Aleatoria') consulta = consulta.eq('tipo', tipoSeleccionado);

    const { data, error } = await consulta;
    if (error || !data?.length) throw new Error('No hay palabras disponibles para este tipo.');

    let palabrasUsadas = new Set();
    if (partidaActualId) {
        const { data: filasUsadas, error: usadasError } = await infiltradoClient
            .from('infiltrado_palabras_usadas')
            .select('palabra')
            .eq('partida_id', partidaActualId);

        if (usadasError) throw new Error('No se pudo consultar el historial de palabras.');
        palabrasUsadas = new Set(filasUsadas.map((fila) => fila.palabra));
    }

    const disponibles = data.filter((fila) => !palabrasUsadas.has(fila.palabra));
    if (!disponibles.length) throw new Error('Ya se han usado todas las palabras disponibles para este tipo.');
    return disponibles[Math.floor(Math.random() * disponibles.length)];
}

async function ejecutarMezclaYAsignacion() {
    const numeroInfiltrados = Number(document.getElementById('totalInfiltrados').value);
    const tipoPalabra = document.getElementById('tipoPalabra').value;
    guardarConfiguracionBase();

    if (numeroInfiltrados >= jugadores.length) {
        abrirModal('Configuración Errónea', 'No puede haber igual o más infiltrados que jugadores.');
        return;
    }

    try {
        const palabraSeleccionada = await obtenerPalabraSecreta(tipoPalabra);
        lugarSecreto = palabraSeleccionada.palabra;
    } catch (error) {
        abrirModal('Error', error.message);
        return;
    }

    const candidatos = [...jugadores];
    infiltradosAsignados = [];
    for (let indice = 0; indice < numeroInfiltrados; indice++) {
        infiltradosAsignados.push(candidatos.splice(Math.floor(Math.random() * candidatos.length), 1)[0]);
    }

    construirRoles();
    jugadorActualIndex = 0;
    faseActual = 'REPARTO';

    if (!(await guardarPartidaTemporal(tipoPalabra, numeroInfiltrados))) return;
    prepararTurnoJugador();
    cambiarPantallaVisual('screen-draw');
}

function construirRoles() {
    roles = {};
    jugadores.forEach((jugador) => {
        roles[jugador] = infiltradosAsignados.includes(jugador) ? 'Eres el INFILTRADO' : `Palabra: ${lugarSecreto}`;
    });
}

async function guardarPartidaTemporal(tipoPalabra, numeroInfiltrados) {
    const datosPartida = {
        numero_jugadores: jugadores.length,
        numero_infiltrados: numeroInfiltrados,
        tipo_palabra: tipoPalabra,
        palabra_oculta: lugarSecreto,
        fase: faseActual,
        jugador_actual: jugadorActualIndex,
        updated_at: new Date().toISOString()
    };

    let resultado = partidaActualId
        ? await infiltradoClient
            .from('infiltrado_partidas')
            .update(datosPartida)
            .eq('id', partidaActualId)
            .select('id')
            .single()
        : await infiltradoClient
            .from('infiltrado_partidas')
            .insert({ ...datosPartida, modo: 'offline' })
            .select('id')
            .single();

    if (!partidaActualId && faltaColumnaModo(resultado.error)) {
        resultado = await infiltradoClient
            .from('infiltrado_partidas')
            .insert(datosPartida)
            .select('id')
            .single();
    }

    if (resultado.error) {
        abrirModal('Error', 'No se pudo guardar la partida.');
        return false;
    }

    partidaActualId = resultado.data.id;
    const { error: eliminarJugadoresError } = await infiltradoClient
        .from('infiltrado_jugadores')
        .delete()
        .eq('partida_id', partidaActualId);

    if (eliminarJugadoresError) {
        abrirModal('Error', 'No se pudieron actualizar los jugadores.');
        return false;
    }

    const filas = jugadores.map((nombre, orden) => ({
        partida_id: partidaActualId,
        nombre,
        infiltrado: infiltradosAsignados.includes(nombre),
        orden
    }));
    const { error: jugadoresError } = await infiltradoClient.from('infiltrado_jugadores').insert(filas);
    if (jugadoresError) {
        abrirModal('Error', 'No se pudieron guardar los jugadores.');
        return false;
    }

    const { error: palabraError } = await infiltradoClient
        .from('infiltrado_palabras_usadas')
        .insert({ partida_id: partidaActualId, palabra: lugarSecreto });

    if (palabraError) {
        abrirModal('Error', 'No se pudo guardar el historial de palabras.');
        return false;
    }

    return true;
}

async function actualizarProgreso() {
    if (!partidaActualId) return;
    await infiltradoClient
        .from('infiltrado_partidas')
        .update({ fase: faseActual, jugador_actual: jugadorActualIndex, updated_at: new Date().toISOString() })
        .eq('id', partidaActualId);
}

async function eliminarPartidaTemporal() {
    let resultado = await infiltradoClient.from('infiltrado_partidas').select('id').eq('modo', 'offline').limit(1);
    if (faltaColumnaModo(resultado.error)) {
        resultado = await infiltradoClient.from('infiltrado_partidas').select('id').limit(1);
    }
    if (resultado.data?.length) await infiltradoClient.from('infiltrado_partidas').delete().eq('id', resultado.data[0].id);
    partidaActualId = null;
}

function prepararTurnoJugador() {
    document.getElementById('player-turn-player').textContent = jugadores[jugadorActualIndex];
    document.getElementById('reveal-area').textContent = 'MANTÉN PULSADO PARA VER';
    document.getElementById('btn-next-player').textContent = jugadorActualIndex === jugadores.length - 1 ? 'Comenzar Partida' : 'Siguiente Jugador';
}

function mostrarRol() {
    document.getElementById('reveal-area').textContent = roles[jugadores[jugadorActualIndex]];
}

function ocultarRol() {
    document.getElementById('reveal-area').textContent = 'MANTÉN PULSADO PARA VER';
}

async function siguienteJugador() {
    if (jugadorActualIndex < jugadores.length - 1) {
        jugadorActualIndex++;
        await actualizarProgreso();
        prepararTurnoJugador();
    } else {
        faseActual = 'PARTIDA';
        await actualizarProgreso();
        prepararPantallaResolucion();
        cambiarPantallaVisual('screen-game');
    }
}

function prepararPantallaResolucion() {
    const contenedor = document.getElementById('infiltrado-inputs-evaluation');
    contenedor.innerHTML = '';

    infiltradosAsignados.forEach((_, indice) => {
        const select = document.createElement('select');
        select.className = 'guess-infiltrado';
        select.setAttribute('aria-label', `Nombre del Infiltrado ${indice + 1}`);
        select.innerHTML = `<option value="">Selecciona infiltrado ${indice + 1}</option>`;
        jugadores.forEach((nombre) => {
            const opcion = document.createElement('option');
            opcion.value = nombre;
            opcion.textContent = nombre;
            select.appendChild(opcion);
        });
        contenedor.appendChild(select);
    });
}

function evaluarInfiltrados() {
    const respuestas = Array.from(document.querySelectorAll('.guess-infiltrado')).map((input) => input.value.toLowerCase()).filter(Boolean);
    const correctos = infiltradosAsignados.map((nombre) => nombre.toLowerCase());
    const acierto = correctos.every((nombre) => respuestas.includes(nombre)) && respuestas.length === correctos.length;
    abrirModal(acierto ? '¡ENHORABUENA!' : 'Fallo', acierto ? `Habéis descubierto a todos los infiltrados: ${infiltradosAsignados.join(' y ')}.` : 'Esos no son los infiltrados o falta alguno. ¡Seguid debatiendo!', acierto);
}

function rendirse() {
    abrirModal('Partida Terminada', `Infiltrado/s: ${infiltradosAsignados.join(' y ')}. Palabra secreta: ${lugarSecreto}.`, true);
}

async function reiniciarMismosJugadores() {
    await ejecutarMezclaYAsignacion();
}

async function reiniciarTodoSistema() {
    await eliminarPartidaTemporal();
    jugadores = [];
    roles = {};
    infiltradosAsignados = [];
    jugadorActualIndex = 0;
    lugarSecreto = '';
    faseActual = 'CONFIGURACION';
    document.getElementById('container-names').innerHTML = '';
    document.getElementById('btn-continue').style.display = 'block';
    document.getElementById('btn-start').style.display = 'none';
    restaurarConfiguracionBase();
    cambiarPantallaVisual('screen-config');
}

function esDispositivoIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
        || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function estaInstaladaPwa() {
    const iniciadaDesdeManifest = new URLSearchParams(window.location.search).get('pwa') === '1';
    if (iniciadaDesdeManifest) sessionStorage.setItem('infiltrado_pwa_mode', '1');

    return iniciadaDesdeManifest
        || sessionStorage.getItem('infiltrado_pwa_mode') === '1'
        || window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true
        || document.referrer.startsWith('android-app://');
}

function actualizarNavegacionPwa() {
    const modoPwa = estaInstaladaPwa();
    document.documentElement.classList.toggle('pwa-standalone', modoPwa);
    document.body.classList.toggle('pwa-standalone', modoPwa);
    document.querySelectorAll('.hide-in-pwa').forEach((control) => {
        control.hidden = modoPwa;
    });
}

function actualizarBotonInstalacionPwa() {
    const boton = document.querySelector('.infiltrado-install-button');
    boton.hidden = !accesoInfiltradoValidado || estaInstaladaPwa() || (!instalacionPwaPendiente && !esDispositivoIos());
}

async function solicitarInstalacionPwa() {
    if (estaInstaladaPwa()) {
        actualizarBotonInstalacionPwa();
        return;
    }

    if (esDispositivoIos()) {
        abrirModal('Instalar aplicación en iOS', '1. Pulsa el botón Compartir de Safari.\n2. Selecciona "Añadir a pantalla de inicio".\n3. Confirma la instalación.');
        return;
    }

    if (!instalacionPwaPendiente) return;
    instalacionPwaPendiente.prompt();
    const resultado = await instalacionPwaPendiente.userChoice;
    instalacionPwaPendiente = null;
    if (resultado.outcome === 'accepted') actualizarBotonInstalacionPwa();
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    instalacionPwaPendiente = event;
    actualizarBotonInstalacionPwa();
});

window.addEventListener('appinstalled', () => {
    instalacionPwaPendiente = null;
    actualizarBotonInstalacionPwa();
});

window.addEventListener('load', () => {
    actualizarNavegacionPwa();
    document.getElementById('infiltradoLoginForm').addEventListener('submit', iniciarSesion);
    restaurarConfiguracionBase();
    comprobarSesion();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});

window.addEventListener('pageshow', actualizarNavegacionPwa);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) actualizarNavegacionPwa();
});

['standalone', 'fullscreen', 'minimal-ui'].forEach((modo) => {
    window.matchMedia(`(display-mode: ${modo})`).addEventListener?.('change', actualizarNavegacionPwa);
});
