        const LUGARES = ["Banco", "Banda", "Cabo", "Planta", "Esposa", "Gato", "Cura", "Coche", "Estación", "Bisturí", 
    "Gemelos", "Batería", "Carta", "Cuadro", "Corona", "Línea", "Marco", "Órgano", "Impresora", "Radio", 
    "Sierra", "Escuela", "Policía", "Hospital", "Gimnasio", "Ratón", "Vela", "Hoja", "Pluma", "Teclado", 
    "Terminal", "Sirena", "Espía", "Bolsa", "Paso", "Barrera", "Piquete", "Caja", "Campaña", "Fórmula", 
    "Taller", "Prensa", "Corte", "Mesa", "Red", "Portero", "Frente", "Capital", "Asilo", "Canal", 
    "Casco", "Maleta", "Militar", "Profesor", "Informático", "Nave", "Destilería", "Cámara", "Estudio", "Bazar", 
    "Cerradura", "Palomita", "Minero", "Pala", "Gato hidráulico", "Balanza", "Espejo", "Estrella", "Granja", "Faro", 
    "Teatro", "Circo", "Clínica", "Fábrica", "Puerto", "Aeropuerto", "Aduana", "Embajada", "Notaría", "Juzgado", 
    "Prisión", "Laboratorio", "Archivo", "Almacén", "Biblioteca", "Museo", "Refugio", "Cabaña", "Palacio", "Fuerte", 
    "Trinchera", "Frontera", "Peaje", "Taquilla", "Quiosco", "Grúa", "Andamio", "Tanque", "Cable", "Brújula"];
        
        let jugadores = [];
        let roles = {}; 
        let impostoresAsignados = [];
        let jugadorActualIndex = 0;
        let lugarSecreto = "";
        let faseActual = "BLOQUEO";

        // Inicializar desplegable de jugadores
        const selectP = document.getElementById('totalPlayers');
        for(let i=3; i<=20; i++) {
            let opt = document.createElement('option');
            opt.value = i; opt.textContent = i + " Jugadores";
            selectP.appendChild(opt);
        }

        window.onload = function() {
            comprobarExpiracionTiempo();
            cargarEstadoJuego();
        };

        function comprobarExpiracionTiempo() {
            const loginTimestamp = localStorage.getItem('impostor_login_time');
            if (loginTimestamp) {
                const cincoHorasEnMs = 5 * 60 * 60 * 1000;
                if (Date.now() - parseInt(loginTimestamp) > cincoHorasEnMs) {
                    reiniciarTodoSistema();
                }
            }
        }

        function guardarEstadoJuego() {
            localStorage.setItem('impostor_fase', faseActual);
            localStorage.setItem('impostor_jugadores', JSON.stringify(jugadores));
            localStorage.setItem('impostor_roles', JSON.stringify(roles));
            localStorage.setItem('impostor_impostoresAsignados', JSON.stringify(impostoresAsignados));
            localStorage.setItem('impostor_jugadorActualIndex', jugadorActualIndex);
            localStorage.setItem('impostor_lugarSecreto', lugarSecreto);
            guardarConfiguracionBase();
        }

        function guardarConfiguracionBase() {
            localStorage.setItem('impostor_config_total', document.getElementById('totalPlayers').value);
            localStorage.setItem('impostor_config_imps', document.getElementById('totalImpostors').value);
        }

        function cargarEstadoJuego() {
            const sesionActiva = localStorage.getItem('impostor_login_time');
            if (!sesionActiva) return;

            faseActual = localStorage.getItem('impostor_fase') || "CONFIGURACION";
            
            if(localStorage.getItem('impostor_config_total')) document.getElementById('totalPlayers').value = localStorage.getItem('impostor_config_total');
            if(localStorage.getItem('impostor_config_imps')) document.getElementById('totalImpostors').value = localStorage.getItem('impostor_config_imps');

            if (faseActual === "BLOQUEO") {
                cambiarPantallaVisual('screen-lock');
            } else if (faseActual === "CONFIGURACION") {
                cambiarPantallaVisual('screen-config');
            } else {
                jugadores = JSON.parse(localStorage.getItem('impostor_jugadores')) || [];
                roles = JSON.parse(localStorage.getItem('impostor_roles')) || {};
                impostoresAsignados = JSON.parse(localStorage.getItem('impostor_impostoresAsignados')) || [];
                jugadorActualIndex = parseInt(localStorage.getItem('impostor_jugadorActualIndex')) || 0;
                lugarSecreto = localStorage.getItem('impostor_lugarSecreto') || "";

                if (faseActual === "REPARTO") {
                    prepararTurnoJugador();
                    cambiarPantallaVisual('screen-draw');
                } else if (faseActual === "PARTIDA") {
                    prepararPantallaResolucion();
                    cambiarPantallaVisual('screen-game');
                }
            }
        }

        // CONTROL DE MODALES
        function abrirModal(titulo, mensaje, esFinPartida = false) {
            document.getElementById('modal-title').textContent = titulo;
            document.getElementById('modal-message').textContent = mensaje;
            
            const btnContenedor = document.getElementById('modal-buttons');
            btnContenedor.innerHTML = ""; 

            if (esFinPartida) {
                const btnMismos = document.createElement('button');
                btnMismos.textContent = "Repetir (Mismos Jugadores)";
                btnMismos.onclick = function() {
                    cerrarModal();
                    reiniciarMismosJugadores();
                };
                
                const btnTodo = document.createElement('button');
                btnTodo.textContent = "Reiniciar todo desde cero";
                btnTodo.className = "btn-danger";
                btnTodo.onclick = function() {
                    cerrarModal();
                    reiniciarTodoSistema();
                };

                btnContenedor.appendChild(btnMismos);
                btnContenedor.appendChild(btnTodo);
            } else {
                const btnCerrar = document.createElement('button');
                btnCerrar.textContent = "Entendido";
                btnCerrar.onclick = cerrarModal;
                btnContenedor.appendChild(btnCerrar);
            }

            document.getElementById('custom-modal').style.display = 'flex';
        }

        function cerrarModal() {
            document.getElementById('custom-modal').style.display = 'none';
        }

        function mostrarAyudaImpostor() {
            abrirModal(
                "Ayuda de El Infiltrado",
                "1. Configura cuántos jugadores e infiltrados participan.\n2. Cada jugador mira su rol manteniendo pulsado el recuadro, sin enseñarlo a los demás.\n3. Los jugadores normales ven el lugar secreto. Los infiltrados no lo conocen.\n4. Durante el debate, todos intentan descubrir a los infiltrados sin revelar demasiado.\n5. Al resolver, seleccionad los nombres de los infiltrados. Si acertáis todos, ganáis."
            );
        }

        // ACCESO
        async function verificarClave() {
            const input = document.getElementById('pinInput').value;
            const { data, error } = await window.websSupabase.rpc('validate_daily_access_code', {
                p_game_slug: 'impostor',
                p_access_code: input
            });

            if (error) {
                abrirModal("Error de conexión", "No se pudo validar la clave. Inténtalo de nuevo.");
                return;
            }

            if (data === true) {
                localStorage.setItem('impostor_login_time', Date.now()); 
                faseActual = "CONFIGURACION";
                guardarEstadoJuego();
                cambiarPantallaVisual('screen-config');
            } else {
                abrirModal("⚠️ Acceso Denegado", "La clave introducida es incorrecta.");
            }
        }

        function cambiarPantallaVisual(idPantalla) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById(idPantalla).classList.add('active');
        }

        // CONFIGURACIÓN Y LÓGICA
        function generarInputsNombres() {
            const num = document.getElementById('totalPlayers').value;
            const container = document.getElementById('container-names');
            container.innerHTML = "<h3>Introduce los nombres:</h3>";
            
            for(let i=1; i<=num; i++) {
                container.innerHTML += `<input type="text" class="player-name-input" placeholder="Jugador ${i}" required>`;
            }
            document.getElementById('btn-continue').style.display = 'none';
            document.getElementById('btn-start').style.display = 'block';
        }

        function iniciarSorteo() {
            const inputs = document.querySelectorAll('.player-name-input');
            if (inputs.length > 0) {
                jugadores = Array.from(inputs).map(inp => inp.value.trim() || inp.placeholder);
            }
            ejecutarMezclaYAsignacion();
        }

        function ejecutarMezclaYAsignacion() {
            const numImpostores = parseInt(document.getElementById('totalImpostors').value);
            
            if (numImpostores >= jugadores.length) {
                abrirModal("Configuración Errónea", "No puede haber igual o más infiltrados que jugadores.");
                return;
            }

            lugarSecreto = LUGARES[Math.floor(Math.random() * LUGARES.length)];
            let copiaJugadores = [...jugadores];
            impostoresAsignados = [];
            
            for(let i=0; i<numImpostores; i++) {
                let index = Math.floor(Math.random() * copiaJugadores.length);
                impostoresAsignados.push(copiaJugadores.splice(index, 1)[0]);
            }

            roles = {};
            jugadores.forEach(j => {
                roles[j] = impostoresAsignados.includes(j) ? "Eres el INFILTRADO 🏴‍☠️" : `Lugar: ${lugarSecreto} 🏙️`;
            });

            jugadorActualIndex = 0;
            faseActual = "REPARTO";
            guardarEstadoJuego();
            prepararTurnoJugador();
            cambiarPantallaVisual('screen-draw');
        }

        function prepararTurnoJugador() {
            document.getElementById('player-turn-name').textContent = "Turno de: " + jugadores[jugadorActualIndex];
            document.getElementById('reveal-area').textContent = "MANTÉN PULSADO PARA VER";
            
            const btnNext = document.getElementById('btn-next-player');
            if (jugadorActualIndex === jugadores.length - 1) {
                btnNext.textContent = "Comenzar Partida";
            } else {
                btnNext.textContent = "Siguiente Jugador";
            }
        }

        function mostrarRol() {
            const nombre = jugadores[jugadorActualIndex];
            document.getElementById('reveal-area').textContent = roles[nombre];
        }

        function ocultarRol() {
            document.getElementById('reveal-area').textContent = "MANTÉN PULSADO PARA VER";
        }

        function siguienteJugador() {
            if (jugadorActualIndex < jugadores.length - 1) {
                jugadorActualIndex++;
                localStorage.setItem('impostor_jugadorActualIndex', jugadorActualIndex);
                prepararTurnoJugador();
            } else {
                faseActual = "PARTIDA";
                guardarEstadoJuego();
                prepararPantallaResolucion();
                cambiarPantallaVisual('screen-game');
            }
        }

        function prepararPantallaResolucion() {
            const contenedorEval = document.getElementById('impostor-inputs-evaluation');
            contenedorEval.innerHTML = "";
            const numImpostores = impostoresAsignados.length;
            for(let i=1; i<=numImpostores; i++) {
                const select = document.createElement('select');
                select.className = 'guess-impostor';
                select.setAttribute('aria-label', `Nombre del Infiltrado ${i}`);

                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = `Selecciona infiltrado ${i}`;
                select.appendChild(emptyOption);

                jugadores.forEach(nombre => {
                    const option = document.createElement('option');
                    option.value = nombre;
                    option.textContent = nombre;
                    select.appendChild(option);
                });

                contenedorEval.appendChild(select);
            }
        }

        function evaluarImpostores() {
            const inputs = document.querySelectorAll('.guess-impostor');
            const respuestas = Array.from(inputs).map(inp => inp.value.trim().toLowerCase()).filter(Boolean);
            const correctos = impostoresAsignados.map(imp => imp.toLowerCase());

            const aciertoTotal = correctos.every(imp => respuestas.includes(imp)) && respuestas.length === correctos.length;

            if (aciertoTotal) {
                abrirModal("🎉 ¡VICTORIA TOTAL!", "¡Felicidades! Habéis descubierto a todos los infiltrados: " + impostoresAsignados.join(' y ') + ".", true);
            } else {
                abrirModal("❌ Fallo", "Esos no son los infiltrados (o falta alguno por escribir). ¡Seguid debatiendo!");
            }
        }

        function rendirse() {
            abrirModal("🏳️ Partida Terminada", "Os habéis rendido. Los infiltrados eran: " + impostoresAsignados.join(' y ') + `. El lugar secreto era: ${lugarSecreto}.`, true);
        }

        function reiniciarMismosJugadores() {
            ejecutarMezclaYAsignacion();
        }

        function limpiarDatosImpostor() {
            Object.keys(localStorage)
                .filter(clave => clave.startsWith('impostor_'))
                .forEach(clave => localStorage.removeItem(clave));
        }

        function reiniciarTodoSistema() {
            limpiarDatosImpostor();
            jugadores = [];
            roles = {};
            impostoresAsignados = [];
            jugadorActualIndex = 0;
            lugarSecreto = "";
            faseActual = "BLOQUEO";
            
            document.getElementById('pinInput').value = "";
            document.getElementById('container-names').innerHTML = "";
            document.getElementById('btn-continue').style.display = 'block';
            document.getElementById('btn-start').style.display = 'none';
            
            cambiarPantallaVisual('screen-lock');
        }
