        const gameGrid = document.getElementById('gameGrid');
        const currentMultiplicationDisplay = document.getElementById('currentMultiplication');
        const scoreDisplay = document.getElementById('score');
        const timerDisplay = document.getElementById('timer');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const winModal = document.getElementById('winModal');
        const winMessage = document.getElementById('winMessage');
        let board = Array(2).fill().map(() => Array(3).fill(0));
        let currentMultiplication = { a: 0, b: 0, result: 0 };
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
            winMessage.textContent = `Has acertado 10 multiplicaciones en ${totalTime}. ¡Eres un genio!`;
            winModal.style.display = 'flex';
        }

        function closeWinModal() {
            winModal.style.display = 'none';
        }

        function generateMultiplication() {
            const a = Math.floor(Math.random() * 10) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            currentMultiplication = { a, b, result: a * b };
            currentMultiplicationDisplay.textContent = `Multiplicación: ${a} × ${b} = ?`;
        }

        function generateBoard() {
            const numbers = new Set([currentMultiplication.result]);
            while (numbers.size < 6) {
                const a = Math.floor(Math.random() * 10) + 1;
                const b = Math.floor(Math.random() * 10) + 1;
                numbers.add(a * b);
            }
            const numberArray = Array.from(numbers).sort(() => Math.random() - 0.5);
            let index = 0;
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    board[row][col] = numberArray[index++];
                }
            }
        }

        function createGrid() {
            gameGrid.innerHTML = '';
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 3; col++) {
                    const cell = document.createElement('div');
                    cell.classList.add('game-cell', 'w-16', 'h-16', 'bg-white', 'border-2', 'border-gray-800', 'rounded-lg', 'flex', 'items-center', 'justify-center', 'text-xl', 'font-bold', 'text-gray-800');
                    cell.textContent = board[row][col];
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    cell.addEventListener('click', () => handleCellClick(row, col));
                    gameGrid.appendChild(cell);
                }
            }
        }

        function handleCellClick(row, col) {
            const cells = document.querySelectorAll('.game-cell');
            cells.forEach(cell => cell.classList.remove('correct', 'incorrect')); // Resetear todas las casillas
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (board[row][col] === currentMultiplication.result) {
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
                        generateMultiplication();
                        generateBoard();
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
                generateMultiplication();
                generateBoard();
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
            generateMultiplication();
            generateBoard();
            createGrid();
            closeWinModal();
        });

        generateMultiplication();
        generateBoard();
        createGrid();
