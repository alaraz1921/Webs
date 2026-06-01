        let numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
        let numerosCantados = [];
        let intervalo = null;
        let enMarcha = false;

        // Función para validar el PIN de entrada
        async function verificarPin() {
            const inputPin = document.getElementById('pinAcceso').value;
            const msgError = document.getElementById('msgError');
            msgError.style.display = 'none';

            const { data, error } = await window.websSupabase.rpc('validate_daily_access_code', {
                p_game_slug: 'bingo_monitor',
                p_access_code: inputPin
            });

            if (error) {
                msgError.textContent = 'No se pudo validar la clave. Inténtalo de nuevo.';
                msgError.style.display = 'block';
                return;
            }

            if (data === true) {
                // Si es correcto, desvanecemos la pantalla de bloqueo
                document.getElementById('pantallaLogin').style.display = 'none';
                // Inicializamos el panel de juego seguro
                inicializarPanel();
            } else {
                // Si falla, mostramos error y limpiamos el cuadro
                msgError.textContent = 'Clave diaria incorrecta. Inténtalo de nuevo.';
                msgError.style.display = 'block';
                document.getElementById('pinAcceso').value = '';
                document.getElementById('pinAcceso').focus();
            }
        }

        function inicializarPanel() {
            const tabla = document.getElementById('tabla-panel');
            tabla.innerHTML = '';
            let contador = 1;
            
            for (let f = 0; f < 9; f++) {
                let fila = document.createElement('tr');
                for (let c = 0; c < 10; c++) {
                    let celda = document.createElement('td');
                    celda.textContent = contador;
                    celda.id = 'bola-' + contador;
                    fila.appendChild(celda);
                    contador++;
                }
                tabla.appendChild(fila);
            }
        }

        function conmutarJuego() {
            const btn = document.getElementById('btnControl');
            if (!enMarcha) {
                enMarcha = true;
                btn.textContent = "Pausar";
                btn.className = "btn-pausar";
                sacarBola(); 
                intervalo = setInterval(sacarBola, 4000); 
            } else {
                enMarcha = false;
                btn.textContent = "Reanudar";
                btn.className = "btn-comenzar";
                clearInterval(intervalo);
            }
        }

        function sacarBola() {
            if (numerosDisponibles.length === 0) {
                clearInterval(intervalo);
                mostrarAlertaMonitor("Se han cantado los 90 n&uacute;meros. Fin de la partida.");
                return;
            }

            const actualBox = document.getElementById('bolaActual');
            const anteriorBox = document.getElementById('bolaAnterior');
            if (actualBox.textContent !== '--') {
                anteriorBox.textContent = actualBox.textContent;
            }

            let indiceAleatorio = Math.floor(Math.random() * numerosDisponibles.length);
            let bolaSacadada = numerosDisponibles.splice(indiceAleatorio, 1)[0];
            numerosCantados.push(bolaSacadada);

            actualBox.textContent = bolaSacadada;

            const celdaPanel = document.getElementById('bola-' + bolaSacadada);
            if (celdaPanel) celdaPanel.classList.add('cantado');
        }


        function mostrarConfirmacionMonitor(texto, callback) {
            document.getElementById('textoMonitorModalConfirm').innerHTML = texto;
            const modal = document.getElementById('monitorModalConfirm');
            modal.style.display = 'flex';

            document.getElementById('btnMonitorConfirmSi').onclick = function() {
                modal.style.display = 'none';
                callback();
            };
            document.getElementById('btnMonitorConfirmNo').onclick = function() {
                modal.style.display = 'none';
            };
        }

        function mostrarAlertaMonitor(texto) {
            document.getElementById('textoMonitorModalAlert').innerHTML = texto;
            document.getElementById('monitorModalAlert').style.display = 'flex';
        }

        function cerrarAlertaMonitor() {
            document.getElementById('monitorModalAlert').style.display = 'none';
        }

        function mostrarAyudaMonitor() {
            mostrarAlertaMonitor("<strong>Monitor de Bingo</strong><br><br>1. Accede con el PIN del monitor.<br>2. Pulsa Comenzar para cantar bolas automáticamente cada pocos segundos.<br>3. Usa Pausar o Reanudar para controlar la partida.<br>4. Validar Cartón calcula la contraclave que necesita un jugador para cambiar de cartón.<br>5. Limpiar reinicia todas las bolas cantadas y deja el monitor preparado para una nueva partida.");
        }

        function reiniciarTodo() {
            mostrarConfirmacionMonitor("&iquest;Seguro que quieres reiniciar el monitor? Se borrar&aacute;n todos los n&uacute;meros cantados.", function() {
                clearInterval(intervalo);
                enMarcha = false;
                numerosDisponibles = Array.from({length: 90}, (_, i) => i + 1);
                numerosCantados = [];
                document.getElementById('bolaActual').textContent = '--';
                document.getElementById('bolaAnterior').textContent = '--';
                document.getElementById('btnControl').textContent = "Comenzar";
                document.getElementById('btnControl').className = "btn-comenzar";
                document.getElementById('resultadoContraclave').textContent = '';
                document.getElementById('claveJugador').value = '';
                inicializarPanel();
            });
        }

        function alternarZonaValidar() {
            const zona = document.getElementById('zonaValidar');
            zona.style.display = (zona.style.display === 'block') ? 'none' : 'block';
        }

        function calcularContraclave() {
            let clave = parseInt(document.getElementById('claveJugador').value);
            if (isNaN(clave)) {
                mostrarAlertaMonitor("Por favor, introduce los 4 n&uacute;meros de la clave.");
                return;
            }
            let contraclave = ((clave * 3) + 7) % 10000;
            let contraclaveString = contraclave.toString().padStart(4, '0');
            
            document.getElementById('resultadoContraclave').textContent = "CONTRACLAVE: " + contraclaveString;
        }

        // Al arrancar, el foco se pone directamente en el cuadro de contraseña
        window.onload = function() {
            document.getElementById('pinAcceso').focus();
        };
