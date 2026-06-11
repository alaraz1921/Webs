const bingoClient = window.websSupabase;
const CARTON_KEY = 'bingo_perm_matrizCarton';
const MARKS_KEY = 'bingo_perm_tachados';
const PARTIDA_KEY = 'bingo_partida_id';

let matrizCarton = [];
let posicionesTachadas = [];
let partidaActual = null;
let instalacionPwaPendiente = null;

function cerrarMenuBingo() {
    const menu = document.getElementById('bingoMenuList');
    const toggle = document.getElementById('bingoMenuToggle');
    if (!menu || !toggle) return;

    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
}

function inicializarMenuBingo() {
    const toggle = document.getElementById('bingoMenuToggle');
    const menu = document.getElementById('bingoMenuList');
    const helpButton = document.getElementById('bingoHelpMenuBtn');

    if (!toggle || !menu) return;

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const estaAbierto = menu.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(estaAbierto));
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.bingo-top-menu')) cerrarMenuBingo();
    });

    helpButton?.addEventListener('click', () => {
        cerrarMenuBingo();
        mostrarAyudaBingo();
    });
}

function mostrarConfirmacion(texto, callback) {
    document.getElementById('textoModalConfirm').innerHTML = texto;
    const modal = document.getElementById('miModalConfirm');
    modal.style.display = 'flex';

    document.getElementById('btnModalConfirmSi').onclick = () => {
        modal.style.display = 'none';
        callback();
    };
    document.getElementById('btnModalConfirmNo').onclick = () => {
        modal.style.display = 'none';
    };
}

function mostrarAlerta(texto) {
    document.getElementById('textoModalAlert').innerHTML = texto;
    document.getElementById('miModalAlert').style.display = 'flex';
}

function cerrarModalAlert() {
    document.getElementById('miModalAlert').style.display = 'none';
}

function abrirSelectorPartida() {
    const input = document.getElementById('inputPartidaId');
    input.value = partidaActual?.id || '';
    document.getElementById('partidaModal').style.display = 'flex';
    input.focus();
}

function cerrarSelectorPartida() {
    document.getElementById('partidaModal').style.display = 'none';
}

async function seleccionarPartida() {
    const id = Number(document.getElementById('inputPartidaId').value);
    if (!Number.isInteger(id) || id < 100 || id > 999) {
        mostrarAlerta('Introduce un id de partida valido de 3 cifras.');
        return;
    }

    const partida = await buscarPartida(id);
    if (!partida) {
        mostrarAlerta('La partida indicada no existe.');
        return;
    }

    if (partidaActual?.id !== partida.id) {
        posicionesTachadas = [];
        guardarCarton();
        dibujarCartonHTML();
    }

    partidaActual = partida;
    localStorage.setItem(PARTIDA_KEY, String(partida.id));
    actualizarIdPartida();
    cerrarSelectorPartida();
}

async function buscarPartida(id) {
    const { data, error } = await bingoClient
        .from('bingo_partidas')
        .select('id, iniciada')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        mostrarAlerta('No se pudo consultar la partida. Intentalo de nuevo.');
        return null;
    }

    return data;
}

function actualizarIdPartida() {
    document.getElementById('partidaId').textContent = partidaActual?.id || '---';
}

function cargarCartonGuardado() {
    const cartonGuardado = localStorage.getItem(CARTON_KEY);
    const tachadosGuardados = localStorage.getItem(MARKS_KEY);

    if (cartonGuardado) {
        matrizCarton = JSON.parse(cartonGuardado);
        posicionesTachadas = tachadosGuardados ? JSON.parse(tachadosGuardados) : [];
        dibujarCartonHTML();
        return;
    }

    generarNuevaEstructuraCarton();
}

async function cargarPartidaGuardada() {
    const valorGuardado = localStorage.getItem(PARTIDA_KEY);
    if (!valorGuardado) {
        actualizarIdPartida();
        return;
    }

    const idGuardado = Number(valorGuardado);
    if (!Number.isInteger(idGuardado)) {
        actualizarIdPartida();
        return;
    }

    partidaActual = await buscarPartida(idGuardado);
    if (!partidaActual) localStorage.removeItem(PARTIDA_KEY);
    actualizarIdPartida();
}

function generarNuevaEstructuraCarton() {
    matrizCarton = Array.from({ length: 3 }, () => Array(9).fill(null));
    posicionesTachadas = [];

    for (let fila = 0; fila < 3; fila++) {
        const columnas = [];
        while (columnas.length < 5) {
            const columna = Math.floor(Math.random() * 9);
            if (!columnas.includes(columna)) columnas.push(columna);
        }
        columnas.forEach((columna) => {
            matrizCarton[fila][columna] = 0;
        });
    }

    for (let columna = 0; columna < 9; columna++) {
        if (!matrizCarton.some((fila) => fila[columna] === 0)) {
            matrizCarton[Math.floor(Math.random() * 3)][columna] = 0;
        }
    }

    for (let columna = 0; columna < 9; columna++) {
        const minimo = columna === 0 ? 1 : columna * 10;
        const maximo = columna === 8 ? 90 : (columna * 10) + 9;
        const filas = [];

        for (let fila = 0; fila < 3; fila++) {
            if (matrizCarton[fila][columna] === 0) filas.push(fila);
        }

        const numeros = [];
        while (numeros.length < filas.length) {
            const numero = Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
            if (!numeros.includes(numero)) numeros.push(numero);
        }
        numeros.sort((a, b) => a - b);
        filas.forEach((fila, indice) => {
            matrizCarton[fila][columna] = numeros[indice];
        });
    }

    guardarCarton();
    dibujarCartonHTML();
}

function guardarCarton() {
    localStorage.setItem(CARTON_KEY, JSON.stringify(matrizCarton));
    localStorage.setItem(MARKS_KEY, JSON.stringify(posicionesTachadas));
}

function dibujarCartonHTML() {
    const tabla = document.getElementById('tabla-carton');
    tabla.innerHTML = '';

    matrizCarton.forEach((fila, filaIndice) => {
        const filaHTML = document.createElement('tr');

        fila.forEach((valor, columnaIndice) => {
            const celda = document.createElement('td');
            if (valor === null) {
                celda.classList.add('sombreada');
            } else {
                celda.textContent = valor;
                if (posicionesTachadas.some((posicion) => posicion.f === filaIndice && posicion.c === columnaIndice)) {
                    celda.classList.add('marcado');
                }
                celda.addEventListener('click', () => tacharNumero(celda, filaIndice, columnaIndice));
            }
            filaHTML.appendChild(celda);
        });

        tabla.appendChild(filaHTML);
    });
}

async function tacharNumero(celda, fila, columna) {
    if (!partidaActual) {
        mostrarAlerta('Selecciona una partida antes de marcar numeros.');
        return;
    }

    const partida = await buscarPartida(partidaActual.id);
    if (!partida?.iniciada) {
        mostrarAlerta('La partida todavia no ha comenzado.');
        return;
    }

    partidaActual = partida;
    celda.classList.toggle('marcado');

    if (celda.classList.contains('marcado')) {
        posicionesTachadas.push({ f: fila, c: columna });
    } else {
        posicionesTachadas = posicionesTachadas.filter((posicion) => posicion.f !== fila || posicion.c !== columna);
    }
    guardarCarton();
}

async function solicitudCambioCarton() {
    if (!partidaActual) {
        generarNuevaEstructuraCarton();
        return;
    }

    const partida = await buscarPartida(partidaActual.id);
    if (!partida) return;

    partidaActual = partida;
    if (partida.iniciada) {
        mostrarAlerta('La partida ya esta comenzada y no se puede cambiar el carton.');
        return;
    }

    generarNuevaEstructuraCarton();
}

function solicitarLimpieza() {
    mostrarConfirmacion('¿Estas seguro de que quieres desmarcar todos los numeros?', () => {
        posicionesTachadas = [];
        guardarCarton();
        dibujarCartonHTML();
    });
}

function solicitarVolverPrincipal() {
    mostrarConfirmacion('¿Quieres volver a Games?', () => {
        window.location.href = '../games.html';
    });
}

function mostrarAyudaBingo() {
    mostrarAlerta('<strong>Como jugar al Bingo</strong><br><br>1. Selecciona el id indicado por el monitor.<br>2. Puedes cambiar de carton mientras la partida no este iniciada.<br>3. Cuando el monitor inicie la partida podras marcar los numeros cantados.<br>4. Limpiar solo desmarca los numeros de tu carton.');
}

function esDispositivoIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
        || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function estaInstaladaPwa() {
    const iniciadaDesdeManifest = new URLSearchParams(window.location.search).get('pwa') === '1';
    if (iniciadaDesdeManifest) sessionStorage.setItem('bingo_pwa_mode', '1');

    return iniciadaDesdeManifest
        || sessionStorage.getItem('bingo_pwa_mode') === '1'
        || window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.matchMedia('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true
        || document.referrer.startsWith('android-app://');
}

function actualizarNavegacionPwa() {
    const modoPwa = estaInstaladaPwa();
    document.body.classList.toggle('pwa-standalone', modoPwa);
    document.querySelectorAll('.hide-in-pwa').forEach((control) => {
        control.hidden = modoPwa;
    });
}

function actualizarBotonesInstalacionPwa() {
    const debenMostrarse = !estaInstaladaPwa() && (Boolean(instalacionPwaPendiente) || esDispositivoIos());
    document.querySelectorAll('.pwa-install-control').forEach((boton) => {
        boton.hidden = !debenMostrarse;
    });
}

async function solicitarInstalacionPwa() {
    cerrarMenuBingo();

    if (estaInstaladaPwa()) {
        actualizarBotonesInstalacionPwa();
        return;
    }

    if (esDispositivoIos()) {
        mostrarAlerta('<strong>Instalar aplicación en iOS</strong><br><br>1. Pulsa el botón Compartir de Safari.<br>2. Selecciona "Añadir a pantalla de inicio".<br>3. Confirma la instalación.');
        return;
    }

    if (!instalacionPwaPendiente) return;

    instalacionPwaPendiente.prompt();
    const resultado = await instalacionPwaPendiente.userChoice;
    instalacionPwaPendiente = null;
    if (resultado.outcome === 'accepted') actualizarBotonesInstalacionPwa();
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    instalacionPwaPendiente = event;
    actualizarBotonesInstalacionPwa();
});

window.addEventListener('appinstalled', () => {
    instalacionPwaPendiente = null;
    actualizarBotonesInstalacionPwa();
});

window.addEventListener('load', async () => {
    actualizarNavegacionPwa();
    inicializarMenuBingo();
    cargarCartonGuardado();
    await cargarPartidaGuardada();
    actualizarBotonesInstalacionPwa();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});
