        const gameGrid = document.getElementById('gameGrid');
        const statusDisplay = document.getElementById('status');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const winModal = document.getElementById('winModal');
        const winMessage = document.getElementById('winMessage');
        let board = Array(6).fill().map(() => Array(7).fill(0));
        let currentPlayer = 1;
        let gameActive = true;
        let confirmCallback = null;

        function createGrid() {
            gameGrid.innerHTML = '';
            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 7; col++) {
                    const cell = document.createElement('div');
                    cell.classList.add('w-12', 'h-12', 'bg-white', 'rounded-full', 'border-2', 'border-gray-800');
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    cell.addEventListener('click', () => handleCellClick(col));
                    gameGrid.appendChild(cell);
                }
            }
        }

        function handleCellClick(col) {
            if (!gameActive) return;
            for (let row = 5; row >= 0; row--) {
                if (board[row][col] === 0) {
                    board[row][col] = currentPlayer;
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    cell.classList.add(currentPlayer === 1 ? 'bg-red-500' : 'bg-blue-600');
                    if (checkWin(row, col)) {
                        gameActive = false;
                        showWinModal(`¡Jugador ${currentPlayer} (${currentPlayer === 1 ? 'Rojo' : 'Azul'}) gana!`);
                    } else if (board.flat().every(cell => cell !== 0)) {
                        gameActive = false;
                        showWinModal('¡Empate!');
                    } else {
                        currentPlayer = currentPlayer === 1 ? 2 : 1;
                        statusDisplay.textContent = `Turno: Jugador ${currentPlayer} (${currentPlayer === 1 ? 'Rojo' : 'Azul'})`;
                    }
                    break;
                }
            }
        }

        function checkWin(row, col) {
            const directions = [
                [0, 1], [1, 0], [1, 1], [1, -1]
            ];
            for (let [dr, dc] of directions) {
                let count = 1;
                for (let i = 1; i <= 3; i++) {
                    const r = row + i * dr;
                    const c = col + i * dc;
                    if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === currentPlayer) {
                        count++;
                    } else {
                        break;
                    }
                }
                for (let i = 1; i <= 3; i++) {
                    const r = row - i * dr;
                    const c = col - i * dc;
                    if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === currentPlayer) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count >= 4) return true;
            }
            return false;
        }

        function showConfirmModal(message, callback) {
            modalTitle.textContent = message;
            confirmModal.style.display = 'flex';
            confirmCallback = callback;
        }

        function closeConfirmModal() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
        }

        function showWinModal(message) {
            winMessage.textContent = message;
            winModal.style.display = 'flex';
        }

        function closeWinModal() {
            winModal.style.display = 'none';
        }

        function resetGame() {
            showConfirmModal('¿Estás seguro de que quieres reiniciar el juego?', () => {
                board = Array(6).fill().map(() => Array(7).fill(0));
                currentPlayer = 1;
                gameActive = true;
                statusDisplay.textContent = `Turno: Jugador ${currentPlayer} (Rojo)`;
                createGrid();
                closeConfirmModal();
            });
        }

        document.getElementById('resetButton').addEventListener('click', resetGame);
        document.getElementById('confirmYes').addEventListener('click', () => confirmCallback && confirmCallback());
        document.getElementById('confirmNo').addEventListener('click', closeConfirmModal);
        document.getElementById('winRestart').addEventListener('click', () => {
            resetGame();
            closeWinModal();
        });

        createGrid();
