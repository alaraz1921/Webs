const INFILTRADO_ONLINE_TOKEN_KEY = 'infiltrado_online_player_token';
const INFILTRADO_ONLINE_CODE_KEY = 'infiltrado_online_codigo';
const INFILTRADO_ONLINE_PARTIDA_KEY = 'infiltrado_online_partida_id';
const INFILTRADO_ONLINE_SESSIONS_KEY = 'infiltrado_online_sessions';
const INFILTRADO_ONLINE_POLL_MS = 5000;

// El token identifica al jugador invitado sin crear una cuenta de Supabase Auth.
let estadoOnline = null;
let canalOnline = null;
let intervaloOnline = null;
let accesoOnlineAutenticado = false;
let mostrarSalaTrasFinal = false;
let actualizacionOnlineEnCurso = false;
let resolucionOnlineEnCurso = false;
let avisoFinOnlineVisible = false;

function actualizarControlesContextualesInfiltrado(idPantalla) {
    const mostrarControlesOnline = ['screen-online-lobby', 'screen-online-role'].includes(idPantalla);
    document.getElementById('online-context-actions').hidden = !mostrarControlesOnline;
    document.getElementById('infiltrado-general-help').hidden = mostrarControlesOnline;
}

function mostrarSeleccionModoInfiltrado() {
    detenerActualizacionOnline();
    accesoOnlineAutenticado = true;
    cambiarPantallaVisual('screen-mode');
}

function abrirModoOnlineAutenticado() {
    accesoOnlineAutenticado = true;
    document.getElementById('online-create-button').hidden = false;
    document.getElementById('online-mode-back').hidden = false;
    cambiarPantallaVisual('screen-online-menu');
}

async function abrirModoOnlineDesdeSeleccion() {
    const { data } = await infiltradoClient.auth.getSession();
    if (data.session?.user && sesionInfiltradoVigente()) {
        abrirModoOnlineAutenticado();
    } else {
        abrirAccesoOnlineInvitado();
    }
}

function abrirAccesoOnlineInvitado() {
    accesoOnlineAutenticado = false;
    document.getElementById('online-create-button').hidden = true;
    document.getElementById('online-mode-back').hidden = false;
    cambiarPantallaVisual('screen-online-menu');
}

function volverDesdeMenuOnline() {
    if (accesoOnlineAutenticado) {
        cambiarPantallaVisual('screen-mode');
    } else {
        cambiarPantallaVisual('screen-lock');
    }
}

function generarCampoModal(id, etiqueta, opciones = {}) {
    const wrapper = document.createElement('label');
    wrapper.className = 'online-modal-field';
    wrapper.textContent = etiqueta;

    const input = document.createElement('input');
    input.id = id;
    input.type = opciones.type || 'text';
    input.placeholder = opciones.placeholder || '';
    input.maxLength = opciones.maxLength || 80;
    input.autocomplete = opciones.autocomplete || 'off';
    if (opciones.inputMode) input.inputMode = opciones.inputMode;
    wrapper.appendChild(input);
    return wrapper;
}

function abrirFormularioOnline(titulo, mensaje, campos, confirmar) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-message').textContent = mensaje;
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    campos.forEach((campo) => contenedor.appendChild(generarCampoModal(campo.id, campo.etiqueta, campo)));

    const botonConfirmar = document.createElement('button');
    botonConfirmar.textContent = 'Confirmar';
    botonConfirmar.onclick = async () => {
        botonConfirmar.disabled = true;
        await confirmar();
        botonConfirmar.disabled = false;
    };
    contenedor.appendChild(botonConfirmar);

    const cancelar = document.createElement('button');
    cancelar.textContent = 'Cancelar';
    cancelar.className = 'btn-danger';
    cancelar.onclick = cerrarModal;
    contenedor.appendChild(cancelar);

    document.getElementById('custom-modal').style.display = 'flex';
    window.setTimeout(() => document.getElementById(campos[0].id)?.focus(), 50);
}

function solicitarCrearPartidaOnline() {
    abrirFormularioOnline(
        'Crear partida online',
        'Indica el nombre con el que aparecerás como anfitrión.',
        [{ id: 'online-modal-name', etiqueta: 'Nombre del jugador', autocomplete: 'nickname' }],
        crearPartidaOnline
    );
}

async function crearPartidaOnline() {
    const nombre = document.getElementById('online-modal-name').value.trim();
    if (nombre.length < 2) {
        abrirModal('Nombre no válido', 'El nombre debe tener al menos 2 caracteres.');
        return;
    }

    const { data, error } = await infiltradoClient.rpc('infiltrado_online_create', { p_nombre: nombre });
    if (error || !data?.ok) {
        abrirModal('Error', data?.message || 'No se pudo crear la partida online.');
        return;
    }

    guardarSesionOnline(data.codigo_publico, data.player_token, data.partida_id);
    cerrarModal();
    await actualizarSalaOnline();
}

function solicitarUnirsePartidaOnline() {
    abrirFormularioOnline(
        'Unirse a partida',
        'Introduce el código de tres cifras.',
        [{ id: 'online-modal-code', etiqueta: 'Código de partida', inputMode: 'numeric', maxLength: 3, placeholder: '001' }],
        accederPartidaOnlinePorCodigo
    );
}

async function accederPartidaOnlinePorCodigo() {
    const codigoIntroducido = document.getElementById('online-modal-code').value.trim();
    const codigo = codigoIntroducido.padStart(3, '0');
    if (!codigoIntroducido || !/^\d{3}$/.test(codigo)) {
        abrirModal('Código no válido', 'Introduce un código de partida de tres cifras.');
        return;
    }

    if (await reanudarComoAnfitrion(codigo) || await reanudarSesionGuardada(codigo)) {
        cerrarModal();
        await actualizarSalaOnline();
        return;
    }

    const validacion = await validarCodigoPartidaOnline(codigo);
    if (!validacion.ok) {
        abrirModal('No se pudo entrar', validacion.message);
        return;
    }

    solicitarNombreNuevoJugador(codigo);
}

async function validarCodigoPartidaOnline(codigo) {
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_exists', { p_codigo: codigo });
    if (error || !data?.ok) {
        return { ok: false, message: data?.message || 'La partida no existe.' };
    }
    return { ok: true };
}

function solicitarNombreNuevoJugador(codigo) {
    abrirFormularioOnline(
        'Unirse a partida',
        `Partida ${codigo}. Indica el nombre con el que aparecerás.`,
        [{ id: 'online-modal-name', etiqueta: 'Nombre del jugador', autocomplete: 'nickname' }],
        () => unirsePartidaOnline(codigo)
    );
}

async function unirsePartidaOnline(codigo) {
    const nombre = document.getElementById('online-modal-name').value.trim();
    if (nombre.length < 2) {
        abrirModal('Nombre no válido', 'El nombre debe tener al menos 2 caracteres.');
        return;
    }

    const { data, error } = await infiltradoClient.rpc('infiltrado_online_join', {
        p_codigo: codigo,
        p_nombre: nombre
    });

    if (error || !data?.ok) {
        abrirModal('No se pudo entrar', data?.message || 'La partida no existe.');
        return;
    }

    guardarSesionOnline(codigo, data.player_token, data.partida_id);
    mostrarSalaTrasFinal = true;
    cerrarModal();
    await actualizarSalaOnline();
}

function leerSesionesOnline() {
    try {
        return JSON.parse(localStorage.getItem(INFILTRADO_ONLINE_SESSIONS_KEY) || '{}');
    } catch {
        return {};
    }
}

function guardarRegistroSesionOnline(codigo, token, partidaId) {
    const sesiones = leerSesionesOnline();
    sesiones[codigo] = { playerToken: token, partidaId };
    localStorage.setItem(INFILTRADO_ONLINE_SESSIONS_KEY, JSON.stringify(sesiones));
}

function eliminarRegistroSesionOnline(codigo) {
    const sesiones = leerSesionesOnline();
    delete sesiones[codigo];
    localStorage.setItem(INFILTRADO_ONLINE_SESSIONS_KEY, JSON.stringify(sesiones));
}

function guardarSesionOnline(codigo, token, partidaId) {
    localStorage.setItem(INFILTRADO_ONLINE_CODE_KEY, codigo);
    localStorage.setItem(INFILTRADO_ONLINE_TOKEN_KEY, token);
    localStorage.setItem(INFILTRADO_ONLINE_PARTIDA_KEY, partidaId);
    guardarRegistroSesionOnline(codigo, token, partidaId);
    mostrarSalaTrasFinal = false;
}

function limpiarSesionOnline(olvidarSesion = false) {
    const codigo = localStorage.getItem(INFILTRADO_ONLINE_CODE_KEY);
    if (olvidarSesion && codigo) eliminarRegistroSesionOnline(codigo);
    localStorage.removeItem(INFILTRADO_ONLINE_CODE_KEY);
    localStorage.removeItem(INFILTRADO_ONLINE_TOKEN_KEY);
    localStorage.removeItem(INFILTRADO_ONLINE_PARTIDA_KEY);
    estadoOnline = null;
    detenerActualizacionOnline();
}

async function validarSesionOnline(codigo, token, partidaId) {
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_state', {
        p_codigo: codigo,
        p_player_token: token
    });

    if (error || !data?.ok) return false;
    guardarSesionOnline(codigo, token, partidaId || data.partida_id);
    estadoOnline = await aplicarCaducidadAnfitrion(data);
    accesoOnlineAutenticado = Boolean(estadoOnline.es_anfitrion);
    return true;
}

async function reanudarComoAnfitrion(codigo) {
    const { data: sesion } = await infiltradoClient.auth.getSession();
    if (!sesion.session?.user || !sesionInfiltradoVigente()) return false;

    const { data, error } = await infiltradoClient.rpc('infiltrado_online_resume_host', { p_codigo: codigo });
    if (error || !data?.ok) return false;
    guardarSesionOnline(codigo, data.player_token, data.partida_id);
    accesoOnlineAutenticado = true;
    return true;
}

async function reanudarSesionGuardada(codigo) {
    const sesion = leerSesionesOnline()[codigo];
    if (!sesion?.playerToken) return false;

    const valida = await validarSesionOnline(codigo, sesion.playerToken, sesion.partidaId);
    if (!valida) eliminarRegistroSesionOnline(codigo);
    return valida;
}

async function aplicarCaducidadAnfitrion(data) {
    if (!data?.es_anfitrion || sesionInfiltradoVigente()) return data;

    await infiltradoClient.auth.signOut();
    localStorage.removeItem(GAMES_AUTH_TIME_KEY);
    return { ...data, es_anfitrion: false };
}

async function restaurarSesionOnline() {
    const codigo = localStorage.getItem(INFILTRADO_ONLINE_CODE_KEY);
    const token = localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY);
    if (!codigo || !token) return false;

    const { data, error } = await infiltradoClient.rpc('infiltrado_online_state', {
        p_codigo: codigo,
        p_player_token: token
    });

    if (error) return false;
    if (!data?.ok) {
        limpiarSesionOnline(true);
        return false;
    }

    estadoOnline = await aplicarCaducidadAnfitrion(data);
    accesoOnlineAutenticado = Boolean(estadoOnline.es_anfitrion);
    if (estadoOnline.es_anfitrion) await cargarCategorias();
    renderizarEstadoOnline();
    iniciarActualizacionOnline();
    return true;
}

async function actualizarSalaOnline() {
    if (actualizacionOnlineEnCurso) return;
    const codigo = localStorage.getItem(INFILTRADO_ONLINE_CODE_KEY);
    const token = localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY);
    if (!codigo || !token) {
        abrirAccesoOnlineInvitado();
        return;
    }

    actualizacionOnlineEnCurso = true;
    try {
        const { data, error } = await infiltradoClient.rpc('infiltrado_online_state', {
            p_codigo: codigo,
            p_player_token: token
        });

        if (error) {
            console.warn('No se pudo actualizar la sala online.', error);
            return;
        }
        if (!data?.ok) {
            const mensaje = data?.message || 'El acceso a la sala ya no es válido.';
            limpiarSesionOnline(true);
            abrirModal('Sala no disponible', mensaje);
            abrirAccesoOnlineInvitado();
            return;
        }

        estadoOnline = await aplicarCaducidadAnfitrion(data);
        renderizarEstadoOnline();
        iniciarActualizacionOnline();
    } finally {
        actualizacionOnlineEnCurso = false;
    }
}

function renderizarEstadoOnline() {
    if (!estadoOnline) return;

    if (estadoOnline.estado_online === 'started') {
        mostrarSalaTrasFinal = false;
        avisoFinOnlineVisible = false;
        if (document.getElementById('screen-online-role').classList.contains('active')) return;
        renderizarRolOnline();
    } else if (estadoOnline.estado_online === 'finished' && resolucionOnlineEnCurso) {
        return;
    } else if (estadoOnline.estado_online === 'finished' && !mostrarSalaTrasFinal && !estadoOnline.jugador_nuevo_tras_final) {
        mostrarAvisoFinRondaOnline();
    } else {
        renderizarSalaOnline();
    }
}

function renderizarSalaOnline() {
    cambiarPantallaVisual('screen-online-lobby');
    document.getElementById('online-lobby-title').textContent = `Partida ${estadoOnline.codigo_publico}`;
    document.getElementById('online-lobby-status').textContent = estadoOnline.estado_online === 'finished'
        ? 'Partida finalizada · lista abierta'
        : estadoOnline.es_anfitrion ? 'Sala de partida' : 'ESPERANDO JUGADORES';

    const lista = document.getElementById('online-players-list');
    lista.innerHTML = '';
    estadoOnline.jugadores.forEach((jugador) => {
        const item = document.createElement('li');
        const nombre = document.createElement('span');
        nombre.textContent = `${jugador.es_anfitrion ? 'ANFITRIÓN · ' : ''}${jugador.nombre}`;
        item.appendChild(nombre);

        if (estadoOnline.es_anfitrion && !jugador.es_anfitrion) {
            const eliminar = document.createElement('button');
            eliminar.type = 'button';
            eliminar.className = 'online-remove-player';
            eliminar.textContent = 'Eliminar';
            eliminar.onclick = () => eliminarJugadorOnline(jugador.id);
            item.appendChild(eliminar);
        }
        lista.appendChild(item);
    });

    const configuracion = document.getElementById('online-host-config');
    configuracion.hidden = !estadoOnline.es_anfitrion;
    document.getElementById('online-start-button').hidden = !estadoOnline.es_anfitrion;
    document.getElementById('online-host-end-game').hidden = !estadoOnline.es_anfitrion;
    document.getElementById('online-total-infiltrados').value = String(estadoOnline.numero_infiltrados || 1);
    document.getElementById('online-tipo-palabra').value = estadoOnline.tipo_palabra || 'Aleatoria';
}

function renderizarRolOnline() {
    cambiarPantallaVisual('screen-online-role');
    document.getElementById('online-role-player').textContent = `${estadoOnline.nombre_jugador} · Partida ${estadoOnline.codigo_publico}`;
    const esInfiltrado = estadoOnline.rol === 'infiltrado';
    document.getElementById('online-role-heading').textContent = esInfiltrado ? 'Eres el infiltrado' : 'Tu palabra es';
    document.getElementById('online-role-value').textContent = esInfiltrado ? 'INFILTRADO' : estadoOnline.palabra_oculta;

    const resolucion = document.getElementById('online-host-resolution');
    resolucion.hidden = !estadoOnline.es_anfitrion;
    document.getElementById('online-guest-leave-game').hidden = estadoOnline.es_anfitrion;
    if (!estadoOnline.es_anfitrion) return;

    const contenedor = document.getElementById('online-suspect-selects');
    contenedor.innerHTML = '';
    for (let indice = 0; indice < estadoOnline.numero_infiltrados; indice++) {
        const select = document.createElement('select');
        select.className = 'online-suspect-select';
        select.innerHTML = `<option value="">Selecciona infiltrado ${indice + 1}</option>`;
        estadoOnline.jugadores.forEach((jugador) => {
            const opcion = document.createElement('option');
            opcion.value = jugador.id;
            opcion.textContent = jugador.nombre;
            select.appendChild(opcion);
        });
        contenedor.appendChild(select);
    }
}

function mostrarAvisoFinRondaOnline() {
    if (avisoFinOnlineVisible) return;
    avisoFinOnlineVisible = true;

    const finalizadaPorAnfitrion = estadoOnline.finalizacion_online === 'host_ended';
    const infiltrados = (estadoOnline.resultado?.infiltrados_reales || []).join(' y ') || '---';
    document.getElementById('modal-title').textContent = 'Ronda terminada';
    document.getElementById('modal-message').textContent = finalizadaPorAnfitrion
        ? 'El anfitrión ha finalizado esta ronda. Continuar a la sala de espera de jugadores.'
        : `Ronda terminada. Infiltrado: ${infiltrados}. Palabra secreta: ${estadoOnline.palabra_oculta || '---'}`;
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    const aceptar = document.createElement('button');
    aceptar.textContent = 'Aceptar';
    aceptar.onclick = () => {
        cerrarModal();
        avisoFinOnlineVisible = false;
        mostrarSalaTrasFinal = true;
        renderizarSalaOnline();
    };
    contenedor.appendChild(aceptar);
    document.getElementById('custom-modal').style.display = 'flex';
}

async function iniciarPartidaOnline() {
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_start', {
        p_partida_id: estadoOnline.partida_id,
        p_player_token: localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY),
        p_numero_infiltrados: Number(document.getElementById('online-total-infiltrados').value),
        p_tipo_palabra: document.getElementById('online-tipo-palabra').value
    });

    if (error || !data?.ok) {
        abrirModal('No se pudo iniciar', data?.message || 'Comprueba que haya suficientes jugadores.');
        return;
    }

    mostrarSalaTrasFinal = false;
    avisoFinOnlineVisible = false;
    await actualizarSalaOnline();
}

async function finalizarPartidaOnline() {
    const seleccionados = Array.from(document.querySelectorAll('.online-suspect-select')).map((select) => Number(select.value) || null);
    if (seleccionados.filter(Boolean).length !== estadoOnline.numero_infiltrados) {
        abrirModal('Selección incompleta', 'Selecciona quiénes crees que eran los infiltrados.');
        return;
    }
    if (new Set(seleccionados).size !== seleccionados.length) {
        abrirModal('Selección no válida', 'Selecciona una persona distinta por cada infiltrado.');
        return;
    }

    resolucionOnlineEnCurso = true;
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_finish', {
        p_partida_id: estadoOnline.partida_id,
        p_player_token: localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY),
        p_sospechoso_1: seleccionados[0],
        p_sospechoso_2: seleccionados[1] || null
    });

    if (error || !data?.ok) {
        resolucionOnlineEnCurso = false;
        abrirModal('No se pudo resolver', data?.message || 'Inténtalo de nuevo.');
        return;
    }

    if (!data.acierto) {
        resolucionOnlineEnCurso = false;
        abrirModal('Resultado incorrecto', 'Los jugadores seleccionados no son todos los infiltrados. Puedes volver a intentarlo.');
        return;
    }

    resolucionOnlineEnCurso = false;
    await actualizarSalaOnline();
}

function solicitarTerminarRondaOnline() {
    document.getElementById('modal-title').textContent = 'Terminar ronda';
    document.getElementById('modal-message').textContent = '¿Quieres terminar esta ronda sin resolver quiénes son los infiltrados?';
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    const confirmar = document.createElement('button');
    confirmar.textContent = 'Terminar ronda';
    confirmar.className = 'btn-danger';
    confirmar.onclick = terminarRondaOnline;
    contenedor.appendChild(confirmar);

    const cancelar = document.createElement('button');
    cancelar.textContent = 'Cancelar';
    cancelar.onclick = cerrarModal;
    contenedor.appendChild(cancelar);
    document.getElementById('custom-modal').style.display = 'flex';
}

async function terminarRondaOnline() {
    resolucionOnlineEnCurso = true;
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_end_round', {
        p_partida_id: estadoOnline.partida_id,
        p_player_token: localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY)
    });

    if (error || !data?.ok) {
        resolucionOnlineEnCurso = false;
        abrirModal('No se pudo terminar', data?.message || 'Inténtalo de nuevo.');
        return;
    }

    cerrarModal();
    resolucionOnlineEnCurso = false;
    mostrarSalaTrasFinal = true;
    estadoOnline = { ...estadoOnline, estado_online: 'finished', finalizacion_online: 'host_ended' };
    renderizarSalaOnline();
    await actualizarSalaOnline();
}

async function eliminarJugadorOnline(jugadorId) {
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_remove_player', {
        p_partida_id: estadoOnline.partida_id,
        p_player_token: localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY),
        p_jugador_id: jugadorId
    });

    if (error || !data?.ok) {
        abrirModal('No se pudo eliminar', data?.message || 'Inténtalo de nuevo.');
        return;
    }
    await actualizarSalaOnline();
}

function solicitarAbandonarPartidaOnline() {
    document.getElementById('modal-title').textContent = 'Abandonar partida';
    document.getElementById('modal-message').textContent = '¿Quieres abandonar esta partida e introducir el código de otra partida?';
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    const confirmar = document.createElement('button');
    confirmar.textContent = 'Abandonar partida';
    confirmar.className = 'btn-danger';
    confirmar.onclick = () => abandonarPartidaOnline(false);
    contenedor.appendChild(confirmar);

    const cancelar = document.createElement('button');
    cancelar.textContent = 'Cancelar';
    cancelar.onclick = cerrarModal;
    contenedor.appendChild(cancelar);
    document.getElementById('custom-modal').style.display = 'flex';
}

function solicitarTerminarPartidaOnline() {
    document.getElementById('modal-title').textContent = 'Terminar partida';
    document.getElementById('modal-message').textContent = 'Si terminas la partida, se eliminará por completo para todos los jugadores.';
    const contenedor = document.getElementById('modal-buttons');
    contenedor.innerHTML = '';

    const confirmar = document.createElement('button');
    confirmar.textContent = 'Terminar partida';
    confirmar.className = 'btn-danger';
    confirmar.onclick = () => abandonarPartidaOnline(true);
    contenedor.appendChild(confirmar);

    const cancelar = document.createElement('button');
    cancelar.textContent = 'Cancelar';
    cancelar.onclick = cerrarModal;
    contenedor.appendChild(cancelar);
    document.getElementById('custom-modal').style.display = 'flex';
}

async function abandonarPartidaOnline(terminarPartida) {
    const codigo = localStorage.getItem(INFILTRADO_ONLINE_CODE_KEY);
    const { data, error } = await infiltradoClient.rpc('infiltrado_online_leave', {
        p_partida_id: estadoOnline.partida_id,
        p_player_token: localStorage.getItem(INFILTRADO_ONLINE_TOKEN_KEY)
    });

    if (error || !data?.ok) {
        abrirModal('No se pudo abandonar', data?.message || 'Inténtalo de nuevo.');
        return;
    }

    cerrarModal();
    if (codigo) eliminarRegistroSesionOnline(codigo);
    limpiarSesionOnline();
    accesoOnlineAutenticado = false;
    if (terminarPartida) {
        cambiarPantallaVisual('screen-mode');
    } else {
        abrirAccesoOnlineInvitado();
        solicitarUnirsePartidaOnline();
    }
}

function iniciarActualizacionOnline() {
    if (!intervaloOnline) intervaloOnline = window.setInterval(actualizarSalaOnline, INFILTRADO_ONLINE_POLL_MS);
    if (!estadoOnline?.es_anfitrion || canalOnline) return;

    // Realtime acelera los cambios del anfitrión; el sondeo periódico permanece como respaldo.
    canalOnline = infiltradoClient
        .channel(`infiltrado-online-${estadoOnline.partida_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltrado_jugadores', filter: `partida_id=eq.${estadoOnline.partida_id}` }, actualizarSalaOnline)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'infiltrado_partidas', filter: `id=eq.${estadoOnline.partida_id}` }, actualizarSalaOnline)
        .subscribe();
}

function detenerActualizacionOnline() {
    if (intervaloOnline) window.clearInterval(intervaloOnline);
    intervaloOnline = null;
    if (canalOnline) infiltradoClient.removeChannel(canalOnline);
    canalOnline = null;
}
