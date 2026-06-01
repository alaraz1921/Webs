        const gameGrid = document.getElementById('gameGrid');
        const currentNumberDisplay = document.getElementById('currentNumber');
        const confirmModal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const winModal = document.getElementById('winModal');
        const instructionsModal = document.getElementById('instructionsModal');
        let board = Array(5).fill().map(() => Array(5).fill(0));
        let currentNumber = 1;
        let lastPosition = null;
        let confirmCallback = null;

        function createGrid() {
            gameGrid.innerHTML = '';
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const cell = document.createElement('div');
                    cell.classList.add('game-cell', 'bg-white');
                    cell.dataset.row = row;
                    cell.dataset.col = col;
                    cell.addEventListener('click', () => handleCellClick(row, col));
                    gameGrid.appendChild(cell);
                }
            }
        }

        function isValidMove(row, col) {
            if (currentNumber === 1) return true;
            if (!lastPosition) return false;
            const { row: lastRow, col: lastCol } = lastPosition;
            const rowDiff = Math.abs(row - lastRow);
            const colDiff = Math.abs(col - lastCol);
            if (rowDiff === 0 && colDiff === 3) return true; // Horizontal
            if (colDiff === 0 && rowDiff === 3) return true; // Vertical
            if (rowDiff === 2 && colDiff === 2) return true; // Diagonal
            return false;
        }

        function handleCellClick(row, col) {
            if (board[row][col] !== 0) return;
            if (!isValidMove(row, col)) return;
            board[row][col] = currentNumber;
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            cell.textContent = currentNumber;
            cell.classList.add('filled');
            cell.classList.add('valid');
            setTimeout(() => cell.classList.remove('valid'), 500);
            lastPosition = { row, col };
            currentNumber++;
            currentNumberDisplay.textContent = currentNumber;
            if (currentNumber > 25) {
                winModal.style.display = 'flex';
            }
        }

        function showConfirmModal(message, callback) {
            modalTitle.textContent = message;
            confirmModal.style.display = 'flex';
            confirmCallback = callback;
        }

        function resetGame() {
            showConfirmModal('¿Estás seguro de que quieres reiniciar el juego? Esto limpiará tu progreso.', () => {
                board = Array(5).fill().map(() => Array(5).fill(0));
                currentNumber = 1;
                lastPosition = null;
                currentNumberDisplay.textContent = currentNumber;
                createGrid();
                confirmModal.style.display = 'none';
            });
        }

        document.getElementById('resetButton').addEventListener('click', resetGame);
        document.getElementById('confirmYes').addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
        });
        document.getElementById('confirmNo').addEventListener('click', () => {
            confirmModal.style.display = 'none';
        });
        document.getElementById('winRestart').addEventListener('click', () => {
            board = Array(5).fill().map(() => Array(5).fill(0));
            currentNumber = 1;
            lastPosition = null;
            currentNumberDisplay.textContent = currentNumber;
            createGrid();
            winModal.style.display = 'none';
        });
        document.getElementById('instructionsButton').addEventListener('click', () => {
            instructionsModal.style.display = 'flex';
        });
        document.getElementById('instructionsClose').addEventListener('click', () => {
            instructionsModal.style.display = 'none';
        });

        createGrid();
