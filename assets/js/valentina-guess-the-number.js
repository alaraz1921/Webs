        const optionGrid = document.getElementById('optionGrid');
        const currentOperationDisplay = document.getElementById('currentOperation');
        const scoreDisplay = document.getElementById('score');
        const timerDisplay = document.getElementById('timer');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const winModal = document.getElementById('winModal');
        const winMessage = document.getElementById('winMessage');
        let currentOperation = { a: 0, b: 0, result: 0 };
        let score = 0;
        let startTime = null;
        let timerInterval = null;
        let confirmCallback = null;

        function showConfirmModal(message, callback) {
            modalTitle.textContent = message;
            confirmModal.style.display = 'flex';
            confirmCallback = callback;
        }

        function closeConfirmModal() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
        }

        function showWinModal() {
            const totalTime = getFormattedTime();
            winMessage.textContent = `Has acertado 10 operaciones en ${totalTime}. ¡Eres un genio de las multiplicaciones!`;
            winModal.style.display = 'flex';
        }

        function closeWinModal() {
            winModal.style.display = 'none';
        }

        function generateOperation() {
            const a = Math.floor(Math.random() * 9) + 1;
            const b = Math.floor(Math.random() * 9) + 1;
            currentOperation = { a, b, result: a * b };
            currentOperationDisplay.textContent = `Operación: ${a} × ? = ${a * b}`;
        }

        function generateOptions() {
            const options = new Set([currentOperation.b]);
            while (options.size < 4) {
                const num = Math.floor(Math.random() * 9) + 1;
                options.add(num);
            }
            return Array.from(options).sort(() => Math.random() - 0.5);
        }

        function createGrid() {
            optionGrid.innerHTML = '';
            const options = generateOptions();
            for (let i = 0; i < 4; i++) {
                const cell = document.createElement('div');
                cell.classList.add('game-cell', 'w-16', 'h-16', 'bg-white', 'border-2', 'border-gray-800', 'rounded-lg', 'flex', 'items-center', 'justify-center', 'text-xl', 'font-bold', 'text-gray-800');
                cell.textContent = options[i];
                cell.dataset.value = options[i];
                cell.addEventListener('click', () => handleCellClick(options[i]));
                optionGrid.appendChild(cell);
            }
        }

        function handleCellClick(value) {
            const cells = document.querySelectorAll('.game-cell');
            cells.forEach(cell => cell.classList.remove('correct', 'incorrect')); // Resetear todas las casillas
            const cell = document.querySelector(`[data-value="${value}"]`);
            if (parseInt(value) === currentOperation.b) {
                cell.classList.add('correct');
                if (score === 0) { // Iniciar timer en el primer acierto
                    startTime = Date.now();
                    timerInterval = setInterval(updateTimer, 1000);
                }
                score++;
                scoreDisplay.textContent = `Aciertos: ${score}/10`;
                if (score >= 10) {
                    clearInterval(timerInterval);
                    showWinModal();
                } else {
                    setTimeout(() => {
                        generateOperation();
                        createGrid();
                    }, 500);
                }
            } else {
                cell.classList.add('incorrect');
                setTimeout(() => cell.classList.remove('incorrect'), 500);
            }
        }

        function updateTimer() {
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerDisplay.textContent = `Tiempo: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        function getFormattedTime() {
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        function resetGame() {
            showConfirmModal('¿Estás seguro de que quieres reiniciar el juego? Esto limpiará tu progreso.', () => {
                score = 0;
                startTime = null;
                if (timerInterval) clearInterval(timerInterval);
                scoreDisplay.textContent = 'Aciertos: 0/10';
                timerDisplay.textContent = 'Tiempo: 0:00';
                generateOperation();
                createGrid();
                closeConfirmModal();
            });
        }

        document.getElementById('resetButton').addEventListener('click', resetGame);
        document.getElementById('confirmYes').addEventListener('click', () => confirmCallback && confirmCallback());
        document.getElementById('confirmNo').addEventListener('click', closeConfirmModal);
        document.getElementById('winRestart').addEventListener('click', () => {
            score = 0;
            startTime = null;
            if (timerInterval) clearInterval(timerInterval);
            scoreDisplay.textContent = 'Aciertos: 0/10';
            timerDisplay.textContent = 'Tiempo: 0:00';
            generateOperation();
            createGrid();
            closeWinModal();
        });

        generateOperation();
        createGrid();
