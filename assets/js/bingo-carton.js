        let juegoEmpezado = false;
        let bloqueadoPorSeguridad = false; // Controla si se requiere clave/contraclave
        let matrizCarton = [];
        let claveGenerada = 0;
        let posicionesTachadas = [];

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

            toggle.addEventListener('click', function(event) {
                event.stopPropagation();
                const estaAbierto = menu.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', estaAbierto ? 'true' : 'false');
            });

            document.addEventListener('click', function(event) {
                if (!event.target.closest('.bingo-top-menu')) {
                    cerrarMenuBingo();
                }
            });

            if (helpButton) {
                helpButton.addEventListener('click', function() {
                    cerrarMenuBingo();
                    mostrarAyudaBingo();
                });
            }
        }

        // MODALES WEB
        function mostrarConfirmacion(texto, callback) {
            document.getElementById('textoModalConfirm').innerHTML = texto;
            const modal = document.getElementById('miModalConfirm');
            modal.style.display = 'flex';
            
            document.getElementById('btnModalConfirmSi').onclick = function() {
                modal.style.display = 'none';
                callback();
            };
            document.getElementById('btnModalConfirmNo').onclick = function() {
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

        function mostrarAyudaBingo() {
            mostrarAlerta("<strong>Cómo jugar al Bingo</strong><br><br>1. Pulsa Empezar Partida cuando el monitor empiece a cantar bolas.<br>2. Toca en tu cartón los números que vayan saliendo.<br>3. Usa Limpiar Tachados si necesitas desmarcar todo.<br>4. Para cambiar de cartón, pide una contraclave al monitor: el cartón muestra una clave y el monitor calcula la contraclave.<br>5. Solo se genera un cartón nuevo cuando la contraclave es correcta.");
        }

        // CONTROL DE MEMORIA PERMANENTE
        function comprobarMemoriaOCrear() {
            const estadoGuardado = localStorage.getItem('bingo_perm_juegoEmpezado');
            const cartonGuardado = localStorage.getItem('bingo_perm_matrizCarton');
            const tachadosGuardados = localStorage.getItem('bingo_perm_tachados');
            const bloqueoGuardado = localStorage.getItem('bingo_perm_bloqueo');

            if (cartonGuardado) {
                matrizCarton = JSON.parse(cartonGuardado);
                juegoEmpezado = (estadoGuardado === 'true');
                bloqueadoPorSeguridad = (bloqueoGuardado === 'true');
                
                if (tachadosGuardados) {
                    posicionesTachadas = JSON.parse(tachadosGuardados);
                }
                dibujarCartonHTML();
                actualizarInterfazBotones();
            } else {
                bloqueadoPorSeguridad = false;
                localStorage.setItem('bingo_perm_bloqueo', 'false');
                generarNuevaEstructuraCarton();
            }
        }

        function generarNuevaEstructuraCarton() {
            matrizCarton = Array.from({ length: 3 }, () => Array(9).fill(null));
            posicionesTachadas = [];

            for (let f = 0; f < 3; f++) {
                let indicesColumnas = [];
                while (indicesColumnas.length < 5) {
                    let colAleatoria = Math.floor(Math.random() * 9);
                    if (!indicesColumnas.includes(colAleatoria)) {
                        indicesColumnas.push(colAleatoria);
                    }
                }
                indicesColumnas.forEach(c => matrizCarton[f][c] = 0);
            }

            for (let c = 0; c < 9; c++) {
                let tieneNumero = false;
                for (let f = 0; f < 3; f++) {
                    if (matrizCarton[f][c] === 0) tieneNumero = true;
                }
                if (!tieneNumero) {
                    let filaAleatoria = Math.floor(Math.random() * 3);
                    matrizCarton[filaAleatoria][c] = 0;
                }
            }

            for (let c = 0; c < 9; c++) {
                let cMin = (c === 0) ? 1 : c * 10;
                let cMax = (c === 8) ? 90 : (c * 10) + 9;

                let filasAAsignar = [];
                for (let f = 0; f < 3; f++) {
                    if (matrizCarton[f][c] === 0) filasAAsignar.push(f);
                }

                let numerosColumna = [];
                while (numerosColumna.length < filasAAsignar.length) {
                    let num = Math.floor(Math.random() * (cMax - cMin + 1)) + cMin;
                    if (!numerosColumna.includes(num)) numerosColumna.push(num);
                }
                numerosColumna.sort((a, b) => a - b);

                filasAAsignar.forEach((f, idx) => {
                    matrizCarton[f][c] = numerosColumna[idx];
                });
            }

            localStorage.setItem('bingo_perm_matrizCarton', JSON.stringify(matrizCarton));
            localStorage.setItem('bingo_perm_juegoEmpezado', juegoEmpezado ? 'true' : 'false');
            localStorage.setItem('bingo_perm_tachados', JSON.stringify(posicionesTachadas));

            dibujarCartonHTML();
            actualizarInterfazBotones();
        }

        function dibujarCartonHTML() {
            const tabla = document.getElementById('tabla-carton');
            tabla.innerHTML = '';

            for (let f = 0; f < 3; f++) {
                let filaHTML = document.createElement('tr');
                for (let c = 0; c < 9; c++) {
                    let celda = document.createElement('td');
                    let valor = matrizCarton[f][c];
                    
                    if (valor === null) {
                        celda.classList.add('sombreada');
                    } else {
                        celda.textContent = valor;
                        
                        let yaTachada = posicionesTachadas.some(p => p.f === f && p.c === c);
                        if (yaTachada) {
                            celda.classList.add('marcado');
                        }

                        celda.onclick = () => tacharNumero(celda, f, c);
                    }
                    filaHTML.appendChild(celda);
                }
                tabla.appendChild(filaHTML);
            }
        }

        function tacharNumero(celda, fila, col) {
            if (!juegoEmpezado) return; 
            
            celda.classList.toggle('marcado');

            if (celda.classList.contains('marcado')) {
                posicionesTachadas.push({f: fila, c: col});
            } else {
                posicionesTachadas = posicionesTachadas.filter(p => !(p.f === fila && p.c === col));
            }
            localStorage.setItem('bingo_perm_tachados', JSON.stringify(posicionesTachadas));
        }

        function conmutarEstadoJuego() {
            if (!juegoEmpezado) {
                // SE INICIA LA PARTIDA
                juegoEmpezado = true;
                bloqueadoPorSeguridad = true; // A partir de este momento, si se cancela o termina, requerirá clave
                localStorage.setItem('bingo_perm_juegoEmpezado', 'true');
                localStorage.setItem('bingo_perm_bloqueo', 'true');
                document.getElementById('zonaCambio').style.display = 'none';
                actualizarInterfazBotones();
            } else {
                // SE TERMINA LA PARTIDA
                mostrarConfirmacion("&iquest;Est&aacute;s seguro de que quieres terminar la partida actual? El cart&oacute;n quedar&aacute; bloqueado hasta que el monitor lo valide.", function() {
                    juegoEmpezado = false;
                    localStorage.setItem('bingo_perm_juegoEmpezado', 'false');
                    actualizarInterfazBotones();
                });
            }
        }

        function actualizarInterfazBotones() {
            const btnAccion = document.getElementById('btnAccion');
            const btnCambiar = document.getElementById('btnCambiar');

            if (juegoEmpezado) {
                btnAccion.textContent = "Terminar Partida";
                btnAccion.className = "btn-terminar";
            } else {
                btnAccion.textContent = "Empezar Partida";
                btnAccion.className = "btn-empezar";
            }
            btnCambiar.disabled = false;
        }

        // FUNCI&Oacute;N DEL BOT&Oacute;N "CAMBIAR CART&Oacute;N"
        function solicitudCambioCarton() {
            mostrarZonaCambio();
        }

        function mostrarZonaCambio() {
            claveGenerada = Math.floor(1000 + Math.random() * 9000);
            document.getElementById('txtClave').textContent = claveGenerada;
            document.getElementById('inputContraclave').value = '';
            document.getElementById('zonaCambio').style.display = 'block';
            document.getElementById('inputContraclave').focus();
        }

        function procesarCambioCarton() {
            const inputElement = document.getElementById('inputContraclave');
            let input = parseInt(inputElement.value);
            let contraclaveCorrecta = ((claveGenerada * 3) + 7) % 10000;

            if (input === contraclaveCorrecta) {
                mostrarAlerta("&iexcl;Contraclave v&aacute;lida! Se ha cambiado el cart&oacute;n.");

                // El cambio validado cierra la partida actual y deja listo el nuevo carton.
                juegoEmpezado = false;
                bloqueadoPorSeguridad = false;
                localStorage.setItem('bingo_perm_juegoEmpezado', 'false');
                localStorage.setItem('bingo_perm_bloqueo', 'false');

                // Resetear por completo la interfaz del panel de contraclaves
                document.getElementById('zonaCambio').style.display = 'none';
                inputElement.value = ''; 
                document.getElementById('txtClave').textContent = '0000';
                
                // Generar el primer cambio de cart&oacute;n de esta nueva etapa de libertad
                generarNuevaEstructuraCarton();
            } else {
                mostrarAlerta("Contraclave incorrecta. P&iacute;desela al monitor.");
            }
        }

        function solicitarLimpieza() {
            mostrarConfirmacion("&iquest;Est&aacute;s seguro de que quieres desmarcar todos los n&uacute;meros tildados?", function() {
                posicionesTachadas = [];
                localStorage.setItem('bingo_perm_tachados', JSON.stringify([]));
                const marcados = document.querySelectorAll('.marcado');
                marcados.forEach(c => c.classList.remove('marcado'));
            });
        }

        window.onload = function() {
            inicializarMenuBingo();
            comprobarMemoriaOCrear();
        };
