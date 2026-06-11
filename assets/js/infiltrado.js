const infiltradoClient = window.websSupabase;
const DEMO_EMAIL = 'demo@alaraz1921.com';

let jugadores = [];
let roles = {};
let infiltradosAsignados = [];
let jugadorActualIndex = 0;
let lugarSecreto = '';
let faseActual = 'CONFIGURACION';
let partidaActualId = null;
let instalacionPwaPendiente = null;

const selectP = document.getElementById('totalPlayers');
for (let numero = 3; numero <= 20; numero++) {
    const opcion = document.createElement('option');
    opcion.value = numero;
    opcion.textContent = `${numero} Jugadores`;
    selectP.appendChild(opcion);
}

function normalizarUsuario(usuario) {
    const valor = usuario.trim().toLowerCase();
    return valor.includes('@') ? valor : valor === 'demo' ? DEMO_EMAIL : valor;
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

    const usuarioIntroducido = document.getElementById('infiltradoUsuario').value.trim().toLowerCase();
    const claveIntroducida = document.getElementById('infiltradoClave').value;
    const { error } = await infiltradoClient.auth.signInWithPassword({
        email: normalizarUsuario(usuarioIntroducido),
        password: usuarioIntroducido === 'demo' && claveIntroducida === '123' ? 'demo123' : claveIntroducida
    });

    if (error || !(await usuarioPuedeUsarInfiltrado())) {
        await infiltradoClient.auth.signOut();
        errorBox.style.display = 'block';
        boton.disabled = false;
        boton.textContent = 'ENTRAR';
        return;
    }

    document.getElementById('infiltradoClave').value = '';
    await iniciarAplicacion();
}

async function comprobarSesion() {
    const { data } = await infiltradoClient.auth.getSession();
    if (data.session?.user && await usuarioPuedeUsarInfiltrado()) {
        await iniciarAplicacion();
        return;
    }

    cambiarPantallaVisual('screen-lock');
    document.getElementById('infiltradoUsuario').focus();
}

async function iniciarAplicacion() {
    await cargarCategorias();
    restaurarConfiguracionBase();
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

    const select = document.getElementById('tipoPalabra');
    [...new Set(data.map((fila) => fila.tipo))].forEach((tipo) => {
        if ([...select.options].some((opcion) => opcion.value === tipo)) return;
        const opcion = document.createElement('option');
        opcion.value = tipo;
        opcion.textContent = tipo;
        select.appendChild(opcion);
    });
}

async function cargarPartidaTemporal() {
    const { data: partidas, error } = await infiltradoClient
        .from('infiltrado_partidas')
        .select('id, numero_jugadores, numero_infiltrados, tipo_palabra, palabra_oculta, fase, jugador_actual')
        .limit(1);

    if (error || !partidas?.length) {
        faseActual = 'CONFIGURACION';
        cambiarPantallaVisual('screen-config');
        return;
    }

    const partida = partidas[0];
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
    return data[Math.floor(Math.random() * data.length)].palabra;
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
        lugarSecreto = await obtenerPalabraSecreta(tipoPalabra);
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
    await eliminarPartidaTemporal();
    const { data, error } = await infiltradoClient
        .from('infiltrado_partidas')
        .insert({
            numero_jugadores: jugadores.length,
            numero_infiltrados: numeroInfiltrados,
            tipo_palabra: tipoPalabra,
            palabra_oculta: lugarSecreto,
            fase: faseActual,
            jugador_actual: jugadorActualIndex
        })
        .select('id')
        .single();

    if (error) {
        abrirModal('Error', 'No se pudo guardar la partida.');
        return false;
    }

    partidaActualId = data.id;
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
    const { data } = await infiltradoClient.from('infiltrado_partidas').select('id').limit(1);
    if (data?.length) await infiltradoClient.from('infiltrado_partidas').delete().eq('id', data[0].id);
    partidaActualId = null;
}

function prepararTurnoJugador() {
    document.getElementById('player-turn-name').textContent = `Turno de: ${jugadores[jugadorActualIndex]}`;
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

async function solicitarInstalacionPwa() {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
        abrirModal('Instalación', 'Infiltrado ya está instalado en este dispositivo.');
        return;
    }
    if (!instalacionPwaPendiente) {
        abrirModal('Instalación', 'Abre el menú del navegador y selecciona Instalar aplicación o Añadir a pantalla de inicio.');
        return;
    }
    instalacionPwaPendiente.prompt();
    await instalacionPwaPendiente.userChoice;
    instalacionPwaPendiente = null;
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    instalacionPwaPendiente = event;
});

window.addEventListener('load', () => {
    document.getElementById('infiltradoLoginForm').addEventListener('submit', iniciarSesion);
    restaurarConfiguracionBase();
    comprobarSesion();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});
